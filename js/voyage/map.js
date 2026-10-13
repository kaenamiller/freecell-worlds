// The Voyage chart: a branching tree of themed boards, 7 levels deep. The voyage opens with
// VOYAGE.firstRowWidth tables; every table then splits into VOYAGE.branch tables of its own. The
// player sees VOYAGE.lookahead levels ahead (their choices and what each choice leads to).
//
// Nodes are generated lazily as the player advances. A node's id encodes its route from the root
// ('n1' → 'n1.0' → 'n1.0.1'), and its theme comes from a stream seeded by that id, so the chart is
// deterministic in the run seed and the route taken.
//
// No board is ever shown twice in a run: each new node takes a theme that no node revealed so far
// has used, including tables behind choices the player never takes. A full run reveals 29 nodes
// (9 at the start, then 4 per board for boards 1-5), so this needs at least 29 themes. With fewer,
// it falls back gracefully: themes on the route to the node are still never repeated, and
// siblings never share a theme.
import { THEME_ORDER } from '../themes.js';
import { VOYAGE } from './config.js';
import { stream } from './rng.js';
import { CHARMS } from './registry.js';

// Every theme already on the chart, in any branch.
const usedThemes = (map) => new Set(Object.values(map.nodes).map((n) => n.theme));

function routeThemes(map, id) {
  const out = [];
  for (let n = map.nodes[id]; n; n = map.nodes[n.parent]) out.push(n.theme);
  return out;
}

// Create the children of `parentId` (or the opening tables when null), once.
function grow(map, parentId, bannedTheme) {
  const parent = parentId ? map.nodes[parentId] : null;
  if (parent ? parent.links.length : map.roots.length) return;
  const row = parent ? parent.row + 1 : 0;
  if (row >= VOYAGE.boards) return;
  const count = parent ? VOYAGE.branch : VOYAGE.firstRowWidth;
  const used = usedThemes(map);
  const route = new Set(parent ? routeThemes(map, parentId) : []);
  const r = stream(map.seed, 'node', parentId || 'root');
  const order = r.shuffle(THEME_ORDER);
  const banned = (t) => !!bannedTheme?.(t, row);
  // Most to least strict: never seen this run, then (only if the pool is too small) not on this
  // route. Each tier first honours bannedTheme (boss/finale clashes), then relaxes it.
  const tiers = [
    (t) => !used.has(t) && !banned(t),
    (t) => !used.has(t),
    (t) => !route.has(t) && !banned(t),
    (t) => !route.has(t),
    () => true,
  ];
  const ids = [];
  for (let k = 0; k < count; k++) {
    const taken = new Set(ids.map((id) => map.nodes[id].theme));
    let theme = null;
    for (const ok of tiers) {
      theme = order.find((t) => !taken.has(t) && ok(t));
      if (theme) break;
    }
    const id = parentId ? `${parentId}.${k}` : `n${k}`;
    map.nodes[id] = { id, row, lane: k, theme, parent: parentId, links: [], port: false, storm: false, stormChallenge: null };
    ids.push(id);
  }
  // Markets are on the route, not a branch you might miss. Every table on a market
  // row docks into the same stop: stickers after board 2, charms after board 4,
  // upgrades after board 6.
  if (VOYAGE.markets.some((market) => market.afterBoard === row + 1)) {
    for (const id of ids) map.nodes[id].port = true;
  }
  if (row >= 1 && row < VOYAGE.boards - 1) for (const id of ids) {
    const node = map.nodes[id];
    if (node.port || stream(map.seed, 'storm', id)() >= VOYAGE.stormChance) continue;
    const own = Object.values(CHARMS).find((c) => c.kind === 'challenge' && c.theme === node.theme);
    if (!own) continue;
    const candidates = Object.values(CHARMS).filter((c) => c.kind === 'challenge' && c.theme !== node.theme && !(c.tags || []).some((tag) => own.tags?.includes(tag))).sort((a, b) => a.id.localeCompare(b.id));
    const second = stream(map.seed, 'storm-challenge', id).pick(candidates);
    if (second) { node.storm = true; node.stormChallenge = second.id; }
  }
  if (parent) parent.links = ids;
  else map.roots = ids;
}

// Make sure everything within `lookahead` levels of the current position exists.
export function revealMap(map, { bannedTheme, lookahead = map.lookahead ?? VOYAGE.lookahead } = {}) {
  map.lookahead = Math.max(1, Math.min(4, Number.isFinite(lookahead) ? Math.floor(lookahead) : VOYAGE.lookahead));
  let frontier = map.path.length ? [map.path[map.path.length - 1]] : [null];
  for (let depth = 0; depth < map.lookahead; depth++) {
    const next = [];
    for (const id of frontier) {
      grow(map, id, bannedTheme);
      next.push(...(id ? map.nodes[id].links : map.roots));
    }
    frontier = next;
  }
}

export function createMap(seed, { bannedTheme, lookahead = VOYAGE.lookahead } = {}) {
  const map = { seed, nodes: {}, roots: [], path: [] };
  revealMap(map, { bannedTheme, lookahead });
  return map;
}

export const findNode = (map, id) => map.nodes[id] || null;

// Nodes the player may pick next.
export function nextChoices(map) {
  const last = map.path[map.path.length - 1];
  return (last ? map.nodes[last].links : map.roots).map((id) => map.nodes[id]);
}

// Commit to a node and reveal what lies `lookahead` levels beyond it.
export function chooseNode(map, id, { bannedTheme, lookahead = map.lookahead ?? VOYAGE.lookahead } = {}) {
  if (!nextChoices(map).some((n) => n.id === id)) throw new Error(`Node ${id} is not reachable`);
  map.path.push(id);
  revealMap(map, { bannedTheme, lookahead });
  return map.nodes[id];
}

// The visible chart for the UI, as rows (index = board - 1). It contains the route taken, the
// alternatives passed up at each step ('skipped', without their subtrees), the current choices
// ('available') and what each choice leads to ('upcoming'). Every node carries `parent` and
// `links` (its children), so the UI can draw each branch explicitly.
export function mapView(map) {
  const current = map.path[map.path.length - 1] || null;
  const onPath = new Set(map.path);
  const visible = [];
  // Route and the siblings passed up along it.
  let siblings = map.roots;
  for (const id of map.path) {
    for (const s of siblings) visible.push({ id: s, state: s === id ? (s === current ? 'current' : 'visited') : 'skipped' });
    siblings = map.nodes[id].links;
  }
  // Choices from here, and each choice's own branches.
  let frontier = nextChoices(map).map((n) => n.id);
  let state = 'available';
  for (let depth = 0; depth < (map.lookahead ?? VOYAGE.lookahead) && frontier.length; depth++) {
    for (const id of frontier) visible.push({ id, state });
    frontier = frontier.flatMap((id) => map.nodes[id].links);
    state = 'upcoming';
  }
  const shown = new Set(visible.map((v) => v.id));
  const rows = [];
  for (const { id, state: st } of visible) {
    const n = map.nodes[id];
    (rows[n.row] ??= []).push({
      ...n,
      links: n.links.filter((l) => shown.has(l)),
      state: onPath.has(id) && st !== 'current' ? 'visited' : st,
    });
  }
  return rows.map((r) => r || []);
}
