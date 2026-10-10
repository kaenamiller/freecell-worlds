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
    $('#title-tagline').textContent = theme.tagline;
    $('#brand-theme').textContent = theme.name;
    document.querySelectorAll('.theme-card, .theme-big').forEach((c) => c.classList.toggle('selected', c.dataset.theme === theme.id));
    this.setHero(theme.art.hero);
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
    for (const id of THEME_ORDER) {
      const t = THEMES[id];
      const small = document.createElement('button');
      small.className = 'theme-card';
      small.dataset.theme = id;
      small.innerHTML = `<img src="${t.art.thumb}" alt="" loading="lazy" /><span>${t.name}</span>`;
      small.addEventListener('click', () => this.handlers.theme && this.handlers.theme(id));
      row.appendChild(small);

      const big = document.createElement('button');
      big.className = 'theme-big';
      big.dataset.theme = id;
      big.innerHTML = `<img src="${t.art.thumb}" alt="" /><div class="meta"><b>${t.name}</b><small>${t.tagline}</small></div>`;
      big.addEventListener('click', () => {
        this.closeModals();
        this.handlers.theme && this.handlers.theme(id);
      });
      grid.appendChild(big);
    }

    const random = document.createElement('button');
    random.type = 'button';
    random.className = 'theme-card theme-random';
    random.title = 'Choose a different theme at random';
    random.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h3c4 0 8 12 12 12h3m-4-4 4 4-4 4M3 18h3c1.5 0 3-1.7 4.5-4M13.5 10C15 7.7 16.5 6 18 6h3m-4-4 4 4-4 4" /></svg><span>Random theme</span>`;
    random.addEventListener('click', async () => {
      const others = THEME_ORDER.filter((id) => id !== document.body.dataset.theme);
      const choices = others.length ? others : THEME_ORDER;
      const id = choices[Math.floor(Math.random() * choices.length)];
      random.disabled = true;
      try {
        await this.handlers.theme?.(id);
      } finally {
        random.disabled = false;
      }
    });
    row.appendChild(random);
  },

  refreshDaily() {
    $('#daily-badge').textContent = dailyDone() ? 'Done' : 'New';
  },

  // --- screens -----------------------------------------------------------------------
  showTitle() {
    this.closeModals();
    this.els.win.classList.remove('show');
    this.els.title.classList.remove('hidden', 'leaving');
    this.els.hud.classList.add('hidden');
    this.els.statusBar.classList.add('hidden');
    $('#scene').style.visibility = 'hidden';
    this.refreshDaily();
    const resume = this.handlers.hasResume && this.handlers.hasResume();
    $('#btn-play-label').textContent = resume ? 'Continue' : 'Play';
  },

  hideTitle() {
    const t = this.els.title;
    t.classList.add('leaving');
    $('#scene').style.visibility = 'visible';
    this.els.hud.classList.remove('hidden');
    this.els.statusBar.classList.remove('hidden');
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
    if (id === 'modal-stats') this.renderStats();
    $('#' + id).classList.add('show');
  },
  closeModals() {
    document.querySelectorAll('.modal.show').forEach((m) => m.classList.remove('show'));
  },
  get modalOpen() {
    return !!document.querySelector('.modal.show');
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
    on('#btn-title-deal', () => {
      const n = parseInt($('#title-deal').value, 10);
      H().dealNumber(Number.isFinite(n) && n > 0 ? n : null);
    });
    $('#title-deal').addEventListener('keydown', (e) => e.key === 'Enter' && $('#btn-title-deal').click());
    on('#btn-title-stats', () => this.openModal('modal-stats'));
    on('#btn-title-settings', () => this.openModal('modal-settings'));

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
    bindCheck('#set-fourcolor', 'fourColor');
    bindCheck('#set-contrast', 'highContrast');
    bindCheck('#set-reduced', 'reducedMotion');
    bindCheck('#set-parallax', 'parallax');
    this.setMuteIcon(settings.muted);
  },

  setPerfReadout(text) {
    $('#perf-readout').textContent = text;
  },
};
