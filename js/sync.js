// Progress sync for signed-in players. localStorage (js/store.js) stays the working
// copy; each key is mirrored to a versioned save slot on the account (server/src/data.js).
//
// - A brand-new account with nothing saved imports everything on this device.
// - Signing in to an account that already has saves takes the account's copy; this
//   device's previous progress is kept under `localBackup`.
// - Each push sends the slot version this device last saw. If another device wrote in
//   between (409), stats are merged and everything else keeps this device's copy, since
//   it is the one being played.
import { load, save, onSave, applyRemote } from './store.js';

export const SYNC_KEYS = ['settings', 'stats', 'game', 'voyage', 'voyageStats', 'voyageTutorial'];
const MERGED = new Set(['stats', 'voyageStats', 'voyageTutorial']);
// The deal and the voyage run are only replaced from the account on the title screen.
const SESSION = new Set(['game', 'voyage']);
const PUSH_DELAY = 1500;
const LOWER_IS_BETTER = new Set(['bestTime', 'bestMoves']);

// --- stat merging --------------------------------------------------------------------
// Two devices' totals can't be added without double counting, so take the larger of each
// counter (the smaller for best times), union the per-theme and per-day maps, and keep
// the newest entries of `recent` lists.
export function mergeStats(a, b) {
  if (a == null) return b;
  if (b == null) return a;
  if (Array.isArray(a) && Array.isArray(b)) {
    const seen = new Map();
    for (const e of [...a, ...b]) seen.set(JSON.stringify(e), e);
    return [...seen.values()].sort((x, y) => (y?.at || 0) - (x?.at || 0)).slice(0, Math.max(a.length, b.length, 10));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (LOWER_IS_BETTER.has(k) && typeof a[k] === 'number' && typeof b[k] === 'number') out[k] = !a[k] ? b[k] : !b[k] ? a[k] : Math.min(a[k], b[k]);
      else out[k] = mergeStats(a[k], b[k]);
    }
    return out;
  }
  if (typeof a === 'number' && typeof b === 'number') return Math.max(a, b);
  if (typeof a === 'boolean' && typeof b === 'boolean') return a || b;
  return b;
}

// --- engine ---------------------------------------------------------------------------
export function createSync({ api, onRemote = () => {}, canReplaceSession = () => true }) {
  // { userId, versions: { key: n }, dirty: [key] } — what this device knows about the account.
  let meta = load('sync', {});
  let userId = null;
  const timers = new Map();
  let pushing = Promise.resolve();

  const persistMeta = () => save('sync', meta);
  const markDirty = (key) => {
    meta.dirty = [...new Set([...(meta.dirty || []), key])];
    persistMeta();
  };

  onSave((key) => {
    if (!userId || !SYNC_KEYS.includes(key)) return;
    markDirty(key);
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => queuePush(key), PUSH_DELAY));
  });

  const queuePush = (key) => (pushing = pushing.then(() => push(key)).catch(() => {}));

  async function push(key, attempt = 0) {
    if (!userId) return;
    const res = await api(`/v1/saves/${key}`, { method: 'PUT', body: { data: load(key, null), version: meta.versions?.[key] || 0 } });
    if (res.status === 200) {
      meta.versions = { ...meta.versions, [key]: res.json.version };
      meta.dirty = (meta.dirty || []).filter((k) => k !== key);
      persistMeta();
      return;
    }
    if (res.status === 409 && attempt < 3) {
      const current = res.json.current;
      meta.versions = { ...meta.versions, [key]: current?.version || 0 };
      if (MERGED.has(key) && current) {
        applyRemote(key, mergeStats(load(key, null), current.data));
        onRemote([key]);
      }
      return push(key, attempt + 1);
    }
    // Offline or a server error: the key stays dirty and goes up on the next flush.
  }

  async function flush() {
    if (!userId) return;
    for (const key of meta.dirty || []) await queuePush(key);
  }

  // Bring this device and the account into line; returns what changed locally.
  async function pull({ fresh = false } = {}) {
    const res = await api('/v1/saves');
    if (res.status !== 200) return [];
    const remote = res.json.saves || {};
    const changed = [];
    const newAccount = Object.keys(remote).length === 0;

    if (fresh && !newAccount) {
      // Another account's (or a signed-out) history on this device: keep it aside.
      save('localBackup', { at: Date.now(), data: Object.fromEntries(SYNC_KEYS.map((k) => [k, load(k, null)])) });
      meta.dirty = [];
    }

    for (const key of SYNC_KEYS) {
      const slot = remote[key];
      const local = load(key, null);
      const known = meta.versions?.[key] || 0;
      if (!slot) {
        // Upload it unless this device's progress was just set aside for an existing account.
        if (local != null && !(fresh && !newAccount)) markDirty(key);
        continue;
      }
      const dirty = (meta.dirty || []).includes(key);
      if (dirty && !fresh) continue; // pushed below; a conflict there resolves it
      if (fresh || slot.version > known) {
        if (SESSION.has(key) && !canReplaceSession()) continue;
        applyRemote(key, slot.data);
        meta.versions = { ...meta.versions, [key]: slot.version };
        changed.push(key);
      }
    }
    persistMeta();
    if (changed.length) onRemote(changed);
    await flush();
    return changed;
  }

  return {
    get active() {
      return !!userId;
    },
    // Call after sign-in (or on startup with a session).
    async start(user) {
      const fresh = meta.userId !== user.id;
      if (fresh) meta = { userId: user.id, versions: {}, dirty: [] };
      userId = user.id;
      persistMeta();
      return pull({ fresh });
    },
    stop() {
      userId = null;
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
      meta = {};
      persistMeta();
    },
    pull: () => (userId ? pull() : Promise.resolve([])),
    flush,
  };
}
