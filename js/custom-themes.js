// Players' own themes: the creator (prompt → up to three generated versions → pick one)
// and the "Your themes" section of the table picker. Generation runs on the account API
// (server/src/themes/); finished themes are registered as regular tables while signed in.
import { api, API_URL } from './account.js';
import { worldTheme } from './theme-expansion.js';
import { THEMES, CUSTOM_ORDER, registerCustomTheme, unregisterCustomThemes } from './themes.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ART = ['board', 'backdrop', 'env', 'back', 'hero', 'thumb', 'court_j', 'court_q', 'court_k'];
const MAX_PROMPT = 500;
const POLL_MS = 3000;
const STAGES = { queued: 'Waiting to start…', directing: 'Planning the look…', finishing: 'Finishing up…' };
const stageText = (stage) => STAGES[stage] || (stage?.startsWith('painting') ? `Painting the art (${stage.split(' ')[1]})…` : 'Working…');

export const customThemeId = (themeId) => `custom-${themeId}`;
const fileUrl = (theme, v, file) => `${API_URL}/v1/themes/${theme.id}/files/${v.id}/${file}`;

// A generated spec (server/src/themes/spec.js) as a table definition the game can load.
function buildTheme(theme, v) {
  const s = v.spec;
  const p = s.palette;
  const t = worldTheme({
    id: customThemeId(theme.id), name: s.name, tagline: s.tagline, font: s.font,
    bg: p.bg, panel: p.panel, accent: p.accent, secondary: p.secondary, paper: [p.paperLight, p.paperShade],
    ink: p.ink, red: p.red, rail: p.rail, inlay: p.inlay, key: p.keyLight, fill: p.fillLight, ambient: p.ambient,
    detail: s.surface, roughness: 0.85, count: 14, glow: s.glow || 0, particles: s.particles, vignette: 0.32,
    art: Object.fromEntries(ART.map((k) => [k, fileUrl(theme, v, `${k}.webp`)])),
  });
  t.custom = { themeId: theme.id, soundsLike: s.soundsLike, music: v.files.includes('music.mp3') ? fileUrl(theme, v, 'music.mp3') : null };
  return t;
}

export function initCustomThemes({ ui, audio, chooseTable, openAccount, themesChanged }) {
  const state = { user: null, themes: [], tokens: 0, error: '', busy: false, loaded: false };
  const body = $('#create-theme-body');
  const section = $('#custom-themes');
  const grid = $('#custom-theme-grid');
  let pollTimer = null;

  // The theme still being made or picked, if any. The creator works on one at a time.
  const open = () => state.themes.find((t) => t.status === 'generating' || t.status === 'choosing') || null;
  const isOpen = () => $('#modal-create-theme').classList.contains('show');

  async function refresh() {
    if (!state.user) return;
    const res = await api('/v1/themes');
    if (res.status !== 200) return;
    state.themes = res.json.themes;
    state.tokens = res.json.tokens;
    state.loaded = true;
    registerReady();
    if (isOpen()) render();
    schedulePoll();
  }

  function registerReady() {
    const before = CUSTOM_ORDER.join();
    unregisterCustomThemes();
    for (const t of [...state.themes].reverse()) {
      const v = t.status === 'ready' && t.variations.find((x) => x.id === t.chosenVariation);
      if (!v?.spec) continue;
      const theme = buildTheme(t, v);
      registerCustomTheme(theme);
      audio.registerTheme(theme.id, theme.custom);
    }
    renderPicker();
    if (CUSTOM_ORDER.join() !== before) themesChanged();
  }

  function renderPicker() {
    section.hidden = !state.user;
    if (!state.user) return;
    grid.innerHTML = '';
    for (const id of CUSTOM_ORDER) {
      const t = THEMES[id];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'theme-big';
      card.dataset.theme = id;
      card.innerHTML = `<img src="${esc(t.art.thumb)}" alt="" loading="lazy" /><div class="meta"><b>${esc(t.name)}</b><small>${esc(t.tagline)}</small></div>`;
      card.addEventListener('click', () => chooseTable(id));
      grid.appendChild(card);
    }
    const create = document.createElement('button');
    create.type = 'button';
    create.className = 'theme-big theme-create';
    const pending = open();
    create.innerHTML = `<span class="theme-create-plus" aria-hidden="true">+</span><div class="meta"><b>${pending ? 'Finish your theme' : 'Create a theme'}</b><small>${pending ? (pending.status === 'generating' ? 'Still being made' : 'Pick your favourite version') : 'Describe it, we’ll paint it'}</small></div>`;
    create.addEventListener('click', () => openCreator());
    grid.appendChild(create);
    ui.syncThemeSelection?.();
  }

  function schedulePoll() {
    clearTimeout(pollTimer);
    if (open()?.status === 'generating') pollTimer = setTimeout(refresh, isOpen() ? POLL_MS : POLL_MS * 5);
  }

  async function act(fn) {
    state.busy = true;
    state.error = '';
    render();
    try {
      const res = await fn();
      if (res && res.status >= 400) state.error = errorText(res);
    } finally {
      state.busy = false;
      await refresh();
      render();
    }
  }

  const errorText = (res) =>
    res.status === 0 ? 'Can’t reach the server. Check your connection and try again.' : res.json?.message || 'Something went wrong. Please try again.';

  // --- creator views ------------------------------------------------------------------
  function composeView() {
    const none = state.tokens < 1;
    return `
      <p class="account-lead">Describe a place, an era or a mood. We’ll design the table, card backs, court cards and music to match.</p>
      <p class="account-note">${state.tokens} Theme Token${state.tokens === 1 ? '' : 's'}. One token makes up to three versions; you keep the one you like best.</p>
      <form class="account-form" id="create-theme-form" novalidate>
        <label>Your theme<textarea name="prompt" rows="3" maxlength="${MAX_PROMPT}" placeholder="A lantern-lit night market in the rain, paper umbrellas and steaming noodle stalls" required ${none ? 'disabled' : ''}></textarea></label>
        <p class="account-error" role="alert">${esc(state.error)}</p>
        <button type="submit" class="btn primary" ${none || state.busy ? 'disabled' : ''}>${state.busy ? 'Checking…' : 'Create theme · 1 token'}</button>
      </form>
      ${none ? '<p class="account-note">You need a Theme Token to create a theme. Token purchases are coming soon.</p>' : ''}`;
  }

  function variationCard(theme, v) {
    if (v.status === 'generating') {
      return `<div class="ct-variation ct-pending"><small>Version ${v.roll}</small><p class="ct-stage" aria-live="polite"><span class="ct-spinner" aria-hidden="true"></span>${esc(stageText(v.stage))}</p><p class="account-note">This takes a few minutes. You can close this and keep playing.</p></div>`;
    }
    if (v.status === 'failed') {
      return `<div class="ct-variation ct-failed"><small>Version ${v.roll}</small><p class="account-note">${esc(v.error)}</p></div>`;
    }
    const s = v.spec;
    const img = (file, cls = '') => `<img class="${cls}" src="${esc(fileUrl(theme, v, file))}" alt="" loading="lazy" />`;
    return `
      <div class="ct-variation">
        ${img('hero.webp', 'ct-hero')}
        <div class="ct-meta"><small>Version ${v.roll}</small><b>${esc(s.name)}</b><span>${esc(s.tagline)}</span></div>
        <div class="ct-strip">${img('board.webp', 'ct-board')}${img('back.webp', 'ct-card')}${img('court_j.webp', 'ct-card')}${img('court_q.webp', 'ct-card')}${img('court_k.webp', 'ct-card')}</div>
        <p class="ct-prompt">“${esc(v.prompt)}”</p>
        <button type="button" class="btn primary" data-choose="${esc(v.id)}" ${state.busy || theme.status !== 'choosing' ? 'disabled' : ''}>Use this one</button>
      </div>`;
  }

  function sessionView(theme) {
    const ready = theme.variations.filter((v) => v.status === 'ready');
    const generating = theme.status === 'generating';
    const last = theme.variations.at(-1)?.prompt || '';
    const reroll = !generating && theme.rollsLeft > 0;
    return `
      <div class="ct-variations">${theme.variations.map((v) => variationCard(theme, v)).join('')}</div>
      <p class="account-error" role="alert">${esc(state.error)}</p>
      ${reroll ? `
        <form class="account-form" id="create-theme-form" novalidate>
          <label>Try again, as is or reworded<textarea name="prompt" rows="2" maxlength="${MAX_PROMPT}" required>${esc(last)}</textarea></label>
          <button type="submit" class="btn" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Checking…' : `Make another version · ${theme.rollsLeft} left`}</button>
        </form>` : ''}
      <p class="account-note">${theme.rollsLeft > 0 ? 'Picking a version is final, and the other versions are deleted.' : 'That was the last try. Pick the version you want to keep.'}</p>
      ${!generating && !ready.length ? `<button type="button" class="btn" id="create-theme-cancel" ${state.busy ? 'disabled' : ''}>Cancel and get my token back</button>` : ''}`;
  }

  function render() {
    if (!state.user) {
      body.innerHTML = `<p class="account-lead">Sign in to create your own table theme. It’s saved to your account and plays on any device.</p><button type="button" class="btn primary" id="create-theme-signin">Sign in</button>`;
      body.querySelector('#create-theme-signin').addEventListener('click', () => {
        ui.closeModals();
        openAccount();
      });
      return;
    }
    if (!state.loaded) {
      body.innerHTML = '<p class="account-note">Loading…</p>';
      return;
    }
    const theme = open();
    body.innerHTML = theme ? sessionView(theme) : composeView();

    body.querySelector('#create-theme-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const prompt = new FormData(e.currentTarget).get('prompt').trim();
      if (prompt.length < 3) return void (body.querySelector('.account-error').textContent = 'Describe your theme in a few words.');
      act(() => api(theme ? `/v1/themes/${theme.id}/variations` : '/v1/themes', { method: 'POST', body: { prompt } }));
    });
    body.querySelector('#create-theme-cancel')?.addEventListener('click', () => act(() => api(`/v1/themes/${theme.id}/cancel`, { method: 'POST', body: {} })));
    for (const b of body.querySelectorAll('[data-choose]')) {
      b.addEventListener('click', async () => {
        await act(() => api(`/v1/themes/${theme.id}/choose`, { method: 'POST', body: { variationId: b.dataset.choose } }));
        const id = customThemeId(theme.id);
        if (THEMES[id]) {
          ui.closeModals();
          ui.toast('✓', 'Theme saved', `${esc(THEMES[id].name)} is now one of your tables.`);
          chooseTable(id);
        }
      });
    }
  }

  function openCreator() {
    state.error = '';
    render();
    ui.openModal('modal-create-theme');
    refresh();
  }

  document.addEventListener('fcw:create-theme', openCreator);

  return {
    open: openCreator,
    // Called by js/account.js whenever the signed-in player changes (null = signed out).
    setUser(user) {
      if (user?.id === state.user?.id) return;
      state.user = user;
      state.themes = [];
      state.loaded = false;
      clearTimeout(pollTimer);
      if (user) refresh();
      else registerReady();
    },
  };
}
