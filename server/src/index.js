// FreeCell Worlds API (api.freecellworlds.com): Better Auth under /api/auth/*, player
// data under /v1/*. The game itself stays a static site; see docs/accounts.md.
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createAuth, origins } from './auth.js';
import {
  SAVE_KEYS, MAX_SAVE_BYTES, listSaves, putSave, tokenBalance, listPurchases, exportAccount, signInLockedUntil, recordSignIn, cleanup,
} from './data.js';
import themes from './themes/routes.js';

export { ThemeGeneration } from './themes/workflow.js';

const app = new Hono();

app.use('*', (c, next) =>
  cors({
    origin: origins(c.env),
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'x-captcha-response'],
    maxAge: 600,
  })(c, next)
);

app.use('*', async (c, next) => {
  c.set('auth', createAuth(c.env, c.executionCtx));
  await next();
});

// Email sign-in goes through the per-account throttle before Better Auth sees it.
app.post('/api/auth/sign-in/email', async (c) => {
  const body = await c.req.raw.clone().json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email) {
    const until = await signInLockedUntil(c.env, email);
    if (until) {
      const minutes = Math.ceil((until - Date.now()) / 60000);
      return c.json({ code: 'ACCOUNT_LOCKED', message: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` }, 429);
    }
  }
  const res = await c.get('auth').handler(c.req.raw);
  // 401 is a wrong email or password; anything else (unverified, captcha, rate limit) isn't a guess.
  if (email && (res.status === 200 || res.status === 401)) c.executionCtx.waitUntil(recordSignIn(c.env, email, res.status === 200));
  return res;
});

app.on(['GET', 'POST'], '/api/auth/*', (c) => c.get('auth').handler(c.req.raw));

// No session required. The game hides "Continue with Google" until a client id is set.
app.get('/v1/config', (c) => c.json({ google: Boolean(c.env.GOOGLE_CLIENT_ID) }));

// --- player data ----------------------------------------------------------------------
const v1 = new Hono();

v1.use('*', async (c, next) => {
  const session = await c.get('auth').api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ code: 'UNAUTHORIZED', message: 'Sign in first.' }, 401);
  c.set('user', session.user);
  await next();
});

v1.get('/me', async (c) => {
  const { id, email, name, image, emailVerified, createdAt } = c.get('user');
  return c.json({ user: { id, email, name, image, emailVerified, createdAt }, tokens: await tokenBalance(c.env, id) });
});

v1.get('/saves', async (c) => c.json({ saves: await listSaves(c.env, c.get('user').id) }));

// Body: { data, version } where `version` is the slot version this device last saw (0 if none).
v1.put('/saves/:key', async (c) => {
  const key = c.req.param('key');
  if (!SAVE_KEYS.includes(key)) return c.json({ code: 'UNKNOWN_KEY', message: `Unknown save key: ${key}` }, 404);
  const raw = await c.req.text();
  if (raw.length > MAX_SAVE_BYTES) return c.json({ code: 'TOO_LARGE', message: 'Save is too large.' }, 413);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return c.json({ code: 'BAD_JSON', message: 'Body must be JSON.' }, 400);
  }
  if (!body || !('data' in body) || !Number.isInteger(body.version) || body.version < 0) {
    return c.json({ code: 'BAD_REQUEST', message: 'Expected { data, version }.' }, 400);
  }
  const result = await putSave(c.env, c.get('user').id, key, JSON.stringify(body.data), body.version);
  if (result.ok) return c.json({ version: result.version, updatedAt: result.updatedAt });
  return c.json({ code: 'VERSION_CONFLICT', current: result.current }, 409);
});

v1.get('/purchases', async (c) => c.json({ purchases: await listPurchases(c.env, c.get('user').id) }));

v1.route('/themes', themes);

v1.get('/account/export', async (c) => {
  const data = await exportAccount(c.env, c.get('user'));
  return c.json(data, 200, { 'Content-Disposition': 'attachment; filename="freecell-worlds-account.json"' });
});

app.route('/v1', v1);

app.get('/', (c) => c.json({ ok: true, service: 'freecell-worlds-api' }));

export default {
  fetch: app.fetch,
  scheduled: (_event, env, ctx) => ctx.waitUntil(cleanup(env)),
};
