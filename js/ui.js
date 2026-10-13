// DOM layer: title screen, HUD, modals, toasts and win overlay. It owns no game
// state — main.js supplies handlers via ui.handlers.
import { THEMES, THEME_ORDER } from './themes.js';
import { settings, saveSettings } from './store.js';
import { stats, ACHIEVEMENTS, fmtTime, dailyDone } from './stats.js';

const $ = (s) => document.querySelector(s);

export const ui = {
  handlers: {},
  els: {},

  init() {
    const E = this.els;
    E.status = $('#status');
    E.solver = $('#solver-badge');
    E.win = $('#win-overlay');
    E.dealInput = $('#deal-input');
    E.title = $('#title-screen');
    E.hud = $('#hud');
    E.statusBar = $('#status-bar');
    E.loader = $('#loader');
    E.fade = $('#fade');

    this.buildThemeUI();
    this.wireButtons();
    this.wireSettings();
    this.refreshDaily();
    this.setTitleMode(settings.titleMode, { persist: false });

    // Close modals via backdrop / × / Escape.
    for (const m of document.querySelectorAll('.modal')) {
      m.addEventListener('pointerdown', (e) => e.target === m && this.closeModals());
      m.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.closeModals()));
    }
    window.addEventListener('keydown', (e) => e.key === 'Escape' && this.closeModals());
  },

  // --- loader ---------------------------------------------------------------------
  setLoading(p, text) {
    $('#loader-fill').style.width = `${Math.round(p * 100)}%`;
    if (text) $('#loader-text').textContent = text;
  },
  hideLoader() {
    this.els.loader.classList.add('done');
    setTimeout(() => this.els.loader.remove(), 800);
  },

  // --- theme visuals -----------------------------------------------------------------
  applyThemeCss(theme) {
    for (const [k, v] of Object.entries(theme.css)) document.documentElement.style.setProperty(k, v);
    document.body.dataset.theme = theme.id;
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme.css['--bg']);
    $('#brand-theme').textContent = theme.name;
    this.syncThemeSelection();
    if (this.titleMode !== 'voyage') this.updateTitleHero();
  },

  titleMode: 'classic',
  titleVoyageTheme: null,
  setTitleVoyageTheme(id) {
    this.titleVoyageTheme = THEMES[id] ? id : null;
    if (this.titleMode === 'voyage') this.updateTitleHero();
  },
  updateTitleHero() {
    const classic = this.titleMode !== 'voyage';
    const id = classic ? document.body.dataset.theme || settings.theme : this.titleVoyageTheme || THEME_ORDER[Math.floor(Date.now() / 86400000) % THEME_ORDER.length];
    const chosen = THEMES[id] || THEMES.roman;
    $('#title-eyebrow').textContent = classic ? 'The classic. Reimagined.' : 'A new world at every table';
    $('#title-tagline').textContent = classic ? chosen.tagline : 'Chart seven tables, collect charms, and face the final boss.';
    $('#title-hint').textContent = classic ? 'Drag cards · double-click to send home · H hint · U undo' : 'Choose your route · collect charms · reach the final table';
    if (this.titleHeroUrl !== chosen.art.hero) { this.titleHeroUrl = chosen.art.hero; this.setHero(chosen.art.hero); }
  },
  setTitleMode(mode, { persist = true } = {}) {
    this.titleMode = mode === 'voyage' ? 'voyage' : 'classic';
    if (persist) this.titleUserSwitched = true;
    document.body.classList.toggle('voyage-reduced-motion', !!settings.reducedMotion);
    for (const name of ['classic', 'voyage']) {
      const active = name === this.titleMode;
      const tab = $(`#title-tab-${name}`);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      $(`#title-panel-${name}`).hidden = !active;
    }
    this.els.title.dataset.titleMode = this.titleMode;
    if (persist && settings.titleMode !== this.titleMode) { settings.titleMode = this.titleMode; saveSettings(); }
    this.updateTitleHero();
    this.fitTitle();
  },

  // Scale the title block so every control stays on screen. The stage centers
  // the scaled box; transform does not change layout, so the wrapper is sized
  // to the visual result.
  ensureTitleFit() {
    if (this._titleFitReady) return;
    const stage = document.querySelector('.title-stage');
    const content = document.querySelector('.title-content');
    if (!stage || !content) return;
    this._titleFitReady = true;
    const refit = () => this.fitTitle();
    const observer = new ResizeObserver(refit);
    observer.observe(stage);
    observer.observe(content);
    document.fonts?.ready.then(refit);
  },

  fitTitle() {
    this.ensureTitleFit();
    const screen = this.els.title || document.getElementById('title-screen');
    const stage = document.querySelector('.title-stage');
    const box = document.querySelector('.title-scale');
    const content = document.querySelector('.title-content');
    if (!screen || !stage || !box || !content || screen.classList.contains('hidden')) return;
    const cs = getComputedStyle(stage);
    const availW = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const availH = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (availW < 8 || availH < 8) return;
    const widthPx = `${Math.min(availW, 1100)}px`;
    if (content.style.width !== widthPx) content.style.width = widthPx;
    const w = content.offsetWidth;
    const h = content.offsetHeight;
    if (!w || !h) return;
    const scale = Math.min(1, (availW - 1) / w, (availH - 1) / h);
    const transform = scale >= 0.999 ? 'none' : `scale(${scale})`;
    const boxW = `${w * Math.min(scale, 1)}px`;
    const boxH = `${h * Math.min(scale, 1)}px`;
    if (content.style.transform === transform && box.style.width === boxW && box.style.height === boxH) return;
    content.style.transformOrigin = 'top left';
    content.style.transform = transform;
    box.style.width = boxW;
    box.style.height = boxH;
  },

  syncThemeSelection() {
    const id = document.body.dataset.theme;
    document.querySelectorAll('.theme-card, .theme-big').forEach((c) => {
      const selected = c.classList.contains('theme-big') || !settings.autoRandomTheme
        ? c.dataset.theme === id
        : c.classList.contains('theme-random');
      c.classList.toggle('selected', selected);
      c.setAttribute('aria-pressed', String(selected));
    });
    $('#set-random-theme').checked = settings.autoRandomTheme;
  },

  heroFlip: false,
  setHero(url) {
    const a = $('#hero-a');
    const b = $('#hero-b');
    const [on, off] = this.heroFlip ? [a, b] : [b, a];
    this.heroFlip = !this.heroFlip;
    on.src = url;
    const show = () => {
      on.classList.add('show');
      off.classList.remove('show');
    };
    on.complete ? show() : (on.onload = show);
  },

  buildThemeUI() {
    const row = $('#theme-row');
    const grid = $('#theme-grid');
    // Sample without replacement once per launch so the shortcuts stay stable.
    const featured = [...THEME_ORDER];
    for (let i = featured.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [featured[i], featured[j]] = [featured[j], featured[i]];
    }
    for (const id of featured.slice(0, 3)) {
      const t = THEMES[id];
      const small = document.createElement('button');
      small.type = 'button';
      small.className = 'theme-card';
      small.dataset.theme = id;
      small.innerHTML = `<img src="${t.art.thumb}" alt="" loading="lazy" /><span>${t.name}</span>`;
      small.addEventListener('click', () => this.handlers.theme && this.handlers.theme(id));
      row.appendChild(small);
    }
    for (const id of THEME_ORDER) {
      const t = THEMES[id];
      const big = document.createElement('button');
      big.type = 'button';
      big.className = 'theme-big';
      big.dataset.theme = id;
      big.innerHTML = `<img src="${t.art.thumb}" alt="" loading="lazy" /><div class="meta"><b>${t.name}</b><small>${t.tagline}</small></div>`;
      big.addEventListener('click', () => {
        this.closeModals();
        this.handlers.theme && this.handlers.theme(id);
      });
      grid.appendChild(big);
    }

    const random = document.createElement('button');
    random.type = 'button';
    random.className = 'theme-card theme-random';
    random.title = 'Use a random theme for each new game';
    random.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h3c4 0 8 12 12 12h3m-4-4 4 4-4 4M3 18h3c1.5 0 3-1.7 4.5-4M13.5 10C15 7.7 16.5 6 18 6h3m-4-4 4 4-4 4" /></svg><span>Random theme</span>`;
    random.addEventListener('click', async () => {
      random.disabled = true;
      try {
        await this.handlers.randomTheme?.();
      } finally {
        random.disabled = false;
      }
    });
    row.prepend(random);
  },

  refreshDaily() {
    $('#daily-badge').textContent = dailyDone() ? 'Done' : 'New';
  },

  // --- screens -----------------------------------------------------------------------
  showTitle() {
    this.titleUserSwitched = false;
    this.closeModals();
    this.els.win.classList.remove('show');
    this.els.title.classList.remove('hidden', 'leaving');
    this.els.hud.classList.add('hidden');
    this.els.statusBar.classList.add('hidden');
    $('#scene').style.visibility = 'hidden';
    this.refreshDaily();
    const resume = this.handlers.hasResume && this.handlers.hasResume();
    $('#btn-play-label').textContent = resume ? 'Continue' : 'Play';
    this.setTitleMode(settings.titleMode, { persist: false });
  },

  hideTitle() {
    const t = this.els.title;
    t.classList.add('leaving');
    $('#scene').style.visibility = 'visible';
    this.els.hud.classList.remove('hidden');
    this.els.statusBar.classList.remove('hidden');
    this.handlers.reframe?.();
    setTimeout(() => t.classList.add('hidden'), 520);
  },

  // Cross-fade through black while swapping heavy scene state.
  async transition(fn) {
    const f = this.els.fade;
    f.classList.add('on');
    await new Promise((r) => setTimeout(r, 300));
    await fn();
    f.classList.remove('on');
  },

  // --- HUD ---------------------------------------------------------------------------
  updateHUD({ moves, found, deal }) {
    $('#moves').textContent = moves;
    $('#progress').textContent = `${found}/52`;
    $('#ring').style.strokeDashoffset = String(94.25 * (1 - found / 52));
    if (deal != null && document.activeElement !== this.els.dealInput) this.els.dealInput.value = deal;
  },
  setTimer(sec) {
    $('#timer').textContent = fmtTime(sec);
  },
  setStatus(text, kind = '') {
    this.els.status.textContent = text;
    this.els.status.className = 'status ' + kind;
    this.els.statusBar.classList.remove('hidden');
  },
  clearStatus() {
    this.els.statusBar.classList.add('hidden');
  },
  setSolverBusy(b) {
    this.els.solver.classList.toggle('active', b);
  },
  setSolveActive(b) {
    $('#btn-solve').classList.toggle('active', b);
  },
  setMuteIcon(muted) {
    const b = $('#btn-mute');
    b.classList.toggle('active', muted);
    b.setAttribute('aria-pressed', String(muted));
    b.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    $('#mute-label').textContent = muted ? 'Muted' : 'Sound';
    $('#ico-sound').innerHTML = muted
      ? '<path d="M16.500 12A4.500 4.500 0 0 0 14 8v2.200l2.400 2.400c.1-.2.100-.4.100-.6zM19 12c0 .9-.2 1.800-.5 2.600l1.500 1.500A9 9 0 0 0 21 12c0-4.300-3-7.900-7-8.800v2.100c2.900.9 5 3.500 5 6.700zM4.300 3 3 4.300 7.700 9H3v6h4l5 5v-6.700l4.200 4.200c-.7.500-1.400.9-2.200 1.100v2.100a9 9 0 0 0 3.700-1.800l2 2 1.300-1.300L12 7.700zM12 4 9.900 6.100 12 8.200z"/>'
      : '<path d="M3 9v6h4l5 5V4L7 9zm13.500 3A4.500 4.500 0 0 0 14 8v8a4.500 4.500 0 0 0 2.500-4zM14 3.200v2.100c2.900.9 5 3.500 5 6.700s-2.100 5.800-5 6.700v2.100c4-.9 7-4.500 7-8.800s-3-7.900-7-8.800z"/>';
  },

  // --- toasts / win -------------------------------------------------------------------
  toast(icon, title, text, ms = 4200) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<div class="t-ico">${icon}</div><div><b>${title}</b><small>${text}</small></div>`;
    $('#toasts').appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 400);
    }, ms);
  },

  showWin({ time, moves, bests, daily, assisted }) {
    $('#win-sub').textContent = assisted ? 'Solved by auto-solve — not counted in your stats.' : daily ? 'Daily challenge complete.' : 'Every card is home.';
    this.countUp($('#win-time'), time, fmtTime);
    this.countUp($('#win-moves'), moves, (v) => String(Math.round(v)));
    this.countUp($('#win-streak'), stats.streak, (v) => String(Math.round(v)));
    $('#win-time-best').textContent = assisted ? '' : bests.newBestTime ? 'New best!' : `Best ${fmtTime(stats.bestTime)}`;
    $('#win-moves-best').textContent = assisted ? '' : bests.newBestMoves ? 'New best!' : `Best ${stats.bestMoves}`;
    $('#win-streak-best').textContent = assisted ? '' : `Best ${stats.bestStreak}`;
    this.els.win.classList.add('show');
  },
  hideWin() {
    this.els.win.classList.remove('show');
  },
  countUp(el, to, fmt) {
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 1100);
      el.textContent = fmt(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  // --- modals -------------------------------------------------------------------------
  openModal(id) {
    this.closeModals();
    if (id === 'modal-stats') {
      this.renderStats();
      this.handlers.statsOpened?.();
    }
    $('#' + id).classList.add('show');
  },
  closeModals() {
    document.querySelectorAll('.modal.show').forEach((m) => m.classList.remove('show'));
  },
  get modalOpen() {
    return !!document.querySelector('.modal.show');
  },

  devUnlocked: false,

  setDevUnlocked(on) {
    this.devUnlocked = !!on;
    document.body.classList.toggle('dev-unlocked', this.devUnlocked);
  },

  toggleDevMenu() {
    const open = !$('#modal-dev')?.classList.contains('show');
    if (open) {
      this.setDevUnlocked(true);
      this.openModal('modal-dev');
      this.handlers.devMenuOpened?.();
    } else this.closeModals();
    return open;
  },

  renderDevReadout(html) {
    const el = $('#dev-readout');
    if (el) el.innerHTML = html;
  },

  setDevReadoutBusy(busy) {
    $('#dev-readout')?.classList.toggle('busy', busy);
  },

  renderStats() {
    const rate = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
    const cells = [
      ['Played', stats.played],
      ['Won', stats.won],
      ['Win rate', `${rate}%`],
      ['Streak', stats.streak],
      ['Best streak', stats.bestStreak],
      ['Best time', stats.bestTime ? fmtTime(stats.bestTime) : '—'],
      ['Fewest moves', stats.bestMoves || '—'],
      ['Avg. time', stats.won ? fmtTime(stats.totalTime / stats.won) : '—'],
      ['Dailies', Object.keys(stats.daily).length],
    ];
    $('#stat-grid').innerHTML = cells.map(([l, v]) => `<div><label>${l}</label><b>${v}</b></div>`).join('');
    $('#ach-grid').innerHTML = ACHIEVEMENTS.map(
      (a) => `<div class="ach ${stats.achievements[a.id] ? 'got' : ''}"><div class="t-ico">${a.icon}</div><div><b>${a.name}</b><small>${a.desc}</small></div></div>`
    ).join('');
  },

  // --- wiring --------------------------------------------------------------------------
  wireButtons() {
    const H = () => this.handlers;
    const on = (sel, fn) => $(sel).addEventListener('click', (e) => (H().click && H().click(e), fn(e)));
    on('#btn-play', () => H().play());
    on('#btn-daily', () => H().daily());
    for (const name of ['classic', 'voyage']) {
      const tab = $(`#title-tab-${name}`);
      tab.addEventListener('click', () => this.setTitleMode(name));
      tab.addEventListener('keydown', (event) => {
        const next = event.key === 'ArrowRight' || event.key === 'ArrowLeft' ? (name === 'classic' ? 'voyage' : 'classic') : event.key === 'End' ? 'voyage' : event.key === 'Home' ? 'classic' : null;
        if (!next) return;
        event.preventDefault();
        this.setTitleMode(next);
        $(`#title-tab-${next}`).focus();
      });
    }
    on('#btn-title-deal-reveal', () => {
      const wrap = $('#title-deal-wrap');
      wrap.hidden = !wrap.hidden;
      $('#btn-title-deal-reveal').setAttribute('aria-expanded', String(!wrap.hidden));
      if (!wrap.hidden) $('#title-deal').focus();
    });
    on('#btn-title-deal', () => {
      const n = parseInt($('#title-deal').value, 10);
      H().dealNumber(Number.isFinite(n) && n > 0 ? n : null);
    });
    $('#title-deal').addEventListener('keydown', (e) => e.key === 'Enter' && $('#btn-title-deal').click());
    on('#btn-title-stats', () => { this.openModal('modal-stats'); $(`#stats-tab-${this.titleMode}`)?.click(); });
    on('#btn-title-settings', () => this.openModal('modal-settings'));
    on('#btn-title-themes', () => this.openModal('modal-themes'));

    on('#btn-home', () => H().home());
    on('#btn-new', () => H().newGame());
    on('#btn-undo', () => H().undo());
    on('#btn-hint', () => H().hint());
    on('#btn-check', () => H().check());
    on('#btn-solve', () => H().solve());
    on('#btn-themes', () => this.openModal('modal-themes'));
    on('#btn-mute', () => {
      settings.muted = !settings.muted;
      saveSettings();
      this.setMuteIcon(settings.muted);
      H().settings('muted');
    });
    on('#btn-settings', () => this.openModal('modal-settings'));
    on('#btn-win-new', () => H().newGame());
    on('#btn-win-menu', () => H().home());
    on('#btn-reset-stats', () => H().resetStats());

    on('#dev-auto-solve', () => H().devSolve?.());
    on('#dev-hint', () => H().devHint?.());
    on('#dev-check', () => H().devAnalyze?.());
    on('#dev-reset-board', () => H().devResetBoard?.());

    this.els.dealInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const n = parseInt(this.els.dealInput.value, 10);
        if (Number.isFinite(n) && n > 0) H().dealNumber(n);
        this.els.dealInput.blur();
      }
    });
  },

  wireSettings() {
    const bindRange = (id, key) => {
      const el = $(id);
      el.value = settings[key];
      el.addEventListener('input', () => {
        settings[key] = parseFloat(el.value);
        saveSettings();
        this.handlers.settings(key);
      });
      // Audible feedback while dragging the effects slider.
      el.addEventListener('change', () => key === 'sfx' && this.handlers.click && this.handlers.click());
    };
    bindRange('#set-master', 'master');
    bindRange('#set-sfx', 'sfx');
    bindRange('#set-music', 'music');
    bindRange('#set-ambience', 'ambience');
    const sel = $('#set-quality');
    sel.value = settings.quality;
    sel.addEventListener('change', () => {
      settings.quality = sel.value;
      saveSettings();
      this.handlers.settings('quality');
    });
    const bindCheck = (id, key) => {
      const el = $(id);
      el.checked = !!settings[key];
      el.addEventListener('change', () => {
        settings[key] = el.checked;
        saveSettings();
        this.handlers.settings(key);
      });
    };
    bindCheck('#set-autofound', 'autoFoundation');
    bindCheck('#set-random-theme', 'autoRandomTheme');
    bindCheck('#set-fourcolor', 'fourColor');
    bindCheck('#set-contrast', 'highContrast');
    settings.tapToPeek ??= false;
    bindCheck('#set-tap-peek', 'tapToPeek');
    bindCheck('#set-reduced', 'reducedMotion');
    bindCheck('#set-cursor-light', 'cursorLight');
    this.setMuteIcon(settings.muted);
  },

  setPerfReadout(text) {
    $('#perf-readout').textContent = text;
  },
};
