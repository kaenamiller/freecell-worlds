// Voyage's DOM layer. main.js owns the run and supplies RunView snapshots.
import { THEMES } from '../themes.js';
import { load, save, settings } from '../store.js';
import { ui } from '../ui.js';
import { CHARMS } from './charms.js';
import { voyageStats } from './stats.js';

const $ = (id) => document.getElementById(id);
const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (value) => Math.round(Number(value) || 0).toLocaleString();
const theme = (id) => THEMES[id] || { name: id || 'Unknown table', tagline: '', art: {} };
const art = (id) => theme(id).art?.thumb ? new URL(`../../${theme(id).art.thumb.replace(/^\.\//, '')}`, import.meta.url).href : '';
const starText = (n) => `${'★'.repeat(Math.max(0, Number(n) || 0))}${'☆'.repeat(Math.max(0, 3 - (Number(n) || 0)))}`;
const compactCharm = (c, extra = '') => c ? `<button type="button" class="voyage-charm ${extra}" aria-label="${esc(`${c.name}. ${c.text}`)}" aria-describedby="voyage-tooltip" data-tip-name="${esc(c.name)}" data-tip-text="${esc(c.text)}"><span aria-hidden="true">${esc(c.icon || '✦')}</span></button>` : '';
const charmCard = (c, action = '') => `<article class="voyage-charm-card"><div class="voyage-charm-card-icon">${compactCharm(c)}</div><div><small>${esc(c.kind || 'charm')}</small><h4>${esc(c.name)}</h4><p>${esc(c.text)}</p></div>${action}</article>`;
const localDate = (key) => key ? `Daily Voyage · ${esc(key)}` : 'Voyage';
const formatTime = (seconds) => `${Math.floor((seconds || 0) / 60)}:${String(Math.round((seconds || 0) % 60)).padStart(2, '0')}`;

export const voyageUI = {
  handlers: {},
  mapView: null,
  selectedNode: null,
  highlightNode: null,
  mapReadOnly: false,
  preparing: false,
  introTimer: null,
  resultTimers: [],
  tooltipPinned: false,
  tooltipAnchor: null,
  confirmResolve: null,
  tutorialSeen: null,
  lastFocus: null,

  init(handlers = {}) {
    this.handlers = handlers;
    this.syncMotion();
    this.tutorialSeen = load('voyageTutorial', {});
    $('btn-voyage')?.addEventListener('click', () => this.handlers[this.titleRun ? 'continueVoyage' : 'startVoyage']?.(this.titleRun ? undefined : { daily: false }));
    $('btn-voyage-daily')?.addEventListener('click', () => this.handlers.startVoyage?.({ daily: true }));
    $('btn-voyage-how')?.addEventListener('click', () => this.replayTutorial());
    $('voyage-open-map')?.addEventListener('click', () => this.handlers.openMap?.());
    $('voyage-abandon')?.addEventListener('click', () => this.handlers.abandonBoard?.());
    $('voyage-map-close')?.addEventListener('click', () => this.mapReadOnly ? this.hideMap() : this.handlers.toMenu?.());
    $('voyage-chart')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-node]');
      if (button) this.selectNode(button.dataset.node);
    });
    $('voyage-chart')?.addEventListener('focusin', (event) => {
      const button = event.target.closest('[data-node]');
      if (button && (button.dataset.node !== this.selectedNode || button.dataset.node !== this.highlightNode)) this.selectNode(button.dataset.node, false);
    });
    $('voyage-map-detail')?.addEventListener('click', (event) => {
      if (event.target.closest('[data-sail]') && !event.target.closest('[data-sail]').disabled) this.handlers.pickNode?.(this.selectedNode);
    });
    $('voyage-result-card')?.addEventListener('click', (event) => {
      const pick = event.target.closest('[data-pick-charm]');
      if (pick) this.handlers.pickCharm?.(pick.dataset.pickCharm);
      if (event.target.closest('[data-result-continue]')) this.handlers.continueToMap?.();
      if (event.target.closest('[data-result-end]')) this.handlers.showRunEnd?.();
    });
    $('voyage-end-card')?.addEventListener('click', (event) => {
      if (event.target.closest('[data-new-voyage]')) this.handlers.startVoyage?.({ daily: false });
      if (event.target.closest('[data-end-menu]')) this.handlers.toMenu?.();
    });
    $('voyage-tutorial-close')?.addEventListener('click', () => this.dismissTutorial());
    $('voyage-tutorial-done')?.addEventListener('click', () => this.dismissTutorial(true));
    $('stats-tab-classic')?.addEventListener('click', () => this.statsTab('classic'));
    $('stats-tab-voyage')?.addEventListener('click', () => this.statsTab('voyage'));
    $('modal-stats')?.addEventListener('click', (event) => { if (event.target === $('modal-stats')) this.statsTab('classic'); });
    document.addEventListener('pointerover', (event) => { const target = event.target.closest?.('[data-tip-name]'); if (target && event.pointerType !== 'touch' && !this.tooltipPinned) this.showTooltip(target); });
    document.addEventListener('pointerout', (event) => { if (event.target.closest?.('[data-tip-name]') && !this.tooltipPinned && !event.relatedTarget?.closest?.('[data-tip-name]')) this.hideTooltip(); });
    document.addEventListener('focusin', (event) => { const target = event.target.closest?.('[data-tip-name]'); if (target) this.showTooltip(target); });
    document.addEventListener('focusout', (event) => { if (event.target.closest?.('[data-tip-name]') && !this.tooltipPinned) this.hideTooltip(); });
    document.addEventListener('click', (event) => {
      const target = event.target.closest?.('[data-tip-name]');
      if (target) { this.tooltipPinned = !(this.tooltipPinned && this.tooltipAnchor === target); this.tooltipPinned ? this.showTooltip(target) : this.hideTooltip(); }
      else if (this.tooltipPinned && !event.target.closest?.('#voyage-tooltip')) { this.tooltipPinned = false; this.hideTooltip(); }
    });
    window.addEventListener('resize', () => { if (!$('voyage-map').hidden) { this.drawLinks(); this.positionTooltip(); } });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        const dialog = ['voyage-confirm', 'voyage-intro', 'voyage-result', 'voyage-end', 'voyage-map'].map($).find((el) => !el.hidden);
        if (dialog) {
          const items = [...dialog.querySelectorAll('button:not([disabled]), [tabindex="0"]')].filter((el) => el.getClientRects().length);
          if (items.length) {
            const first = items[0], last = items.at(-1);
            if (!dialog.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
            else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
          }
        }
        return;
      }
      if (event.key !== 'Escape') return;
      if (!$('voyage-confirm').hidden) { event.preventDefault(); this.resolveConfirm(false); }
      else if (!$('voyage-tutorial').hidden) this.dismissTutorial();
      else if (!$('voyage-intro').hidden) this.finishIntro();
      else if (!$('voyage-map').hidden && this.mapReadOnly) this.hideMap();
      else if (this.tooltipPinned) { this.tooltipPinned = false; this.hideTooltip(); }
    });
  },

  setMode(mode) {
    this.syncMotion();
    document.body.dataset.mode = mode;
    $('voyage-hud').hidden = mode !== 'voyage';
    if (mode === 'classic') this.hideAll();
  },

  refreshTitle(info = {}) {
    this.titleRun = info.run || null;
    $('btn-voyage-label').textContent = info.run ? 'Continue Voyage' : 'Begin Voyage';
    const summary = $('voyage-title-summary');
    summary.hidden = !info.run;
    if (info.run) {
      const board = Math.min(info.run.boards, info.run.board + (info.run.status === 'map' ? 1 : 0));
      summary.innerHTML = `<div class="voyage-title-summary-head"><strong>Board ${board} of ${info.run.boards}</strong><span>${num(info.run.score)} points</span></div><div class="voyage-title-summary-kit"><span>Charms</span>${info.run.boons?.length ? info.run.boons.map((c) => compactCharm(c)).join('') : '<small>None yet</small>'}</div><div class="voyage-title-summary-boss"><span>Final boss ahead</span>${compactCharm(info.run.boss, 'boss')}<strong>${esc(info.run.boss?.name || 'Unknown boss')}</strong></div>`;
    }
    const best = $('voyage-title-best');
    best.innerHTML = voyageStats.runs ? `<span>Your best run</span><strong>${num(voyageStats.bestScore)} points</strong><small>Board ${voyageStats.bestBoard || 1} of 7</small>` : '<span>Your best run</span><strong>Uncharted</strong><small>Your journey starts here</small>';
    const heroTheme = info.run?.current?.theme || info.run?.map?.flat().find((n) => n.state === 'current')?.theme || info.run?.results?.at(-1)?.theme || info.run?.map?.flat().find((n) => n.state === 'available')?.theme;
    ui.setTitleVoyageTheme(heroTheme);
    if (info.run && ui.els.title && !ui.els.title.classList.contains('hidden') && !ui.titleUserSwitched) ui.setTitleMode('voyage', { persist: false });
    const badge = $('voyage-daily-badge');
    badge.textContent = info.daily?.result ? 'Done' : 'New';
    $('btn-voyage-daily').setAttribute('aria-label', `Daily Voyage${info.daily?.result ? ', completed today' : ', new today'}`);
  },

  showMap(view) {
    this.syncMotion();
    this.mapView = view;
    this.mapReadOnly = view.status !== 'map';
    this.hideTooltip();
    $('voyage-result').hidden = true;
    $('voyage-end').hidden = true;
    $('voyage-map').hidden = false;
    $('voyage-map-sub').textContent = `${localDate(view.daily)} · ${num(view.score)} points · ${view.boons.length} charms`;
    $('voyage-map-progress').textContent = `${view.results.length} of ${view.boards} boards cleared · ${view.undos} shared undos`;
    $('voyage-map-close').textContent = this.mapReadOnly ? 'Return to board' : 'Menu';
    const firstAvailable = view.map.flat().find((n) => n.state === 'available');
    const current = view.map.flat().find((n) => n.state === 'current');
    this.selectedNode = this.mapReadOnly ? current?.id : firstAvailable?.id;
    this.highlightNode = null;
    this.renderChart();
    this.selectNode(this.selectedNode, false, false);
    this.setPreparing(this.preparing);
    requestAnimationFrame(() => {
      this.drawLinks();
      const target = $('voyage-chart').querySelector(this.mapReadOnly ? '.voyage-history-stage.current-stage' : '.voyage-active-section');
      if (target) {
        const scroll = $('voyage-map-scroll');
        const context = window.matchMedia('(max-width: 800px)').matches ? 0 : 118;
        scroll.scrollTop += target.getBoundingClientRect().top - scroll.getBoundingClientRect().top - context;
      }
      $('voyage-map').querySelector(this.mapReadOnly ? '#voyage-map-close' : '.voyage-map-detail [data-sail]')?.focus({ preventScroll: true });
    });
  },

  hideMap() { $('voyage-map').hidden = true; this.hideTooltip(); },
  setPreparing(value) {
    this.preparing = !!value;
    $('voyage-preparing').hidden = !value;
    $('voyage-chart').classList.toggle('preparing', !!value);
    $('voyage-map-detail').querySelector('[data-sail]')?.toggleAttribute('disabled', !!value);
  },

  renderChart() {
    const view = this.mapView;
    const all = view.map.flat();
    const byId = new Map(all.map((node) => [node.id, node]));
    const nodeHtml = (node, compact = false) => `<button type="button" class="voyage-node ${esc(node.state)} ${node.final ? 'final' : ''} ${compact ? 'compact' : ''}" data-node="${esc(node.id)}" data-node-id="${esc(node.id)}" data-parent="${esc(node.parent || '')}" aria-label="${esc(`${theme(node.theme).name}, board ${node.row + 1}, ${node.state}. Challenge: ${node.challenge?.name || 'none'}`)}" aria-pressed="${node.id === this.selectedNode}"><img src="${esc(art(node.theme))}" alt="" loading="lazy"><span class="voyage-node-shade"></span><span class="voyage-node-challenge" aria-hidden="true">${esc(node.challenge?.icon || '◆')}</span><span class="voyage-node-name">${esc(theme(node.theme).name)}</span><span class="voyage-node-state">${node.state === 'available' ? 'Choose' : node.state === 'current' ? 'Here' : node.state === 'visited' ? 'Cleared' : node.final ? 'Boss' : node.state === 'skipped' ? 'Passed' : 'Ahead'}</span></button>`;
    const history = view.map.map((row, i) => {
      const route = row?.find((node) => node.state === 'visited' || node.state === 'current');
      if (!route) return '';
      const passed = row.filter((node) => node.state === 'skipped');
      return `<section class="voyage-history-stage ${route.state === 'current' ? 'current-stage' : ''}" data-stage="${i}"><div class="voyage-stage-label"><span>${String(i + 1).padStart(2, '0')}</span><strong>${i === view.boards - 1 ? 'Final table' : `Board ${i + 1}`}</strong></div><div class="voyage-history-nodes"><div class="voyage-history-side">${passed[0] ? nodeHtml(passed[0], true) : ''}</div><div class="voyage-history-main">${nodeHtml(route, true)}</div><div class="voyage-history-side">${passed[1] ? nodeHtml(passed[1], true) : ''}</div></div></section>`;
    }).join('');
    const choices = all.filter((node) => node.state === 'available');
    const choiceRow = choices[0]?.row ?? -1;
    const branches = choices.map((node) => {
      const children = node.links.map((id) => byId.get(id)).filter(Boolean);
      return `<article class="voyage-active-branch" data-branch="${esc(node.id)}"><div class="voyage-branch-parent">${nodeHtml(node)}</div>${children.length ? `<div class="voyage-branch-caption">Leads to board ${node.row + 2}</div><div class="voyage-branch-children">${children.map((child) => nodeHtml(child)).join('')}</div>` : ''}</article>`;
    }).join('');
    const active = choices.length ? `<section class="voyage-active-section" data-stage="${choiceRow}"><div class="voyage-active-heading"><span class="voyage-kicker">Choose board ${choiceRow + 1} of ${view.boards}</span><strong>${choices.length} routes ahead</strong></div><div class="voyage-active-branches count-${choices.length}">${branches}</div></section>` : '';
    const lastVisible = Math.max(-1, ...all.map((node) => node.row));
    const future = Array.from({ length: Math.max(0, view.boards - lastVisible - 1) }, (_, k) => {
      const row = lastVisible + k + 1;
      return `<div class="voyage-future-stage" data-stage="${row}"><span class="voyage-future-number">${String(row + 1).padStart(2, '0')}</span><span>${row === view.boards - 1 ? 'Final table' : `Board ${row + 1}`}</span><i></i><small>Uncharted</small></div>`;
    }).join('');
    const boss = `<div class="voyage-boss-marker">${compactCharm(view.boss)}<span>Board 7 boss: ${esc(view.boss?.name || 'unknown')}</span></div>`;
    $('voyage-chart').innerHTML = `<svg class="voyage-route-lines" aria-hidden="true"></svg><div class="voyage-chart-content">${history}${active}<div class="voyage-future">${future}${boss}</div></div>`;
  },

  drawLinks() {
    const chart = $('voyage-chart');
    const svg = chart.querySelector('svg');
    if (!svg || !this.mapView) return;
    const rect = chart.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${Math.max(1, rect.width)} ${Math.max(1, rect.height)}`);
    const byId = new Map(this.mapView.map.flat().map((node) => [node.id, node]));
    const paths = [];
    for (const node of byId.values()) {
      const a = chart.querySelector(`[data-node-id="${CSS.escape(node.id)}"]`);
      if (!a) continue;
      const children = (node.links || []).map((id) => ({ id, view: byId.get(id), el: chart.querySelector(`[data-node-id="${CSS.escape(id)}"]`) })).filter((child) => child.view && child.el && child.view.parent === node.id);
      if (!children.length) continue;
      const ar = a.getBoundingClientRect();
      const x1 = ar.left + ar.width / 2 - rect.left;
      const y1 = ar.bottom - rect.top;
      const yFirst = Math.min(...children.map(({ el }) => el.getBoundingClientRect().top - rect.top));
      const hub = y1 + Math.max(10, Math.min(28, (yFirst - y1) * .38));
      const anyTaken = children.some(({ view }) => ['visited', 'current'].includes(view.state));
      const trunkType = anyTaken ? 'taken' : children.some(({ view }) => view.state === 'available') ? 'available-fork' : 'upcoming-fork';
      const activeTrunk = this.highlightNode && (node.id === this.highlightNode || children.some(({ id }) => id === this.highlightNode));
      paths.push(`<path d="M${x1} ${y1} L${x1} ${hub}" class="${trunkType} ${activeTrunk ? 'highlight' : ''}"/>`);
      for (const { id, view: child, el: b } of children) {
        const br = b.getBoundingClientRect();
        const x2 = br.left + br.width / 2 - rect.left;
        const y2 = br.top - rect.top;
        const d = `M${x1} ${hub} C${x1} ${hub + Math.max(12, (y2 - hub) * .42)},${x2} ${y2 - Math.max(12, (y2 - hub) * .32)},${x2} ${y2}`;
        const type = ['visited', 'current'].includes(child.state) ? 'taken' : child.state === 'available' ? 'available-fork' : child.state === 'skipped' ? 'skipped-stub' : 'upcoming-fork';
        const active = this.highlightNode && (id === this.highlightNode || node.id === this.highlightNode);
        const dim = this.highlightNode && ['available', 'upcoming'].includes(child.state) && !active;
        paths.push(`<path d="${d}" class="${type} ${active ? 'highlight' : ''} ${dim ? 'dimmed' : ''}"/>`);
      }
    }
    svg.innerHTML = paths.join('');
  },

  selectNode(id, focus = true, highlight = true) {
    const node = this.mapView?.map.flat().find((n) => n.id === id);
    if (!node) return;
    this.selectedNode = id;
    this.highlightNode = highlight && node.state === 'available' ? id : null;
    $('voyage-chart').querySelectorAll('[data-node]').forEach((button) => button.setAttribute('aria-pressed', button.dataset.node === id));
    $('voyage-chart').classList.toggle('has-highlight', !!this.highlightNode);
    $('voyage-chart').querySelectorAll('[data-branch]').forEach((branch) => branch.classList.toggle('highlight', branch.dataset.branch === this.highlightNode));
    this.drawLinks();
    const t = theme(node.theme);
    const challenge = node.challenge;
    const canSail = node.state === 'available' && !this.mapReadOnly;
    const byId = new Map(this.mapView.map.flat().map((n) => [n.id, n]));
    const leads = (node.links || []).map((childId) => byId.get(childId)).filter(Boolean);
    $('voyage-map-detail').innerHTML = `<div class="voyage-detail-hero"><img src="${esc(art(node.theme))}" alt=""><div><small>Board ${node.row + 1} of ${this.mapView.boards}${node.final ? ' · Final table' : ''}</small><h3>${esc(t.name)}</h3><p>${esc(t.tagline)}</p></div></div><div class="voyage-detail-body"><div class="voyage-detail-challenge"><span class="voyage-detail-icon">${compactCharm(challenge)}</span><div><small>${node.final ? 'Final theme challenge' : 'Theme challenge'}</small><strong>${esc(challenge?.name || 'Challenge')}</strong><p>${esc(challenge?.text || '')}</p></div></div>${node.final && this.mapView.boss ? `<div class="voyage-detail-challenge boss"><span class="voyage-detail-icon">${compactCharm(this.mapView.boss)}</span><div><small>Boss</small><strong>${esc(this.mapView.boss.name)}</strong><p>${esc(this.mapView.boss.text)}</p></div></div>` : ''}${leads.length ? `<div class="voyage-detail-leads"><small>Leads to</small><strong>${leads.map((child) => esc(theme(child.theme).name)).join(' · ')}</strong></div>` : ''}<small class="voyage-offer-label">Possible charms from this table</small><div class="voyage-detail-boons">${(node.boons || []).map((c) => `<div>${compactCharm(c)}<span>${esc(c.name)}</span></div>`).join('')}</div><p class="voyage-detail-note">Earn stars to reveal more charm choices.</p></div><div class="voyage-detail-actions">${canSail ? `<button type="button" class="btn primary" data-sail ${this.preparing ? 'disabled' : ''}>Set sail →</button>` : `<span class="voyage-detail-status">${node.state === 'current' ? 'Current table' : node.state === 'visited' ? 'Board cleared' : node.state === 'upcoming' ? 'Ahead on the chart' : 'Route not taken'}</span>`}</div>`;
    if (focus && canSail) $('voyage-map-detail').querySelector('[data-sail]')?.focus({ preventScroll: true });
  },

  showBoardIntro(view) {
    this.syncMotion();
    this.setPreparing(false);
    const cur = view.current;
    if (!cur) return Promise.resolve();
    this.hideMap();
    const t = theme(cur.theme);
    const thresholds = cur.starThresholds || [];
    $('voyage-intro-card').innerHTML = `<p class="voyage-kicker">${localDate(view.daily)} · Board ${cur.idx + 1} of ${view.boards}</p><div class="voyage-intro-art"><img src="${esc(art(cur.theme))}" alt=""></div><h2 id="voyage-intro-title">${esc(t.name)}</h2><p class="voyage-intro-tagline">${esc(t.tagline)}</p><div class="voyage-intro-challenge">${compactCharm(cur.challenge)}<span><small>Theme challenge</small><strong>${esc(cur.challenge?.name || '')}</strong><em>${esc(cur.challenge?.text || '')}</em></span></div>${cur.boss ? `<div class="voyage-intro-challenge boss">${compactCharm(cur.boss)}<span><small>Final boss</small><strong>${esc(cur.boss.name)}</strong><em>${esc(cur.boss.text)}</em></span></div>` : ''}<div class="voyage-intro-facts"><span>Par <b>${num(cur.par)} moves</b></span><span>Free cells <b>${num(cur.freeCells)}</b></span></div><div class="voyage-intro-stars">${thresholds.map((score, i) => `<span>${'★'.repeat(i + 1)}<b>${i === 0 && !score ? 'Clear' : num(score)}</b></span>`).join('')}</div><p class="voyage-continue-hint">Tap or press Enter to continue</p>`;
    $('voyage-intro').hidden = false;
    $('voyage-intro-card').focus();
    return new Promise((resolve) => {
      this.introResolve = resolve;
      $('voyage-intro').onclick = () => this.finishIntro();
      $('voyage-intro').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.finishIntro(); } };
      this.introTimer = setTimeout(() => this.finishIntro(), settings.reducedMotion ? 1600 : 2600);
    });
  },
  finishIntro() { if (!this.introResolve) return; clearTimeout(this.introTimer); $('voyage-intro').hidden = true; const done = this.introResolve; this.introResolve = null; done(); },

  setHud(view) {
    if (!view) return;
    this.syncMotion();
    $('voyage-hud').hidden = document.body.dataset.mode !== 'voyage' || view.status !== 'board';
    const currentBoard = view.current?.idx != null ? view.current.idx + 1 : view.board;
    $('voyage-hud-board').textContent = `${currentBoard} / ${view.boards}`;
    $('voyage-hud-score').textContent = num(view.score);
    const undo = $('btn-undo');
    undo?.setAttribute('aria-label', `Undo move, ${view.undos} left in this run`);
    undo?.setAttribute('title', `${view.undos} undos left in this run`);
    const label = undo?.querySelector('span');
    if (label) label.textContent = `Undo ${view.undos}`;
    $('voyage-hud-charms').innerHTML = `<small>Charms</small>${view.boons.length ? view.boons.map((c) => compactCharm(c)).join('') : '<span class="voyage-empty-charms">None yet</span>'}`;
    $('voyage-hud-challenge').innerHTML = `<small>Challenge</small>${compactCharm(view.current?.challenge, 'voyage-effect-chip')}${view.current?.boss ? `<small>Boss</small>${compactCharm(view.current.boss, 'voyage-effect-chip boss')}` : ''}`;
  },

  setLiveScore({ total = 0, stars = 0, thresholds = [] } = {}) {
    $('voyage-live-score').textContent = num(total);
    const high = Math.max(Number(thresholds[2]) || 0, 1);
    $('voyage-star-track').innerHTML = `<div class="voyage-star-fill" style="width:${Math.min(100, Math.max(0, Number(total) / high * 100))}%"></div>${[0, 1, 2].map((i) => `<span class="${stars > i ? 'earned' : ''}" style="left:${Math.min(96, Math.max(4, (Number(thresholds[i]) || 0) / high * 100))}%" title="${i + 1} star${i ? 's' : ''}: ${num(thresholds[i])} points">★</span>`).join('')}`;
    $('voyage-star-track').setAttribute('aria-label', `${num(total)} board points, ${stars} stars. Thresholds ${thresholds.map(num).join(', ')}`);
  },

  showResult(view) {
    this.syncMotion();
    this.hideMap();
    this.resultTimers.forEach(clearTimeout);
    this.resultTimers = [];
    const result = view.results.at(-1);
    if (!result) return;
    const t = theme(result.theme);
    const lines = result.score?.lines || [];
    const mults = result.score?.mults || [];
    const offers = view.reward?.offers || [];
    const next = view.status === 'won' ? '<button class="btn primary" data-result-end>See voyage summary</button>' : offers.length ? '' : '<button class="btn primary" data-result-continue>Continue voyage</button>';
    $('voyage-result-card').innerHTML = `<p class="voyage-kicker">Board ${result.idx + 1} of ${view.boards} · ${esc(t.name)}</p><h2 id="voyage-result-title">Table cleared</h2><div class="voyage-result-stars" aria-label="${result.stars} of 3 stars">${starText(result.stars)}</div><p class="voyage-result-sub">${num(result.moves)} moves · ${formatTime(result.time)} · ${num(result.undosUsed)} undos used</p><div class="voyage-score-sheet"><div class="voyage-score-lines">${lines.map((line, i) => `<div style="--line:${i}"><span>${esc(line.label)}</span><b>${num(line.pts)}</b></div>`).join('')}${mults.map((m, i) => `<div class="voyage-mult" style="--line:${lines.length + i}"><span>${esc(m.label)}</span><b>×${Number(m.x).toFixed(2)}</b></div>`).join('')}</div><div class="voyage-score-total"><span>Board score</span><strong>${num(result.total)}</strong></div><div class="voyage-score-run">Run total <b>${num(view.score)}</b></div></div>${offers.length ? `<div class="voyage-reward"><p class="voyage-kicker">Choose one charm · ${result.stars} ${result.stars === 1 ? 'choice' : 'choices'} earned</p><div class="voyage-reward-options">${offers.map((c) => charmCard(c, `<button class="btn primary" data-pick-charm="${esc(c.id)}">Choose</button>`)).join('')}</div></div>` : `<div class="voyage-actions">${next}</div>`}`;
    $('voyage-result').hidden = false;
    const card = $('voyage-result-card');
    card.classList.remove('show-stars', 'show-reward');
    const delay = settings.reducedMotion ? 0 : 480;
    this.resultTimers.push(setTimeout(() => card.classList.add('show-stars'), delay));
    this.resultTimers.push(setTimeout(() => card.classList.add('show-reward'), delay + (settings.reducedMotion ? 0 : 450)));
    this.resultTimers.push(setTimeout(() => card.querySelector('button[data-pick-charm], button[data-result-continue], button[data-result-end]')?.focus({ preventScroll: true }), delay + (settings.reducedMotion ? 0 : 520)));
  },

  showRunEnd(view) {
    this.hideAll();
    const won = view.status === 'won';
    const reached = won ? view.boards : Math.min(view.boards, view.results.length + 1);
    const allCharms = new Map(view.boons.map((c) => [c.id, c]));
    $('voyage-end-card').innerHTML = `<p class="voyage-kicker">${localDate(view.daily)}</p><h2 id="voyage-end-title">${won ? 'Voyage complete' : 'Voyage ended'}</h2><p class="voyage-end-sub">${won ? 'Seven tables crossed. Your chart is complete.' : view.lostReason === 'abandoned' ? 'The run was abandoned.' : 'No more routes through this table.'}</p><div class="voyage-end-totals"><div><small>Boards reached</small><strong>${reached} / ${view.boards}</strong></div><div><small>Total score</small><strong>${num(view.score)}</strong></div><div><small>Stars earned</small><strong>${num(view.stars)}</strong></div></div><div class="voyage-end-list">${view.results.map((r) => `<div class="voyage-end-row"><img src="${esc(art(r.theme))}" alt=""><span><small>Board ${r.idx + 1}</small><strong>${esc(theme(r.theme).name)}</strong><em>${r.charm ? `Charm: ${esc(allCharms.get(r.charm)?.name || r.charm)}` : 'No charm picked'}</em></span><span class="voyage-end-row-score"><b>${starText(r.stars)}</b><strong>${num(r.total)}</strong></span></div>`).join('')}</div><div class="voyage-end-charms"><small>Charms collected</small><div>${view.boons.length ? view.boons.map((c) => compactCharm(c)).join('') : '<span>None</span>'}</div></div><div class="voyage-actions"><button class="btn primary" data-new-voyage>New Voyage</button><button class="btn" data-end-menu>Menu</button></div>`;
    $('voyage-end').hidden = false;
    $('voyage-end-card').querySelector('[data-new-voyage]')?.focus({ preventScroll: true });
  },

  hideAll() {
    this.finishIntro();
    this.preparing = false;
    this.hideTooltip();
    $('voyage-hud').hidden = true;
    for (const id of ['voyage-map', 'voyage-intro', 'voyage-result', 'voyage-end', 'voyage-confirm', 'voyage-tutorial']) $(id).hidden = true;
    this.resultTimers.forEach(clearTimeout);
    this.resultTimers = [];
    if (this.confirmResolve) this.resolveConfirm(false);
  },

  confirm({ title = 'Are you sure?', text = '', ok = 'Confirm', cancel = 'Cancel' } = {}) {
    if (this.confirmResolve) this.resolveConfirm(false);
    this.lastFocus = document.activeElement;
    $('voyage-confirm-title').textContent = title;
    $('voyage-confirm-text').textContent = text;
    $('voyage-confirm-ok').textContent = ok;
    $('voyage-confirm-cancel').textContent = cancel;
    $('voyage-confirm').hidden = false;
    $('voyage-confirm-cancel').focus();
    return new Promise((resolve) => {
      this.confirmResolve = resolve;
      $('voyage-confirm-ok').onclick = () => this.resolveConfirm(true);
      $('voyage-confirm-cancel').onclick = () => this.resolveConfirm(false);
    });
  },
  resolveConfirm(value) { if (!this.confirmResolve) return; $('voyage-confirm').hidden = true; const done = this.confirmResolve; this.confirmResolve = null; done(value); this.lastFocus?.focus?.(); },

  tutorial(step, force = false) {
    const copy = {
      map: ['Read the chart', 'Choose a table to set sail. Two rows are visible ahead; each table shows its challenge and possible charms. The final boss is marked from the start.'],
      board: ['Your voyage kit', 'Charms last through the run. Tap them for details. The challenge changes this table, and your undos are shared across all seven boards. There are no restarts.'],
      reward: ['Stars reveal choices', 'A cleared table earns one to three stars. Each star reveals another charm choice; choose one to carry through the rest of your voyage.'],
    }[step];
    if (!copy || (!force && this.tutorialSeen?.[step])) return;
    if (!force) { this.tutorialSeen[step] = true; save('voyageTutorial', this.tutorialSeen); }
    $('voyage-tutorial-title').textContent = copy[0];
    $('voyage-tutorial-text').textContent = copy[1];
    $('voyage-tutorial').dataset.step = step;
    $('voyage-tutorial').hidden = false;
    $('voyage-tutorial-done').textContent = this.tutorialQueue?.length ? 'Next' : 'Got it';
    $('voyage-tutorial-done').focus({ preventScroll: true });
  },
  replayTutorial() { this.tutorialQueue = ['map', 'board', 'reward']; this.tutorial(this.tutorialQueue.shift(), true); },
  dismissTutorial(advance = false) {
    $('voyage-tutorial').hidden = true;
    if (advance && this.tutorialQueue?.length) this.tutorial(this.tutorialQueue.shift(), true);
    else this.tutorialQueue = null;
  },

  renderStats(stats = {}) {
    const rate = stats.runs ? Math.round((stats.wins || 0) / stats.runs * 100) : 0;
    const cells = [['Runs', stats.runs], ['Won', stats.wins], ['Win rate', `${rate}%`], ['Boards cleared', stats.boardsCleared], ['Best board', stats.bestBoard ? `${stats.bestBoard} / 7` : '—'], ['Best score', num(stats.bestScore)], ['Best stars', stats.bestStars], ['Win streak', stats.winStreak], ['Best streak', stats.bestWinStreak]];
    const topThemes = Object.entries(stats.themeClears || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topCharms = Object.entries(stats.charmPicks || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
    $('stats-voyage').innerHTML = `<div class="stat-grid">${cells.map(([label, value]) => `<div><label>${esc(label)}</label><b>${esc(value ?? 0)}</b></div>`).join('')}</div><h4>Tables visited</h4><div class="voyage-stat-list">${topThemes.length ? topThemes.map(([id, count]) => `<div><span>${esc(theme(id).name)}</span><b>${num(count)}</b></div>`).join('') : '<p>No boards cleared yet.</p>'}</div><h4>Favorite charms</h4><div class="voyage-stat-list">${topCharms.length ? topCharms.map(([id, count]) => `<div><span>${esc(CHARMS[id]?.name || id)}</span><b>${num(count)}</b></div>`).join('') : '<p>No charms picked yet.</p>'}</div><h4>Recent voyages</h4><div class="voyage-stat-list">${(stats.recent || []).slice(0, 5).map((r) => `<div><span>${r.daily ? `Daily ${esc(r.daily)}` : 'Voyage'} · ${r.won ? 'Won' : `Board ${r.board}`}</span><b>${num(r.score)}</b></div>`).join('') || '<p>Your voyages will appear here.</p>'}</div>`;
  },
  statsTab(which) {
    const voyage = which === 'voyage';
    $('stats-voyage').hidden = !voyage;
    $('stats-classic').hidden = voyage;
    for (const [id, active] of [['stats-tab-voyage', voyage], ['stats-tab-classic', !voyage]]) {
      $(id).classList.toggle('active', active);
      $(id).setAttribute('aria-selected', String(active));
    }
  },

  showTooltip(anchor) {
    if (!anchor?.isConnected) return;
    this.tooltipAnchor = anchor;
    const tip = $('voyage-tooltip');
    tip.innerHTML = `<strong>${esc(anchor.dataset.tipName)}</strong><span>${esc(anchor.dataset.tipText)}</span>`;
    tip.hidden = false;
    this.positionTooltip();
  },
  positionTooltip() {
    const anchor = this.tooltipAnchor, tip = $('voyage-tooltip');
    if (!anchor?.isConnected || tip.hidden) return;
    const r = anchor.getBoundingClientRect();
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    const top = r.top - h - 10 < 8 ? r.bottom + 10 : r.top - h - 10;
    tip.style.left = `${left}px`; tip.style.top = `${Math.max(8, Math.min(innerHeight - h - 8, top))}px`;
  },
  hideTooltip() { $('voyage-tooltip').hidden = true; this.tooltipAnchor = null; },
  syncMotion() { document.body.classList.toggle('voyage-reduced-motion', !!settings.reducedMotion); },
};
