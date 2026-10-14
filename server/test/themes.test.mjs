// Custom theme pipeline against a local API running with GEN_MOCK=1 (see api.test.mjs for
// how to start it). Tokens are granted with scripts/grant-tokens.mjs on the local database.
// Local wrangler logs "Worker's code had hung" once per run when a workflow step returns an
// object; the runs still complete (see /cdn-cgi/local/explorer/api/workflows/.../instances).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { ORIGIN, PASSWORD, client, emailLink } from './helpers.mjs';

const grant = (email, n) => execFileSync('node', ['scripts/grant-tokens.mjs', email, String(n)], { encoding: 'utf8' });

async function player(tag) {
  const call = client();
  const email = `${tag}-${Date.now()}@example.com`;
  await call('/api/auth/sign-up/email', { method: 'POST', captcha: true, body: { email, password: PASSWORD, name: tag, callbackURL: `${ORIGIN}/` } });
  await call((await emailLink(email, 'Confirm your FreeCell Worlds email')).replace(/^https?:\/\/[^/]+/, ''));
  assert.equal((await call('/v1/me')).status, 200);
  return { call, email };
}

async function settle(call, themeId) {
  for (let i = 0; i < 120; i++) {
    const r = await call(`/v1/themes/${themeId}`);
    if (r.json.theme.status !== 'generating') return r.json.theme;
    await sleep(250);
  }
  throw new Error('generation did not finish');
}

const p = await player('artist');
const other = await player('other');
let themeId;

test('creating a theme needs a token', async () => {
  const r = await p.call('/v1/themes', { method: 'POST', body: { prompt: 'a haunted lighthouse at dusk' } });
  assert.equal(r.status, 402);
  assert.equal(r.json.code, 'NO_TOKENS');
});

test('a prompt that fails the terms check is refused and costs nothing', async () => {
  grant(p.email, 2);
  const r = await p.call('/v1/themes', { method: 'POST', body: { prompt: 'something forbidden' } });
  assert.equal(r.status, 422);
  assert.equal(r.json.code, 'PROMPT_REJECTED');
  assert.equal((await p.call('/v1/me')).json.tokens, 2);
});

test('a token buys a theme; the first variation generates every game file', async () => {
  const r = await p.call('/v1/themes', { method: 'POST', body: { prompt: 'a haunted lighthouse at dusk' } });
  assert.equal(r.status, 202);
  assert.equal(r.json.tokens, 1);
  themeId = r.json.theme.id;
  assert.equal(r.json.theme.status, 'generating');
  const theme = await settle(p.call, themeId);
  assert.equal(theme.status, 'choosing');
  assert.equal(theme.rollsLeft, 2);
  const [v] = theme.variations;
  assert.equal(v.status, 'ready');
  assert.equal(v.spec.name, 'A Haunted Lighthouse');
  assert.match(v.spec.palette.bg, /^#[0-9a-f]{6}$/);
  for (const f of ['board', 'backdrop', 'env', 'hero', 'thumb', 'back', 'court_j', 'court_q', 'court_k']) assert.ok(v.files.includes(`${f}.webp`), f);
  const file = await p.call(`/v1/themes/${themeId}/files/${v.id}/hero.webp`);
  assert.equal(file.status, 200);
  assert.match(file.headers.get('content-type'), /^image\//);
  assert.equal((await other.call(`/v1/themes/${themeId}/files/${v.id}/hero.webp`)).status, 404);
  assert.equal((await other.call(`/v1/themes/${themeId}`)).status, 404);
});

test('two more rolls, then no more', async () => {
  const second = await p.call(`/v1/themes/${themeId}/variations`, { method: 'POST', body: { prompt: 'a haunted lighthouse in a storm' } });
  assert.equal(second.status, 202);
  const busy = await p.call(`/v1/themes/${themeId}/variations`, { method: 'POST', body: { prompt: 'a haunted lighthouse in a storm' } });
  assert.equal(busy.status, 409);
  assert.equal(busy.json.code, 'BUSY');
  await settle(p.call, themeId);
  assert.equal((await p.call(`/v1/themes/${themeId}/variations`, { method: 'POST', body: { prompt: 'forbidden lighthouse' } })).json.code, 'PROMPT_REJECTED');
  assert.equal((await p.call(`/v1/themes/${themeId}/variations`, { method: 'POST', body: { prompt: 'a haunted lighthouse at dusk' } })).status, 202);
  const theme = await settle(p.call, themeId);
  assert.equal(theme.rollsLeft, 0);
  assert.deepEqual(theme.variations.map((v) => [v.roll, v.status]), [[1, 'ready'], [2, 'ready'], [3, 'ready']]);
  const more = await p.call(`/v1/themes/${themeId}/variations`, { method: 'POST', body: { prompt: 'a haunted lighthouse at dusk' } });
  assert.equal(more.json.code, 'NO_ROLLS');
  assert.equal((await p.call(`/v1/themes/${themeId}/cancel`, { method: 'POST', body: {} })).status, 409);
});

test('picking one keeps it and deletes the others', async () => {
  const before = (await p.call(`/v1/themes/${themeId}`)).json.theme;
  const [first, second] = before.variations;
  assert.equal((await other.call(`/v1/themes/${themeId}/choose`, { method: 'POST', body: { variationId: second.id } })).status, 409);
  const r = await p.call(`/v1/themes/${themeId}/choose`, { method: 'POST', body: { variationId: second.id } });
  assert.equal(r.status, 200);
  assert.equal(r.json.theme.status, 'ready');
  assert.deepEqual(r.json.theme.variations.map((v) => v.id), [second.id]);
  assert.equal((await p.call(`/v1/themes/${themeId}/files/${first.id}/hero.webp`)).status, 404);
  assert.equal((await p.call(`/v1/themes/${themeId}/files/${second.id}/hero.webp`)).status, 200);
  assert.equal((await p.call(`/v1/themes/${themeId}/variations`, { method: 'POST', body: { prompt: 'again' } })).json.code, 'LOCKED');
});

test('a failed run gives its roll back, and a theme with nothing finished can be refunded', async () => {
  const r = await p.call('/v1/themes', { method: 'POST', body: { prompt: 'mockfail harbour' } });
  assert.equal(r.status, 202);
  assert.equal(r.json.tokens, 0);
  const theme = await settle(p.call, r.json.theme.id);
  assert.equal(theme.status, 'choosing');
  assert.equal(theme.rollsLeft, 3);
  assert.equal(theme.variations[0].status, 'failed');
  const c = await p.call(`/v1/themes/${theme.id}/cancel`, { method: 'POST', body: {} });
  assert.equal(c.status, 200);
  assert.equal(c.json.tokens, 1);
  assert.equal((await p.call('/v1/themes')).json.themes.length, 1);
});
