# Custom themes

Players spend a Theme Token to have a table theme generated from their own description. This is the paid product that accounts exist for. This page covers how the pipeline works, the rules it enforces, how to run it locally, and what's left before launch.

## The player's side

1. Sign in, then open **Create a theme** from the account screen or the table picker.
2. Describe the theme. One token is spent when the prompt passes the content check.
3. Wait a few minutes while the first version generates. The player can close the screen and keep playing.
4. Compare versions. Each token allows **three** versions in total. The player can reuse the prompt or reword it for each new version.
5. Pick one with **Use this one**. Picking is final: the other versions are deleted. After the third version, picking is the only option left.
6. The theme appears under **Your themes** in the table picker on every device where the player is signed in, and plays like any built-in table in Classic mode.

## Pipeline

```
POST /v1/themes {prompt}
  │  balance ≥ 1?                        402 NO_TOKENS
  │  30 prompt checks/day?               429 PROMPT_LIMIT
  │  Claude: terms-of-service check      422 PROMPT_REJECTED (no token spent; logged)
  │  D1 batch: −1 token, theme, version 1 (all or nothing)
  ▼
Workflow "ThemeGeneration" (one run per version; every step retried on its own)
  1. art direction   Claude writes the spec: name, tagline, palette, font, surface,
                     particles, which built-in table's sounds to borrow, 7 image prompts,
                     a music prompt. sanitizeSpec() enforces card readability.
  2. image hero      Nano Banana 2.1, 2K, 16:9
  3. images ×6       board, backdrop, card back, Jack, Queen, King, each with the hero
                     passed as the style reference so the set matches
     music           ElevenLabs music_v1, 90 s instrumental (runs alongside; optional)
  4. cut files       Images binding: the 9 WebPs the game loads, sized like
                     tools/optimize-assets.sh does for built-in themes
  5. finish          version 'ready', theme 'choosing'
  on failure         version 'failed', its roll is given back, its files deleted
```

| Code | Role |
| --- | --- |
| `server/src/themes/routes.js` | `/v1/themes` endpoints |
| `server/src/themes/llm.js` | Content check and art direction (Claude via the Anthropic SDK, with server-side fallback on safety declines) |
| `server/src/themes/spec.js` | The spec schema the LLM must fill, and `sanitizeSpec()` |
| `server/src/themes/media.js` | Image and music calls, file cutting, the mock generators |
| `server/src/themes/workflow.js` | The durable generation run |
| `server/src/themes/store.js` | D1/R2 bookkeeping: tokens, rolls, versions, files |
| `js/custom-themes.js` | The creator screen, "Your themes" in the picker, registering kept themes |

### API

All routes need a signed-in session.

| Route | Does |
| --- | --- |
| `GET /v1/themes` | The player's themes (not cancelled) with their versions, and the token balance |
| `GET /v1/themes/:id` | One theme; poll this while a version generates (`stage` shows progress) |
| `POST /v1/themes` `{prompt}` | Spend a token and start version 1 |
| `POST /v1/themes/:id/variations` `{prompt}` | Start the next version (409 `BUSY`, `NO_ROLLS` or `LOCKED`) |
| `POST /v1/themes/:id/choose` `{variationId}` | Keep that version; deletes the others |
| `POST /v1/themes/:id/cancel` | Refund the token. Only allowed when no version has finished, so a run of failures never costs the player |
| `GET /v1/themes/:id/files/:variationId/:file` | `board.webp`, `backdrop.webp`, `env.webp`, `hero.webp`, `thumb.webp`, `back.webp`, `court_j/q/k.webp`, `music.mp3`. Owner only |

### Data

`custom_theme` (status, rolls used, chosen version) → `theme_variation` (prompt, status, stage, spec JSON) → `theme_asset` (one row per R2 object). Tokens are the sum of `token_ledger`: `-1 theme` when a theme starts, `+1 theme_refund` on cancel. `theme_prompt_check` records every prompt the check saw, allowed or not, for abuse review and the daily limit; the hourly cron deletes rows older than 90 days. All of it is in the player's data export and is deleted with the account.

R2 keys are `themes/<themeId>/<variationId>/<file>`, with the full-size originals under `src/`.

### Rules worth knowing

- **A refused prompt costs nothing.** The check runs before the token is spent and before a roll is used. A prompt the theme has already used isn't checked again.
- **A failed version doesn't count.** Its roll is returned. Gemini's safety block or ElevenLabs refusing a prompt fail fast instead of retrying.
- **Music is optional.** If the track fails, the theme plays the music of the built-in table its spec borrows sounds from.
- **Stuck runs.** The cron fails any version still generating after 2 hours, which returns the roll.
- **Readability is enforced, not trusted.** `sanitizeSpec()` swaps in safe values if the card paper is too dark, the ink contrast is too low, or the background too bright.
- **Output safety** relies on the image and music providers' own filters plus the prompt check. No one reviews generated images after the fact yet (see next steps).

## In the game

A kept theme becomes table `custom-<themeId>`, built with the same `worldTheme()` function as the expansion tables, with art URLs pointing at the API. Images are loaded with `crossOrigin = 'use-credentials'` so the session cookie goes along and WebGL can use them. UI sounds and ambience come from the built-in table named in the spec's `soundsLike`.

Custom themes are kept out of `THEME_ORDER`, so random tables, the daily challenge and Voyage don't use them yet. If the saved table is a custom one, the game starts on a built-in table and switches once the account has loaded. Signing out switches back to a built-in table but keeps the saved choice for next time.

## Running it locally

`server/.dev.vars` has `GEN_MOCK=1`, which replaces every model call with stand-ins: the prompt check refuses any prompt containing "forbidden", the spec is derived from the prompt, the images are palette gradients, and there's no music. A prompt containing "mockfail" makes the images fail, for testing refunds.

```sh
cd server
npm run db:migrate:local
npx wrangler dev --port 8787 > /tmp/fcw-api.log 2>&1 &
npm run grant -- you@example.com 3            # Theme Tokens for a local account
FCW_API_LOG=/tmp/fcw-api.log npm test         # 17 tests: accounts and themes
```

To generate for real locally, set `GEN_MOCK=0` and fill in `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` and `ELEVENLABS_API_KEY` in `server/.dev.vars`. Each version then costs real money.

Local wrangler prints "Worker's code had hung" once per generation run. It's a quirk of the local Workflows emulator when a step returns an object; the runs finish normally.

## Next steps

### What you need to provide

1. **API keys**, set as Worker secrets: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`. The Gemini and ElevenLabs keys used by the asset scripts would work, but separate production keys let you track and cap this spend on its own.
2. **Cloudflare:** turn on Images for the account. Workflows are included in the Workers Paid plan already required for accounts.
3. **Token pricing.** Decide what a token costs. Run a few real generations first and measure the cost of one version.
4. **The other account setup** in [server-infrastructure.md](server-infrastructure.md#open-items) (D1, R2, Turnstile, Google, Resend).

### What I'd build next, in order

1. **A first real generation.** Run one theme end to end against the real APIs. Tune the art-direction prompt against the results, and record the per-version cost to set token pricing.
2. **Stripe Checkout for tokens.** The `purchase` and `token_ledger` tables are ready. It needs a checkout endpoint, `POST /v1/stripe/webhook` and a buy button in the creator (it currently says purchases are coming soon). Refunds should only return unspent tokens.
3. **Custom themes in Voyage.** Add the player's kept themes to the Voyage map pool for regular runs, but not the Daily Voyage, which must be the same for everyone. Each Voyage run also gives every custom theme 3 charms and 1 challenge, drawn from the built-in themes' charm bank with the run's seed so a resumed run gets the same ones. This touches `js/voyage/map.js` (pool), `js/voyage/charms.js` (`boonsForTheme` / `challengeForTheme`) and `js/voyage/run.js`. The chart also needs an island image; the creator could generate one as an eighth image, or use the theme's thumbnail.
4. **Checking the generated images.** A cheap vision pass on the hero and portraits (Claude can do it) before a version is shown, to catch text artifacts and anything the image model's filter missed. Plus a way for players to report a theme.
5. **Legal pages.** The privacy policy needs to name Anthropic, Google (Gemini) and ElevenLabs as processors of theme prompts. The terms need rules for prompts, who owns generated themes, and what happens to a theme when an account is deleted. Ask your lawyer about both.
6. **Smaller items:**
   - Let players rename a kept theme.
   - Back up the R2 bucket, since themes are paid content.
   - Decide what happens to a theme the player never finishes picking. Today it waits forever; auto-picking the latest version after 30 days would be one option.
   - Generate the theme's UI sounds instead of borrowing a built-in table's.
