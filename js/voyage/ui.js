// Voyage's DOM layer. main.js owns the run and supplies RunView snapshots.
import { THEMES } from '../themes.js';
import { load, save, settings } from '../store.js';
import { ui } from '../ui.js';
import { CHARMS } from './charms.js';
import { VoyageChart } from './chart.js';
import { explainScoreLine } from './scoring.js';
import { voyageStats } from './stats.js';

const $ = (id) => document.getElementById(id);
const TARGET_HINT = 'Click a glowing target · or Tab, then Enter';
const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (value) => Math.round(Number(value) || 0).toLocaleString();
const theme = (id) => THEMES[id] || { name: id || 'Unknown table', tagline: '', art: {} };
const art = (id) => theme(id).art?.thumb ? new URL(`../../${theme(id).art.thumb.replace(/^\.\//, '')}`, import.meta.url).href : '';
const hero = (id) => theme(id).art?.hero ? new URL(`../../${theme(id).art.hero.replace(/^\.\//, '')}`, import.meta.url).href : '';
const chartIsland = (id) => new URL(`../../assets/art/chart/islands/${id}.webp`, import.meta.url).href;
const chartMarket = (kind) => new URL(`../../assets/art/chart/markets/${kind}.webp`, import.meta.url).href;
const stickerArt = (type) => new URL(`../../assets/art/stickers/${type}.webp`, import.meta.url).href;
const chartBoat = new URL('../../assets/art/chart/boat.webp', import.meta.url).href;
const starText = (n) => `${'★'.repeat(Math.max(0, Number(n) || 0))}${'☆'.repeat(Math.max(0, 3 - (Number(n) || 0)))}`;
const relationBadge = (c) => (c?.relation === '+' || c?.relation === '!') ? `<b class="voyage-boss-relation relation-${c.relation === '+' ? 'help' : 'weak'}" title="${esc(c.relationText)}" aria-label="${esc(c.relationText)}">${esc(c.relation)}</b>` : '';
const charmArt = (c) => (c?.id && !c.placeholder ? new URL(`../../assets/art/charms/${c.id}.webp`, import.meta.url).href : '');
const charmGlyph = (c) => {
  const src = charmArt(c);
  return src ? `<img src="${esc(src)}" alt="" draggable="false">` : esc(c?.icon || '✦');
};
const FAMILIES = { cells: '▣', columns: '▥', wild: '◇', suit: '♠', foundation: '⌂', ability: 'ϟ', undo: '↶', coin: '⛁', vision: '◉', sticker: '✧', fortune: '☆' };
const STICKERS = { wild: ['◇', 'Wild'], fool: ['△', 'Fool'], key: ['⚿', 'Key'], gold: ['⛁', 'Gold'], lucky: ['✣', 'Lucky'] };
// Engine card ids use foundation order: clubs, diamonds, hearts, spades.
const SUITS = ['♣', '♦', '♥', '♠'];
const SUIT_NAMES = ['Clubs', 'Diamonds', 'Hearts', 'Spades'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const cardName = (id) => `${RANKS[(Number(id) - 1) % 13]}${SUITS[Math.floor((Number(id) - 1) / 13)]}`;
const activeText = (c) => c?.level === 2 && c.upgradeText ? c.upgradeText : c?.text || '';
const familyName = (c) => c?.family ? `${FAMILIES[c.family] || '✦'} ${c.family}` : '';
const kindName = (c) => c?.kind === 'challenge' ? 'Challenge' : c?.kind || 'charm';
const secondaryChallenges = (current) => (current?.extraChallenges?.length ? current.extraChallenges : current?.stormChallenge ? [current.stormChallenge] : []).filter((c) => !c.hidden);
const stormNote = '<span class="voyage-storm-note">ϟ Storm table · Double coins · 3 charm choices</span>';
const levelBadge = (c) => c?.level === 2 ? '<b class="voyage-level" aria-label="Level 2">II</b>' : '';
const confiscated = (view) => view.current?.confiscated || view.confiscated;
const mapConfiscated = (view, node) => node?.confiscated || confiscated(view) || view.map?.flat().find((n) => n.final && n.confiscated)?.confiscated;
const confiscation = (view) => confiscated(view) ? `<span class="voyage-confiscation">Confiscates: ${esc(confiscated(view).name)}</span>` : '';
const compactCharm = (c, extra = '', interactive = false) => {
  if (!c || c.hidden) return '';
  const usable = interactive && c.ability && !c.confiscated;
  const text = `${activeText(c)}${c.confiscated ? ' Confiscated during the finale.' : ''}`;
  const name = `${c.name}${c.level === 2 ? ' · II' : ''}${c.family ? ` · ${familyName(c)}` : ''}`;
  return `<button type="button" class="voyage-charm ${c.placeholder ? 'placeholder' : ''} ${extra} ${c.confiscated ? 'confiscated' : ''} ${usable ? 'voyage-ability' : ''}" ${usable ? `data-ability="${esc(c.id)}" aria-disabled="${!c.ability.available}"` : ''} aria-label="${esc(`${name}. ${text}${c.badge ? ` ${c.badge}.` : ''}${c.relationText ? ` Boss interaction: ${c.relationText}.` : ''}${usable ? ` ${c.ability.label}, ${c.ability.uses} uses left.` : ''}`)}" aria-describedby="voyage-tooltip" data-tip-name="${esc(name)}" data-tip-text="${esc(text)}"${c.relationText ? ` data-tip-relation="${esc(c.relationText)}"` : ''}><span aria-hidden="true">${charmGlyph(c)}</span>${c.badge ? `<b class="voyage-charm-badge">${esc(c.badge)}</b>` : ''}${levelBadge(c)}${c.family ? `<i class="voyage-family-glyph" aria-hidden="true">${esc(FAMILIES[c.family] || '✦')}</i>` : ''}${relationBadge(c)}${usable ? `<b class="voyage-use-pip" aria-hidden="true">${c.ability.uses}</b>` : ''}</button>`;
};
const charmCard = (c, action = '', preview = false) => c.hidden ? '' : `<article class="voyage-charm-card"><div class="voyage-charm-card-icon">${compactCharm(c)}</div><div class="voyage-charm-copy"><small>${esc(familyName(c) || kindName(c))}</small><h4>${esc(c.name)} ${levelBadge(c)}</h4><p>${preview ? `Now: ${esc(activeText(c))}<br><span class="voyage-upgrade-preview">→ Upgraded: ${esc(c.upgradeText || activeText(c))}</span>` : esc(activeText(c))}</p></div>${action}</article>`;
const purse = (coins) => `<span class="voyage-purse" aria-label="${num(coins)} coins"><span aria-hidden="true">⛁</span> ${num(coins)}</span>`;
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
  chart: null,
  selectedByUser: false,

  init(handlers = {}) {
    this.handlers = handlers;
    this.chart = new VoyageChart($('voyage-chart'), {
      theme,
      islandUrl: chartIsland,
      marketUrl: chartMarket,
      boatUrl: chartBoat,
      landmarkUrl: new URL('../../assets/art/chart/boss-landmark.webp', import.meta.url).href,
      silhouetteUrl: new URL('../../assets/art/chart/fog-isle.webp', import.meta.url).href,
      charmGlyph: (charm) => charm?.icon || '✦',
    });
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
      // While a charm is asking for a target, any charm in the tray cancels it.
      if (button && this.targetCancel) { this.cancelTarget(); return; }
      if (button && button.getAttribute('aria-disabled') !== 'true') this.handlers.useAbility?.(button.dataset.ability);
    });
    $('voyage-abandon')?.addEventListener('click', () => this.handlers.abandonBoard?.());
    $('voyage-map-close')?.addEventListener('click', () => this.mapReadOnly ? this.hideMap() : this.handlers.toMenu?.());
    $('voyage-map')?.addEventListener('click', (event) => {
      if (this.chart?.motion) { event.preventDefault(); event.stopPropagation(); this.chart.skip(); }
    }, true);
    $('voyage-chart')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-node]');
      if (this.chart?.motion) { this.chart.skip(); return; }
      if (this.chart?.didDrag) { this.chart.didDrag = false; return; }
      if (!button || this.preparing) return;
      if (String(button.dataset.node).startsWith('market:')) {
        const market = this.mapView?.markets?.find((item) => item.id === button.dataset.node);
        if (this.tappedNode === button.dataset.node && market?.state === 'available' && !this.mapReadOnly) {
          this.enterMarket(market.id);
          return;
        }
        this.selectedByUser = true;
        this.selectMarket(button.dataset.node);
        this.tappedNode = button.dataset.node;
        return;
      }
      if (button.dataset.node === '__boss__') {
        this.selectedByUser = true;
        this.selectNode('__boss__', false);
        this.tappedNode = '__boss__';
        return;
      }
      const node = this.mapView?.map.flat().find((item) => item.id === button.dataset.node);
      if (this.tappedNode === button.dataset.node && node?.state === 'available' && !this.mapReadOnly) {
        this.handlers.pickNode?.(button.dataset.node);
      } else {
        this.selectedByUser = true;
        this.selectNode(button.dataset.node, false);
        this.tappedNode = button.dataset.node;
      }
    });
    $('voyage-chart')?.addEventListener('focusin', (event) => {
      const button = event.target.closest('[data-node]');
      if (button && button.dataset.node !== this.selectedNode) {
        if (String(button.dataset.node).startsWith('market:')) this.selectMarket(button.dataset.node);
        else this.selectNode(button.dataset.node, false);
      }
    });
    $('voyage-map-detail')?.addEventListener('click', (event) => {
      if (event.target.closest('[data-back-route]')) {
        const id = this.mapRouteNode || this.mapView?.map.flat().find((n) => n.state === 'available')?.id || this.mapView?.map.flat().find((n) => n.state === 'current')?.id;
        if (id) this.selectNode(id, false);
        return;
      }
      if (event.target.closest('[data-sail]') && !event.target.closest('[data-sail]').disabled) this.handlers.pickNode?.(this.selectedNode);
      if (event.target.closest('[data-enter-market]') && !event.target.closest('[data-enter-market]').disabled) this.enterMarket(this.selectedNode);
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
    $('voyage-port')?.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-port-action]');
      if (!button || button.disabled) return;
      const { portAction: action, id, offer } = button.dataset;
      if (action === 'sticker') { this.openStickerPicker(Number(offer)); return; }
      if (action === 'service') { this.openPortService(id); return; }
      if (action === 'sell') {
        const item = this.portView.port.sell.find((o) => o.charm.id === id);
        if (item && await this.confirm({ title: `Sell ${item.charm.name}?`, text: `Receive ${num(item.price)} coins. This boon and its upgrade leave your voyage.`, ok: 'Sell boon', cancel: 'Keep boon' })) this.handlers.portSell?.(id);
        return;
      }
      const handler = { boon: 'portBuyBoon', upgrade: 'portUpgrade', undo: 'portBuyUndo', reroll: 'portReroll', leave: 'portLeave' }[action];
      if (id == null) this.handlers[handler]?.();
      else this.handlers[handler]?.(id);
    });
    $('voyage-sticker-picker')?.addEventListener('click', (event) => {
      const target = event.target.closest('[data-sticker-card], [data-service-boon]');
      if (target) {
        const intent = this.pickerIntent;
        const arg = target.dataset.stickerCard ? Number(target.dataset.stickerCard) : target.dataset.serviceBoon;
        this.closeStickerPicker();
        if (intent) this.handlers[intent.handler]?.(intent.id, arg);
      } else if (event.target.closest('[data-sticker-cancel]')) this.closeStickerPicker();
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
    window.addEventListener('resize', () => {
      if (!$('voyage-map').hidden) {
        this.chart?.resize();
        this.positionTooltip();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        const dialog = ['voyage-confirm', 'voyage-sticker-picker', 'voyage-port', 'voyage-intro', 'voyage-result', 'voyage-end', 'voyage-map'].map($).find((el) => !el.hidden && !el.classList.contains('leaving'));
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
      if (!$('voyage-map').hidden && $('voyage-tutorial').hidden && !this.preparing && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        const choices = [...$('voyage-chart').querySelectorAll('.voyage-island.available, .voyage-market.available, [data-node="__boss__"]')];
        if (choices.length) {
          event.preventDefault();
          const current = Math.max(0, choices.findIndex((el) => el.dataset.node === this.selectedNode));
          const delta = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 1;
          const target = choices[(current + delta + choices.length) % choices.length];
          this.selectedByUser = true;
          this.selectNode(target.dataset.node, false);
          target.focus({ preventScroll: true });
        }
        return;
      }
      if (!$('voyage-map').hidden && $('voyage-tutorial').hidden && event.key === 'Enter' && !this.mapReadOnly && !this.preparing) {
        const node = this.mapView?.map.flat().find((item) => item.id === this.selectedNode);
        if (this.mapView?.markets?.some((m) => m.id === this.selectedNode && m.state === 'available')) {
          event.preventDefault();
          this.enterMarket(this.selectedNode);
        } else if (node?.state === 'available') {
          event.preventDefault();
          this.handlers.pickNode?.(node.id);
        }
        return;
      }
      if (event.key !== 'Escape') return;
      if (this.chart?.motion) { event.preventDefault(); this.chart.skip(); return; }
      if (!$('voyage-confirm').hidden) { event.preventDefault(); this.resolveConfirm(false); }
      else if (!$('voyage-sticker-picker').hidden) { event.preventDefault(); this.closeStickerPicker(); }
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
    this.closeStickerPicker();
    $('voyage-port').hidden = true;
    this.mapView = view;
    this.mapReadOnly = !['map', 'port'].includes(view.status);
    this.hideTooltip();
    $('voyage-result').hidden = true;
    $('voyage-end').hidden = true;
    $('voyage-map').hidden = false;
    $('voyage-map-sub').textContent = `${localDate(view.daily)} · ${num(view.score)} points · ${view.boons.filter((c) => !c.hidden).length} charms`;
    $('voyage-map-coins').innerHTML = purse(view.coins);
    $('voyage-map-progress').textContent = `${view.results.length} of ${view.boards} boards cleared · ${view.undos} shared undos`;
    $('voyage-map-close').textContent = this.mapReadOnly ? 'Return to board' : 'Menu';
    const firstAvailable = (view.markets || []).find((m) => m.state === 'available') || view.map.flat().find((n) => n.state === 'available');
    const current = view.map.flat().find((n) => n.state === 'current');
    this.selectedNode = this.mapReadOnly ? current?.id : firstAvailable?.id;
    this.mapRouteNode = this.selectedNode;
    this.highlightNode = null;
    this.selectedByUser = false;
    this.tappedNode = null;
    this.renderChart();
    this.selectNode(this.selectedNode, false, false);
    this.setPreparing(this.preparing);
    requestAnimationFrame(() => {
      $('voyage-map').querySelector(this.mapReadOnly ? '#voyage-map-close' : '.voyage-map-detail :is([data-sail], [data-enter-market])')?.focus({ preventScroll: true });
    });
  },

  hideMap() { this.chart?.pause(); $('voyage-map').hidden = true; this.hideTooltip(); },
  setPreparing(value) {
    this.preparing = !!value;
    $('voyage-preparing').hidden = !value;
    $('voyage-chart').classList.toggle('preparing', !!value);
    $('voyage-map-detail').querySelector('[data-sail], [data-enter-market]')?.toggleAttribute('disabled', !!value);
  },

  renderChart() {
    this.chart?.render(this.mapView, this.selectedNode);
  },

  drawLinks() {},

  selectMarket(id) {
    const market = (this.mapView?.markets || []).find((item) => item.id === id);
    if (!market) return;
    if (this.selectedNode !== id) this.tappedNode = null;
    this.selectedNode = id;
    this.highlightNode = null;
    this.chart?.select(id);
    const canEnter = market.state === 'available' && !this.mapReadOnly;
    const status = { current: 'Market visited · your next table sails from here', visited: 'Market visited', upcoming: 'Ahead on the chart' }[market.state] || 'Docked';
    const reroll = market.kind === 'upgrades'
      ? 'The upgrade list is the charms you already hold, so the reroll stays closed.'
      : 'You can reroll that stall once during the visit.';
    $('voyage-map-detail').innerHTML = `<div class="voyage-detail-hero voyage-detail-boss"><span class="voyage-detail-icon">⚓</span><div><small>After board ${market.afterBoard}</small><h3>${esc(market.name)}</h3><p>Every route stops here.</p></div></div><div class="voyage-detail-body"><p>${esc(market.wares)}</p><p class="voyage-harbour-note">You can also sell a charm and buy undos. ${esc(reroll)}</p><p class="voyage-detail-note">${canEnter ? 'Your next tables leave from this harbour.' : 'Every route between these tables passes through this harbour.'}</p></div><div class="voyage-detail-actions">${canEnter ? `<button type="button" class="btn primary" data-enter-market ${this.preparing ? 'disabled' : ''}>Enter market →</button>` : `<span class="voyage-detail-status">${status}</span>`}</div>`;
  },

  selectNode(id, focus = true, highlight = true) {
    if (String(id).startsWith('market:')) { this.selectMarket(id); return; }
    if (id === '__boss__') {
      if (this.selectedNode !== id) this.tappedNode = null;
      this.selectedNode = id;
      this.highlightNode = null;
      this.chart?.select(id);
      const boss = this.mapView.boss || {};
      const taken = confiscated(this.mapView);
      $('voyage-map-detail').innerHTML = `<div class="voyage-detail-hero voyage-detail-boss"><span class="voyage-detail-icon">${compactCharm(boss, 'boss')}</span><div><small>Board ${this.mapView.boards} · Final boss</small><h3>${esc(boss.name || 'Final boss')}</h3><p>Waits on board ${this.mapView.boards}</p></div></div><div class="voyage-detail-body"><div class="voyage-detail-challenge boss"><span class="voyage-detail-icon">${compactCharm(boss, 'boss')}</span><div><small>Final boss</small><strong>${esc(boss.name || 'Final boss')}</strong><p>${esc(boss.text || '')}</p>${boss.tell ? `<p class="voyage-boss-watch">Watch for: ${esc(boss.tell)}</p>` : ''}${taken ? confiscation(this.mapView) : ''}</div></div><p class="voyage-detail-note">This landmark is beyond the fog. It does not change your next course.</p></div><div class="voyage-detail-actions"><button type="button" class="btn" data-back-route>Back to route</button></div>`;
      return;
    }
    const node = this.mapView?.map.flat().find((n) => n.id === id);
    if (!node) return;
    if (this.selectedNode !== id) this.tappedNode = null;
    this.selectedNode = id;
    this.mapRouteNode = id;
    this.highlightNode = highlight && node.state === 'available' ? id : null;
    this.chart?.select(id);
    const t = theme(node.theme);
    const challenge = node.challenge;
    const canSail = node.state === 'available' && !this.mapReadOnly;
    const byId = new Map(this.mapView.map.flat().map((n) => [n.id, n]));
    const leads = (node.links || []).map((childId) => byId.get(childId)).filter(Boolean);
    $('voyage-map-detail').innerHTML = `<div class="voyage-detail-hero"><img src="${esc(art(node.theme))}" alt=""><div><small>Board ${node.row + 1} of ${this.mapView.boards}${node.final ? ' · Final table' : ''}</small><h3>${esc(t.name)}</h3><p>${esc(t.tagline)}</p></div></div><div class="voyage-detail-body"><div class="voyage-detail-challenge"><span class="voyage-detail-icon">${compactCharm(challenge)}</span><div><small>${kindName(challenge)} · Strength ${node.strength ?? node.row + 1}${node.final ? ' · Final table' : ''}</small><strong>${esc(challenge?.name || 'Challenge')}</strong><p>${esc(challenge?.text || '')}</p></div></div>${node.stormChallenge ? `<div class="voyage-detail-challenge storm"><span class="voyage-detail-icon">${compactCharm(node.stormChallenge)}</span><div><small>Storm · ${kindName(node.stormChallenge)} · Strength ${node.strength ?? node.row + 1}</small><strong>${esc(node.stormChallenge.name)}</strong><p>${esc(activeText(node.stormChallenge))}</p></div></div>` : ''}${node.storm ? stormNote : ''}${node.final && this.mapView.boss ? `<div class="voyage-detail-challenge boss"><span class="voyage-detail-icon">${compactCharm(this.mapView.boss)}</span><div><small>Boss</small><strong>${esc(this.mapView.boss.name)}</strong><p>${esc(this.mapView.boss.text)}</p>${confiscation({ confiscated: mapConfiscated(this.mapView, node) })}</div></div>` : ''}${leads.length ? `<div class="voyage-detail-leads"><small>Leads to</small><strong>${leads.map((child) => esc(theme(child.theme).name)).join(' · ')}</strong></div>` : ''}<small class="voyage-offer-label">Possible charms from this table</small><div class="voyage-detail-boons">${(node.boons || []).filter((c) => !c.hidden).map((c) => `<div>${compactCharm(c)}<span>${esc(c.name)}${c.level === 2 ? ' · II' : ''}</span><small class="voyage-family-name">${esc(familyName(c))}</small></div>`).join('')}</div>${node.market ? `<p class="voyage-harbour-note">⚓ ${esc(node.market.name)} after this table. ${esc(node.market.wares)}</p>` : node.port ? '<p class="voyage-harbour-note">⚓ Market after this table</p>' : ''}<p class="voyage-detail-note">Earn stars to reveal more charm choices.</p></div><div class="voyage-detail-actions">${canSail ? `<button type="button" class="btn primary" data-sail ${this.preparing ? 'disabled' : ''}>Set course →</button>` : `<span class="voyage-detail-status">${node.state === 'current' ? 'Current table' : node.state === 'visited' ? 'Board cleared' : node.state === 'upcoming' ? 'Ahead on the chart' : 'Route not taken'}</span>`}</div>`;
    if (focus && canSail) $('voyage-map-detail').querySelector('[data-sail]')?.focus({ preventScroll: true });
  },

  finishSailingSoon(ms) { this.chart?.finishSoon(ms); },

  sailTo(nodeId, options = {}) {
    return this.chart?.sailTo(nodeId, { reducedMotion: settings.reducedMotion, ...options }) || Promise.resolve();
  },

  // Sail the boat into the market island, light its lantern, then open the stalls.
  async enterMarket(id) {
    if (this.preparing || this.mapReadOnly || this.mapView?.markets?.find((m) => m.id === id)?.state !== 'available') return;
    this.setPreparing(true);
    try {
      await this.chart?.sailTo(id, { reducedMotion: settings.reducedMotion });
      await this.chart?.dock(id, { reducedMotion: settings.reducedMotion });
    } finally {
      this.setPreparing(false);
    }
    this.handlers.enterPort?.();
  },

  showPort(view) {
    this.syncMotion();
    const focused = document.activeElement?.closest('[data-port-action]');
    const focusKey = focused && [focused.dataset.portAction, focused.dataset.id, focused.dataset.offer];
    const scroll = $('voyage-port-stalls').scrollTop;
    this.hideAll();
    this.portView = view;
    const port = view.port;
    if (!port) return;
    const coins = port.coins ?? view.coins ?? 0;
    const buy = (action, price, attrs = '', unavailable = false, label = 'Buy', locked = 'Unavailable') => {
      const short = Math.max(0, price - coins);
      return `<div class="voyage-port-buy"><button type="button" class="btn primary" data-port-action="${action}" ${attrs} ${unavailable || short ? 'disabled' : ''}>${unavailable ? esc(locked) : `${label} · ⛁ ${num(price)}`}</button>${short && !unavailable ? `<small>Need ${num(short)} more coins</small>` : ''}</div>`;
    };
    const stall = (name, note, items) => `<section class="voyage-stall"><header><h3>${name}</h3><p>${note}</p></header><div class="voyage-stall-items">${items || '<p class="voyage-detail-note">Nothing available this visit.</p>'}</div></section>`;
    const titles = { stickers: 'Sticker market', boons: 'Charm market', upgrades: 'Upgrade market' };
    const blurbs = {
      stickers: 'Stickers for the cards you carry. Every market also sells charms back, stocks undos, and can reroll.',
      boons: 'New charms for the crossing. Every market also sells charms back, stocks undos, and can reroll.',
      upgrades: 'Raise a charm you already hold. Selling and undos are here too. The upgrade list is not random, so reroll stays closed.',
    };
    $('voyage-port-title').textContent = port.name || titles[port.kind] || (port.grand ? 'Grand Port' : 'Harbour market');
    const blurb = $('voyage-port-blurb');
    if (blurb) blurb.textContent = blurbs[port.kind] || 'Gather a little luck for the journey ahead.';
    $('voyage-port-coins').innerHTML = purse(coins);
    const showKind = (kind) => port.kind === kind || (!port.kind && ({ stickers: port.stickers, boons: port.boons, upgrades: port.upgrades }[kind] || []).length);
    const rerollClosed = port.kind === 'upgrades';
    $('voyage-port-stalls').innerHTML =
      (showKind('boons') ? stall('Charms', 'A new companion for the crossing.', (port.boons || []).map((o) => charmCard(o.charm, `<small class="voyage-port-theme">${esc(theme(o.charm.theme).name)}</small>${buy('boon', o.price, `data-id="${esc(o.charm.id)}"`, o.sold, 'Buy', 'Sold')}`)).join('')) : '') +
      (showKind('stickers') ? stall('Stickers', 'Choose a card. Its sticker lasts the voyage.', (port.stickers || []).map((o, i) => `<article class="voyage-sticker-offer"><span class="voyage-sticker-sigil" aria-hidden="true"><img src="${esc(stickerArt(o.type))}" alt="" draggable="false"></span><div><h4>${esc(o.name)}</h4><p>${esc(o.text)}</p></div>${buy('sticker', o.price, `data-offer="${i}"`, o.sold, 'Choose card', 'Sold')}</article>`).join('')) : '') +
      (showKind('upgrades') ? stall('Upgrade', 'Bring a held charm to level II.', (port.upgrades || []).map((o) => charmCard(o.charm, buy('upgrade', o.price, `data-id="${esc(o.charm.id)}"`, false, 'Upgrade'), true)).join('')) : '') +
      stall('Provisions', 'Shared undos for the tables ahead.', port.provisions ? `<article class="voyage-port-simple"><strong>↶ +1 undo</strong><p>${num(port.provisions.left)} purchases left this visit</p>${buy('undo', port.provisions.price, '', port.provisions.left <= 0, 'Provision', 'Visit limit reached')}</article>` : '') +
      stall('Sell', 'Trade a held charm for a fuller purse.', (port.sell || []).map((o) => charmCard(o.charm, `<button type="button" class="btn" data-port-action="sell" data-id="${esc(o.charm.id)}">Sell · +⛁ ${num(o.price)}</button>`)).join('')) +
      stall('Reroll', port.kind === 'stickers' ? 'Refresh the sticker stall once per visit.' : port.kind === 'upgrades' ? 'The charms you carry are the only upgrades.' : 'Refresh the charm stall once per visit.', port.reroll ? `<article class="voyage-port-simple"><strong>⟳ Fresh wares</strong><p>${rerollClosed ? 'Nothing here is drawn at random.' : port.reroll.used ? 'Already rerolled this visit' : 'Your other stalls stay as they are.'}</p>${buy('reroll', port.reroll.price, '', port.reroll.used || rerollClosed, 'Reroll', rerollClosed ? 'Nothing to redraw' : 'Already rerolled')}</article>` : '');
    if (port.services?.length) $('voyage-port-stalls').innerHTML += stall('Special services', 'A little help from your travelling companions.', port.services.map((service) => `<article class="voyage-port-simple"><strong>${esc(service.label)}</strong><p>${esc(service.text)}</p>${buy('service', service.price, `data-id="${esc(service.id)}"`, (service.affordable === false && service.price <= coins) || (service.needsBoon && !view.boons.some((c) => !c.hidden)), service.needsCard ? 'Choose card' : service.needsBoon ? 'Choose boon' : 'Use service')}${service.affordable === false && service.price <= coins ? '<small class="voyage-detail-note">Service unavailable</small>' : ''}</article>`).join(''));
    $('voyage-port').hidden = false;
    $('voyage-port-stalls').scrollTop = scroll;
    const replacement = focusKey && [...$('voyage-port').querySelectorAll('[data-port-action]')].find((b) => b.dataset.portAction === focusKey[0] && b.dataset.id === focusKey[1] && b.dataset.offer === focusKey[2] && !b.disabled);
    (replacement || $('voyage-port-leave')).focus({ preventScroll: true });
  },

  openStickerPicker(offerIdx) {
    const offer = this.portView?.port?.stickers?.[offerIdx];
    if (!offer || offer.sold || offer.price > (this.portView.port.coins ?? this.portView.coins ?? 0)) return;
    this.openCardPicker({ label: `${offer.name} sticker`, price: offer.price, text: 'One sticker per card. Choosing a marked card replaces its sticker.', intent: { handler: 'portBuySticker', id: offerIdx } });
  },
  openPortService(id) {
    const service = this.portView?.port?.services?.find((s) => s.id === id);
    if (!service || service.affordable === false || service.price > (this.portView.port.coins ?? this.portView.coins ?? 0)) return;
    const intent = { handler: 'portService', id };
    if (service.needsCard) this.openCardPicker({ label: service.label, price: service.price, text: service.text, intent });
    else if (service.needsBoon) {
      this.stickerFocus = document.activeElement; this.pickerIntent = intent; this.hideTooltip();
      $('voyage-sticker-picker-card').onkeydown = null;
      $('voyage-sticker-picker-card').innerHTML = `<p class="voyage-kicker">${esc(service.label)} · ⛁ ${num(service.price)}</p><h2 id="voyage-sticker-picker-title">Choose a boon</h2><p>${esc(service.text)}</p><div class="voyage-service-boons">${this.portView.boons.filter((c) => !c.hidden).map((c) => charmCard(c, `<button type="button" class="btn primary" data-service-boon="${esc(c.id)}">Choose</button>`)).join('')}</div><div class="voyage-actions"><button type="button" class="btn" data-sticker-cancel>Cancel · Esc</button></div>`;
      $('voyage-sticker-picker').hidden = false;
      $('voyage-sticker-picker').querySelector('[data-service-boon], [data-sticker-cancel]')?.focus({ preventScroll: true });
    } else this.handlers.portService?.(id);
  },
  openCardPicker({ label, price, text, intent }) {
    this.pickerIntent = intent;
    this.stickerFocus = document.activeElement;
    this.hideTooltip();
    const held = new Map((this.portView.stickers || []).map((s) => [Number(s.card), s.type]));
    $('voyage-sticker-picker-card').innerHTML = `<p class="voyage-kicker">${esc(label)} · ⛁ ${num(price)}</p><h2 id="voyage-sticker-picker-title">Choose its card</h2><p>${esc(text)}</p><div class="voyage-card-picker" aria-label="52 cards, four suit rows">${SUITS.map((suit, row) => `<div class="voyage-suit-row" role="group" aria-label="${SUIT_NAMES[row]}">${RANKS.map((rank, col) => {
      const id = row * 13 + col + 1, sticker = held.get(id);
      return `<button type="button" class="voyage-mini-card ${row === 1 || row === 2 ? 'red' : ''}" data-sticker-card="${id}" aria-label="${esc(`${rank} of ${SUIT_NAMES[row].toLowerCase()}${sticker ? `, ${STICKERS[sticker]?.[1]} sticker; replace it` : ''}`)}"><b>${rank}</b><span aria-hidden="true">${suit}</span>${sticker ? `<img class="voyage-mini-sticker" src="${esc(stickerArt(sticker))}" alt="" draggable="false">` : ''}</button>`;
    }).join('')}</div>`).join('')}</div><div class="voyage-actions"><button type="button" class="btn" data-sticker-cancel>Cancel · Esc</button></div>`;
    $('voyage-sticker-picker').hidden = false;
    $('voyage-sticker-picker').querySelector('[data-sticker-card]')?.focus({ preventScroll: true });
    $('voyage-sticker-picker-card').onkeydown = (event) => {
      const card = event.target.closest('[data-sticker-card]');
      if (!card) return;
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -13, ArrowDown: 13 }[event.key];
      if (step) { event.preventDefault(); $('voyage-sticker-picker').querySelector(`[data-sticker-card="${(Number(card.dataset.stickerCard) - 1 + step + 52) % 52 + 1}"]`)?.focus(); }
    };
  },
  closeStickerPicker() {
    if (!$('voyage-sticker-picker') || $('voyage-sticker-picker').hidden) return;
    $('voyage-sticker-picker').hidden = true;
    this.pickerIntent = null;
    this.stickerFocus?.focus?.({ preventScroll: true });
    this.hideTooltip();
  },

  showBossIntro(view) {
    const boss = view.current?.boss;
    if (!boss) return Promise.resolve();
    this.hideMap();
    this.setPreparing(false);
    this.syncMotion();
    $('voyage-intro-card').classList.remove('has-secondary');
    $('voyage-intro-card').innerHTML = `<p class="voyage-kicker">Board 7 · The finale</p><div class="voyage-boss-icon" aria-hidden="true">${charmGlyph(boss)}</div><h2 id="voyage-intro-title">${esc(boss.name)}</h2><p>${esc(boss.text)}</p>${confiscation(view)}<p class="voyage-boss-watch">Watch for: ${esc(boss.tell)}</p>${view.current.budgeted ? '<p class="voyage-detail-note">Challenge eased for the finale.</p>' : ''}<button type="button" class="btn primary voyage-intro-continue" data-intro-continue>Continue</button>`;
    return this.openIntro(view.current.theme);
  },

  flashBossTell(view) {
    const boss = view.current?.boss;
    if (!boss) return;
    document.querySelector('.voyage-tell-flash')?.remove();
    const tell = document.createElement('div');
    tell.className = 'voyage-tell-flash'; tell.setAttribute('role', 'status');
    tell.innerHTML = `${charmGlyph(boss)}<span>Watch for: ${esc(boss.tell)}</span>`;
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
    $('voyage-intro-card').classList.toggle('has-secondary', secondaryChallenges(cur).length > 0);
    const stars = thresholds.map((score, i) => {
      const clear = i === 0 && !score;
      return `<li><span class="voyage-intro-star-row" aria-label="${i + 1} star${i ? 's' : ''}">${'★'.repeat(i + 1)}<i>${'★'.repeat(2 - i)}</i></span><b>${clear ? 'Clear' : num(score)}</b><small>${clear ? 'Finish the table' : 'points'}</small></li>`;
    }).join('');
    $('voyage-intro-card').innerHTML = `<p class="voyage-kicker">${localDate(view.daily)} · Board ${cur.idx + 1} of ${view.boards}</p><h2 id="voyage-intro-title">${esc(t.name)}</h2><p class="voyage-intro-tagline">${esc(t.tagline)}</p><div class="voyage-intro-challenge">${compactCharm(cur.challenge)}<span><small>${kindName(cur.challenge)} · Strength ${cur.strength ?? cur.idx + 1}</small><strong>${esc(cur.challenge?.name || '')}</strong><em>${esc(cur.challenge?.text || '')}</em></span></div>${secondaryChallenges(cur).map((c) => `<div class="voyage-intro-challenge storm">${compactCharm(c)}<span><small>${cur.storm ? 'Storm · ' : ''}${kindName(c)}</small><strong>${esc(c.name)}</strong><em>${esc(activeText(c))}</em></span></div>`).join('')}${cur.storm ? stormNote : ''}${cur.boss ? `<div class="voyage-intro-challenge boss">${compactCharm(cur.boss)}<span><small>Final boss</small><strong>${esc(cur.boss.name)}</strong><em>${esc(cur.boss.text)}</em>${confiscation(view)}</span></div>` : ''}<section class="voyage-intro-goals" aria-label="Table goals"><div class="voyage-intro-facts"><span>Par<b>${num(cur.par)} moves</b></span><span>Free cells<b>${num(cur.freeCells)}</b></span></div><ol class="voyage-intro-stars">${stars}</ol></section>${cur.bossRelented ? `<p class="voyage-detail-note">${esc(view.boss?.name || 'The boss')} relented: no fair deal could be verified under it.</p>` : cur.budgeted ? '<p class="voyage-detail-note">Challenge eased for the finale.</p>' : cur.relaxed ? '<p class="voyage-detail-note">Challenge eased for a verified deal.</p>' : ''}<button type="button" class="btn primary voyage-intro-continue" data-intro-continue>Continue</button>`;
    return this.openIntro(cur.theme);
  },
  openIntro(themeId) {
    const overlay = $('voyage-intro');
    clearTimeout(this.introFade);
    const src = hero(themeId);
    $('voyage-intro-hero').src = src;
    overlay.classList.toggle('has-hero', Boolean(src));
    overlay.classList.remove('leaving');
    overlay.hidden = false;
    const card = $('voyage-intro-card');
    (card.querySelector('[data-intro-continue]') || card).focus();
    return new Promise((resolve) => {
      this.introResolve = resolve;
      $('voyage-intro').onclick = () => this.finishIntro();
      $('voyage-intro').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.finishIntro(); } };
    });
  },
  // Resolve straight away so the table entrance plays while the hero fades out.
  finishIntro() {
    if (!this.introResolve) return;
    const overlay = $('voyage-intro');
    const done = this.introResolve;
    this.introResolve = null;
    if (settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches) overlay.hidden = true;
    else {
      overlay.classList.add('leaving');
      this.introFade = setTimeout(() => { overlay.hidden = true; overlay.classList.remove('leaving'); }, 600);
    }
    done();
  },

  setHud(view) {
    if (!view) return;
    this.syncMotion();
    $('voyage-hud').hidden = $('voyage-dock').hidden = document.body.dataset.mode !== 'voyage' || view.status !== 'board';
    const currentBoard = view.current?.idx != null ? view.current.idx + 1 : view.board;
    $('voyage-hud-board').textContent = `${currentBoard} / ${view.boards}`;
    $('voyage-hud-board-metric').dataset.tipText = `Table ${currentBoard} of ${view.boards}. A voyage is seven tables in a row. Clear this one to continue. There is no restart, and undos are shared across the whole run.`;
    $('voyage-hud-coins').textContent = `⛁ ${num(view.coins)}`;
    const grants = view.current?.undoGrants || 0;
    $('voyage-undo-cap').hidden = !grants;
    $('voyage-undo-cap').textContent = `charm undos ${grants}/${view.current?.undoCap ?? 3}`;
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
    $('voyage-hud-charms').innerHTML = `<small>Charms</small>${view.boons.length ? view.boons.filter((c) => !c.hidden).map((c) => `<span class="voyage-tray-item ${c.id === confiscated(view)?.id ? 'confiscated' : ''}">${compactCharm({ ...c, confiscated: c.id === confiscated(view)?.id }, '', true)}<span>${esc(c.name)}</span><small>${esc(familyName(c))}</small></span>`).join('') : '<span class="voyage-empty-charms" tabindex="0" aria-describedby="voyage-tooltip" data-tip-name="Charms" data-tip-text="Charms you pick after each table stay with you for the rest of the voyage.">None yet</span>'}`;
    $('voyage-hud-challenge').innerHTML = `<small>${kindName(view.current?.challenge)}</small>${compactCharm(view.current?.challenge, 'voyage-effect-chip', true)}${secondaryChallenges(view.current).map((c) => `<small>${view.current?.storm ? 'Storm · ' : ''}${kindName(c)}</small>${compactCharm(c, 'voyage-effect-chip storm', true)}`).join('')}${view.current?.boss ? `<small>Boss</small>${compactCharm(view.current.boss, 'voyage-effect-chip boss', true)}${confiscation(view)}` : ''}${view.current?.moveCapacity != null ? `<span class="voyage-capacity" tabindex="0" aria-describedby="voyage-tooltip" data-tip-name="Move size" data-tip-text="You can move a sequence of up to ${num(view.current.moveCapacity)} cards onto an occupied column. An empty column may accept a shorter sequence.">Move up to ${num(view.current.moveCapacity)}</span>` : ''}${view.current?.override ? '<span class="voyage-override-chip" tabindex="0" aria-describedby="voyage-tooltip" data-tip-name="Next drop" data-tip-text="Your next card drop uses a charm you armed. Place it, or press Esc to cancel.">✦ Next drop…</span>' : ''}`;
    this.markTargetingCharm();
    this.refreshOpenTooltip();
  },

  // Ability targeting. The engine lights the legal targets on the table itself; this
  // is only the instruction banner. It never blocks the board.
  showTargetPrompt({ ability = null, icon = '✦', name = 'Charm', text = '', avoidTop = null } = {}, onCancel = null) {
    this.clearTargetPrompt();
    const prompt = document.createElement('div');
    prompt.className = 'voyage-target-prompt';
    prompt.setAttribute('role', 'status');
    prompt.setAttribute('aria-live', 'polite');
    prompt.innerHTML = `<span class="voyage-target-icon" aria-hidden="true">${esc(icon)}</span><div class="voyage-target-copy"><b>${esc(name)}</b><span>${esc(text)}</span><small data-target-focus data-hint>${TARGET_HINT}</small></div><button type="button" class="btn" data-target-cancel>Cancel<span class="voyage-key"> · Esc</span></button>`;
    prompt.querySelector('[data-target-cancel]').addEventListener('click', () => this.cancelTarget());
    document.body.append(prompt);
    // Keep clear of the table's top row (cells are targets too): over the HUD's stat
    // chips if that fits, else along the bottom edge.
    if (avoidTop != null) {
      const fits = (top) => top + prompt.offsetHeight + 6 <= avoidTop;
      if (!fits(prompt.offsetTop)) prompt.classList.add(fits(8) ? 'high' : 'low');
    }
    this.targetPrompt = prompt;
    this.targetCancel = onCancel;
    this.targetAbility = ability;
    this.markTargetingCharm();
  },
  updateTargetPrompt(label = '') {
    const focus = this.targetPrompt?.querySelector('[data-target-focus]');
    if (!focus) return;
    // A named target (keyboard focus or pointer) always shows; the generic hint is desktop-only.
    focus.textContent = label || TARGET_HINT;
    focus.toggleAttribute('data-hint', !label);
  },
  // A click that missed every target: a small shake points back at the instruction.
  nudgeTargetPrompt() {
    const prompt = this.targetPrompt;
    if (!prompt || settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    prompt.classList.remove('nudge'); void prompt.offsetWidth; prompt.classList.add('nudge');
  },
  clearTargetPrompt() {
    this.targetPrompt?.remove(); this.targetPrompt = null;
    this.targetCancel = null; this.targetAbility = null;
    this.markTargetingCharm();
  },
  cancelTarget() {
    const cancel = this.targetCancel;
    this.clearTargetPrompt();
    cancel?.();
  },
  markTargetingCharm() {
    for (const el of document.querySelectorAll('[data-ability]')) el.classList.toggle('targeting', !!this.targetAbility && el.dataset.ability === this.targetAbility);
  },

  // choose({ icon, name, text, options: [{ value, label, detail, disabled }], at: {x,y}|null }) -> value|null
  choose({ icon = '✦', name = 'Charm', text = '', options = [], at = null } = {}) {
    this.cancelChoice();
    const layer = document.createElement('div');
    layer.className = 'voyage-choice-layer';
    layer.setAttribute('role', 'dialog'); layer.setAttribute('aria-modal', 'true'); layer.setAttribute('aria-label', name);
    layer.innerHTML = `<div class="voyage-choice"><p class="voyage-choice-title"><span aria-hidden="true">${esc(icon)}</span>${esc(name)}</p>${text ? `<p class="voyage-choice-text">${esc(text)}</p>` : ''}<div class="voyage-choice-options">${options.map((o, i) => `<button type="button" class="btn" data-choice="${i}" ${o.disabled ? 'disabled' : ''}><b>${esc(o.label)}</b>${o.detail ? `<small>${esc(o.detail)}</small>` : ''}</button>`).join('')}</div><button type="button" class="btn voyage-choice-cancel" data-choice-cancel>Cancel · Esc</button></div>`;
    document.body.append(layer);
    const card = layer.querySelector('.voyage-choice');
    if (at) {
      // Sit just above the card it is about, kept on screen.
      const r = card.getBoundingClientRect(), pad = 10;
      const x = Math.max(pad, Math.min(window.innerWidth - r.width - pad, at.x - r.width / 2));
      const above = at.y - r.height - 24;
      const y = above >= pad ? above : Math.min(window.innerHeight - r.height - pad, at.y + 48);
      Object.assign(card.style, { left: `${x}px`, top: `${y}px` });
    } else card.classList.add('centred');
    this.choiceLayer = layer;
    this.choiceFocus = document.activeElement;
    const buttons = () => [...layer.querySelectorAll('button:not([disabled])')];
    this.choiceKeys = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); this.cancelChoice(); }
      else if (['Tab', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) {
        const list = buttons(), i = list.indexOf(document.activeElement);
        const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey);
        event.preventDefault(); list[(i + (back ? -1 : 1) + list.length) % list.length]?.focus();
      }
      // Game hotkeys wait while the menu is open.
      event.stopImmediatePropagation();
    };
    document.addEventListener('keydown', this.choiceKeys, true);
    layer.addEventListener('pointerdown', (event) => event.stopPropagation());
    layer.addEventListener('click', (event) => {
      const button = event.target.closest('[data-choice]');
      if (button) this.cancelChoice(options[Number(button.dataset.choice)].value);
      else if (event.target === layer || event.target.closest('[data-choice-cancel]')) this.cancelChoice();
    });
    buttons()[0]?.focus();
    return new Promise((resolve) => { this.choiceResolve = resolve; });
  },
  cancelChoice(value = null) {
    this.choiceLayer?.remove(); this.choiceLayer = null;
    if (this.choiceKeys) document.removeEventListener('keydown', this.choiceKeys, true);
    this.choiceKeys = null;
    const resolve = this.choiceResolve; this.choiceResolve = null;
    if (resolve) { this.choiceFocus?.focus?.({ preventScroll: true }); resolve(value); }
  },
  // Close any open ability pick (board teardown, menu).
  cancelPick() {
    this.cancelChoice();
    this.cancelTarget();
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
    const offers = (view.reward?.offers || []).filter((c) => !c.hidden);
    const picks = Math.min(offers.length, view.reward?.picks || 1);
    const next = view.status === 'won' ? '<button class="btn primary" data-result-end>See voyage summary</button>' : offers.length ? '' : '<button class="btn primary" data-result-continue>Continue voyage</button>';
    const scoreNames = { cards: 'Cards home', efficiency: 'Moves', freecells: 'Free cells', chains: 'Chains', bossStars: 'Finale stars' };
    const scoreRow = (line, i, mult = false) => {
      const name = mult ? line.label : (scoreNames[line.key] || line.label);
      const text = explainScoreLine(line);
      return `<div class="voyage-score-line${mult ? ' voyage-mult' : ''}" style="--line:${i}" tabindex="0" aria-label="${esc(`${line.label}. ${text}`)}" aria-describedby="voyage-tooltip" data-tip-name="${esc(name)}" data-tip-text="${esc(text)}"><span>${esc(line.label)}</span><b>${mult ? `×${Number(line.x).toFixed(2)}` : num(line.pts)}</b></div>`;
    };
    $('voyage-result-card').innerHTML = `<p class="voyage-kicker">Board ${result.idx + 1} of ${view.boards} · ${esc(t.name)}</p><h2 id="voyage-result-title">${result.conceded ? 'Stepped out' : 'Table cleared'}</h2><div class="voyage-result-stars" aria-label="${result.stars} of 3 stars">${starText(result.stars)}</div><p class="voyage-result-sub">${result.conceded ? 'To be continued · ' : ''}${num(result.moves)} moves · ${formatTime(result.time)} · ${num(result.undosUsed)} undos used</p>${result.storm && !result.conceded ? stormNote : ''}<div class="voyage-score-sheet"><div class="voyage-score-lines">${lines.map((line, i) => scoreRow(line, i)).join('')}${mults.map((m, i) => scoreRow(m, lines.length + i, true)).join('')}</div><div class="voyage-score-total"><span>Board score</span><strong>${num(result.total)}</strong></div><div class="voyage-score-run">Run total <b>${num(view.score)}</b></div></div>${result.coins != null ? `<div class="voyage-coin-sheet"><small>Coins earned</small>${(result.coinLines || []).map((line) => `<div><span>${esc(line.label)}</span><b>${num(line.n ?? line.coins ?? line.amount ?? line.pts)}</b></div>`).join('')}<div class="voyage-coin-total"><strong>Earned ${purse(result.coins)}</strong><span>Purse ${num(view.coins)}</span></div></div>` : ''}${offers.length ? `<div class="voyage-reward"><p class="voyage-kicker">${picks === 2 ? 'Choose 2 boons' : 'Choose one charm'} · ${offers.length} ${offers.length === 1 ? 'choice' : 'choices'}</p><div class="voyage-reward-options">${offers.map((c) => charmCard(c, `<button class="btn primary" data-pick-charm="${esc(c.id)}">Choose</button>`)).join('')}</div></div>` : `<div class="voyage-actions">${next}</div>`}`;
    $('voyage-result').hidden = false;
    const card = $('voyage-result-card');
    card.classList.remove('show-stars', 'show-coins', 'show-reward');
    const reduced = settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = reduced ? 0 : Math.max(480, (lines.length + mults.length) * 70 + 280);
    this.resultTimers.push(setTimeout(() => card.classList.add('show-stars'), delay));
    this.resultTimers.push(setTimeout(() => card.classList.add('show-coins'), delay + (reduced ? 0 : 350)));
    this.resultTimers.push(setTimeout(() => card.classList.add('show-reward'), delay + (reduced ? 0 : 700)));
    this.resultTimers.push(setTimeout(() => card.querySelector('button[data-pick-charm], button[data-result-continue], button[data-result-end]')?.focus({ preventScroll: true }), delay + (reduced ? 0 : 770)));
  },

  showRunEnd(view) {
    this.hideAll();
    const won = view.status === 'won';
    const reached = won ? view.boards : Math.min(view.boards, view.results.length + 1);
    const allCharms = new Map(view.boons.map((c) => [c.id, c]));
    const picksText = (r) => {
      const ids = r.charms?.length ? r.charms : r.charm ? [r.charm] : [];
      return ids.length ? `${ids.length > 1 ? 'Charms' : 'Charm'}: ${ids.map((id) => esc(allCharms.get(id)?.name || CHARMS[id]?.name || id)).join(' · ')}` : 'No charm picked';
    };
    $('voyage-end-card').innerHTML = `<p class="voyage-kicker">${localDate(view.daily)}</p><h2 id="voyage-end-title">${won ? 'Voyage complete' : 'Voyage ended'}</h2><p class="voyage-end-sub">${won ? 'Seven tables crossed. Your chart is complete.' : view.lostReason === 'abandoned' ? 'The run was abandoned.' : 'No more routes through this table.'}</p><div class="voyage-end-totals"><div><small>Boards reached</small><strong>${reached} / ${view.boards}</strong></div><div><small>Total score</small><strong>${num(view.score)}</strong></div><div><small>Stars earned</small><strong>${num(view.stars)}</strong></div></div><div class="voyage-end-list">${view.results.map((r) => `<div class="voyage-end-row"><img src="${esc(art(r.theme))}" alt=""><span><small>Board ${r.idx + 1}${r.storm ? ' · ϟ Storm' : ''}</small><strong>${esc(theme(r.theme).name)}</strong><em>${picksText(r)}</em></span><span class="voyage-end-row-score"><b>${starText(r.stars)}</b><strong>${num(r.total)}</strong></span></div>`).join('')}</div><div class="voyage-end-charms"><small>Charms collected</small><div>${view.boons.length ? view.boons.map((c) => compactCharm(c)).join('') : '<span>None</span>'}</div></div><div class="voyage-end-stickers"><small>Card stickers · ${view.stickers?.length || 0}</small><div>${(view.stickers || []).map((sticker) => `<span><img src="${esc(stickerArt(sticker.type))}" alt="">${esc(cardName(sticker.card))} · ${esc(STICKERS[sticker.type]?.[1] || sticker.type)}</span>`).join('') || '<span>None</span>'}</div></div><div class="voyage-actions"><button class="btn primary" data-new-voyage>New Voyage</button><button class="btn" data-end-menu>Menu</button></div>`;
    $('voyage-end').hidden = false;
    $('voyage-end-card').querySelector('[data-new-voyage]')?.focus({ preventScroll: true });
  },

  hideAll() {
    this.hideMap();
    this.cancelPick();
    this.closeStickerPicker();
    this.finishIntro();
    this.preparing = false;
    this.hideTooltip();
    this.hideMarkTip();
    $('voyage-hud').hidden = $('voyage-dock').hidden = true;
    for (const id of ['voyage-map', 'voyage-port', 'voyage-sticker-picker', 'voyage-intro', 'voyage-result', 'voyage-end', 'voyage-confirm', 'voyage-tutorial']) $(id).hidden = true;
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
      map: ['Read the sea chart', 'Tap an island to inspect its challenge and possible charms; tap it again to set course. Markets sit between the tables: stickers after board 2, charms after board 4, and upgrades after board 6. Fog begins where your lookout ends, while storms and the final boss stay marked at a glance.'],
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
    const relation = anchor.dataset.tipRelation;
    tip.innerHTML = `<strong>${esc(anchor.dataset.tipName)}</strong><span>${esc(anchor.dataset.tipText)}</span>${relation ? `<span class="voyage-tip-relation"><b>Boss interaction</b> ${esc(relation)}</span>` : ''}`;
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
  markTipVisible() { return !$('card-mark-tooltip')?.hidden; },
  showMarkTip(x, y, name, text) {
    const tip = $('card-mark-tooltip');
    if (!tip || !name || !text) return;
    if (this.markTipName !== name || this.markTipText !== text) {
      tip.innerHTML = `<strong>${esc(name)}</strong><span>${esc(text)}</span>`;
      this.markTipName = name;
      this.markTipText = text;
    }
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const left = Math.max(8, Math.min(innerWidth - w - 8, x + 16));
    const above = y - h - 14;
    const top = above >= 8 ? above : Math.min(innerHeight - h - 8, y + 18);
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(8, top)}px`;
  },
  hideMarkTip() {
    const tip = $('card-mark-tooltip');
    if (!tip || tip.hidden) return;
    tip.hidden = true;
    this.markTipName = null;
    this.markTipText = null;
  },
  syncMotion() { document.body.classList.toggle('voyage-reduced-motion', !!settings.reducedMotion); },
};
