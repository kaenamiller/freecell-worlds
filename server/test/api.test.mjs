// End-to-end checks against a running local API:
//   cp .dev.vars.example .dev.vars && npm run db:migrate:local
//   npx wrangler dev --port 8787 > /tmp/fcw-api.log 2>&1 &
//   FCW_API_LOG=/tmp/fcw-api.log npm test
// Emails are read from the wrangler log (RESEND_API_KEY is empty in .dev.vars).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { API, CAPTCHA, ORIGIN, PASSWORD, client, emailLink } from './helpers.mjs';

const email = `player-${Date.now()}@example.com`;

const a = client();
const b = client(); // a second device

test('public config reports whether Google sign-in is configured', async () => {
  const r = await client()('/v1/config');
  assert.equal(r.status, 200);
  assert.equal(r.json.google, false);
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
});

test('sign-up needs a captcha', async () => {
  const r = await a('/api/auth/sign-up/email', { method: 'POST', body: { email, password: PASSWORD, name: 'Player' } });
  assert.equal(r.status, 400);
  assert.equal(r.json.code, 'MISSING_RESPONSE');
});

test('breached passwords are refused', async () => {
  const r = await a('/api/auth/sign-up/email', { method: 'POST', captcha: true, body: { email: `pwned-${email}`, password: 'password123', name: 'P' } });
  assert.equal(r.status, 400);
  assert.match(r.json.message, /data breach/);
});

test('sign-up, then sign-in is blocked until the email is verified', async () => {
  const up = await a('/api/auth/sign-up/email', { method: 'POST', captcha: true, body: { email, password: PASSWORD, name: 'Player', callbackURL: `${ORIGIN}/?account=verified` } });
  assert.equal(up.status, 200);
  assert.equal(up.json.token, null);
  assert.match(up.json.user.id, /^[0-9a-f-]{36}$/);
  // Signing in unverified re-sends the link, so it carries the same callback.
  const r = await a('/api/auth/sign-in/email', { method: 'POST', captcha: true, body: { email, password: PASSWORD, callbackURL: `${ORIGIN}/?account=verified` } });
  assert.equal(r.status, 403);
  assert.equal((await a('/v1/me')).status, 401);
});

test('the verification link signs the player in and redirects to the game', async () => {
  const link = await emailLink(email, 'Confirm your FreeCell Worlds email');
  const r = await a(link.replace(/^https?:\/\/[^/]+/, ''));
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), `${ORIGIN}/?account=verified`);
  // Local and staging omit COOKIE_DOMAIN, so the session cookie stays host-only.
  const cookies = r.headers.getSetCookie();
  assert.ok(cookies.some((c) => c.startsWith('better-auth.session_token=')));
  assert.ok(cookies.every((c) => !/;\s*domain=/i.test(c)));
  const me = await a('/v1/me');
  assert.equal(me.status, 200);
  assert.equal(me.json.user.email, email);
  assert.equal(me.json.user.emailVerified, true);
  assert.equal(me.json.tokens, 0);
});

test('saves are versioned and a stale write gets a conflict', async () => {
  const first = await a('/v1/saves/stats', { method: 'PUT', body: { data: { played: 3, won: 2 }, version: 0 } });
  assert.equal(first.status, 200);
  assert.equal(first.json.version, 1);
  // Creating the same slot again from another device that hasn't seen it conflicts.
  await b('/api/auth/sign-in/email', { method: 'POST', captcha: true, body: { email, password: PASSWORD } });
  const dup = await b('/v1/saves/stats', { method: 'PUT', body: { data: { played: 1, won: 0 }, version: 0 } });
  assert.equal(dup.status, 409);
  assert.deepEqual(dup.json.current.data, { played: 3, won: 2 });
  assert.equal(dup.json.current.version, 1);
  const next = await b('/v1/saves/stats', { method: 'PUT', body: { data: { played: 4, won: 2 }, version: 1 } });
  assert.equal(next.json.version, 2);
  const stale = await a('/v1/saves/stats', { method: 'PUT', body: { data: { played: 9 }, version: 1 } });
  assert.equal(stale.status, 409);
  const all = await a('/v1/saves');
  assert.deepEqual(all.json.saves.stats.data, { played: 4, won: 2 });
  assert.equal(all.json.saves.stats.version, 2);
});

test('only known keys and well-formed bodies are accepted', async () => {
  assert.equal((await a('/v1/saves/dev', { method: 'PUT', body: { data: true, version: 0 } })).status, 404);
  assert.equal((await a('/v1/saves/voyage', { method: 'PUT', body: { data: null } })).status, 400);
  const big = 'x'.repeat(300 * 1024);
  assert.equal((await a('/v1/saves/voyage', { method: 'PUT', body: { data: big, version: 0 } })).status, 413);
  assert.equal((await a('/v1/saves/voyage', { method: 'PUT', body: { data: null, version: 0 } })).status, 200);
});

test('export includes profile and saves but no secrets', async () => {
  const r = await a('/v1/account/export');
  assert.equal(r.status, 200);
  assert.equal(r.json.profile.email, email);
  assert.deepEqual(r.json.signInMethods.map((m) => m.providerId), ['credential']);
  assert.ok(r.json.saves.stats);
  assert.doesNotMatch(JSON.stringify(r.json), /password|accessToken|"token"/i);
});

test('password reset emails a link that redirects with a token', async () => {
  const r = await client()('/api/auth/request-password-reset', { method: 'POST', captcha: true, body: { email, redirectTo: `${ORIGIN}/?account=reset` } });
  assert.equal(r.status, 200);
  const link = await emailLink(email, 'Reset your FreeCell Worlds password');
  const hop = await client()(link.replace(/^https?:\/\/[^/]+/, ''));
  assert.equal(hop.status, 302);
  const to = new URL(hop.headers.get('location'));
  assert.equal(to.origin + to.pathname, `${ORIGIN}/`);
  assert.equal(to.searchParams.get('account'), 'reset');
  const token = to.searchParams.get('token');
  assert.ok(token);
  const done = await client()('/api/auth/reset-password', { method: 'POST', body: { token, newPassword: `${PASSWORD} again` } });
  assert.equal(done.status, 200);
  // Resetting revokes every session.
  assert.equal((await a('/v1/me')).status, 401);
});

test('repeated wrong passwords lock the account even across IPs', async () => {
  const statuses = [];
  for (let i = 0; i < 9; i++) {
    const r = await client()('/api/auth/sign-in/email', {
      method: 'POST',
      captcha: true,
      headers: { 'cf-connecting-ip': `203.0.113.${i + 1}` },
      body: { email, password: `wrong ${i}` },
    });
    statuses.push(r.status);
  }
  assert.deepEqual(statuses, [401, 401, 401, 401, 401, 401, 401, 401, 429]);
  const right = await client()('/api/auth/sign-in/email', { method: 'POST', captcha: true, headers: { 'cf-connecting-ip': '203.0.113.99' }, body: { email, password: `${PASSWORD} again` } });
  assert.equal(right.status, 429);
  assert.equal(right.json.code, 'ACCOUNT_LOCKED');
});

test('account deletion is confirmed by email and removes the data', async () => {
  const c = client();
  const other = `delete-${email}`;
  await c('/api/auth/sign-up/email', { method: 'POST', captcha: true, body: { email: other, password: PASSWORD, name: 'D', callbackURL: `${ORIGIN}/` } });
  await c((await emailLink(other, 'Confirm your FreeCell Worlds email')).replace(/^https?:\/\/[^/]+/, ''));
  await c('/v1/saves/settings', { method: 'PUT', body: { data: { theme: 'zen' }, version: 0 } });
  const req = await c('/api/auth/delete-user', { method: 'POST', body: { callbackURL: `${ORIGIN}/?account=deleted` } });
  assert.equal(req.status, 200);
  assert.equal((await c('/v1/me')).status, 200); // nothing happens until the link is opened
  const link = await emailLink(other, 'Confirm deleting your FreeCell Worlds account');
  const r = await c(link.replace(/^https?:\/\/[^/]+/, ''));
  assert.equal(r.status, 302);
  assert.equal((await c('/v1/me')).status, 401);
  const again = await client()('/api/auth/sign-in/email', { method: 'POST', captcha: true, body: { email: other, password: PASSWORD } });
  assert.equal(again.status, 401);
});

test('requests from other origins are refused', async () => {
  const r = await fetch(`${API}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json', 'x-captcha-response': CAPTCHA, 'cf-connecting-ip': '192.0.2.50' },
    body: JSON.stringify({ email: `origin-${email}`, password: PASSWORD }),
  });
  assert.equal(r.status, 403);
  assert.equal(r.headers.get('access-control-allow-origin'), null);
});
