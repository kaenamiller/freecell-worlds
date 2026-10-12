// Voyage's DOM layer. main.js owns the run and supplies RunView snapshots.
import { THEMES } from '../themes.js';
import { load, save, settings } from '../store.js';
import { ui } from '../ui.js';
import { CHARMS } from './charms.js';
import { explainScoreLine } from './scoring.js';
import { voyageStats } from './stats.js';

const $ = (id) => document.getElementById(id);
const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (value) => Math.round(Number(value) || 0).toLocaleString();
const theme = (id) => THEMES[id] || { name: id || 'Unknown table', tagline: '', art: {} };
const art = (id) => theme(id).art?.thumb ? new URL(`../../${theme(id).art.thumb.replace(/^\.\//, '')}`, import.meta.url).href : '';
const starText = (n) => `${'★'.repeat(Math.max(0, Number(n) || 0))}${'☆'.repeat(Math.max(0, 3 - (Number(n) || 0)))}`;
const relationBadge = (c) => c?.relation ? `<b class="voyage-boss-relation relation-${c.relation === '+' ? 'help' : c.relation === '!' ? 'weak' : 'neutral'}" title="${esc(c.relationText)}" aria-label="${esc(c.relationText)}">${esc(c.relation)}</b>` : '';
const compactCharm = (c, extra = '', interactive = false) => c ? `<button type="button" class="voyage-charm ${c.placeholder ? 'placeholder' : ''} ${extra} ${interactive && c.ability ? 'voyage-ability' : ''}" ${interactive && c.ability ? `data-ability="${esc(c.id)}" aria-disabled="${!c.ability.available}"` : ''} aria-label="${esc(`${c.name}. ${c.text}${c.badge ? ` ${c.badge}.` : ''}${c.relationText ? ` ${c.relationText}.` : ''}${interactive && c.ability ? ` ${c.ability.label}, ${c.ability.uses} uses left.` : ''}`)}" aria-describedby="voyage-tooltip" data-tip-name="${esc(c.name)}" data-tip-text="${esc(c.text + (c.relationText ? ` ${c.relationText}.` : ''))}"><span aria-hidden="true">${esc(c.icon || '✦')}</span>${c.badge ? `<b class="voyage-charm-badge">${esc(c.badge)}</b>` : ''}${relationBadge(c)}${interactive && c.ability ? `<b class="voyage-use-pip" aria-hidden="true">${c.ability.uses}</b>` : ''}</button>` : '';
const charmCard = (c, action = '') => `<article class="voyage-charm-card"><div class="voyage-charm-card-icon">${compactCharm(c)}</div><div><small>${esc(c.kind || 'charm')}</small><h4>${esc(c.name)}</h4><p>${esc(c.text)}</p></div>${action}</article>`;
const localDate = (key) => key ? `Daily Voyage · ${esc(key)}` : 'Voyage';
const formatTime = (seconds) => `${Math.floor((seconds || 0) / 60)}:${String(Math.round((seconds || 0) % 60)).padStart(2, '0')}`;

// The second star is anchored at the middle of the bar. Points from zero to that
// threshold fill the left half; points from there to the third star fill the right half.
const starBar = (total, thresholds = []) => {
  const marks = [0, 1, 2].map((i) => Math.max(0, Number(thresholds[i]) || 0));
  const score = Math.max(0, Number(total) || 0);
  const mid = marks[1];
  const top = Math.max(marks[2], mid);
  let fill = 0;
  if (mid <= 0) fill = score > 0 ? 100 : 0;
  else if (score <= mid) fill = (score / mid) * 50;
  else if (top <= mid) fill = 100;
  else fill = Math.min(100, 50 + ((score - mid) / (top - mid)) * 50);
  const places = [mid <= 0 ? 0 : Math.min(46, (marks[0] / mid) * 50), 50, 100];
  return { fill, places, marks };
};
const boardScoreTip = (thresholds) => {
  const { marks } = starBar(0, thresholds);
  return `Two stars at ${num(marks[1])} points. Three stars at ${num(marks[2])}. Sending cards home, especially in a chain, raises the score. Extra moves and free-cell placements lower it.`;
};

export const voyageUI = {
  handlers: {},
  mapView: null,
  selectedNode: null,
  highlightNode: null,
  mapReadOnly: false,
  preparing: false,
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
    $('btn-voyage-new')?.addEventListener('click', () => this.handlers.startVoyage?.({ daily: false }));
    $('btn-voyage-daily')?.addEventListener('click', () => this.handlers.startVoyage?.({ daily: true }));
    $('btn-voyage-how')?.addEventListener('click', () => this.replayTutorial());
    $('voyage-open-map')?.addEventListener('click', () => this.handlers.openMap?.());
    // Ability buttons live in the charm tray (#voyage-dock) and the effect chips (#voyage-hud).
    for (const id of ['voyage-hud', 'voyage-dock']) $(id)?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-ability]');
      if (button && button.getAttribute('aria-disabled') !== 'true') this.handlers.useAbility?.(button.dataset.ability);
    });
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
      if (target && target.dataset.tipPin !== 'off') { this.tooltipPinned = !(this.tooltipPinned && this.tooltipAnchor === target); this.tooltipPinned ? this.showTooltip(target) : this.hideTooltip(); }
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
    $('voyage-hud').hidden = $('voyage-dock').hidden = mode !== 'voyage';
    if (mode === 'classic') {
      this.hideAll();
      const undo = $('btn-undo');
      undo?.removeAttribute('data-tip-name');
      undo?.removeAttribute('data-tip-text');
      undo?.removeAttribute('data-tip-pin');
      if (undo?.getAttribute('aria-describedby') === 'voyage-tooltip') undo.removeAttribute('aria-describedby');
      undo?.setAttribute('title', 'Undo (U)');
      undo?.setAttribute('aria-label', 'Undo move');
      const label = undo?.querySelector('span');
      if (label) label.textContent = 'Undo';
    }
  },

  refreshTitle(info = {}) {
    this.titleRun = info.run || null;
    $('btn-voyage-label').textContent = info.run ? 'Continue Voyage' : 'Begin Voyage';
    $('btn-voyage-new').hidden = !info.run;
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
    ui.fitTitle?.();
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

  showBossIntro(view) {
    const boss = view.current?.boss;
    if (!boss) return Promise.resolve();
    this.hideMap();
    this.setPreparing(false);
    this.syncMotion();
    $('voyage-intro-card').innerHTML = `<p class="voyage-kicker">Board 7 · The finale</p><div class="voyage-boss-icon" aria-hidden="true">${esc(boss.icon)}</div><h2 id="voyage-intro-title">${esc(boss.name)}</h2><p>${esc(boss.text)}</p><p class="voyage-boss-watch">Watch for: ${esc(boss.tell)}</p>${view.current.budgeted ? '<p class="voyage-detail-note">Challenge eased for the finale.</p>' : ''}<button type="button" class="btn primary voyage-intro-continue" data-intro-continue>Continue</button>`;
    return this.openIntro();
  },

  flashBossTell(view) {
    const boss = view.current?.boss;
    if (!boss) return;
    document.querySelector('.voyage-tell-flash')?.remove();
    const tell = document.createElement('div');
    tell.className = 'voyage-tell-flash'; tell.setAttribute('role', 'status');
    tell.textContent = `${boss.icon} Watch for: ${boss.tell}`;
    document.body.append(tell);
    $('voyage-hud-challenge').classList.add('voyage-tell-glow');
    setTimeout(() => { tell.remove(); $('voyage-hud-challenge').classList.remove('voyage-tell-glow'); }, 2000);
  },

  showBoardIntro(view) {
    this.syncMotion();
    this.setPreparing(false);
    const cur = view.current;
    if (!cur) return Promise.resolve();
    this.hideMap();
    const t = theme(cur.theme);
    const thresholds = cur.starThresholds || [];
    $('voyage-intro-card').innerHTML = `<p class="voyage-kicker">${localDate(view.daily)} · Board ${cur.idx + 1} of ${view.boards}</p><div class="voyage-intro-art"><img src="${esc(art(cur.theme))}" alt=""></div><h2 id="voyage-intro-title">${esc(t.name)}</h2><p class="voyage-intro-tagline">${esc(t.tagline)}</p><div class="voyage-intro-challenge">${compactCharm(cur.challenge)}<span><small>Theme challenge · Strength ${cur.strength ?? cur.idx + 1}</small><strong>${esc(cur.challenge?.name || '')}</strong><em>${esc(cur.challenge?.text || '')}</em></span></div>${cur.boss ? `<div class="voyage-intro-challenge boss">${compactCharm(cur.boss)}<span><small>Final boss</small><strong>${esc(cur.boss.name)}</strong><em>${esc(cur.boss.text)}</em></span></div>` : ''}<div class="voyage-intro-facts"><span>Par <b>${num(cur.par)} moves</b></span><span>Free cells <b>${num(cur.freeCells)}</b></span></div><div class="voyage-intro-stars">${thresholds.map((score, i) => `<span>${'★'.repeat(i + 1)}<b>${i === 0 && !score ? 'Clear' : num(score)}</b></span>`).join('')}</div>${cur.bossRelented ? `<p class="voyage-detail-note">${esc(view.boss?.name || 'The boss')} relented: no fair deal could be verified under it.</p>` : cur.budgeted ? '<p class="voyage-detail-note">Challenge eased for the finale.</p>' : cur.relaxed ? '<p class="voyage-detail-note">Challenge eased for a verified deal.</p>' : ''}<button type="button" class="btn primary voyage-intro-continue" data-intro-continue>Continue</button>`;
    return this.openIntro();
  },
  openIntro() {
    $('voyage-intro').hidden = false;
    const card = $('voyage-intro-card');
    (card.querySelector('[data-intro-continue]') || card).focus();
    return new Promise((resolve) => {
      this.introResolve = resolve;
      $('voyage-intro').onclick = () => this.finishIntro();
      $('voyage-intro').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.finishIntro(); } };
    });
  },
  finishIntro() { if (!this.introResolve) return; $('voyage-intro').hidden = true; const done = this.introResolve; this.introResolve = null; done(); },

  setHud(view) {
    if (!view) return;
    this.syncMotion();
    $('voyage-hud').hidden = $('voyage-dock').hidden = document.body.dataset.mode !== 'voyage' || view.status !== 'board';
    const currentBoard = view.current?.idx != null ? view.current.idx + 1 : view.board;
    $('voyage-hud-board').textContent = `${currentBoard} / ${view.boards}`;
    $('voyage-hud-board-metric').dataset.tipText = `Table ${currentBoard} of ${view.boards}. A voyage is seven tables in a row. Clear this one to continue. There is no restart, and undos are shared across the whole run.`;
    $('voyage-hud-score').textContent = num(view.score);
    $('voyage-hud-score-metric').dataset.tipText = `${num(view.score)} points from tables you have already cleared. The board score beside this is still in play and joins the run total only when you clear the table.`;
    const undo = $('btn-undo');
    undo?.setAttribute('aria-label', `Undo move, ${view.undos} left in this run. Press U.`);
    undo?.removeAttribute('title');
    undo?.setAttribute('aria-describedby', 'voyage-tooltip');
    undo?.setAttribute('data-tip-name', 'Undo');
    undo?.setAttribute('data-tip-pin', 'off');
    undo?.setAttribute('data-tip-text', `${view.undos} undos left for this voyage. Press U to take back a move. They are shared across all seven tables, and a move you undo is taken out of the board score.`);
    const label = undo?.querySelector('span');
    if (label) label.textContent = `Undo ${view.undos}`;
    $('voyage-hud-charms').innerHTML = `<small>Charms</small>${view.boons.length ? view.boons.map((c) => compactCharm(c, '', true)).join('') : '<span class="voyage-empty-charms" tabindex="0" aria-describedby="voyage-tooltip" data-tip-name="Charms" data-tip-text="Charms you pick after each table stay with you for the rest of the voyage.">None yet</span>'}`;
    $('voyage-hud-challenge').innerHTML = `<small>Challenge</small>${compactCharm(view.current?.challenge, 'voyage-effect-chip', true)}${view.current?.boss ? `<small>Boss</small>${compactCharm(view.current.boss, 'voyage-effect-chip boss', true)}` : ''}${view.current?.moveCapacity != null ? `<span class="voyage-capacity" tabindex="0" aria-describedby="voyage-tooltip" data-tip-name="Move size" data-tip-text="You can move a sequence of up to ${num(view.current.moveCapacity)} cards onto an occupied column. An empty column may accept a shorter sequence.">Move up to ${num(view.current.moveCapacity)}</span>` : ''}${view.current?.override ? '<span class="voyage-override-chip" tabindex="0" aria-describedby="voyage-tooltip" data-tip-name="Next drop" data-tip-text="Your next card drop uses a charm you armed. Place it, or press Esc to cancel.">✦ Next drop…</span>' : ''}`;
    this.refreshOpenTooltip();
  },

  pickTargets(kind, targets) {
    this.cancelPick();
    const overlay = document.createElement('div');
    overlay.className = 'voyage-targeting';
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', `Choose a ${kind}`);
    overlay.innerHTML = `<div class="voyage-pick-prompt">Choose a ${esc(kind)} <button type="button" class="btn" data-pick-cancel>Cancel · Esc</button></div>${targets.map((t, i) => `<button type="button" class="voyage-pick-target" data-target="${i}" style="left:${t.x}px;top:${t.y}px" aria-label="${esc(t.label)}">${i + 1}</button>`).join('')}`;
    document.body.append(overlay);
    this.pickOverlay = overlay;
    this.pickFocus = document.activeElement;
    this.pickKeys = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); this.cancelPick(); }
      else if (event.key === 'Tab') {
        const buttons = [...overlay.querySelectorAll('button')], i = buttons.indexOf(document.activeElement);
        event.preventDefault(); event.stopImmediatePropagation(); buttons[(i + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
      } else event.stopImmediatePropagation();
    };
    document.addEventListener('keydown', this.pickKeys, true);
    overlay.addEventListener('pointerdown', (event) => event.stopPropagation());
    overlay.addEventListener('click', (event) => {
      const button = event.target.closest('[data-target]');
      if (button) this.cancelPick(targets[Number(button.dataset.target)].value);
      else if (event.target.closest('[data-pick-cancel]')) this.cancelPick();
    });
    overlay.querySelector('[data-target]')?.focus();
    return new Promise((resolve) => { this.pickResolve = resolve; });
  },
  cancelPick(value = null) {
    this.pickOverlay?.remove(); this.pickOverlay = null;
    if (this.pickKeys) document.removeEventListener('keydown', this.pickKeys, true);
    this.pickKeys = null;
    const resolve = this.pickResolve; this.pickResolve = null;
    if (resolve) { this.pickFocus?.focus?.({ preventScroll: true }); resolve(value); }
  },

  setLiveScore({ total = 0, stars = 0, thresholds = [] } = {}) {
    $('voyage-live-score').textContent = num(total);
    const bar = starBar(total, thresholds);
    $('voyage-hud-live').dataset.tipText = boardScoreTip(thresholds);
    $('voyage-star-track').innerHTML = `<div class="voyage-star-scale"><div class="voyage-star-fill" style="width:${bar.fill}%"></div>${bar.places.map((place, i) => `<span class="${stars > i ? 'earned' : ''}" style="left:${place}%">★</span>`).join('')}</div>`;
    $('voyage-star-track').setAttribute('aria-label', `${num(total)} board points, ${stars} stars. Two stars at ${num(bar.marks[1])} points. Three stars at ${num(bar.marks[2])}.`);
    this.refreshOpenTooltip();
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
    const scoreNames = { cards: 'Cards home', efficiency: 'Moves', freecells: 'Free cells', chains: 'Chains', bossStars: 'Finale stars' };
    const scoreRow = (line, i, mult = false) => {
      const name = mult ? line.label : (scoreNames[line.key] || line.label);
      const text = explainScoreLine(line);
      return `<div class="voyage-score-line${mult ? ' voyage-mult' : ''}" style="--line:${i}" tabindex="0" aria-label="${esc(`${line.label}. ${text}`)}" aria-describedby="voyage-tooltip" data-tip-name="${esc(name)}" data-tip-text="${esc(text)}"><span>${esc(line.label)}</span><b>${mult ? `×${Number(line.x).toFixed(2)}` : num(line.pts)}</b></div>`;
    };
    $('voyage-result-card').innerHTML = `<p class="voyage-kicker">Board ${result.idx + 1} of ${view.boards} · ${esc(t.name)}</p><h2 id="voyage-result-title">Table cleared</h2><div class="voyage-result-stars" aria-label="${result.stars} of 3 stars">${starText(result.stars)}</div><p class="voyage-result-sub">${num(result.moves)} moves · ${formatTime(result.time)} · ${num(result.undosUsed)} undos used</p><div class="voyage-score-sheet"><div class="voyage-score-lines">${lines.map((line, i) => scoreRow(line, i)).join('')}${mults.map((m, i) => scoreRow(m, lines.length + i, true)).join('')}</div><div class="voyage-score-total"><span>Board score</span><strong>${num(result.total)}</strong></div><div class="voyage-score-run">Run total <b>${num(view.score)}</b></div></div>${offers.length ? `<div class="voyage-reward"><p class="voyage-kicker">Choose one charm · ${offers.length} ${offers.length === 1 ? 'choice' : 'choices'}</p><div class="voyage-reward-options">${offers.map((c) => charmCard(c, `<button class="btn primary" data-pick-charm="${esc(c.id)}">Choose</button>`)).join('')}</div></div>` : `<div class="voyage-actions">${next}</div>`}`;
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
    this.cancelPick();
    this.finishIntro();
    this.preparing = false;
    this.hideTooltip();
    $('voyage-hud').hidden = $('voyage-dock').hidden = true;
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

  refreshOpenTooltip() {
    if (!this.tooltipAnchor || $('voyage-tooltip').hidden) return;
    if (!this.tooltipAnchor.isConnected) { this.tooltipPinned = false; this.hideTooltip(); return; }
    this.showTooltip(this.tooltipAnchor);
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
