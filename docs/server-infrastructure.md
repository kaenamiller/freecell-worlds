# Server infrastructure

The planned production setup for FreeCell Worlds' backend. This page covers the infrastructure. For how sign-in, sync and the data model work, see [accounts.md](accounts.md).

Status (October 16, 2026): the API is on the `player-accounts` branch and tested locally. Production D1 `freecell-worlds` (`8d4f72c3-98ac-4ad1-af49-60b9252b27bb`) and R2 `freecell-worlds-theme-assets` exist; production migrations are not applied yet and no Worker secrets are set. Staging D1 `freecell-worlds-staging` (`c1af33a8-3b29-4146-b396-7ead7aa4b6e9`) already has migrations 0001 and 0002 applied. Staging R2 `freecell-worlds-theme-assets-staging` exists. DNS for the zone is on Cloudflare. The game is grey-clouded to GitHub Pages. `api` and `api-staging` are free for Worker custom domains. Turnstile, Google OAuth and Resend are not finished.

## Overview

```
                        freecellworlds.com (Cloudflare DNS)
                                      │
          ┌───────────────────────────┴───────────────────────────┐
          │                                                       │
  freecellworlds.com                                   api.freecellworlds.com
  Static game (HTML/JS/assets)                         Cloudflare Worker "freecell-worlds-api"
  GitHub Pages today, Cloudflare later                 Hono + Better Auth (server/)
          │                                                       │
          │  fetch(credentials: include)                          ├── D1 "freecell-worlds"  (accounts, saves, purchases)
          └──────────────────────────────────────────────────────▶├── R2 "freecell-worlds-theme-assets"  (custom theme files)
                                                                  ├── Workflow "freecell-worlds-theme-generation"  (custom themes)
                                                                  ├── Images binding  (cuts generated art to game sizes)
                                                                  ├── Cron, hourly at :17  (cleanup)
                                                                  │
                                       outbound ──────────────────┼── Google OAuth  (sign-in)
                                                                  ├── Resend  (account emails, from mail.freecellworlds.com)
                                                                  ├── Cloudflare Turnstile siteverify  (human check)
                                                                  ├── Have I Been Pwned range API  (breached passwords)
                                                                  ├── Anthropic Claude  (theme prompt check + art direction)
                                                                  ├── Google Gemini, Nano Banana 2.1  (theme images)
                                                                  └── ElevenLabs music  (theme music)
```

The game and the API are on subdomains of the same registrable domain. Browsers therefore treat API requests as same-site, and the session cookie (set for `freecellworlds.com`) isn't blocked by Safari or Firefox tracking protection.

## Components

| Component | Service | Name / address | Purpose |
| --- | --- | --- | --- |
| Game | GitHub Pages now (`.github/workflows/deploy-pages.yml`), Cloudflare Pages planned | `freecellworlds.com` | The static PWA. Unchanged by accounts apart from `js/account.js` and `js/sync.js` |
| API | Cloudflare Workers | `freecell-worlds-api` at `api.freecellworlds.com` | Auth (`/api/auth/*`), player data (`/v1/*`) |
| Database | Cloudflare D1 (SQLite) | `freecell-worlds`, binding `DB` | Users, sessions, save slots, rate limits, purchases, token ledger, custom themes |
| File storage | Cloudflare R2 | `freecell-worlds-theme-assets`, binding `THEME_ASSETS` | Custom theme images and music |
| Theme generation | Cloudflare Workflows | `freecell-worlds-theme-generation`, binding `THEME_GEN`, class `ThemeGeneration` | One durable run per theme version; see [custom-themes.md](custom-themes.md) |
| Image resizing | Cloudflare Images binding | binding `IMAGES` | Cuts each generated original into the WebP sizes the game loads |
| Scheduled job | Workers Cron Trigger | `17 * * * *` | Deletes unconfirmed sign-ups older than 24 h, expired sessions and tokens, old rate-limit rows |
| Human check | Cloudflare Turnstile | widget for `freecellworlds.com` | On sign-up, password sign-in, password reset and resending the confirmation email |
| Account email | Resend | sender `accounts@mail.freecellworlds.com` | Confirmation, password reset, account-deletion links |
| Inbound email | Cloudflare Email Routing | `support@`, `gdpr@freecellworlds.com` | Support and privacy requests (both are named in the legal pages) |
| Google sign-in | Google Cloud OAuth client (Web) | redirect `https://api.freecellworlds.com/api/auth/callback/google` | "Continue with Google" |

## Domains and DNS

All records live in the Cloudflare zone for `freecellworlds.com`.

| Host | Points to | Notes |
| --- | --- | --- |
| `freecellworlds.com`, `www` | GitHub Pages now; Cloudflare Pages after the move | The game. Grey-clouded today |
| `staging` | Not attached yet | The game build that should talk to the staging API |
| `api` | Worker custom domain | Created by `wrangler deploy` from the top-level `routes` entry |
| `api-staging` | Worker custom domain | Created by `wrangler deploy --env staging` |
| `mail` | Resend's SPF, DKIM and return-path records | Sending domain kept separate from the root, so root MX can stay with Email Routing |
| root MX | Cloudflare Email Routing | Forwards `support@` and `gdpr@` |

## Configuration

Plain variables are in `server/wrangler.toml`. Secrets are set with `npx wrangler secret put NAME` and never committed. For local development, copy `server/.dev.vars.example` to `server/.dev.vars`.

| Name | Kind | Production | Staging | Local |
| --- | --- | --- | --- | --- |
| `BETTER_AUTH_URL` | var | `https://api.freecellworlds.com` | `https://api-staging.freecellworlds.com` | `http://localhost:8787` |
| `TRUSTED_ORIGINS` | var | `https://freecellworlds.com,https://www.freecellworlds.com` | `https://staging.freecellworlds.com`, localhost:8080 | `http://localhost:8080,...` |
| `COOKIE_DOMAIN` | var | `freecellworlds.com` | empty (host-only) | empty |
| `COOKIE_PREFIX` | var | `fcw` | `fcw-staging` | `better-auth` in `.dev.vars`, so the production name is not inherited |
| `EMAIL_FROM` | var | `FreeCell Worlds <accounts@mail.freecellworlds.com>` | same | `onboarding@resend.dev` |
| `GOOGLE_CLIENT_ID` | var | from Google Cloud | empty until the client id is copied here | empty (Google button hidden) |
| `BETTER_AUTH_SECRET` | secret | `openssl rand -base64 32` | created by the staging workflow if missing | dev placeholder |
| `GOOGLE_CLIENT_SECRET` | secret | from Google Cloud | same secret, set with `--env staging` | empty |
| `RESEND_API_KEY` | secret | from Resend | same, `--env staging` | empty (emails print to the wrangler log) |
| `TURNSTILE_SECRET_KEY` | secret | from the Turnstile widget | same secret, uploaded by the deploy when the GitHub environment secret is set and the worker does not have it yet | Cloudflare's always-pass test secret |
| `GEN_MOCK` | var | `0` | `1` | `1` |
| `ANTHROPIC_API_KEY` | secret | from the Anthropic Console | empty while `GEN_MOCK=1` | empty while `GEN_MOCK=1` |
| `GEMINI_API_KEY` | secret | from Google AI Studio / Cloud | empty while `GEN_MOCK=1` | empty while `GEN_MOCK=1` |
| `ELEVENLABS_API_KEY` | secret | from ElevenLabs | empty while `GEN_MOCK=1` | empty while `GEN_MOCK=1` |
| `LLM_MODEL`, `IMAGE_MODEL` | var (optional) | unset: `claude-opus-5-5` and `gemini-nano-banana-2.1` | unset | unset |

The Turnstile **site key** is public and lives in the client: `CONFIG.turnstileSiteKey` in `js/account.js`. `freecellworlds.com` and `staging.freecellworlds.com` use `0x4AAAAAAFYovaiTyTegTnzy`. Localhost keeps Cloudflare's always-pass test site key. The widget secret is `TURNSTILE_SECRET_KEY` on the worker. It is not a wrangler var: a var would replace the secret on every deploy.

Session cookies are not shared across environments. Production sets `__Secure-fcw.session_token` for `Domain=freecellworlds.com`, which the browser sends to every subdomain, including `api-staging`. Staging sets `__Secure-fcw-staging.session_token` with no `Domain`, so it is host-only on `api-staging.freecellworlds.com` and the worker never reads the production cookie. Local sets the prefix to `better-auth` in `.dev.vars`, so the cookie is `better-auth.session_token` on `localhost` and does not inherit production's `fcw`.

Rotating `BETTER_AUTH_SECRET` signs everyone out and invalidates outstanding email links. Staging and production have separate secrets.

## Environments

| Environment | Game | API | Database |
| --- | --- | --- | --- |
| Local | `npm run serve` (:8080) | `wrangler dev` (:8787) | local D1 under `server/.wrangler/` |
| Staging | `staging.freecellworlds.com` | `api-staging.freecellworlds.com` (`freecell-worlds-api-staging`) | D1 `freecell-worlds-staging` |
| Production | `freecellworlds.com` | `api.freecellworlds.com` | D1 `freecell-worlds` |

`[env.staging]` in `server/wrangler.toml` is the staging worker: its own D1 database, R2 bucket, workflow name `freecell-worlds-theme-generation-staging`, and `GEN_MOCK = "1"`. Bindings are not inherited, so the block repeats them. `TRUSTED_ORIGINS` includes `https://staging.freecellworlds.com` plus localhost ports 8080 so a local page is allowed by CORS. A localhost page is a different site from `api-staging`, and the staging cookie is `SameSite=Lax`, so a signed-in session still has to be used from `staging.freecellworlds.com`.

## Security at the edge

- **CORS:** only the trusted origins get CORS headers, with credentials allowed. Better Auth also rejects state-changing requests from untrusted origins (403).
- **Client IP:** taken from `cf-connecting-ip`, which Cloudflare sets and clients can't spoof in production.
- **Rate limits** (per IP, stored in D1):

  | Path | Limit |
  | --- | --- |
  | `/sign-in/email` | 5 per minute |
  | `/sign-up/email` | 10 per hour |
  | `/request-password-reset`, `/send-verification-email`, `/delete-user` | 3 per 15 min |
  | `/reset-password` | 5 per 15 min |
  | everything else | 100 per minute |

- **Per-account lockout:** 8 failed sign-ins within 15 minutes locks that email for 15 minutes.
- **Optional later:** a Cloudflare WAF rate-limiting rule on `api.freecellworlds.com/api/auth/*` as an outer layer that stops floods before they reach the Worker.

## Plans and cost

- **Workers Paid plan is required.** Password hashing (scrypt) takes more CPU than the free plan's 10 ms per request. The paid plan's base fee also covers generous D1, R2 and request allowances.
- **D1, R2, Turnstile and Email Routing** should stay within included or free usage at launch.
- **Resend:** the free tier covers early sign-up volume. Move to a paid tier if account emails exceed its monthly cap.
- **Google OAuth:** free. Only the basic `email` and `profile` scopes are requested, so Google's sensitive-scope review doesn't apply.
- **Theme generation** is the one cost that scales with sales: each version is two Claude calls, seven 2K images and one 90-second music track, and a token buys up to three versions. Price tokens from measured per-version cost (see [custom-themes.md](custom-themes.md)). Workflows and the Images binding bill per use on top of the Workers plan.

Check current pricing pages before launch; these notes describe the plan tiers, not exact figures.

## Deploying

GitHub Actions (`.github/workflows/deploy-api.yml`) deploys with `cloudflare/wrangler-action`. The `staging` and `production` GitHub environments each need `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

- **Staging** deploys on every push to `main` or `player-accounts` that changes `server/` or the workflow. The job applies staging D1 migrations first (the database already exists, so this does not need the Worker), then deploys. A missing Worker is normal on the first run: `wrangler secret list` fails until the Worker exists, so the job treats that error as an empty secret list and passes missing secrets to `wrangler deploy --secrets-file`. That creates the Worker and the secrets in one request. A `BETTER_AUTH_SECRET` that is already stored is left as it is, and the value is never printed. `TURNSTILE_SECRET_KEY` is uploaded the same way when the GitHub environment secret of that name is set. The job warns and still deploys when it is absent.
- **Production** deploys only from a manual run (`workflow_dispatch`, target `production`). The job uses the GitHub environment `production`. Turn on Required reviewers for that environment (Settings → Environments → production) before the first production deploy. The workflow file cannot set reviewers. It uses the same migrations-then-deploy order as staging, including the first run before the production Worker exists.

From a machine that is already logged in to Cloudflare, the same steps are `npm run db:migrate:staging` and `npm run deploy:staging`, or `npm run db:migrate` and `npm run deploy` for production. `npm run deploy` passes `--env=""` so Wrangler uses the top-level worker and not staging. Staging is only `wrangler deploy --env staging`. On a brand-new Worker, put secrets in the deploy (`wrangler deploy --secrets-file`) rather than `wrangler secret put`, which cannot see a Worker that does not exist yet.

- Always apply migrations before deploying code that needs them.
- Staging migrations 0001 and 0002 are already recorded in `d1_migrations`. Production migrations have not been applied.
- Migrations only add things. Never edit an applied migration; add a new numbered file.
- `migrations/0001_auth.sql` is generated by `npm run gen:schema`. After a `better-auth` upgrade, regenerate it and diff. If anything changed, put the difference in a new migration.
- The game deploys separately, via GitHub Pages on push to `main`. A game release that calls a new API endpoint must ship after the API change.

## Backups and recovery

- D1 Time Travel can restore the database to any minute in the last 30 days: `npx wrangler d1 time-travel restore freecell-worlds --timestamp=2026-10-13T08:00:00Z`.
- For longer retention, add a scheduled `wrangler d1 export freecell-worlds --remote --output=backup.sql` (for example from a weekly GitHub Action) to a private R2 bucket.
- R2 theme files have no automatic backup. They are paid content, so add bucket replication or a periodic copy before launch. The original prompts and art-direction specs are in D1, but regenerating gives different art.
- Players' localStorage is a second copy of their progress; a sync can re-upload it.

## Monitoring

- Workers Observability is on (`[observability] enabled = true`): request logs and errors in the Cloudflare dashboard.
- Watch:
  - the 5xx rate on `/api/auth/*`
  - 429 counts (attack or limits set too tight)
  - Resend delivery failures (logged as `[email] Resend <status>`)
  - whether the cron run succeeds
  - theme versions that fail (`[themes] ... failed` in the logs) and the share of prompts the check refuses (`theme_prompt_check`)
- Sentry is named in the privacy policy as the error reporter but isn't wired up yet. When it is, use the Workers SDK in the API and the browser SDK in the game.

## Planned additions

| Addition | Infrastructure it needs |
| --- | --- |
| Stripe Checkout for Theme Tokens | `POST /v1/stripe/webhook` in the Worker, plus `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` secrets. The webhook writes to `purchase` and `token_ledger` |
| Game hosting on Cloudflare | Cloudflare Pages project for the static site, replacing the GitHub Pages workflow. `tools/prepare-pages.mjs` already builds the `_site/` directory to upload |
| Leaderboards / anti-cheat | A `game_result` table with move lists; the Worker replays classic deals with `js/rules.js` to verify wins |
| Error reporting | Sentry DSN as a var, for the Worker and the game |
| Staging game host | DNS for `staging.freecellworlds.com` pointing at a build of this branch. The Pages workflow only publishes `main` to the production site |

## Open items

- [x] Create production D1 `freecell-worlds` and put its id in `server/wrangler.toml`.
- [x] Create production R2 `freecell-worlds-theme-assets`.
- [x] Create staging D1 `freecell-worlds-staging`, apply migrations 0001 and 0002, and create staging R2 `freecell-worlds-theme-assets-staging`.
- [x] Add GitHub environment secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` on `staging` and `production`. The token has Workers Scripts, D1, R2, Account Settings Read, Workers Routes, DNS, and Zone Read. Creating or updating a Workflow (`PUT /accounts/{account_id}/workflows/{workflow_name}`) accepts **Workers Scripts Write** — the same Workers Scripts permission. The token UI has no separate Workflows permission. Under the new Workers roles, creating a Worker that does not exist yet needs **Workers Admin** at the Workers product scope; **Editor** cannot create one. Legacy Workers Scripts Edit still includes create.
- [ ] On the GitHub environment `production`, turn on Required reviewers. Leave `staging` without reviewers.
- [ ] Upgrade to the Workers Paid plan (scrypt, and the Workflows binding).
- [x] Turn on Cloudflare Images for the account (the `IMAGES` binding). Staging and production both bind it.
- [ ] Apply production migrations (the manual production workflow does this, or `npm run db:migrate`).
- [ ] Set `TURNSTILE_SECRET_KEY` (the widget secret) as a GitHub environment secret on `staging` and `production`, or with `wrangler secret put` after the Worker exists. The deploy stores it when that GitHub secret is present and the Worker does not already have it. The site key `0x4AAAAAAFYovaiTyTegTnzy` is already in `js/account.js` for both public hosts. Localhost still uses the test site key. The first deploy generates `BETTER_AUTH_SECRET` when it is missing and does not print it.
- [ ] Add `GOOGLE_CLIENT_SECRET` and `RESEND_API_KEY` on both workers when those accounts exist.
- [ ] Create the Google OAuth client. Authorized JavaScript origins: `https://freecellworlds.com`, `https://www.freecellworlds.com`, `https://staging.freecellworlds.com`. Redirect URIs: `https://api.freecellworlds.com/api/auth/callback/google` and `https://api-staging.freecellworlds.com/api/auth/callback/google`. Put the client id in both `[vars]` and `[env.staging.vars]`.
- [ ] Verify `mail.freecellworlds.com` in Resend. Until `RESEND_API_KEY` is set, verification links are only in the Worker logs (`npx wrangler tail --env staging`).
- [ ] Set up `gdpr@` and `support@` in Email Routing.
- [ ] Host the game at `staging.freecellworlds.com` from this branch. `js/account.js` calls `https://api-staging.freecellworlds.com` only on that hostname.
- [ ] Set `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` and `ELEVENLABS_API_KEY` when theme generation leaves `GEN_MOCK`.
- [ ] Confirm with counsel whether an EU representative (GDPR Art. 27) is needed.
