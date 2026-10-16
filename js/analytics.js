// Analytics front door (docs/analytics-plan.md §4). Game code calls track(); this module
// validates against js/analytics-schema.js and sends each event to GA4 (gtag) and to the
// first-party sender (js/analytics-1p.js). Collection mode comes from js/consent.js.
//
// Off on localhost and under automated browsers (navigator.webdriver) unless the page is opened
// with ?analytics=debug. Debug mode logs every event to window.__fcwAnalytics and the console,
// and on localhost also accepts ?analytics_api=<url> and ?analytics_region=eu|us.
import { EVENTS, prepareEvent } from './analytics-schema.js';
import { ANALYTICS, APP_VERSION } from './analytics-config.js';
import { consent } from './consent.js';
import * as firstParty from './analytics-1p.js';

export { uuid as newId } from './analytics-1p.js';

const query = new URLSearchParams(location.search);
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const DEBUG = (() => {
  try {
    if (query.get('analytics') === 'debug') sessionStorage.setItem('freecellworlds.analyticsDebug', '1');
    if (query.get('analytics') === 'off') sessionStorage.removeItem('freecellworlds.analyticsDebug');
    return sessionStorage.getItem('freecellworlds.analyticsDebug') === '1';
  } catch {
    return query.get('analytics') === 'debug';
  }
})();
const ALLOWED = DEBUG || (!LOCAL && !navigator.webdriver);
const API = (DEBUG && LOCAL && query.get('analytics_api')) || ANALYTICS.api;
const GA_ID = ANALYTICS.gaMeasurementId;

// Consent Mode region defaults: GA4 also treats these as denied until the player accepts.
const CONSENT_REGIONS = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH'];

const log = DEBUG ? (window.__fcwAnalytics = { events: [], batches: [], errors: [], modes: [] }) : null;

let mode = 'off';
let ready = false;
const pending = []; // events tracked before consent is known
let contextProvider = () => ({});
const ga = { loaded: false, granted: false };

export const analyticsDebug = DEBUG;

// fn() returns the live context params (mode, theme_id, …); called once per event.
export function setContextProvider(fn) {
  contextProvider = fn;
}

function context() {
  return {
    app_version: APP_VERSION,
    logged_in: false,
    installed: document.documentElement.classList.contains('is-installed'),
    ...contextProvider(),
  };
}

export function track(name, params = {}) {
  if (!ALLOWED) return;
  const ctx = context();
  if (!ready) {
    if (pending.length < 100) pending.push([name, params, ctx]);
    return;
  }
  dispatch(name, params, ctx);
}

function dispatch(name, params, ctx) {
  const def = EVENTS[name];
  const { fp, ga: gaEvents, errors } = prepareEvent(name, params, ctx);
  if (log) {
    log.events.push({ name, params: fp, context: ctx, ga: gaEvents, mode, errors });
    for (const e of errors) { log.errors.push(e); console.warn('[analytics]', e); }
    console.debug('[analytics]', name, fp ?? gaEvents[0]?.params);
  }
  if (mode === 'off' || !def) return;
  if (fp && def.only !== 'ga') firstParty.enqueue(name, ctx, fp, { summary: !!def.summary });
  if (mode === 'full' && ga.loaded) for (const e of gaEvents) window.gtag('event', e.name, e.params);
}

// Virtual page view for each screen of the single-page app. Repeats of the same screen are ignored.
let lastScreen = null;
export function screen(name) {
  if (name === lastScreen) return;
  lastScreen = name;
  track('page_view', { screen_name: name, page_title: name, page_location: `${location.origin}/app/${name.replace(/_/g, '/')}` });
}

export function setUser({ userId = null, props = null } = {}) {
  if (!ga.loaded) return;
  window.gtag('set', { user_id: userId });
  if (props) window.gtag('set', 'user_properties', props);
}

// Callbacks that may track() a final event when the page is being unloaded (e.g. game_exit).
// Registered at import time so they run before the first-party sender's own pagehide flush.
const hideHooks = new Set();
export function onPageHide(fn) {
  hideHooks.add(fn);
  return () => hideHooks.delete(fn);
}
window.addEventListener('pagehide', () => {
  for (const fn of hideHooks) {
    try { fn(); } catch (error) { console.warn('[analytics]', error); }
  }
});

export function initAnalytics() {
  firstParty.configure({
    api: ALLOWED ? API : '',
    appVersion: APP_VERSION,
    onBatch: log ? (payload, transport) => log.batches.push({ transport, payload }) : null,
  });
  consent.onChange(applyMode);
  // Local play and automated checks: nothing is collected, so don't ask. Settings still work.
  if (!ALLOWED) {
    consent.mountUI();
    ready = true;
    return Promise.resolve();
  }
  const forceRegion = DEBUG && LOCAL ? query.get('analytics_region') : null;
  return consent.init({ api: API, forceRegion }).then(() => {
    applyMode(consent.mode);
    ready = true;
    for (const [name, params, ctx] of pending.splice(0)) dispatch(name, params, ctx);
    wireGlobal();
  });
}

function applyMode(next) {
  mode = ALLOWED ? next : 'off';
  log?.modes.push(mode);
  firstParty.setMode(mode);
  if (mode === 'full') enableGa();
  else disableGa();
}

// --- GA4 ------------------------------------------------------------------------------
// gtag.js loads only in full mode, and never while GA_ID is empty.
function enableGa() {
  if (!GA_ID) return;
  if (ga.loaded) {
    if (!ga.granted) window.gtag('consent', 'update', { analytics_storage: 'granted' });
    ga.granted = true;
    return;
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); }; // eslint-disable-line prefer-rest-params
  const denied = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' };
  window.gtag('consent', 'default', { ...denied, region: CONSENT_REGIONS });
  window.gtag('consent', 'default', { ...denied, analytics_storage: 'granted' });
  if (consent.choice === 'granted') window.gtag('consent', 'update', { analytics_storage: 'granted' });
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    ...(DEBUG ? { debug_mode: true } : {}),
  });
  ga.loaded = true;
  ga.granted = true;
  const inject = () => {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
    document.head.appendChild(s);
  };
  // Keep the download out of the way of the first frames and texture uploads.
  if ('requestIdleCallback' in window) requestIdleCallback(inject, { timeout: 4000 });
  else setTimeout(inject, 1500);
}

function disableGa() {
  if (!ga.loaded || !ga.granted) return;
  window.gtag('consent', 'update', { analytics_storage: 'denied' });
  ga.granted = false;
  // Remove the cookies GA4 set while it was allowed.
  const host = location.hostname.split('.').slice(-2).join('.');
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0].trim();
    if (name === '_ga' || name.startsWith('_ga_')) {
      for (const domain of ['', `; domain=.${host}`]) document.cookie = `${name}=; Max-Age=0; path=/${domain}`;
    }
  }
}

// --- app-wide events ------------------------------------------------------------------
function wireGlobal() {
  let errors = 0;
  const report = (message, where) => {
    if (errors++ >= 5) return; // a few per page load is enough to spot a problem; Sentry has the rest
    track('app_error', { message: String(message || 'error').slice(0, 100), where: String(where || '').replace(location.origin, '').slice(0, 100) });
  };
  window.addEventListener('error', (e) => report(e.message, e.filename ? `${e.filename}:${e.lineno}` : ''));
  window.addEventListener('unhandledrejection', (e) => report(e.reason?.message || e.reason, 'promise'));
  window.addEventListener('beforeinstallprompt', () => track('pwa_install_prompt', { outcome: 'shown' }));
  window.addEventListener('appinstalled', () => track('pwa_installed'));
}

// --- per-deal interaction counters (analytics-plan.md §5.6) ----------------------------
// One instance follows the deal on the table. main.js calls the hooks; summary() goes into
// game_end (and later voyage_board_end).
export class PlayCounters {
  constructor() {
    this.reset();
    document.addEventListener('visibilitychange', () => {
      const now = performance.now();
      if (document.hidden) this.hiddenAt = now;
      else if (this.hiddenAt) { this.bg += now - this.hiddenAt; this.hiddenAt = 0; }
    });
  }

  reset() {
    this.c = { invalid_moves: 0, drags: 0, taps: 0, double_clicks: 0, key_moves: 0, rank_highlight_uses: 0, peeks: 0 };
    this.dealtAt = performance.now();
    this.firstMoveAt = 0;
    this.lastMoveAt = 0;
    this.bgAtLastMove = 0;
    this.idleMax = 0;
    this.undoStreak = 0;
    this.undoMax = 0;
    this.invalidAt = [];
    this.bg = 0;
    this.hiddenAt = document.hidden ? performance.now() : 0;
    this.autoFinished = false;
  }

  // The deal intro finished and the table is playable.
  dealt() {
    this.dealtAt = performance.now();
  }

  bgMs(now = performance.now()) {
    return this.bg + (this.hiddenAt ? now - this.hiddenAt : 0);
  }

  // kind: drags | taps | double_clicks | key_moves (omit for moves made another way).
  move(kind) {
    const now = performance.now(), bg = this.bgMs(now);
    if (kind && kind in this.c) this.c[kind]++;
    if (!this.firstMoveAt) this.firstMoveAt = now;
    else this.idleMax = Math.max(this.idleMax, now - this.lastMoveAt - (bg - this.bgAtLastMove));
    this.lastMoveAt = now;
    this.bgAtLastMove = bg;
    this.undoStreak = 0;
  }

  invalid() {
    this.c.invalid_moves++;
    this.invalidAt.push(performance.now());
    if (this.invalidAt.length > 10) this.invalidAt.shift();
  }

  undo() {
    this.undoStreak++;
    this.undoMax = Math.max(this.undoMax, this.undoStreak);
  }

  count(key) {
    if (key in this.c) this.c[key]++;
  }

  // Three or more rejected moves in the last 30 seconds (sent with abandons).
  invalidBurst() {
    const since = performance.now() - 30000;
    return this.invalidAt.filter((t) => t >= since).length >= 3;
  }

  summary(history = []) {
    return {
      ...this.c,
      auto_moves: history.reduce((n, m) => n + (m.auto ? 1 : 0), 0),
      freecell_uses: history.reduce((n, m) => n + (m.t === 'C' ? 1 : 0), 0),
      first_move_ms: this.firstMoveAt ? Math.max(0, Math.round(this.firstMoveAt - this.dealtAt)) : undefined,
      idle_max_s: Math.round(this.idleMax / 1000),
      undo_max_streak: this.undoMax,
      bg_seconds: Math.round(this.bgMs() / 1000),
      auto_finished: this.autoFinished,
    };
  }
}
