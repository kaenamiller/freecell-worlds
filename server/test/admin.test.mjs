// Admin dashboard: signed-out and non-allowlisted sessions get 403, and the
// summary counts rows in the event table. Requires the local API (see api.test.mjs)
// with ADMIN_EMAILS=admin@example.com.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { API, ORIGIN, PASSWORD, client, emailLink } from './helpers.mjs';
import { dateRange } from '../src/analytics/admin.js';

const ADMIN = 'admin@example.com';
const SENTINEL = `sentinel-stack-${crypto.randomUUID()}`;
const mark = crypto.randomUUID().slice(0, 8);
const themeAlpha = `theme-alpha-${mark}`;
const themeBeta = `theme-beta-${mark}`;
const themeGamma = `theme-gamma-${mark}`;
const themeAncient = `theme-ancient-${mark}`;

function localSql(sql) {
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'freecell-worlds', '--local', '--json', '--command', sql], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`local d1 failed (${r.status}): ${(r.stderr || r.stdout || '').slice(0, 500)}`);
}

function insertEvents(rows) {
  const values = rows.map(({ id, day, name, player, session, ctx, params }) => {
    const ts = Date.parse(`${day}T12:00:00Z`);
    const ctxSql = ctx ? `'${JSON.stringify(ctx).replaceAll("'", "''")}'` : 'null';
    const paramsSql = `'${JSON.stringify(params).replaceAll("'", "''")}'`;
    return `('${id}', ${ts}, ${ts}, '${day}', '${name}', '${session}', '${player}', 'full', ${paramsSql}, ${ctxSql})`;
  });
  localSql(
    `insert into event (id, ts, received, day, name, session_id, player_id, mode, params, ctx)
     values ${values.join(',')}`,
  );
}

async function whenApiUp() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(API + '/');
      if (res.ok) return;
    } catch { /* wrangler restarts its local D1 when a second process writes it */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('local API did not come back');
}

async function verify(c, email) {
  const link = await emailLink(email, 'Confirm your FreeCell Worlds email');
  const hop = await c(link.replace(/^https?:\/\/[^/]+/, ''));
  assert.equal(hop.status, 302);
}

async function signedIn(email) {
  const c = client();
  const body = { email, password: PASSWORD, callbackURL: `${ORIGIN}/?account=verified` };
  const inn = await c('/api/auth/sign-in/email', { method: 'POST', captcha: true, body });
  if (inn.status === 403) await verify(c, email);
  else if (inn.status !== 200) {
    const up = await c('/api/auth/sign-up/email', { method: 'POST', captcha: true, body: { ...body, name: email.split('@')[0] } });
    assert.equal(up.status, 200, JSON.stringify(up.json));
    await verify(c, email);
  }
  assert.equal((await c('/v1/me')).status, 200);
  return c;
}

function countOf(list, key, value, field) {
  return list.find((row) => row[key] === value)?.[field] ?? 0;
}

test('signed-out admin routes are 403 and carry no rows', async () => {
  const anon = client();
  const page = await anon('/admin');
  const summary = await anon('/admin/summary?days=7');
  assert.equal(page.status, 403);
  assert.equal(summary.status, 403);
  assert.equal(summary.json.code, 'FORBIDDEN');
  assert.equal(page.json, null);
  assert.doesNotMatch(page.text + JSON.stringify(summary.json), /Players in range|ADMIN_EMAILS|kaena@redblindmedia.com|admin@example.com/);
});

test('a signed-in player who is not on the allowlist gets 403', async () => {
  const player = await signedIn(`player-${mark}@example.com`);
  const page = await player('/admin');
  const summary = await player('/admin/summary?days=7');
  assert.equal(page.status, 403);
  assert.equal(summary.status, 403);
  assert.equal(summary.json.message, 'Not available.');
  assert.doesNotMatch(page.text, /Players in range|ADMIN_EMAILS|admin@example.com/);
  assert.doesNotMatch(page.text, new RegExp(SENTINEL));
});

test('the summary aggregates the event table for the selected range', async () => {
  const admin = await signedIn(ADMIN);
  const before7 = await admin('/admin/summary?days=7');
  const before30 = await admin('/admin/summary?days=30');
  const before90 = await admin('/admin/summary?days=90');
  assert.equal(before7.status, 200);
  assert.equal((await admin('/admin/summary?days=15')).status, 400);

  const week = dateRange(7);
  const month = dateRange(30);
  const today = week.end;
  const tenAgo = month.daysList[month.daysList.length - 11];
  const p1 = crypto.randomUUID();
  const p2 = crypto.randomUUID();
  const p3 = crypto.randomUUID();
  const s1 = crypto.randomUUID();
  const s2 = crypto.randomUUID();
  const s3 = crypto.randomUUID();
  const run1 = crypto.randomUUID();
  const run2 = crypto.randomUUID();
  const id = (suffix) => `admin-dash-${mark}-${suffix}`;

  insertEvents([
    { id: id('a'), day: today, name: 'game_start', player: p1, session: s1, ctx: { theme_id: themeAlpha }, params: { game_id: crypto.randomUUID() } },
    { id: id('b'), day: today, name: 'game_start', player: p2, session: s2, ctx: { theme_id: themeAlpha }, params: { game_id: crypto.randomUUID() } },
    { id: id('c'), day: today, name: 'voyage_board_start', player: p2, session: s2, ctx: { theme_id: themeBeta }, params: { run_id: run1, board_idx: 0 } },
    { id: id('d'), day: today, name: 'voyage_run_start', player: p1, session: s1, ctx: { theme_id: themeAlpha }, params: { run_id: run1 } },
    { id: id('e'), day: today, name: 'voyage_run_end', player: p1, session: s1, ctx: { theme_id: themeAlpha }, params: { run_id: run1, outcome: 'win' } },
    { id: id('f'), day: today, name: 'app_error', player: p1, session: s1, ctx: { theme_id: themeAlpha }, params: { message: 'boom', where: '/js/main.js:1', stack: SENTINEL } },
    { id: id('g'), day: tenAgo, name: 'voyage_run_start', player: p3, session: s3, ctx: { theme_id: themeGamma }, params: { run_id: run2 } },
    { id: id('h'), day: tenAgo, name: 'game_start', player: p3, session: s3, ctx: { theme_id: themeGamma }, params: { game_id: crypto.randomUUID() } },
    { id: id('i'), day: '2020-01-01', name: 'game_start', player: crypto.randomUUID(), session: crypto.randomUUID(), ctx: { theme_id: themeAncient }, params: { game_id: crypto.randomUUID() } },
  ]);
  await whenApiUp();

  const weekAfter = await admin('/admin/summary?days=7');
  const monthAfter = await admin('/admin/summary?days=30');
  const quarterAfter = await admin('/admin/summary?days=90');
  assert.equal(weekAfter.status, 200);
  assert.equal(weekAfter.json.players - before7.json.players, 2);
  assert.equal(weekAfter.json.sessions - before7.json.sessions, 2);
  assert.equal(countOf(weekAfter.json.themes, 'theme', themeAlpha, 'plays') - countOf(before7.json.themes, 'theme', themeAlpha, 'plays'), 2);
  assert.equal(countOf(weekAfter.json.themes, 'theme', themeBeta, 'plays'), 1);
  assert.equal(countOf(weekAfter.json.themes, 'theme', themeGamma, 'plays'), 0);
  assert.equal(countOf(weekAfter.json.themes, 'theme', themeAncient, 'plays'), 0);
  assert.equal(weekAfter.json.voyage.started - before7.json.voyage.started, 1);
  assert.equal(weekAfter.json.voyage.finished - before7.json.voyage.finished, 1);
  assert.equal(countOf(weekAfter.json.events, 'name', 'app_error', 'n') - countOf(before7.json.events, 'name', 'app_error', 'n'), 1);
  assert.equal(weekAfter.json.daily.length, 7);
  assert.ok(weekAfter.json.errors.some((row) => row.stack === SENTINEL && row.message === 'boom' && row.where === '/js/main.js:1'));

  assert.equal(monthAfter.json.players - before30.json.players, 3);
  assert.equal(monthAfter.json.voyage.started - before30.json.voyage.started, 2);
  assert.equal(countOf(monthAfter.json.themes, 'theme', themeGamma, 'plays'), 1);
  assert.equal(countOf(monthAfter.json.themes, 'theme', themeAncient, 'plays'), 0);
  assert.equal(countOf(quarterAfter.json.themes, 'theme', themeAncient, 'plays') - countOf(before90.json.themes, 'theme', themeAncient, 'plays'), 0);
  assert.equal(quarterAfter.json.daily.length, 90);

  const html = await admin('/admin?days=7');
  assert.equal(html.status, 200);
  assert.match(html.headers.get('content-type') || '', /text\/html/);
  assert.match(html.text, /Players in range/);
  assert.doesNotMatch(html.text, /ADMIN_EMAILS|kaena@redblindmedia.com|admin@example.com/);
  assert.doesNotMatch(html.text, new RegExp(SENTINEL));
});
