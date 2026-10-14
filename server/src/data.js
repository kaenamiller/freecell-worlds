// Player data in D1: versioned save slots, purchases, theme tokens and custom themes.

// The client's localStorage keys (js/store.js) that sync to an account.
export const SAVE_KEYS = ['settings', 'stats', 'game', 'voyage', 'voyageStats', 'voyageTutorial'];
export const MAX_SAVE_BYTES = 256 * 1024;

const slot = (row) => ({ data: JSON.parse(row.data), version: row.version, updatedAt: row.updated_at });

export async function listSaves(env, userId) {
  const { results } = await env.DB.prepare('SELECT key, data, version, updated_at FROM save_slot WHERE user_id = ?').bind(userId).all();
  return Object.fromEntries(results.map((r) => [r.key, slot(r)]));
}

async function getSave(env, userId, key) {
  const row = await env.DB.prepare('SELECT data, version, updated_at FROM save_slot WHERE user_id = ? AND key = ?').bind(userId, key).first();
  return row ? slot(row) : null;
}

// Optimistic concurrency: the write lands only if `baseVersion` matches what is stored
// (0 = the slot doesn't exist yet). Otherwise the caller gets the current slot back.
export async function putSave(env, userId, key, json, baseVersion) {
  const now = Date.now();
  const stmt =
    baseVersion === 0
      ? env.DB.prepare('INSERT INTO save_slot (user_id, key, data, version, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT DO NOTHING').bind(userId, key, json, now)
      : env.DB.prepare('UPDATE save_slot SET data = ?, version = version + 1, updated_at = ? WHERE user_id = ? AND key = ? AND version = ?').bind(json, now, userId, key, baseVersion);
  const { meta } = await stmt.run();
  if (meta.changes === 1) return { ok: true, version: baseVersion + 1, updatedAt: now };
  return { ok: false, current: await getSave(env, userId, key) };
}

export async function tokenBalance(env, userId) {
  const row = await env.DB.prepare('SELECT COALESCE(SUM(delta), 0) AS balance FROM token_ledger WHERE user_id = ?').bind(userId).first();
  return row.balance;
}

export async function listPurchases(env, userId) {
  const { results } = await env.DB.prepare(
    'SELECT id, product, tokens, amount_cents, currency, status, created_at FROM purchase WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all();
  return results;
}

export async function listThemes(env, userId) {
  const [themes, assets] = await env.DB.batch([
    env.DB.prepare('SELECT id, name, prompt, status, chosen_option, created_at, updated_at FROM custom_theme WHERE user_id = ? ORDER BY created_at DESC').bind(userId),
    env.DB.prepare(
      'SELECT a.id, a.theme_id, a.option, a.kind, a.content_type, a.bytes FROM theme_asset a JOIN custom_theme t ON t.id = a.theme_id WHERE t.user_id = ?'
    ).bind(userId),
  ]);
  return themes.results.map((t) => ({ ...t, assets: assets.results.filter((a) => a.theme_id === t.id) }));
}

// The asset row, only if it belongs to one of this user's themes.
export async function ownedAsset(env, userId, themeId, assetId) {
  return env.DB.prepare(
    'SELECT a.r2_key, a.content_type FROM theme_asset a JOIN custom_theme t ON t.id = a.theme_id WHERE t.user_id = ? AND t.id = ? AND a.id = ?'
  ).bind(userId, themeId, assetId).first();
}

// R2 objects aren't covered by the database cascade, so remove them before the user row goes.
export async function deleteThemeAssets(env, userId) {
  if (!env.THEME_ASSETS) return;
  const { results } = await env.DB.prepare(
    'SELECT a.r2_key FROM theme_asset a JOIN custom_theme t ON t.id = a.theme_id WHERE t.user_id = ?'
  ).bind(userId).all();
  for (let i = 0; i < results.length; i += 1000) await env.THEME_ASSETS.delete(results.slice(i, i + 1000).map((r) => r.r2_key));
}

// Everything we hold about a player, for the privacy-policy data export.
export async function exportAccount(env, user) {
  const [accounts, sessions, ledger] = await env.DB.batch([
    env.DB.prepare('SELECT providerId, createdAt FROM account WHERE userId = ?').bind(user.id),
    env.DB.prepare('SELECT createdAt, expiresAt, ipAddress, userAgent FROM session WHERE userId = ?').bind(user.id),
    env.DB.prepare('SELECT delta, reason, purchase_id, theme_id, created_at FROM token_ledger WHERE user_id = ? ORDER BY created_at').bind(user.id),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    profile: { id: user.id, email: user.email, emailVerified: user.emailVerified, name: user.name, image: user.image, createdAt: user.createdAt },
    signInMethods: accounts.results,
    sessions: sessions.results,
    saves: await listSaves(env, user.id),
    purchases: await listPurchases(env, user.id),
    tokenLedger: ledger.results,
    themes: await listThemes(env, user.id),
  };
}

// --- per-email sign-in throttle ------------------------------------------------------
// Better Auth limits each IP; this also limits each account, so guesses spread across
// many IPs still lock out after FAIL_LIMIT failures in FAIL_WINDOW.
const FAIL_LIMIT = 8;
const FAIL_WINDOW = 15 * 60 * 1000;
const LOCK_FOR = 15 * 60 * 1000;

export async function signInLockedUntil(env, email) {
  const row = await env.DB.prepare('SELECT locked_until FROM login_throttle WHERE email = ?').bind(email).first();
  return row && row.locked_until > Date.now() ? row.locked_until : 0;
}

export async function recordSignIn(env, email, ok) {
  if (ok) return env.DB.prepare('DELETE FROM login_throttle WHERE email = ?').bind(email).run();
  const now = Date.now();
  // Start a new window when the old one has lapsed; lock once the count reaches the limit.
  await env.DB.prepare(
    `INSERT INTO login_throttle (email, failures, window_start, locked_until) VALUES (?1, 1, ?2, 0)
     ON CONFLICT (email) DO UPDATE SET
       failures = CASE WHEN window_start < ?2 - ?3 THEN 1 ELSE failures + 1 END,
       window_start = CASE WHEN window_start < ?2 - ?3 THEN ?2 ELSE window_start END,
       locked_until = CASE WHEN window_start >= ?2 - ?3 AND failures + 1 >= ?4 THEN ?2 + ?5 ELSE locked_until END`
  ).bind(email, now, FAIL_WINDOW, FAIL_LIMIT, LOCK_FOR).run();
}

// --- hourly cleanup ---------------------------------------------------------------------
export async function cleanup(env) {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  // Better Auth stores dates as ISO text; our own tables and rateLimit use epoch ms.
  const iso = (ms) => new Date(ms).toISOString();
  await env.DB.batch([
    // Password sign-ups never verified within a day (the link has expired). Removing them
    // frees the address, so nobody can squat an email and block its owner's Google sign-in.
    env.DB.prepare(
      `DELETE FROM user WHERE emailVerified = 0 AND createdAt < ?
       AND NOT EXISTS (SELECT 1 FROM account a WHERE a.userId = user.id AND a.providerId != 'credential')`
    ).bind(iso(dayAgo)),
    env.DB.prepare('DELETE FROM session WHERE expiresAt < ?').bind(iso(now)),
    env.DB.prepare('DELETE FROM verification WHERE expiresAt < ?').bind(iso(now)),
    env.DB.prepare('DELETE FROM rateLimit WHERE lastRequest < ?').bind(dayAgo),
    env.DB.prepare('DELETE FROM login_throttle WHERE window_start < ? AND locked_until < ?').bind(dayAgo, now),
  ]);
}
