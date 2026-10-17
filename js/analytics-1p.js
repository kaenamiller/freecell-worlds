// First-party event sender (docs/first-party-analytics-plan.md §4). js/analytics.js hands it
// validated events; this module owns ids, sessions, batching, transport and the offline queue.
// It sends nothing until ANALYTICS.api is set (js/analytics-config.js).
import { prepareEvent, SCHEMA_VERSION } from './analytics-schema.js';

const PID_KEY = 'freecellworlds.pid';
const SID_KEY = 'freecellworlds.sid'; // sessionStorage
const QUEUE_KEY = 'freecellworlds.evq';
const SESSION_IDLE_MS = 30 * 60 * 1000; // same rule as GA4
const FLUSH_EVENTS = 20;
const FLUSH_MS = 10000;
const MAX_BODY = 60000; // fetch keepalive caps bodies at 64 KB
const QUEUE_MAX_EVENTS = 500;
const QUEUE_MAX_BYTES = 256 * 1024;
const ACTIVE_GAP_MS = 60000; // input gaps longer than this don't count as active time

export const uuid = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

const store = (area) => ({
  get(key) { try { return JSON.parse(area().getItem(key) || 'null'); } catch { return null; } },
  set(key, value) { try { area().setItem(key, JSON.stringify(value)); } catch { /* quota or storage off */ } },
  remove(key) { try { area().removeItem(key); } catch { /* storage off */ } },
});
const local = store(() => localStorage);
const sessionArea = store(() => sessionStorage);

const state = {
  mode: 'off',
  url: '',
  app: 'dev',
  buffer: [],
  timer: 0,
  session: null,
  pid: null,
  firstVisit: false,
  onBatch: null, // debug hook: (payload, transport) => void
  wired: false,
};

export function configure({ api = '', appVersion = 'dev', onBatch = null } = {}) {
  state.url = api ? `${api.replace(/\/$/, '')}/events` : '';
  state.app = appVersion;
  state.onBatch = onBatch;
  if (!state.wired) wire();
}

export const active = () => state.mode !== 'off' && !!state.url;

// Switching mode ends the current session, so anonymous and full data are never linked.
export function setMode(mode) {
  if (mode === state.mode) return;
  if (state.session) endSession();
  flush();
  state.mode = mode;
  state.session = null;
  if (mode !== 'full') {
    local.remove(PID_KEY);
    local.remove(QUEUE_KEY);
    sessionArea.remove(SID_KEY);
    state.pid = null;
  }
  if (mode === 'off') state.buffer = [];
  // No device id is created until there is somewhere to send events.
  if (mode === 'full' && state.url) {
    state.pid = local.get(PID_KEY);
    state.firstVisit = !state.pid;
    if (!state.pid) { state.pid = uuid(); local.set(PID_KEY, state.pid); }
    const saved = sessionArea.get(SID_KEY), now = Date.now();
    if (saved && now - saved.last < SESSION_IDLE_MS) state.session = { ...saved, visibleSince: document.hidden ? 0 : now, lastInput: now };
    drainQueue();
  }
}

// summary: the event may be sent in anonymous mode (analytics-schema.js).
export function enqueue(name, context, params, { summary = false } = {}) {
  if (!active() || (state.mode === 'anonymous' && !summary)) return false;
  const now = Date.now();
  ensureSession(now);
  push(name, context, params, now);
  return true;
}

export function flush({ beacon = false } = {}) {
  clearTimeout(state.timer);
  state.timer = 0;
  if (!state.buffer.length || !state.url) return;
  const events = state.buffer.splice(0);
  for (const batch of chunk(events)) send(batch, beacon);
}

// --- sessions -------------------------------------------------------------------------
function ensureSession(now) {
  const s = state.session;
  if (s && now - s.last < SESSION_IDLE_MS) return;
  if (s) endSession();
  state.session = { id: uuid(), started: now, last: now, seq: 0, events: 0, active: 0, foreground: 0, visibleSince: document.hidden ? 0 : now, lastInput: now };
  if (state.mode === 'full') {
    const q = new URLSearchParams(location.search);
    const utm = (k) => q.get(`utm_${k}`) || undefined;
    let referrer;
    try {
      const r = document.referrer && new URL(document.referrer);
      if (r && r.origin !== location.origin) referrer = r.origin + r.pathname;
    } catch { /* not a URL */ }
    push('session_start', null, {
      referrer, landing: location.pathname, first_visit: state.firstVisit,
      utm_source: utm('source'), utm_medium: utm('medium'), utm_campaign: utm('campaign'), utm_term: utm('term'), utm_content: utm('content'),
    }, now);
    state.firstVisit = false;
  }
}

function sessionTotals(now = Date.now()) {
  const s = state.session;
  const fg = s.foreground + (s.visibleSince ? now - s.visibleSince : 0);
  return { active_s: Math.round(s.active / 1000), foreground_s: Math.round(fg / 1000), events: s.events };
}

function endSession() {
  const s = state.session;
  if (!s || !s.events) return;
  push('session_end', null, sessionTotals(Math.min(Date.now(), s.last + ACTIVE_GAP_MS)), Date.now(), s);
  state.session = null;
}

function persistSession() {
  if (state.mode === 'full' && state.session) sessionArea.set(SID_KEY, state.session);
}

function push(name, context, params, now, session = state.session) {
  const { fp } = prepareEvent(name, params);
  if (!fp) return;
  session.seq++;
  session.events++;
  session.last = now;
  state.buffer.push({ id: uuid(), n: name, t: now, sid: session.id, s: session.seq, ...(context ? { c: context } : {}), p: fp });
  if (state.buffer.length >= FLUSH_EVENTS) flush();
  else if (!state.timer) state.timer = setTimeout(flush, FLUSH_MS);
}

// --- transport ------------------------------------------------------------------------
const header = () => ({ v: SCHEMA_VERSION, app: state.app, mode: state.mode, ...(state.mode === 'full' ? { pid: state.pid } : {}) });

function chunk(events) {
  const batches = [];
  let cur = [], size = 200;
  for (const e of events) {
    const n = JSON.stringify(e).length + 1;
    if (cur.length && size + n > MAX_BODY) { batches.push(cur); cur = []; size = 200; }
    cur.push(e);
    size += n;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

async function send(events, beacon, payload = { ...header(), events }) {
  const body = JSON.stringify(payload);
  state.onBatch?.(payload, beacon ? 'beacon' : 'fetch');
  if (beacon && navigator.sendBeacon) {
    // text/plain keeps the request simple (no CORS preflight).
    if (!navigator.sendBeacon(state.url, new Blob([body], { type: 'text/plain' }))) enqueueOffline(payload);
    return;
  }
  try {
    const res = await fetch(state.url, { method: 'POST', body, keepalive: true, credentials: 'include', headers: { 'Content-Type': 'text/plain' } });
    if (res.status >= 500) enqueueOffline(payload);
    else if (res.ok) drainQueue();
    // Other 4xx: the server rejected the batch as invalid, so retrying won't help.
  } catch {
    enqueueOffline(payload);
  }
}

function enqueueOffline(payload) {
  if (state.mode !== 'full' || payload.mode !== 'full') return;
  const queue = local.get(QUEUE_KEY) || [];
  queue.push(payload);
  let events = queue.reduce((n, b) => n + b.events.length, 0);
  while (queue.length > 1 && (events > QUEUE_MAX_EVENTS || JSON.stringify(queue).length > QUEUE_MAX_BYTES)) {
    events -= queue.shift().events.length; // drop the oldest batch
  }
  local.set(QUEUE_KEY, queue);
}

let draining = false;
async function drainQueue() {
  if (draining || state.mode !== 'full' || !state.url || !navigator.onLine) return;
  const queue = local.get(QUEUE_KEY);
  if (!queue?.length) return;
  draining = true;
  local.remove(QUEUE_KEY);
  try {
    // Each batch keeps its original header and timestamps; failures go back on the queue.
    for (const payload of queue) await send(payload.events, false, { ...payload, queued: true });
  } finally {
    draining = false;
  }
}

// --- page lifecycle -------------------------------------------------------------------
function wire() {
  state.wired = true;
  const input = () => {
    const s = state.session;
    if (!s || document.hidden) return;
    const now = Date.now();
    const gap = now - s.lastInput;
    if (gap < ACTIVE_GAP_MS) s.active += gap;
    s.lastInput = now;
  };
  window.addEventListener('pointerdown', input, { capture: true, passive: true });
  window.addEventListener('keydown', input, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    const s = state.session, now = Date.now();
    if (document.hidden) {
      if (s?.visibleSince) { s.foreground += now - s.visibleSince; s.visibleSince = 0; }
      persistSession();
      flush({ beacon: true });
    } else if (s) {
      s.visibleSince = now;
      s.lastInput = now;
    }
  });
  window.addEventListener('pagehide', () => {
    // A reload inside 30 minutes continues the session, so this end is provisional:
    // the server keeps the largest totals it sees for a session id.
    const s = state.session;
    if (active() && s?.events) push('session_end', null, sessionTotals(), Date.now(), s);
    persistSession();
    flush({ beacon: true });
  });
  window.addEventListener('online', () => drainQueue());
}
