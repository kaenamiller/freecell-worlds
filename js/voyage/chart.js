// Painted Voyage sea chart. This module owns chart geometry, SVG routes/fog,
// island rendering, and the short sailing/docking beats. It has no run state.
import { FogVolume } from './fog.js';

const SVG = 'http://www.w3.org/2000/svg';
const MOBILE = '(max-width: 800px) and (orientation: portrait)';

const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);

function hash(text) {
  let h = 2166136261;
  for (const c of String(text)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const jitter = (seed, amount) => ((hash(seed) / 0xffffffff) * 2 - 1) * amount;
const stateLabel = (node) => node.state === 'available' ? 'Available route'
  : node.state === 'current' ? 'Your position'
    : node.state === 'visited' ? 'Cleared'
      : node.state === 'skipped' ? 'Route passed' : 'Ahead';

// Each generation occupies its own band. Dense lookouts extend vertically,
// keeping every island reachable without squeezing hit targets or crossing rows.
function geometry(view, portrait, box) {
  const all = (view.map || []).flat();
  const rows = [...new Set(all.map(n => n.row))].sort((a, b) => a - b);
  let width = Math.max(1, box.width || (portrait ? 368 : 620));
  const viewportHeight = Math.max(300, box.height || 600);
  const points = new Map(), sizes = new Map();
  const last = rows.at(-1) ?? -1;
  const future = Math.max(0, (view.boards || 7) - last - 1);
  const currentRow = all.find(n => n.state === 'current')?.row ?? -1;
  const choiceRow = all.find(n => n.state === 'available')?.row ?? currentRow + 1;
  const sizeFor = n => portrait
    ? ({ available: 108, current: 100, upcoming: 88, visited: 76, skipped: 68 }[n.state] || 88)
    : ({ available: 156, current: 124, upcoming: 100, visited: 92, skipped: 80 }[n.state] || 100);
  let height, edge;
  if (portrait) {
    const marketRows = new Set((view.markets || []).map((market) => market.row));
    const bands = rows.map(row => {
      const nodes = all.filter(n => n.row === row).sort((a,b) => a.id.localeCompare(b.id));
      const size = Math.max(...nodes.map(sizeFor));
      const step = size / 1.12 + 24;
      return { row, nodes, size, step, extent: Math.ceil(nodes.length / 3) * step + (marketRows.has(row) ? 200 : 8) };
    });
    const fogRoom = 68 + future * 18;
    height = Math.max(viewportHeight, fogRoom + bands.reduce((sum,b) => sum + b.extent, 0) + 62);
    let y = height - 62;
    for (const band of bands) {
      const { nodes, size, step, extent, row } = band;
      nodes.forEach((n, i) => {
        const columns = Math.min(3, nodes.length);
        const perColumn = Math.ceil(nodes.length / columns);
        const column = Math.floor(i / perColumn), line = i % perColumn;
        const x = width * ((column + .5) / columns);
        const yy = y - size * .5 - line * step;
        points.set(n.id, { x: x + jitter(`${view.seed}:${n.id}:x`, 4), y: yy + jitter(`${view.seed}:${n.id}:y`, 5) });
        sizes.set(n.id, sizeFor(n));
      });
      const market = (view.markets || []).find((item) => item.row === row);
      if (market) points.set(market.id, { x: width / 2, y: y - extent + 96 });
      y -= extent;
    }
    edge = y + 6;
  } else {
    const viewW = Math.max(1, box.width || 620);
    // History keeps the same column pitch as the live route. Start the camera
    // at the current position; the earlier boards remain reachable to the left.
    // Markets get a column of their own between their row and the next, so
    // their lanes can gather and split again without crowding the islands.
    const colGap = 330, marketGap = 230;
    const marketRows = (view.markets || []).map((market) => market.row);
    const colX = (row) => firstX + row * colGap + marketRows.filter((r) => r < row).length * marketGap;
    const firstX = Math.max(200, (viewW - 160) / 2);
    const hasChoices = all.some(n => n.state === 'available');
    const harbour = (view.markets || []).find((market) => ['available', 'current'].includes(market.state));
    const initialPan = currentRow < 0 ? 0 : hasChoices
      ? Math.max(0, colX(choiceRow) - firstX - (harbour ? (colGap + marketGap) / 2 : 0))
      : Math.max(0, colX(currentRow) + (harbour ? (colGap + marketGap) / 2 : 0) - viewW * .43);
    // The boat and first two live columns stay framed in the viewport, so a
    // crowded near column trims its islands until they fit. Later columns
    // keep full size and may extend the scrollable height instead.
    const span = (count, size) => count * (size / 1.12 + 40) + 32;
    const scale = new Map(rows.map(row => {
      const nodes = all.filter(n => n.row === row);
      const size = Math.max(...nodes.map(sizeFor));
      if (row >= choiceRow + 2 || span(nodes.length, size) <= viewportHeight) return [row, 1];
      return [row, Math.max(.6, ((viewportHeight - 32) / nodes.length - 40) * 1.12 / size)];
    }));
    height = Math.max(viewportHeight, ...rows.map(row => {
      const nodes = all.filter(n => n.row === row);
      return span(nodes.length, Math.max(...nodes.map(sizeFor)) * scale.get(row));
    }));
    for (const row of rows) {
      const nodes = all.filter(n => n.row === row).sort((a,b) => a.id.localeCompare(b.id));
      const x = colX(row);
      const skipped = nodes.filter(n => n.state === 'skipped');
      nodes.forEach((n,i) => {
        const isHistory = row <= currentRow;
        const u = isHistory ? (n.state !== 'skipped' ? .5 : skipped.indexOf(n) === 0 ? .22 : .78) : ((i + .5) / nodes.length);
        // A long lookout may need a tall distant column. Keep the boat and
        // first two live columns framed in the viewport rather than stretching
        // the current choices across that entire scrollable height.
        const bandHeight = row < choiceRow + 2 ? viewportHeight : height;
        const y = 16 + (bandHeight - 32) * u;
        points.set(n.id, { x: x + (isHistory ? 0 : jitter(`${view.seed}:${n.id}:x`, 4)), y: y + jitter(`${view.seed}:${n.id}:y`, 1) });
        sizes.set(n.id, Math.round(sizeFor(n) * scale.get(row)));
      });
    }
    edge = colX(last) + 84;
    placeMarkets(view, points, (colGap + marketGap) / 2);
    for (const market of view.markets || []) {
      const point = points.get(market.id);
      if (point) edge = Math.max(edge, point.x + 120);
    }
    width = Math.max(viewW + initialPan, edge + 280);
    return { width, height, points, sizes, edge, rowCount: rows.length, viewW, initialPan,
      origin: { x: firstX - colGap, y: viewportHeight / 2 },
      teasers: future ? teaserPoints(view.seed, edge, width, height) : [] };
  }
  return { width, height, points, sizes, edge, rowCount: rows.length, viewW: width, teasers: [] };
}

function placeMarkets(view, points, offset) {
  for (const market of view.markets || []) {
    const row = (view.map || []).flat().filter((node) => node.row === market.row);
    // Once the row is played, the market sits in line with the table you docked from.
    const docked = row.filter((node) => ['visited', 'current'].includes(node.state));
    const here = (docked.length ? docked : row).map((node) => points.get(node.id)).filter(Boolean);
    if (!here.length) continue;
    const hereX = here.reduce((sum, point) => sum + point.x, 0) / here.length;
    const hereY = here.reduce((sum, point) => sum + point.y, 0) / here.length;
    points.set(market.id, { x: hereX + offset, y: hereY });
  }
}

function teaserPoints(seed, edge, width, height) {
  const span = Math.max(80, width - edge - 110);
  return [0, 1, 2, 3].map((i) => ({
    x: edge + 36 + (i + 0.4) / 4 * span + jitter(`${seed}:fog:${i}:x`, 18),
    y: height * (0.18 + (i % 3) * 0.26) + jitter(`${seed}:fog:${i}:y`, 22),
  }));
}

function curve(a, b, portrait) {
  if (portrait) {
    const dy = b.y - a.y;
    return `M ${a.x} ${a.y} C ${a.x} ${a.y + dy * .46}, ${b.x} ${b.y - dy * .34}, ${b.x} ${b.y}`;
  }
  const dx = b.x - a.x;
  return `M ${a.x} ${a.y} C ${a.x + dx * .46} ${a.y}, ${b.x - dx * .34} ${b.y}, ${b.x} ${b.y}`;
}

function fallbackIsland(accent) {
  return `<svg class="voyage-island-fallback" viewBox="0 0 120 90" aria-hidden="true">
    <ellipse cx="60" cy="70" rx="51" ry="10" fill="#092f3b" opacity=".55"/>
    <path d="M15 65Q28 48 43 49Q51 24 65 38Q80 30 88 50Q103 53 108 65Q78 79 15 65Z" fill="${esc(accent || '#d7b66c')}"/>
    <path d="M24 62Q43 51 55 57T96 57" fill="none" stroke="#f4e7bd" stroke-width="3" opacity=".7"/>
  </svg>`;
}

export function layoutChart(view, portrait, box) {
  return geometry(view, portrait, box);
}

export class VoyageChart {
  constructor(root, options = {}) {
    this.root = root;
    this.options = options;
    this.motion = null;
    this.rendering = false;
    this.resizeFrame = 0;
    this.resize = () => {
      if (this.resizeFrame) return;
      this.resizeFrame = requestAnimationFrame(() => {
        this.resizeFrame = 0;
        if (this.view && this.root.getClientRects().length) this.render(this.view, this.selected);
      });
    };
    this.media = matchMedia(MOBILE);
    this.media.addEventListener?.('change', this.resize);
    this.panX = 0;
    this.didDrag = false;
    this.fog = new FogVolume();
    this.bindPan();
  }

  bindPan() {
    const root = this.root;
    root.addEventListener('pointerdown', (event) => {
      if (this.media.matches || event.button || this.drag) return;
      // Keep pointer focus from inspecting an island before a drag is classified.
      event.preventDefault();
      this.didDrag = false;
      const scroller = root.closest('.voyage-map-scroll');
      this.drag = { x: event.clientX, y: event.clientY, pan: this.panX, scroller, top: scroller?.scrollTop || 0, pointerId: event.pointerId, axis: null };
    });
    root.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.drag?.pointerId) return;
      const dx = event.clientX - this.drag.x;
      const dy = event.clientY - this.drag.y;
      if (!this.drag.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 7) {
        // Landscape charts take every touch (touch-action: none), so a vertical
        // swipe scrolls the frame here instead of cancelling the pan midway.
        this.drag.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : event.pointerType === 'mouse' ? null : 'y';
        if (this.drag.axis) root.setPointerCapture?.(this.drag.pointerId);
      }
      if (this.drag.axis === 'x') this.setPan(this.drag.pan - dx);
      else if (this.drag.axis === 'y' && this.drag.scroller) this.drag.scroller.scrollTop = this.drag.top - dy;
    });
    const endDrag = (event) => {
      if (event.pointerId !== this.drag?.pointerId) return;
      if (this.drag.axis) this.didDrag = true;
      this.drag = null;
    };
    root.addEventListener('pointerup', endDrag);
    root.addEventListener('pointercancel', endDrag);
    // Touch implicitly captures to the island under the thumb; taking capture for
    // the chart fires lostpointercapture on that island, which must not end the drag.
    root.addEventListener('lostpointercapture', (event) => { if (event.target === root) endDrag(event); });
    root.addEventListener('click', (event) => {
      if (!this.didDrag) return;
      event.preventDefault();
      event.stopPropagation();
      this.didDrag = false;
    }, true);
    root.addEventListener('wheel', (event) => {
      if (this.media.matches) return;
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey;
      if (!horizontal) return;
      event.preventDefault();
      this.setPan(this.panX + (event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX));
    }, { passive: false });
  }

  setPan(x) {
    const max = Math.max(0, (this.geo?.width || 0) - (this.geo?.viewW || this.geo?.width || 0));
    this.panX = Math.max(0, Math.min(max, x));
    this.root.querySelector('.voyage-chart-world')?.style.setProperty('--pan-x', `${-this.panX}px`);
  }

  viewportBox() {
    const bounds = this.root.getBoundingClientRect();
    const scroller = this.root.closest('.voyage-map-scroll');
    return { width: bounds.width, height: scroller ? scroller.clientHeight - (this.media.matches ? 0 : 72) : bounds.height };
  }

  layout(view, box = this.viewportBox()) {
    return geometry(view, this.media.matches, box);
  }

  render(view, selected = null) {
    if (this.rendering) return;
    this.rendering = true;
    try {
      this._paint(view, selected);
    } finally {
      this.rendering = false;
    }
  }

  _paint(view, selected = null) {
    this.cancel();
    const newView = this.view !== view;
    this.view = view;
    this.selected = selected;
    this.portrait = this.media.matches;
    const box = this.viewportBox();
    this.geo = geometry(view, this.portrait, box);
    const { width, height, points, viewW } = this.geo;
    this.maxPan = Math.max(0, width - (viewW || width));
    this.panX = this.portrait ? 0 : newView ? this.geo.initialPan : Math.min(this.panX, this.maxPan);
    const all = (view.map || []).flat();
    const byId = new Map(all.map((node) => [node.id, node]));
    const lastVisible = Math.max(-1, ...all.map((node) => node.row));
    const edge = this.geo.edge;
    const fogPct = (edge / (this.portrait ? height : width)) * 100;
    const routes = [];
    const emit = (cls, id, d) => {
      routes.push(`<path class="voyage-sea-lane-under ${cls}" d="${d}"/>`);
      routes.push(`<path class="voyage-sea-lane ${cls}" data-route-to="${esc(id)}" d="${d}"/>`);
    };
    const laneClass = (state) => ['visited', 'current'].includes(state) ? 'taken'
      : state === 'skipped' ? 'skipped' : state === 'available' ? 'available' : 'upcoming';
    // Every table on a market row docks at the market, so all lanes gather there.
    // Each table keeps its own channel through the harbour, and its branches
    // split from that channel: the pairings stay readable past the market.
    const marketAt = new Map((view.markets || []).filter((market) => points.get(market.id)).map((market) => [market.row, market]));
    for (const [row, market] of marketAt) {
      const m = points.get(market.id);
      const axis = this.portrait ? 'x' : 'y';
      const sources = all.filter((n) => n.row === row && points.get(n.id)).sort((a, b) => points.get(a.id)[axis] - points.get(b.id)[axis]);
      const pivot = sources.findIndex((n) => ['visited', 'current'].includes(n.state));
      const gap = Math.min(this.portrait ? 26 : 38, (this.portrait ? 72 : 100) / Math.max(1, sources.length - 1));
      sources.forEach((node, i) => {
        const a = points.get(node.id);
        const shift = (pivot >= 0 ? i - pivot : i - (sources.length - 1) / 2) * gap;
        const port = { ...m, [axis]: m[axis] + shift };
        const docked = ['visited', 'current'].includes(node.state);
        const cls = node.state === 'skipped' ? 'skipped' : docked ? laneClass(market.state) : 'upcoming';
        emit(cls, docked ? market.id : `${node.id}>${market.id}`, curve(a, port, this.portrait));
        for (const childId of node.links || []) {
          const child = byId.get(childId), b = points.get(childId);
          if (child && b) emit(laneClass(child.state), childId, curve(port, b, this.portrait));
        }
      });
    }
    for (const node of all) {
      if (marketAt.has(node.row)) continue;
      const a = points.get(node.id);
      for (const childId of node.links || []) {
        const child = byId.get(childId);
        const b = points.get(childId);
        if (!a || !b || !child) continue;
        emit(laneClass(child.state), childId, curve(a, b, this.portrait));
      }
    }
    if (!this.portrait && lastVisible < (view.boards || 7) - 1) {
      const second = all.filter((node) => node.state === 'upcoming');
      const from = second.length ? second : all.filter((node) => node.state === 'available');
      for (const node of from) {
        const a = points.get(node.id);
        if (!a) continue;
        emit('ghost', `ghost-${node.id}`, curve(a, { x: edge + 88, y: a.y }, false));
      }
    }
    const origin = this.portrait ? { x: width / 2, y: height + 16 } : this.geo.origin;
    for (const root of all.filter((node) => node.row === 0)) {
      const point = points.get(root.id);
      if (!point) continue;
      const cls = root.state === 'available' ? 'available' : ['visited', 'current'].includes(root.state) ? 'taken' : 'skipped';
      emit(cls, root.id, curve(origin, point, this.portrait));
    }
    const current = all.find((node) => node.state === 'current') || all.filter((node) => node.state === 'visited').at(-1);
    const harbour = (view.markets || []).find((market) => market.state === 'current');
    const boatAt = harbour && points.get(harbour.id) ? points.get(harbour.id)
      : current ? points.get(current.id) : (this.portrait ? { x: width / 2, y: height - 28 } : this.geo.origin);
    // Island chips sit inside the island button, so their tips never pin; a click still selects the island.
    const chipTip = (name, text) => ` title="" data-tip-pin="off" data-tip-name="${esc(name)}" data-tip-text="${esc(text.trim())}"`;
    // Challenge chips show the charm art; the glyph stays behind it as the fallback if the art fails to load.
    const chipIcon = (c, fallback) => {
      const glyph = `<b>${esc(this.options.charmGlyph(c) || fallback)}</b>`;
      const src = this.options.charmArt?.(c);
      return src ? `<img src="${esc(src)}" alt="" draggable="false" loading="lazy" onerror="this.hidden=true">${glyph}` : glyph;
    };
    const stormText = (c) => (c?.level === 2 && c.upgradeText) || c?.text || '';
    const islands = all.map((node) => {
      const p = points.get(node.id);
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return '';
      const t = this.options.theme(node.theme);
      const challenge = node.challenge;
      const strength = node.strength ?? node.row + 1;
      const label = `${t.name}, board ${node.row + 1}, ${stateLabel(node)}. Challenge: ${challenge?.name || 'none'}, strength ${strength}${node.market ? `. ${node.market.name} after this table` : ''}${node.storm ? `. Storm: ${node.stormChallenge?.name || 'second challenge'}, double coins` : ''}${node.final ? `. Finale: ${view.boss?.name || 'boss'}` : ''}${node.confiscated ? `. Confiscates ${node.confiscated.name}` : ''}`;
      const accent = t.css?.['--accent'] || 'var(--accent)';
      return `<button type="button" class="voyage-island ${esc(node.state)}${node.port ? ' harbour' : ''}${node.storm ? ' storm' : ''}${node.final ? ' finale' : ''}" data-node="${esc(node.id)}" data-node-id="${esc(node.id)}" style="--island-size:${this.geo.sizes.get(node.id)}px;--chart-x:${(p.x / width) * 100}%;--chart-y:${(p.y / height) * 100}%;--island-accent:${esc(accent)}" aria-label="${esc(label)}" aria-pressed="${node.id === selected}" title="${esc(t.name)}">
        <span class="voyage-island-glow" aria-hidden="true"></span>
        <span class="voyage-island-art"><img src="${esc(this.options.islandUrl(node.theme))}" alt="" draggable="false" loading="lazy" onerror="this.hidden=true">${fallbackIsland(accent)}</span>
        <span class="voyage-island-name">${esc(t.name)}</span>
        <span class="voyage-island-chips" aria-hidden="true"><i class="challenge"${chipTip(`Challenge · ${challenge?.name || 'None'}`, `${challenge?.text || 'No challenge on this table.'} Strength ${strength}.`)}>${chipIcon(challenge, '◆')}</i>${node.storm ? `<i class="storm voyage-node-storm"${chipTip(`Storm · ${node.stormChallenge?.name || 'Second challenge'}`, `${stormText(node.stormChallenge)} A storm table adds this second challenge, but pays double coins and offers 3 charm choices.`)}>${chipIcon(node.stormChallenge, 'ϟ')}</i>` : ''}</span>
        ${node.storm ? '<span class="voyage-storm-head" aria-hidden="true"></span>' : ''}
        ${node.final ? `<span class="voyage-finale-mark" aria-hidden="true"${chipTip(`Final boss · ${view.boss?.name || 'Boss'}`, `${view.boss?.text || 'The boss waits on this final table.'}${node.confiscated ? ` Confiscates ${node.confiscated.name}.` : ''}`)}>${esc(this.options.charmGlyph(view.boss) || '♛')}</span>` : ''}
      </button>`;
    }).join('');
    const markets = (view.markets || []).map((market) => {
      const p = points.get(market.id);
      if (!p) return '';
      const label = `${market.name} after board ${market.afterBoard}, ${market.state === 'available' ? 'next stop' : market.state === 'current' ? 'your position' : market.state === 'visited' ? 'visited' : 'ahead'}. ${market.wares} You can also sell a charm, buy undos, and reroll.`;
      const art = this.options.marketUrl?.(market.kind) || '';
      return `<button type="button" class="voyage-market ${esc(market.state || 'upcoming')}" data-node="${esc(market.id)}" style="--chart-x:${(p.x / width) * 100}%;--chart-y:${(p.y / height) * 100}%;--island-accent:#e0b877" aria-label="${esc(label)}" aria-pressed="${market.id === selected}" title="${esc(market.name)}"><span class="voyage-island-glow" aria-hidden="true"></span><span class="voyage-island-art"><img src="${esc(art)}" alt="" draggable="false" loading="lazy" onerror="this.hidden=true">${fallbackIsland('#e0b877')}</span><span class="voyage-harbour-mark" aria-hidden="true"><b>⚓</b><i></i></span><span class="voyage-island-name">${esc(market.name)}</span><small>After board ${market.afterBoard}</small></button>`;
    }).join('');
    const futureRows = Math.max(0, (view.boards || 7) - lastVisible - 1);
    const taken = view.confiscated || all.find(n => n.final && n.confiscated)?.confiscated;
    const bossText = `Board ${view.boards || 7} · Final boss: ${view.boss?.name || 'Unknown'}${taken ? ` · Confiscates ${taken.name}` : ''}`;
    const teasers = (this.geo.teasers || []).map((p, i) => `<span class="voyage-fog-isle" aria-hidden="true" style="--chart-x:${(p.x / width) * 100}%;--chart-y:${(p.y / height) * 100}%"><img src="${esc(this.options.silhouetteUrl || '')}" alt="" onerror="this.hidden=true"></span>`).join('');
    const landmark = `<button type="button" class="voyage-boss-landmark" data-node="__boss__" aria-label="${esc(bossText)}" aria-pressed="${selected === '__boss__'}" title="${esc(view.boss?.name || 'Final boss')}"><span class="voyage-boss-art"><img src="${esc(this.options.landmarkUrl || '')}" alt="" draggable="false" onerror="this.hidden=true"><b aria-hidden="true">${esc(this.options.charmGlyph(view.boss) || '♛')}</b></span><small>Board ${view.boards || 7} · Final boss</small><span>${esc(view.boss?.name || 'Final boss')}</span></button>`;
    this.root.innerHTML = `<div class="voyage-chart-horizon">${landmark}<div class="voyage-chart-compass" aria-hidden="true"><i>N</i></div></div><div class="voyage-chart-world ${this.portrait ? 'portrait' : 'landscape'}" style="width:${width}px;height:${height}px;--pan-x:${-this.panX}px;--chart-ratio:${width}/${height};--fog-edge:${fogPct}%">
      <svg class="voyage-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="voyage-lane-fade" gradientUnits="userSpaceOnUse" x1="${edge - 60}" x2="${edge + 88}"><stop stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="voyage-ghost-mask"><rect width="${width}" height="${height}" fill="url(#voyage-lane-fade)"/></mask></defs>
        <g class="voyage-chart-grid"><path d="M0 ${height * .25}H${width}M0 ${height * .5}H${width}M0 ${height * .75}H${width}M${width * .25} 0V${height}M${width * .5} 0V${height}M${width * .75} 0V${height}"/></g>
        <g class="voyage-chart-routes">${routes.join('')}</g>
        <g class="voyage-chart-wake"></g>
        <g class="voyage-fog-mask">${this.portrait ? `<rect x="0" y="0" width="${width}" height="${edge}"/>` : `<rect x="${edge}" y="0" width="${Math.max(0, width - edge)}" height="${height}"/>`}</g>
      </svg>
      <div class="voyage-fog-haze" aria-hidden="true"></div>
      <div class="voyage-fog-bank" aria-hidden="true"><div class="voyage-fog-layer fog-a"></div><div class="voyage-fog-layer fog-b"></div></div>
      <div class="voyage-fog-isles" aria-hidden="true">${teasers}</div>
      <div class="voyage-islands">${islands}${markets}</div>
      <div class="voyage-boat" style="--chart-x:${(boatAt.x / width) * 100}%;--chart-y:${(boatAt.y / height) * 100}%" aria-label="Your boat"><img src="${esc(this.options.boatUrl)}" alt="" onerror="this.hidden=true"><span aria-hidden="true">⛵</span></div>
      <div class="voyage-fog-caption">${futureRows ? `${futureRows} uncharted ${futureRows === 1 ? 'table' : 'tables'}` : current?.final ? 'Final table reached' : 'The finale lies ahead'}</div>
    </div>`;
    this.root.classList.remove('chart-paused');
    const volume = this.fog.attach(this.root.querySelector('.voyage-fog-bank'), { width, height, edge, portrait: this.portrait, seed: hash(view.seed ?? '') });
    this.root.querySelector('.voyage-chart-world').classList.toggle('fog-volume', volume);
    this.root.dataset.orientation = this.portrait ? 'portrait' : 'landscape';
    this.setPan(this.panX);
    if (newView && !this.portrait) {
      const scroller = this.root.closest('.voyage-map-scroll');
      if (scroller) scroller.scrollTop = 0;
    }
    if (box.width < 40 && !this.pendingSize) {
      this.pendingSize = true;
      requestAnimationFrame(() => {
        this.pendingSize = false;
        if (this.view && this.root.getClientRects().length) this.render(this.view, this.selected);
      });
    } else if (this.portrait) {
      requestAnimationFrame(() => {
        const scroller = this.root.closest('.voyage-map-scroll') || this.root;
        const nodes = [...this.root.querySelectorAll('.voyage-island.available, .voyage-island.current')];
        if (!nodes.length || !scroller) return;
        const sr = scroller.getBoundingClientRect();
        const horizon = this.root.querySelector('.voyage-chart-horizon').offsetHeight;
        const contentTop = sr.top + horizon;
        const top = Math.min(...nodes.map((n) => n.getBoundingClientRect().top));
        const bottom = Math.max(...nodes.map((n) => n.getBoundingClientRect().bottom));
        if (top < contentTop + 6 || bottom > sr.bottom - 6) {
          scroller.scrollTop += (top + bottom) / 2 - (contentTop + sr.bottom) / 2;
        }
      });
    }
  }

  select(id) {
    this.selected = id;
    this.root.querySelectorAll('[data-node]').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.node === id)));
  }

  async sailTo(id, { reducedMotion = false, preview = false } = {}) {
    const target = this.geo?.points.get(id);
    const boat = this.root.querySelector('.voyage-boat');
    const island = this.root.querySelector(`[data-node="${CSS.escape(id)}"]`);
    if (!target || !boat || reducedMotion) return;
    this.cancel();
    const { width, height } = this.geo;
    const start = {
      x: parseFloat(boat.style.getPropertyValue('--chart-x')) * width / 100,
      y: parseFloat(boat.style.getPropertyValue('--chart-y')) * height / 100,
    };
    const route = this.root.querySelector(`[data-route-to="${CSS.escape(id)}"]`);
    const parent = this.view.map.flat().find(n => n.links?.includes(id));
    const d = parent ? route?.getAttribute('d') || curve(start, target, this.portrait) : curve(start, target, this.portrait);
    const wake = document.createElementNS(SVG, 'path');
    wake.setAttribute('class', 'voyage-sailing-wake');
    wake.setAttribute('d', d);
    this.root.querySelector('.voyage-chart-wake')?.append(wake);
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    this.root.querySelector('.voyage-chart-svg')?.append(path);
    const length = Math.max(1, path.getTotalLength());
    const frames = [];
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const t = length * i / steps;
      const p = path.getPointAtLength(t);
      const q = path.getPointAtLength(Math.min(length, t + 2));
      const ang = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
      frames.push({
        left: `${p.x / width * 100}%`,
        top: `${p.y / height * 100}%`,
        transform: `translate(-50%,-50%) rotate(${ang}deg)`,
        offset: i / steps,
      });
    }
    path.remove();
    this.root.classList.add('is-sailing');
    this.fog.parting(true);
    island?.classList.add('sail-target');
    const duration = preview ? 4000 : 2300;
    let resolve;
    const finished = new Promise((done) => { resolve = done; });
    const animation = boat.animate(frames, { duration, easing: 'cubic-bezier(.55,.05,.35,.98)', fill: 'forwards' });
    wake.style.setProperty('--wake-length', String(length));
    const wakeAnimation = wake.animate([
      { strokeDashoffset: length, opacity: .35 },
      { strokeDashoffset: 0, opacity: 1, offset: .7 },
      { strokeDashoffset: -length * .16, opacity: .2 },
    ], { duration, easing: 'ease-in-out', fill: 'forwards' });
    const finish = () => {
      clearTimeout(this.soonTimer);
      animation.cancel();
      wakeAnimation.cancel();
      boat.style.setProperty('--chart-x', `${target.x / width * 100}%`);
      boat.style.setProperty('--chart-y', `${target.y / height * 100}%`);
      this.root.classList.remove('is-sailing');
      this.fog.parting(false);
      island?.classList.remove('sail-target');
      this.motion = null;
      resolve();
    };
    animation.onfinish = finish;
    this.motion = { finish, animation, wakeAnimation };
    if (preview) {
      animation.currentTime = duration * 0.5;
      wakeAnimation.currentTime = duration * 0.5;
      animation.pause();
      wakeAnimation.pause();
    }
    return finished;
  }

  dock(id, { reducedMotion = false, preview = false } = {}) {
    this.cancel();
    const p = this.geo?.points.get(id), boat = this.root.querySelector('.voyage-boat');
    if (p && boat) {
      boat.style.setProperty('--chart-x', `${(p.x - 24) / this.geo.width * 100}%`);
      boat.style.setProperty('--chart-y', `${(p.y + 25) / this.geo.height * 100}%`);
    }
    const stop = this.root.querySelector(`[data-node="${CSS.escape(id)}"]`);
    stop?.classList.add('docking');
    this.root.classList.add('is-docking');
    if (reducedMotion) return Promise.resolve();
    return new Promise((resolve) => {
      const finish = () => { clearTimeout(timer); this.root.classList.remove('is-docking'); stop?.classList.remove('docking'); this.motion = null; resolve(); };
      const timer = preview ? null : setTimeout(finish, 760);
      this.motion = { finish };
      if (preview) {
        const lantern = stop?.querySelector('.voyage-harbour-mark i');
        lantern?.getAnimations().forEach(a => { a.pause(); a.currentTime = 380; });
      }
    });
  }

  // A prepared deal must not acquire a 1.45s delay just for the boat.
  // Finish the remaining path quickly once preparation has completed.
  finishSoon(ms = 180) {
    const motion = this.motion;
    if (!motion) return;
    for (const a of [motion.animation, motion.wakeAnimation]) {
      if (!a) continue;
      try {
        if (a.playState === 'paused') a.play();
        const remaining = a.effect.getTiming().duration - (a.currentTime || 0);
        if (remaining > ms) a.updatePlaybackRate(remaining / ms);
      } catch { /* some engines reject playbackRate on finished effects */ }
    }
    clearTimeout(this.soonTimer);
    this.soonTimer = setTimeout(() => { if (this.motion === motion) motion.finish(); }, ms);
  }

  skip() { this.motion?.finish?.(); }
  cancel() {
    if (!this.motion) return;
    const motion = this.motion;
    this.motion = null;
    clearTimeout(this.soonTimer);
    motion.animation?.cancel();
    motion.wakeAnimation?.cancel();
    motion.finish?.();
  }
  pause() {
    this.cancel();
    cancelAnimationFrame(this.resizeFrame); this.resizeFrame = 0;
    this.fog.stop();
    this.root.classList.add('chart-paused');
  }
  resume() {
    this.motion?.animation?.play();
    this.motion?.wakeAnimation?.play();
    this.root.classList.remove('chart-paused');
    this.fog.start();
  }
}
