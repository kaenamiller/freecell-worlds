// Player accounts: sign-in (Google, or email + password), the account modal, and the
// sync engine (js/sync.js). The API lives at api.freecellworlds.com (server/).
import { createSync } from './sync.js';

const host = location.hostname;
const local = host === 'localhost' || host === '127.0.0.1' || host === '::1';
const staging = host === 'staging.freecellworlds.com';
// Staging uses Cloudflare's always-pass Turnstile test site key, paired with the test
// secret in wrangler [env.staging.vars]. Production needs the real widget site key.
const CONFIG = local
  ? { api: `http://${host === '127.0.0.1' ? '127.0.0.1' : 'localhost'}:8787`, turnstileSiteKey: '1x00000000000000000000AA' }
  : staging
    ? { api: 'https://api-staging.freecellworlds.com', turnstileSiteKey: '1x00000000000000000000AA' }
    : { api: 'https://api.freecellworlds.com', turnstileSiteKey: '0x4AAAAAAA_REPLACE_ME' };

const APP_URL = location.origin + location.pathname;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const API_URL = CONFIG.api;

export async function api(path, { method = 'GET', body, captcha, keepalive } = {}) {
  try {
    const res = await fetch(CONFIG.api + path, {
      method,
      credentials: 'include',
      keepalive,
      headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(captcha && { 'x-captcha-response': captcha }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  } catch {
    return { status: 0, json: null }; // offline or API unreachable
  }
}

// Better Auth error codes, in words a player can act on.
const MESSAGES = {
  INVALID_EMAIL_OR_PASSWORD: 'That email and password don’t match.',
  EMAIL_NOT_VERIFIED: 'Confirm your email first. We’ve sent the link again.',
  USER_ALREADY_EXISTS: 'An account with that email already exists. Sign in instead.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'An account with that email already exists. Sign in instead.',
  PASSWORD_TOO_SHORT: 'Use at least 8 characters.',
  PASSWORD_TOO_LONG: 'That password is too long.',
  INVALID_EMAIL: 'Check the email address.',
  INVALID_TOKEN: 'That link has expired. Request a new one.',
  SESSION_EXPIRED: 'For your security, sign out and sign back in, then try again.',
  MISSING_RESPONSE: 'Please complete the human check.',
  VERIFICATION_FAILED: 'The human check failed. Please try again.',
  account_not_linked:
    'This email has a password sign-up that hasn’t been confirmed. Open the confirmation email we sent, or try Google again tomorrow.',
};
const errorText = (res) =>
  res.status === 0
    ? 'Can’t reach the server. Check your connection and try again.'
    : res.status === 429 && !res.json?.code
      ? 'Too many attempts. Wait a minute and try again.'
      : MESSAGES[res.json?.code] || res.json?.message || 'Something went wrong. Please try again.';

// --- Cloudflare Turnstile (human check on the password forms) ------------------------
let turnstileReady;
function loadTurnstile() {
  turnstileReady ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve(window.turnstile);
    s.onerror = () => { turnstileReady = null; reject(new Error('turnstile')); };
    document.head.appendChild(s);
  });
  return turnstileReady;
}

// Renders a widget into `el`; `token()` returns the current answer (tokens are single-use).
function humanCheck(el) {
  let token = '';
  let id = null;
  loadTurnstile()
    .then((ts) => {
      if (!el.isConnected) return;
      id = ts.render(el, {
        sitekey: CONFIG.turnstileSiteKey,
        theme: 'dark',
        size: 'flexible',
        callback: (t) => (token = t),
        'expired-callback': () => (token = ''),
        'error-callback': () => (token = ''),
      });
    })
    .catch(() => (el.textContent = 'The human check couldn’t load. Check your connection or content blocker.'));
  return {
    token: () => token,
    reset: () => {
      token = '';
      if (id != null) window.turnstile?.reset(id);
    },
  };
}

// --- account state and modal ------------------------------------------------------------
export function initAccount({ ui, onRemote, canReplaceSession, onUser = () => {} }) {
  const state = { user: null, tokens: 0, google: false, view: 'signin', email: '', resetToken: '', syncing: false, lastSync: 0, error: '' };
  const sync = createSync({ api, onRemote, canReplaceSession });
  const body = $('#account-body');
  const titleBtn = $('#btn-title-account');

  const refreshButton = () => {
    titleBtn.textContent = state.user ? state.user.name || 'Account' : 'Sign in';
    titleBtn.classList.toggle('signed-in', !!state.user);
  };

  async function runSync(fn) {
    state.syncing = true;
    if (state.view === 'account') render();
    await fn();
    state.syncing = false;
    state.lastSync = Date.now();
    if (state.view === 'account') render();
  }

  async function signedIn(user, { announce } = {}) {
    state.user = user;
    state.view = 'account';
    refreshButton();
    onUser(user);
    await runSync(() => sync.start(user));
    const me = await api('/v1/me');
    if (me.status === 200) state.tokens = me.json.tokens;
    if (announce) ui.toast('✓', announce, `Your progress now saves to ${esc(user.email)}.`);
    render();
  }

  function signedOut() {
    state.user = null;
    state.view = 'signin';
    sync.stop();
    refreshButton();
    onUser(null);
  }

  const open = (view, error = '') => {
    if (view) state.view = view;
    state.error = error;
    render();
    ui.openModal('modal-account');
  };

  // Shared submit handling: disable the form, show errors inline, reset the human check.
  function wireForm(form, check, submit) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      const err = form.querySelector('.account-error');
      btn.disabled = true;
      err.textContent = '';
      const data = Object.fromEntries(new FormData(form));
      try {
        const msg = await submit(data, check?.token());
        if (msg) err.textContent = msg;
      } finally {
        btn.disabled = false;
        check?.reset();
      }
    });
  }

  const googleButton = `<button type="button" class="btn account-google" id="account-google"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"/><path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/><path d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z"/><path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z"/></svg>Continue with Google</button>`;
  const googleBlock = () => (state.google ? `${googleButton}<div class="account-or"><span>or use email</span></div>` : '');

  const views = {
    signin: () => `
      <p class="account-lead">Sign in to save your stats, settings and Voyage runs to your account and pick them up on any device. Playing without an account still works.</p>
      ${googleBlock()}
      <div class="account-tabs" role="tablist">
        <button type="button" role="tab" class="btn${state.view === 'signin' ? ' active' : ''}" data-view="signin" aria-selected="${state.view === 'signin'}">Sign in</button>
        <button type="button" role="tab" class="btn${state.view === 'signup' ? ' active' : ''}" data-view="signup" aria-selected="${state.view === 'signup'}">Create account</button>
      </div>
      <form class="account-form" id="account-form" novalidate>
        <label>Email<input name="email" type="email" autocomplete="email" required value="${esc(state.email)}" /></label>
        <label>Password<input name="password" type="password" autocomplete="${state.view === 'signup' ? 'new-password' : 'current-password'}" required minlength="8" maxlength="128" /></label>
        ${state.view === 'signup' ? '<p class="account-note">At least 8 characters. We check new passwords against known data breaches.</p>' : ''}
        <div class="account-captcha"></div>
        <p class="account-error" role="alert">${esc(state.error)}</p>
        <button type="submit" class="btn primary">${state.view === 'signup' ? 'Create account' : 'Sign in'}</button>
        ${state.view === 'signin' ? '<button type="button" class="link" data-view="forgot">Forgot password?</button>' : ''}
      </form>
      ${state.view === 'signup' ? '<p class="account-note">By creating an account you agree to the <a href="terms/">Terms</a> and <a href="privacy/">Privacy Policy</a>. Accounts are for ages 13 and up.</p>' : ''}`,
    checkEmail: () => `
      <p class="account-lead">We sent a confirmation link to <strong>${esc(state.email)}</strong>. Open it on this device to finish signing in. It expires in 24 hours.</p>
      <form class="account-form" id="account-form">
        <div class="account-captcha"></div>
        <p class="account-error" role="alert"></p>
        <button type="submit" class="btn">Send the link again</button>
        <button type="button" class="link" data-view="signin">Back to sign in</button>
      </form>`,
    forgot: () => `
      <p class="account-lead">Enter your email and we’ll send a link to choose a new password.</p>
      <form class="account-form" id="account-form" novalidate>
        <label>Email<input name="email" type="email" autocomplete="email" required value="${esc(state.email)}" /></label>
        <div class="account-captcha"></div>
        <p class="account-error" role="alert"></p>
        <button type="submit" class="btn primary">Send reset link</button>
        <button type="button" class="link" data-view="signin">Back to sign in</button>
      </form>`,
    forgotSent: () => `
      <p class="account-lead">If an account uses <strong>${esc(state.email)}</strong>, a reset link is on its way. It expires in one hour.</p>
      <button type="button" class="btn" data-view="signin">Back to sign in</button>`,
    reset: () => `
      <p class="account-lead">Choose a new password. You’ll be signed out everywhere else.</p>
      <form class="account-form" id="account-form" novalidate>
        <label>New password<input name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="128" /></label>
        <label>Repeat it<input name="confirm" type="password" autocomplete="new-password" required /></label>
        <p class="account-error" role="alert">${esc(state.error)}</p>
        <button type="submit" class="btn primary">Save password</button>
      </form>`,
    account: () => {
      const u = state.user;
      const status = state.syncing ? 'Syncing…' : state.lastSync ? `Synced at ${new Date(state.lastSync).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Not synced yet';
      return `
      <div class="account-who">
        ${u.image ? `<img src="${esc(u.image)}" alt="" referrerpolicy="no-referrer" />` : `<span class="account-initial" aria-hidden="true">${esc((u.name || u.email)[0].toUpperCase())}</span>`}
        <div><strong>${esc(u.name || u.email)}</strong><small>${esc(u.email)}</small></div>
      </div>
      <p class="account-sync" aria-live="polite">${status}</p>
      <h4>Theme Tokens</h4>
      <p class="account-note">${state.tokens} token${state.tokens === 1 ? '' : 's'}. Each one makes a table theme of your own.</p>
      <div class="account-actions"><button type="button" class="btn" id="account-create-theme">Create a theme</button></div>
      <h4>Your data</h4>
      <div class="account-actions">
        <button type="button" class="btn" id="account-sync">Sync now</button>
        <button type="button" class="btn" id="account-export">Download my data</button>
        <button type="button" class="btn" id="account-signout">Sign out</button>
      </div>
      <p class="account-error" role="alert">${esc(state.error)}</p>
      <details class="account-danger">
        <summary>Delete account</summary>
        <p class="account-note">This permanently deletes your profile, synced progress, custom themes and unused tokens. Purchase records are kept for tax law. Progress on this device stays here.</p>
        <button type="button" class="btn" id="account-delete">Email me a deletion link</button>
      </details>`;
    },
    deleteSent: () => `
      <p class="account-lead">We sent a link to <strong>${esc(state.user?.email)}</strong>. Your account is deleted when you open it.</p>
      <button type="button" class="btn" data-view="account">Back</button>`,
  };

  function render() {
    const view = state.view === 'signup' ? 'signin' : state.view;
    $('#account-title').textContent = state.user ? 'Account' : view === 'reset' ? 'New password' : 'Save your progress';
    body.innerHTML = views[view]();
    for (const b of body.querySelectorAll('[data-view]')) b.addEventListener('click', () => {
      const email = body.querySelector('input[name=email]')?.value;
      if (email) state.email = email;
      state.view = b.dataset.view;
      state.error = '';
      render();
    });
    const form = body.querySelector('#account-form');
    const captchaEl = body.querySelector('.account-captcha');
    const check = captchaEl && humanCheck(captchaEl);

    body.querySelector('#account-google')?.addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      const res = await api('/api/auth/sign-in/social', {
        method: 'POST',
        body: { provider: 'google', callbackURL: `${APP_URL}?account=signed-in`, errorCallbackURL: `${APP_URL}?account=error` },
      });
      if (res.json?.url) location.href = res.json.url;
      else {
        e.currentTarget.disabled = false;
        body.querySelector('.account-error').textContent = errorText(res);
      }
    });

    if (view === 'signin') wireForm(form, check, async ({ email, password }, captcha) => {
      state.email = email.trim();
      const signup = state.view === 'signup';
      const res = await api(signup ? '/api/auth/sign-up/email' : '/api/auth/sign-in/email', {
        method: 'POST',
        captcha,
        body: { email: state.email, password, callbackURL: `${APP_URL}?account=verified`, ...(signup && { name: state.email.split('@')[0] }) },
      });
      if (res.status === 200 && res.json?.token) return void (await signedIn(res.json.user, { announce: 'Signed in' }));
      if (res.status === 200 || res.json?.code === 'EMAIL_NOT_VERIFIED') {
        state.view = 'checkEmail';
        return void render();
      }
      return errorText(res);
    });

    if (view === 'checkEmail') wireForm(form, check, async (_, captcha) => {
      const res = await api('/api/auth/send-verification-email', { method: 'POST', captcha, body: { email: state.email, callbackURL: `${APP_URL}?account=verified` } });
      return res.status === 200 ? 'Sent. Check your inbox and spam folder.' : errorText(res);
    });

    if (view === 'forgot') wireForm(form, check, async ({ email }, captcha) => {
      state.email = email.trim();
      const res = await api('/api/auth/request-password-reset', { method: 'POST', captcha, body: { email: state.email, redirectTo: `${APP_URL}?account=reset` } });
      if (res.status !== 200) return errorText(res);
      state.view = 'forgotSent';
      render();
    });

    if (view === 'reset') wireForm(form, null, async ({ password, confirm }) => {
      if (password !== confirm) return 'Those passwords don’t match.';
      const res = await api('/api/auth/reset-password', { method: 'POST', body: { token: state.resetToken, newPassword: password } });
      if (res.status !== 200) return errorText(res);
      state.view = 'signin';
      state.error = '';
      render();
      ui.toast('✓', 'Password saved', 'Sign in with your new password.');
    });

    if (view === 'account') {
      body.querySelector('#account-sync').addEventListener('click', () => runSync(() => sync.pull()));
      body.querySelector('#account-create-theme').addEventListener('click', () => document.dispatchEvent(new CustomEvent('fcw:create-theme')));
      body.querySelector('#account-signout').addEventListener('click', async () => {
        await sync.flush();
        await api('/api/auth/sign-out', { method: 'POST', body: {} });
        signedOut();
        render();
        ui.toast('✓', 'Signed out', 'Progress on this device stays here.');
      });
      body.querySelector('#account-export').addEventListener('click', async () => {
        const res = await api('/v1/account/export');
        if (res.status !== 200) return void (body.querySelector('.account-error').textContent = errorText(res));
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(res.json, null, 2)], { type: 'application/json' }));
        a.download = 'freecell-worlds-account.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      });
      body.querySelector('#account-delete').addEventListener('click', async () => {
        const res = await api('/api/auth/delete-user', { method: 'POST', body: { callbackURL: `${APP_URL}?account=deleted` } });
        if (res.status !== 200) return void (body.querySelector('.account-error').textContent = errorText(res));
        state.view = 'deleteSent';
        render();
      });
    }
    body.querySelector('input')?.focus();
  }

  titleBtn.addEventListener('click', () => open(state.user ? 'account' : null));

  // Keep devices in step: pull when the player comes back, push before the page goes.
  document.addEventListener('visibilitychange', () => {
    if (!sync.active) return;
    if (document.visibilityState === 'visible') sync.pull();
    else sync.flush();
  });
  window.addEventListener('online', () => sync.active && sync.flush());

  // Links back from emails and Google land here with ?account=... (plus token or error).
  const params = new URLSearchParams(location.search);
  const landing = params.get('account');
  const landingToken = params.get('token');
  const landingError = params.get('error');
  if (landing) {
    for (const k of ['account', 'token', 'error']) params.delete(k);
    history.replaceState(null, '', location.pathname + (params.size ? `?${params}` : '') + location.hash);
  }

  api('/v1/config').then((res) => {
    const google = res.status === 200 && !!res.json?.google;
    if (google === state.google) return;
    state.google = google;
    const open = document.getElementById('modal-account')?.classList.contains('show');
    if (open && !state.user && (state.view === 'signin' || state.view === 'signup')) render();
  });

  (async () => {
    const res = await api('/api/auth/get-session');
    if (res.status === 200 && res.json?.user) {
      await signedIn(res.json.user, { announce: landing === 'verified' ? 'Email confirmed' : landing === 'signed-in' ? 'Signed in' : null });
    } else if (res.status === 200) {
      signedOut(); // the session ended (signed out elsewhere, expired, or the account was deleted)
    }
    // Otherwise offline: keep pending changes for the next session check.
    if (landing === 'reset') {
      if (landingToken && !landingError) {
        state.resetToken = landingToken;
        open('reset');
      } else open('forgot', MESSAGES.INVALID_TOKEN);
    } else if (landing === 'error' || (landing === 'verified' && !state.user)) {
      open('signin', MESSAGES[landingError] || (landing === 'verified' ? MESSAGES.INVALID_TOKEN : 'Google sign-in didn’t finish. Please try again.'));
    } else if (landing === 'deleted') ui.toast('✓', 'Account deleted', 'Your account and its saved data are gone.');
  })();

  refreshButton();
  return { open, sync };
}
