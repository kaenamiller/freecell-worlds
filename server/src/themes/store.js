// D1 + R2 bookkeeping for custom themes: tokens, rolls, variations and their files.
export const MAX_ROLLS = 3;
export const MAX_PROMPT = 500;
export const DAILY_PROMPT_CHECKS = 30;

const now = () => Date.now();
export const r2Prefix = (themeId, variationId) => `themes/${themeId}/${variationId}/`;

// Spend one token and open a theme with its first variation, all or nothing: every insert
// is conditioned on the ledger row, which only lands if the balance covers it.
export async function createTheme(env, userId, prompt) {
  const [themeId, variationId, ledgerId] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  const t = now();
  const [spend] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO token_ledger (id, user_id, delta, reason, theme_id, created_at)
       SELECT ?1, ?2, -1, 'theme', ?3, ?4 WHERE (SELECT COALESCE(SUM(delta), 0) FROM token_ledger WHERE user_id = ?2) >= 1`
    ).bind(ledgerId, userId, themeId, t),
    env.DB.prepare(
      `INSERT INTO custom_theme (id, user_id, status, rolls_used, created_at, updated_at)
       SELECT ?1, ?2, 'generating', 1, ?3, ?3 WHERE EXISTS (SELECT 1 FROM token_ledger WHERE id = ?4)`
    ).bind(themeId, userId, t, ledgerId),
    env.DB.prepare(
      `INSERT INTO theme_variation (id, theme_id, roll, prompt, status, stage, created_at, updated_at)
       SELECT ?1, ?2, 1, ?3, 'generating', 'queued', ?4, ?4 WHERE EXISTS (SELECT 1 FROM token_ledger WHERE id = ?5)`
    ).bind(variationId, themeId, prompt, t, ledgerId),
  ]);
  return spend.meta.changes === 1 ? { themeId, variationId } : null;
}

// Use another roll on a theme that is waiting for the player. Returns the new variation id.
export async function addVariation(env, userId, themeId, prompt) {
  const t = now();
  const row = await env.DB.prepare(
    `UPDATE custom_theme SET rolls_used = rolls_used + 1, status = 'generating', updated_at = ?3
     WHERE id = ?1 AND user_id = ?2 AND status = 'choosing' AND rolls_used < ?4 RETURNING rolls_used`
  ).bind(themeId, userId, t, MAX_ROLLS).first();
  if (!row) return null;
  const variationId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO theme_variation (id, theme_id, roll, prompt, status, stage, created_at, updated_at) VALUES (?, ?, ?, ?, 'generating', 'queued', ?, ?)`
  ).bind(variationId, themeId, row.rolls_used, prompt, t, t).run();
  return variationId;
}

export const setStage = (env, variationId, stage) =>
  env.DB.prepare('UPDATE theme_variation SET stage = ?, updated_at = ? WHERE id = ?').bind(stage, now(), variationId).run();

export const saveSpec = (env, variationId, spec) =>
  env.DB.prepare('UPDATE theme_variation SET spec = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(spec), now(), variationId).run();

export async function putFile(env, themeId, variationId, file, { bytes, contentType }) {
  const key = r2Prefix(themeId, variationId) + file;
  await env.THEME_ASSETS.put(key, bytes, { httpMetadata: { contentType } });
  await env.DB.prepare(
    `INSERT INTO theme_asset (variation_id, file, r2_key, content_type, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (variation_id, file) DO UPDATE SET r2_key = excluded.r2_key, content_type = excluded.content_type, bytes = excluded.bytes`
  ).bind(variationId, file, key, contentType, bytes.byteLength, now()).run();
}

export async function getFile(env, themeId, variationId, file) {
  const obj = await env.THEME_ASSETS.get(r2Prefix(themeId, variationId) + file);
  return obj && { bytes: new Uint8Array(await obj.arrayBuffer()), contentType: obj.httpMetadata?.contentType || 'application/octet-stream' };
}

export async function finishVariation(env, themeId, variationId) {
  const t = now();
  await env.DB.batch([
    env.DB.prepare("UPDATE theme_variation SET status = 'ready', stage = NULL, updated_at = ? WHERE id = ?").bind(t, variationId),
    env.DB.prepare("UPDATE custom_theme SET status = 'choosing', updated_at = ? WHERE id = ? AND status = 'generating'").bind(t, themeId),
  ]);
}

// A failed run doesn't count: its roll goes back to the player and its files are removed.
export async function failVariation(env, themeId, variationId, error) {
  const t = now();
  const [res] = await env.DB.batch([
    env.DB.prepare("UPDATE theme_variation SET status = 'failed', stage = NULL, error = ?, updated_at = ? WHERE id = ? AND status = 'generating'").bind(String(error).slice(0, 500), t, variationId),
    env.DB.prepare(
      `UPDATE custom_theme SET status = 'choosing', rolls_used = MAX(rolls_used - 1, 0), updated_at = ?
       WHERE id = ? AND status = 'generating' AND EXISTS (SELECT 1 FROM theme_variation WHERE id = ? AND status = 'failed' AND updated_at = ?)`
    ).bind(t, themeId, variationId, t),
  ]);
  if (res.meta.changes) await deleteVariationFiles(env, [variationId]);
}

async function deleteVariationFiles(env, variationIds) {
  if (!variationIds.length) return;
  const marks = variationIds.map(() => '?').join(',');
  const { results } = await env.DB.prepare(`SELECT r2_key FROM theme_asset WHERE variation_id IN (${marks})`).bind(...variationIds).all();
  for (let i = 0; i < results.length; i += 1000) await env.THEME_ASSETS.delete(results.slice(i, i + 1000).map((r) => r.r2_key));
  await env.DB.prepare(`DELETE FROM theme_asset WHERE variation_id IN (${marks})`).bind(...variationIds).run();
}

// Lock in one ready variation. The others' files are deleted; their rows stay as history.
export async function chooseVariation(env, userId, themeId, variationId) {
  const res = await env.DB.prepare(
    `UPDATE custom_theme SET status = 'ready', chosen_variation = ?3, updated_at = ?4
     WHERE id = ?1 AND user_id = ?2 AND status = 'choosing'
     AND EXISTS (SELECT 1 FROM theme_variation WHERE id = ?3 AND theme_id = ?1 AND status = 'ready')`
  ).bind(themeId, userId, variationId, now()).run();
  if (res.meta.changes !== 1) return false;
  const { results } = await env.DB.prepare('SELECT id FROM theme_variation WHERE theme_id = ? AND id != ?').bind(themeId, variationId).all();
  await deleteVariationFiles(env, results.map((r) => r.id));
  return true;
}

// Give the token back for a theme that never produced anything to choose from.
export async function cancelTheme(env, userId, themeId) {
  const t = now();
  const [res] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE custom_theme SET status = 'cancelled', updated_at = ?3 WHERE id = ?1 AND user_id = ?2 AND status = 'choosing'
       AND NOT EXISTS (SELECT 1 FROM theme_variation WHERE theme_id = ?1 AND status = 'ready')`
    ).bind(themeId, userId, t),
    env.DB.prepare(
      `INSERT INTO token_ledger (id, user_id, delta, reason, theme_id, created_at)
       SELECT ?1, ?2, 1, 'theme_refund', ?3, ?4 WHERE EXISTS (SELECT 1 FROM custom_theme WHERE id = ?3 AND status = 'cancelled' AND updated_at = ?4)`
    ).bind(crypto.randomUUID(), userId, themeId, t),
  ]);
  return res.meta.changes === 1;
}

const parseSpec = (s) => {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};

export async function listThemes(env, userId, themeId = null) {
  const only = themeId ? ' AND t.id = ?2' : '';
  const binds = themeId ? [userId, themeId] : [userId];
  const [themes, variations, files] = await env.DB.batch([
    env.DB.prepare(`SELECT t.id, t.status, t.rolls_used, t.chosen_variation, t.created_at, t.updated_at FROM custom_theme t WHERE t.user_id = ?1${only} AND t.status != 'cancelled' ORDER BY t.created_at DESC`).bind(...binds),
    env.DB.prepare(
      `SELECT v.id, v.theme_id, v.roll, v.prompt, v.status, v.stage, v.spec, v.error, v.created_at FROM theme_variation v JOIN custom_theme t ON t.id = v.theme_id
       WHERE t.user_id = ?1${only} ORDER BY v.roll, v.created_at`
    ).bind(...binds),
    env.DB.prepare(
      `SELECT a.variation_id, a.file FROM theme_asset a JOIN theme_variation v ON v.id = a.variation_id JOIN custom_theme t ON t.id = v.theme_id
       WHERE t.user_id = ?1${only} AND a.file NOT LIKE 'src/%'`
    ).bind(...binds),
  ]);
  return themes.results.map((t) => ({
    id: t.id,
    status: t.status,
    rollsUsed: t.rolls_used,
    rollsLeft: MAX_ROLLS - t.rolls_used,
    chosenVariation: t.chosen_variation,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    variations: variations.results
      .filter((v) => v.theme_id === t.id && (t.status !== 'ready' || v.id === t.chosen_variation))
      .map((v) => ({
        id: v.id, roll: v.roll, prompt: v.prompt, status: v.status, stage: v.stage, error: v.status === 'failed' ? 'Generation failed. That try didn’t use a roll.' : null,
        spec: parseSpec(v.spec), createdAt: v.created_at,
        files: files.results.filter((f) => f.variation_id === v.id).map((f) => f.file),
      })),
  }));
}

export async function ownedFile(env, userId, themeId, variationId, file) {
  return env.DB.prepare(
    `SELECT a.r2_key, a.content_type FROM theme_asset a JOIN theme_variation v ON v.id = a.variation_id JOIN custom_theme t ON t.id = v.theme_id
     WHERE t.user_id = ? AND t.id = ? AND v.id = ? AND a.file = ?`
  ).bind(userId, themeId, variationId, file).first();
}

// Prompt checks in the last day, for the per-player limit.
export async function recentPromptChecks(env, userId) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM theme_prompt_check WHERE user_id = ? AND created_at > ?').bind(userId, now() - 86400000).first();
  return row.n;
}

export const logPromptCheck = (env, userId, prompt, verdict) =>
  env.DB.prepare('INSERT INTO theme_prompt_check (id, user_id, prompt, allowed, category, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), userId, prompt, verdict.allowed ? 1 : 0, verdict.category, verdict.reason || null, now()).run();

// Runs whose workflow died without reporting back (cron): fail them so the roll returns.
export async function failStuckVariations(env) {
  const { results } = await env.DB.prepare("SELECT id, theme_id FROM theme_variation WHERE status = 'generating' AND updated_at < ?").bind(now() - 2 * 3600000).all();
  for (const v of results) await failVariation(env, v.theme_id, v.id, 'timed out');
}
