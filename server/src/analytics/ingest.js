// POST /events and GET /config. Events go straight into the existing DB binding.
// Google Analytics is not configured here; the game leaves gaMeasurementId empty.
import { EVENTS, SCHEMA_VERSION, prepareEvent } from '../../../js/analytics-schema.js';

const MAX_BODY = 60000;
const MAX_EVENTS = 100;
const SKEW_PAST_MS = 7 * 24 * 60 * 60 * 1000;
const SKEW_FUTURE_MS = 5 * 60 * 1000;
const BOT = /bot|spider|crawler|headless/i;

// Same set js/analytics.js uses for Consent Mode. A missing country is not a consent region;
// the game falls back to the time zone when this endpoint can't be reached.
const CONSENT_COUNTRIES = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH']);

export async function analyticsConfig(c) {
  const country = c.req.raw.cf?.country || null;
  let enabled = true;
  let sample = 1;
  try {
    const { results } = await c.env.DB.prepare(
      `select "key", "value" from "remote_config" where "key" in ('analytics_enabled', 'analytics_sample')`,
    ).all();
    for (const row of results || []) {
      if (row.key === 'analytics_enabled') enabled = row.value !== '0' && row.value !== 'false';
      if (row.key === 'analytics_sample') {
        const n = Number(row.value);
        if (Number.isFinite(n)) sample = Math.min(1, Math.max(0, n));
      }
    }
  } catch {
    // Migration not applied yet: collection stays on and the client can still ask.
  }
  return c.json({
    country,
    consentRequired: country ? CONSENT_COUNTRIES.has(country) : false,
    analytics: { enabled, sample },
  });
}

export async function ingestEvents(c) {
  const raw = await c.req.text();
  if (raw.length > MAX_BODY) return c.json({ code: 'TOO_LARGE', message: 'Batch is too large.' }, 413);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return c.json({ code: 'BAD_JSON', message: 'Body must be JSON.' }, 400);
  }
  if (!body || body.v !== SCHEMA_VERSION || !Array.isArray(body.events) || body.events.length > MAX_EVENTS) {
    return c.json({ code: 'BAD_REQUEST', message: 'Expected { v, mode, events }.' }, 400);
  }
  if (body.mode !== 'full' && body.mode !== 'anonymous' && body.mode !== 'server') {
    return c.json({ code: 'BAD_REQUEST', message: 'Unknown collection mode.' }, 400);
  }
  if (body.mode !== 'server' && BOT.test(c.req.header('user-agent') || '')) return c.body(null, 204);

  const now = Date.now();
  const playerId = body.mode === 'full' && typeof body.pid === 'string' ? body.pid.slice(0, 64) : null;
  const app = typeof body.app === 'string' ? body.app.slice(0, 40) : null;
  const country = c.req.raw.cf?.country || null;
  const agent = parseAgent(c.req.header('user-agent') || '');
  const rejected = {};
  const stmts = [];
  const seen = new Set();
  let suspect = 0;
  let dupesInBatch = 0;

  for (const ev of body.events) {
    const row = normalize(ev, { now, mode: body.mode, playerId, app, country, agent });
    if (!row) {
      rejected.invalid = (rejected.invalid || 0) + 1;
      continue;
    }
    if (seen.has(row.id)) {
      dupesInBatch++;
      continue;
    }
    seen.add(row.id);
    if (row.suspect) suspect++;
    stmts.push(insertEvent(c.env.DB, row));
  }

  let inserted = 0;
  if (stmts.length) {
    const results = await c.env.DB.batch(stmts);
    inserted = results.reduce((n, r) => n + (r.meta?.changes || 0), 0);
  }
  const dedupes = dupesInBatch + (stmts.length - inserted);
  await recordStats(c.env.DB, {
    day: new Date(now).toISOString().slice(0, 10),
    accepted: inserted,
    rejected,
    dedupes,
    suspect,
    bytes: raw.length,
  });
  return c.body(null, 204);
}

function normalize(ev, ctx) {
  if (!ev || typeof ev.id !== 'string' || typeof ev.n !== 'string' || !EVENTS[ev.n]) return null;
  if (!/^[0-9a-f-]{36}$/i.test(ev.id)) return null;
  const params = ev.p && typeof ev.p === 'object' && !Array.isArray(ev.p) ? ev.p : {};
  const context = ev.c && typeof ev.c === 'object' && !Array.isArray(ev.c) ? ev.c : null;
  const { fp } = prepareEvent(ev.n, params, context || {});
  if (!fp) return null;
  let ts = Number(ev.t);
  let clockSkew = 0;
  if (!Number.isFinite(ts) || ts < ctx.now - SKEW_PAST_MS || ts > ctx.now + SKEW_FUTURE_MS) {
    ts = ctx.now;
    clockSkew = 1;
  }
  return {
    id: ev.id,
    ts: Math.round(ts),
    received: ctx.now,
    day: new Date(ts).toISOString().slice(0, 10),
    name: ev.n,
    sessionId: typeof ev.sid === 'string' ? ev.sid.slice(0, 64) : null,
    playerId: ctx.playerId,
    mode: ctx.mode,
    app: ctx.app,
    country: ctx.country,
    device: ctx.agent.device,
    browser: ctx.agent.browser,
    os: ctx.agent.os,
    ctx: context ? JSON.stringify(context).slice(0, 4000) : null,
    params: JSON.stringify(fp),
    suspect: suspectEvent(ev.n, fp) ? 1 : 0,
    clockSkew,
  };
}

function suspectEvent(name, params) {
  if ((name === 'game_end' || name === 'voyage_board_end') && params.outcome === 'win' && Number(params.time_s) < 5) return true;
  if (Number(params.moves) > 10000) return true;
  return false;
}

function insertEvent(db, row) {
  return db.prepare(
    `insert or ignore into "event"
      ("id", "ts", "received", "day", "name", "session_id", "player_id", "mode", "app_version", "country", "device", "browser", "os", "ctx", "params", "trusted", "suspect", "internal", "clock_skew")
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?)`,
  ).bind(
    row.id, row.ts, row.received, row.day, row.name, row.sessionId, row.playerId, row.mode, row.app,
    row.country, row.device, row.browser, row.os, row.ctx, row.params, row.suspect, row.clockSkew,
  );
}

async function recordStats(db, row) {
  const current = await db.prepare(`select "rejected" from "ingest_stats" where "day" = ?`).bind(row.day).first();
  let rejected = {};
  try { rejected = JSON.parse(current?.rejected || '{}') || {}; } catch { rejected = {}; }
  for (const [reason, n] of Object.entries(row.rejected)) rejected[reason] = (rejected[reason] || 0) + n;
  await db.prepare(
    `insert into "ingest_stats" ("day", "accepted", "rejected", "dedupes", "suspect", "bytes")
     values (?, ?, ?, ?, ?, ?)
     on conflict("day") do update set
       "accepted" = "accepted" + excluded."accepted",
       "rejected" = excluded."rejected",
       "dedupes" = "dedupes" + excluded."dedupes",
       "suspect" = "suspect" + excluded."suspect",
       "bytes" = "bytes" + excluded."bytes"`,
  ).bind(row.day, row.accepted, JSON.stringify(rejected), row.dedupes, row.suspect, row.bytes).run();
}

function parseAgent(ua) {
  const browser = /Edg\//.test(ua) ? 'edge'
    : /Chrome\//.test(ua) ? 'chrome'
      : /Firefox\//.test(ua) ? 'firefox'
        : /Safari\//.test(ua) ? 'safari'
          : 'other';
  const os = /Windows/.test(ua) ? 'windows'
    : /Android/.test(ua) ? 'android'
      : /iPhone|iPad/.test(ua) ? 'ios'
        : /Mac OS X/.test(ua) ? 'mac'
          : /Linux/.test(ua) ? 'linux'
            : 'other';
  const device = /iPad|Tablet/.test(ua) ? 'tablet' : /Mobi|Android/.test(ua) ? 'mobile' : 'desktop';
  return { browser, os, device };
}
