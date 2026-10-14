// /v1/themes: create a theme with a token, reroll up to three times, pick one, and fetch
// its files. Mounted behind the signed-in check in src/index.js.
import { Hono } from 'hono';
import { moderatePrompt } from './llm.js';
import { tokenBalance } from '../data.js';
import {
  MAX_PROMPT, DAILY_PROMPT_CHECKS, createTheme, addVariation, chooseVariation, cancelTheme, listThemes, ownedFile,
  recentPromptChecks, logPromptCheck, failVariation,
} from './store.js';

const themes = new Hono();
const err = (c, status, code, message, extra = {}) => c.json({ code, message, ...extra }, status);

async function readPrompt(c) {
  const body = await c.req.json().catch(() => ({}));
  const prompt = typeof body.prompt === 'string' ? body.prompt.replace(/\s+/g, ' ').trim() : '';
  if (prompt.length < 3) return { error: err(c, 400, 'PROMPT_TOO_SHORT', 'Describe your theme in a few words.') };
  if (prompt.length > MAX_PROMPT) return { error: err(c, 400, 'PROMPT_TOO_LONG', `Keep it under ${MAX_PROMPT} characters.`) };
  return { prompt };
}

// The terms-of-service check. Returns an error response, or null if the prompt may be used.
async function checkPrompt(c, prompt) {
  const user = c.get('user');
  if ((await recentPromptChecks(c.env, user.id)) >= DAILY_PROMPT_CHECKS) {
    return err(c, 429, 'PROMPT_LIMIT', 'That’s a lot of ideas for one day. Try again tomorrow.');
  }
  const verdict = await moderatePrompt(c.env, prompt);
  c.executionCtx.waitUntil(logPromptCheck(c.env, user.id, prompt, verdict));
  return verdict.allowed ? null : err(c, 422, 'PROMPT_REJECTED', verdict.reason || 'That prompt can’t be used for a theme.', { category: verdict.category });
}

async function start(c, themeId, variationId, prompt) {
  try {
    await c.env.THEME_GEN.create({ id: variationId, params: { themeId, variationId, prompt } });
  } catch (e) {
    console.error(`[themes] could not start ${variationId}: ${e.message}`);
    await failVariation(c.env, themeId, variationId, 'could not start');
  }
}

const one = async (c, themeId) => (await listThemes(c.env, c.get('user').id, themeId))[0] || null;

themes.get('/', async (c) => c.json({ themes: await listThemes(c.env, c.get('user').id), tokens: await tokenBalance(c.env, c.get('user').id) }));

themes.get('/:themeId', async (c) => {
  const theme = await one(c, c.req.param('themeId'));
  return theme ? c.json({ theme }) : err(c, 404, 'NOT_FOUND', 'Theme not found.');
});

// Body: { prompt }. Spends one token; 402 when the player has none.
themes.post('/', async (c) => {
  const user = c.get('user');
  const { prompt, error } = await readPrompt(c);
  if (error) return error;
  if ((await tokenBalance(c.env, user.id)) < 1) return err(c, 402, 'NO_TOKENS', 'You need a Theme Token to create a theme.');
  const rejected = await checkPrompt(c, prompt);
  if (rejected) return rejected;
  const created = await createTheme(c.env, user.id, prompt);
  if (!created) return err(c, 402, 'NO_TOKENS', 'You need a Theme Token to create a theme.');
  await start(c, created.themeId, created.variationId, prompt);
  return c.json({ theme: await one(c, created.themeId), tokens: await tokenBalance(c.env, user.id) }, 202);
});

// Body: { prompt } (the same or an edited prompt). Uses one of the theme's three rolls.
themes.post('/:themeId/variations', async (c) => {
  const themeId = c.req.param('themeId');
  const theme = await one(c, themeId);
  if (!theme) return err(c, 404, 'NOT_FOUND', 'Theme not found.');
  if (theme.status !== 'choosing') return err(c, 409, theme.status === 'generating' ? 'BUSY' : 'LOCKED', theme.status === 'generating' ? 'Wait for the current version to finish.' : 'This theme is already finished.');
  if (theme.rollsLeft < 1) return err(c, 409, 'NO_ROLLS', 'You’ve used all three tries. Pick your favourite.');
  const { prompt, error } = await readPrompt(c);
  if (error) return error;
  // A prompt this theme already used has passed the check.
  if (!theme.variations.some((v) => v.prompt === prompt)) {
    const rejected = await checkPrompt(c, prompt);
    if (rejected) return rejected;
  }
  const variationId = await addVariation(c.env, c.get('user').id, themeId, prompt);
  if (!variationId) return err(c, 409, 'BUSY', 'This theme changed. Refresh and try again.');
  await start(c, themeId, variationId, prompt);
  return c.json({ theme: await one(c, themeId) }, 202);
});

// Body: { variationId }. Final: the other variations are deleted.
themes.post('/:themeId/choose', async (c) => {
  const { variationId } = await c.req.json().catch(() => ({}));
  const ok = typeof variationId === 'string' && (await chooseVariation(c.env, c.get('user').id, c.req.param('themeId'), variationId));
  if (!ok) return err(c, 409, 'CANNOT_CHOOSE', 'That version can’t be picked right now.');
  return c.json({ theme: await one(c, c.req.param('themeId')) });
});

// Refunds the token when nothing has finished yet (every try so far failed).
themes.post('/:themeId/cancel', async (c) => {
  const user = c.get('user');
  if (!(await cancelTheme(c.env, user.id, c.req.param('themeId')))) return err(c, 409, 'CANNOT_CANCEL', 'Only a theme with no finished versions can be cancelled.');
  return c.json({ ok: true, tokens: await tokenBalance(c.env, user.id) });
});

themes.get('/:themeId/files/:variationId/:file', async (c) => {
  const { themeId, variationId, file } = c.req.param();
  const row = await ownedFile(c.env, c.get('user').id, themeId, variationId, file);
  const obj = row && (await c.env.THEME_ASSETS.get(row.r2_key));
  if (!obj) return err(c, 404, 'NOT_FOUND', 'File not found.');
  // Files never change once written, so the browser may keep them.
  return new Response(obj.body, { headers: { 'Content-Type': row.content_type, 'Cache-Control': 'private, max-age=31536000, immutable' } });
});

export default themes;
