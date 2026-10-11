// The Voyage chart: a branching tree of themed boards, 7 levels deep. The voyage opens with
// VOYAGE.firstRowWidth tables; every table then splits into VOYAGE.branch tables of its own. The
// player sees VOYAGE.lookahead levels ahead (their choices and what each choice leads to).
//
// Nodes are generated lazily as the player advances. A node's id encodes its route from the root
// ('n1' → 'n1.0' → 'n1.0.1'), and its theme comes from a stream seeded by that id, so the chart is
// deterministic in the run seed whatever order nodes are revealed in. A node's children avoid
// every theme on the route to it, so no theme repeats on a path, and siblings never share one.
import { THEME_ORDER } from '../themes.js';
import { VOYAGE } from './config.js';
import { stream } from './rng.js';

const rowOf = (id) => id.split('.').length - 1;

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
  const avoid = new Set(parent ? routeThemes(map, parentId) : []);
  const r = stream(map.seed, 'node', parentId || 'root');
  const preferred = r.shuffle(THEME_ORDER.filter((t) => !avoid.has(t) && !bannedTheme?.(t, row)));
  const fallback = r.shuffle(THEME_ORDER.filter((t) => !avoid.has(t)));
  const ids = [];
  for (let k = 0; k < count; k++) {
    const theme = preferred.shift() || fallback.find((t) => !ids.some((id) => map.nodes[id].theme === t)) || THEME_ORDER[k];
    const id = parentId ? `${parentId}.${k}` : `n${k}`;
    map.nodes[id] = { id, row, lane: k, theme, parent: parentId, links: [] };
    ids.push(id);
  }
  if (parent) parent.links = ids;
  else map.roots = ids;
}

// Make sure everything within `lookahead` levels of the current position exists.
function reveal(map, bannedTheme) {
  let frontier = map.path.length ? [map.path[map.path.length - 1]] : [null];
  for (let depth = 0; depth < VOYAGE.lookahead; depth++) {
    const next = [];
    for (const id of frontier) {
      grow(map, id, bannedTheme);
      next.push(...(id ? map.nodes[id].links : map.roots));
    }
    frontier = next;
  }
}

export function createMap(seed, { bannedTheme } = {}) {
  const map = { seed, nodes: {}, roots: [], path: [] };
  reveal(map, bannedTheme);
  return map;
}

export const findNode = (map, id) => map.nodes[id] || null;

// Nodes the player may pick next.
export function nextChoices(map) {
  const last = map.path[map.path.length - 1];
  return (last ? map.nodes[last].links : map.roots).map((id) => map.nodes[id]);
}

// Commit to a node and reveal what lies `lookahead` levels beyond it.
export function chooseNode(map, id, { bannedTheme } = {}) {
  if (!nextChoices(map).some((n) => n.id === id)) throw new Error(`Node ${id} is not reachable`);
  map.path.push(id);
  reveal(map, bannedTheme);
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
  for (let depth = 0; depth < VOYAGE.lookahead && frontier.length; depth++) {
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
