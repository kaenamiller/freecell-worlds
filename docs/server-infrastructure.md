# Server infrastructure

The planned production setup for FreeCell Worlds' backend. This page covers the infrastructure. For how sign-in, sync and the data model work, see [accounts.md](accounts.md).

Status (October 13, 2026): the API is built and tested locally on the `player-accounts` branch. Nothing below is provisioned yet.

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
                                                                  ├── Cron, hourly at :17  (cleanup)
                                                                  │
                                       outbound ──────────────────┼── Google OAuth  (sign-in)
                                                                  ├── Resend  (account emails, from mail.freecellworlds.com)
                                                                  ├── Cloudflare Turnstile siteverify  (human check)
                                                                  └── Have I Been Pwned range API  (breached passwords)
```

The game and the API are on subdomains of the same registrable domain. Browsers therefore treat API requests as same-site, and the session cookie (set for `freecellworlds.com`) isn't blocked by Safari or Firefox tracking protection.

## Components

| Component | Service | Name / address | Purpose |
| --- | --- | --- | --- |
| Game | GitHub Pages now (`.github/workflows/deploy-pages.yml`), Cloudflare Pages planned | `freecellworlds.com` | The static PWA. Unchanged by accounts apart from `js/account.js` and `js/sync.js` |
| API | Cloudflare Workers | `freecell-worlds-api` at `api.freecellworlds.com` | Auth (`/api/auth/*`), player data (`/v1/*`) |
| Database | Cloudflare D1 (SQLite) | `freecell-worlds`, binding `DB` | Users, sessions, save slots, rate limits, purchases, token ledger, custom themes |
| File storage | Cloudflare R2 | `freecell-worlds-theme-assets`, binding `THEME_ASSETS` | Custom theme images and music. Reserved; nothing writes here yet |
| Scheduled job | Workers Cron Trigger | `17 * * * *` | Deletes unconfirmed sign-ups older than 24 h, expired sessions and tokens, old rate-limit rows |
| Human check | Cloudflare Turnstile | widget for `freecellworlds.com` | On sign-up, password sign-in, password reset and resending the confirmation email |
| Account email | Resend | sender `accounts@mail.freecellworlds.com` | Confirmation, password reset, account-deletion links |
| Inbound email | Cloudflare Email Routing | `support@`, `gdpr@freecellworlds.com` | Support and privacy requests (both are named in the legal pages) |
| Google sign-in | Google Cloud OAuth client (Web) | redirect `https://api.freecellworlds.com/api/auth/callback/google` | "Continue with Google" |

## Domains and DNS

All records live in the Cloudflare zone for `freecellworlds.com`.

| Host | Points to | Notes |
| --- | --- | --- |
| `freecellworlds.com`, `www` | GitHub Pages now; Cloudflare Pages after the move | The game |
| `api` | Worker custom domain | Created automatically by `wrangler deploy` from the `routes` entry in `server/wrangler.toml` |
| `mail` | Resend's SPF, DKIM and return-path records | Sending domain kept separate from the root, so root MX can stay with Email Routing |
| root MX | Cloudflare Email Routing | Forwards `support@` and `gdpr@` |

## Configuration

Plain variables are in `server/wrangler.toml`. Secrets are set with `npx wrangler secret put NAME` and never committed. For local development, copy `server/.dev.vars.example` to `server/.dev.vars`.

| Name | Kind | Production value | Local value |
| --- | --- | --- | --- |
| `BETTER_AUTH_URL` | var | `https://api.freecellworlds.com` | `http://localhost:8787` |
| `TRUSTED_ORIGINS` | var | `https://freecellworlds.com,https://www.freecellworlds.com` | `http://localhost:8080,...` |
| `COOKIE_DOMAIN` | var | `freecellworlds.com` | empty |
| `EMAIL_FROM` | var | `FreeCell Worlds <accounts@mail.freecellworlds.com>` | `onboarding@resend.dev` |
| `GOOGLE_CLIENT_ID` | var | from Google Cloud | empty (Google button disabled) |
| `BETTER_AUTH_SECRET` | secret | `openssl rand -base64 32` | dev placeholder |
| `GOOGLE_CLIENT_SECRET` | secret | from Google Cloud | empty |
| `RESEND_API_KEY` | secret | from Resend | empty (emails print to the wrangler log) |
| `TURNSTILE_SECRET_KEY` | secret | from the Turnstile widget | Cloudflare's always-pass test secret |

The Turnstile **site key** is public and lives in the client: `CONFIG.turnstileSiteKey` in `js/account.js`. It's still a placeholder (`0x4AAAAAAA_REPLACE_ME`).

Rotating `BETTER_AUTH_SECRET` signs everyone out and invalidates outstanding email links.

## Environments

| Environment | Game | API | Database |
| --- | --- | --- | --- |
| Local | `npm run serve` (:8080) | `wrangler dev` (:8787) | local D1 under `server/.wrangler/` |
| Production | `freecellworlds.com` | `api.freecellworlds.com` | D1 `freecell-worlds` |

A staging environment isn't planned yet. When one is needed, add an `[env.staging]` block to `wrangler.toml` with its own D1 database, R2 bucket and `api-staging` subdomain.

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

Check current pricing pages before launch; these notes describe the plan tiers, not exact figures.

## Deploying

First-time setup is the checklist in [accounts.md](accounts.md#production-setup-checklist). After that, a release is:

```sh
cd server
npm ci
npm run db:migrate   # applies any new files in migrations/ to the remote D1
npm run deploy       # wrangler deploy
```

- Always apply migrations before deploying code that needs them.
- Migrations only add things. Never edit an applied migration; add a new numbered file.
- `migrations/0001_auth.sql` is generated by `npm run gen:schema`. After a `better-auth` upgrade, regenerate it and diff. If anything changed, put the difference in a new migration.
- The game deploys separately, via GitHub Pages on push to `main`. A game release that calls a new API endpoint must ship after the API change.

## Backups and recovery

- D1 Time Travel can restore the database to any minute in the last 30 days: `npx wrangler d1 time-travel restore freecell-worlds --timestamp=2026-10-13T08:00:00Z`.
- For longer retention, add a scheduled `wrangler d1 export freecell-worlds --remote --output=backup.sql` (for example from a weekly GitHub Action) to a private R2 bucket.
- R2 theme files have no automatic backup. Generated themes can be regenerated from their stored prompts if needed.
- Players' localStorage is a second copy of their progress; a sync can re-upload it.

## Monitoring

- Workers Observability is on (`[observability] enabled = true`): request logs and errors in the Cloudflare dashboard.
- Watch:
  - the 5xx rate on `/api/auth/*`
  - 429 counts (attack or limits set too tight)
  - Resend delivery failures (logged as `[email] Resend <status>`)
  - whether the cron run succeeds
- Sentry is named in the privacy policy as the error reporter but isn't wired up yet. When it is, use the Workers SDK in the API and the browser SDK in the game.

## Planned additions

| Addition | Infrastructure it needs |
| --- | --- |
| Stripe Checkout for Theme Tokens | `POST /v1/stripe/webhook` in the Worker, plus `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` secrets. The webhook writes to `purchase` and `token_ledger` |
| Custom theme generation | Cloudflare Queues (or Workflows) for the multi-minute generation jobs, Gemini image and ElevenLabs audio API keys as secrets, output written to R2 and `theme_asset` |
| Game hosting on Cloudflare | Cloudflare Pages project for the static site, replacing the GitHub Pages workflow. `tools/prepare-pages.mjs` already builds the `_site/` directory to upload |
| Leaderboards / anti-cheat | A `game_result` table with move lists; the Worker replays classic deals with `js/rules.js` to verify wins |
| Error reporting | Sentry DSN as a var, for the Worker and the game |
| Staging | `[env.staging]` in `wrangler.toml` with its own D1, R2 and subdomain |

## Open items

- [ ] Create the D1 database and put its id in `server/wrangler.toml`.
- [ ] Create the R2 bucket.
- [ ] Create the Turnstile widget and replace the site-key placeholder in `js/account.js`.
- [ ] Create the Google OAuth client and consent screen.
- [ ] Verify `mail.freecellworlds.com` in Resend.
- [ ] Set up the `gdpr@` and `support@` addresses in Email Routing.
- [ ] Upgrade to the Workers Paid plan.
- [ ] Confirm with counsel whether an EU representative (GDPR Art. 27) is needed.
