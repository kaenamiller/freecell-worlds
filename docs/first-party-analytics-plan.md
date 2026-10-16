# First-party analytics and admin panel plan

Status (October 15, 2026): F0 and F1 are built on `main`. The sender stays off until `api` is set in `js/analytics-config.js`. Everything from F2 on is still a proposal. Companion to [analytics-plan.md](analytics-plan.md), which defines the event catalog. This plan stores that same catalog ourselves, on the Cloudflare stack the accounts branch already uses, and adds an admin panel on top.

The backend parts (sections 5–9) build on the `player-accounts` branch (the `freecell-accounts` checkout: Hono Worker, Better Auth, D1, R2, hourly cron). Build them there, or after it merges. The client parts (section 4) can land on `main` now and stay switched off until the endpoint exists.

## 1. What this gives us that GA4 doesn't

| | GA4 | First-party |
| --- | --- | --- |
| Ad blockers | 15–35% of desktop traffic lost | Same-site requests to `api.freecellworlds.com`, not on blocklists |
| Offline / PWA play | Lost | Queued on the device, sent later with the original timestamp |
| Row-level queries ("runs that held charm X at board 4") | Only through BigQuery | Plain SQL on our own tables |
| Param limits | 25 params, 100 chars | Full lists: held charms, offers, score lines, port stock |
| Link to purchases, token ledger, custom themes | Only through user_id | Same database family, joined by `user_id` |
| Attribution, demographics, Google's modelling | Yes | Referrer and UTM tags only |

GA4 stays for acquisition and attribution and as an independent cross-check. The first-party store is the source of truth for gameplay, balance and revenue analysis.

## 2. Consent and privacy model

### Regions

`GET https://api.freecellworlds.com/config` (new, no auth) returns `{ country, consentRequired, analytics: { enabled, sample } }` from `request.cf.country`. Cache it for the session. If the call fails, fall back to `Intl.DateTimeFormat().resolvedOptions().timeZone`: `Europe/*` counts as consent required. The same endpoint gives us a **remote kill switch and sampling rate** without redeploying the game.

Consent is required in the EEA (EU + IS, LI, NO), the UK and CH. This reads GDPR's "monitoring behaviour" rule together with token sales to EU buyers. It isn't legal advice, so get a quick lawyer review before launch.

### Three collection modes

| Mode | When | What happens |
| --- | --- | --- |
| `full` | Outside consent regions, or the player accepted | Persistent `player_id` in localStorage, offline queue, link to the account when signed in |
| `anonymous` | Consent region before a choice, after declining, or `navigator.globalPrivacyControl` is on | Nothing is stored on the device for analytics. The session id lives in memory (new on every page load). No offline queue, no account link. Only **self-contained summary events** are sent (section 4.4), so aggregate balance data still works |
| `off` | Player turned off *Settings → Privacy → Share play data* (available everywhere) | Nothing is sent, to either store |

Server-side business events (purchases, token ledger, sign-ups) are recorded in every mode, because they are transaction records. Outside `full` mode they are not linked to gameplay.

### Deletion, export and retention

- The raw archive and raw events carry only `player_id`, a random device id. The link to an account lives only in `player_link`. **Account deletion** removes the `player_link` rows plus every fact and raw row for those player ids. What remains in the R2 archive can no longer be tied to a person. This hooks into the existing `deleteUser.beforeDelete` in `server/src/auth.js`, next to `deleteThemeAssets`.
- **Data export** (account menu) adds an analytics summary: sessions, games, runs and purchases.
- Retention: raw events in D1 for 30 days, the R2 archive for 25 months (an R2 lifecycle rule deletes older objects), fact tables for 25 months after a player's last activity.

### Legal page changes

- `privacy/index.html`: replace "We don't run ad trackers or profiling analytics" with a description of GA4 and our own play statistics, the three modes, retention, and the Settings toggle. Add Google Analytics to the processor list.
- The cookie/consent banner only appears in consent regions. It has two equal buttons, *Accept* and *Decline*, and a link to the policy. The choice is saved in localStorage, because remembering the choice is strictly necessary.

## 3. Architecture

```
 Game (freecellworlds.com)                          Worker freecell-worlds-api (api.freecellworlds.com, admin.freecellworlds.com)
 ─────────────────────────                          ─────────────────────────────────────────────────────────────────────────
 track(name, params)                                GET  /config  ── country, consent, kill switch
   ├─ gtag (GA4)                                    POST /events  ── validate → enrich → Queue.send(batch)
   └─ analytics-1p.js                                                     │
        buffer → batch → fetch keepalive ─────────▶                       ▼
        offline queue (full mode)                   Queue  freecell-worlds-events ──(DLQ: freecell-worlds-events-dlq)
                                                          │ consumer (same Worker), batches of up to 100
 Server code (auth hooks, Stripe webhook,                 ├─▶ D1 freecell-worlds-analytics: raw `event` (30 d) + fact tables (upserts)
 theme workflow, token ledger)                            └─▶ R2 freecell-worlds-analytics-archive: NDJSON.gz per batch
   └─ emit(name, params) ──▶ Queue (+ GA4 Measurement Protocol for purchase/refund)
                                                    Cron hourly  :17  → rollups (today + last 3 days)
                                                    Cron daily 03:30  → compaction, pruning, cohorts, player summaries
                                                    admin.freecellworlds.com (Cloudflare Access) → static admin UI + /api/* reports
                                                         reads D1 analytics + D1 freecell-worlds (accounts, purchases)
```

Why these pieces:

- **A separate D1 database** (`freecell-worlds-analytics`, binding `ANALYTICS_DB`). Analytics growth can't press on the accounts database's 10 GB limit or slow down its backups and migrations.
- **A Queue between ingest and D1.** The ingest response returns right away. The consumer batches many requests into one D1 write, and a D1 outage turns into retries instead of lost data, with a dead-letter queue for poison batches.
- **R2 archive.** Cheap permanent raw history that DuckDB, or BigQuery later, can read directly through R2's S3 API. Cloudflare Pipelines (stream → R2 as Iceberg/Parquet) could replace the archive writer if it's mature enough when we build. Evaluate it then.
- **Same Worker, new module** (`server/src/analytics/`). It reuses Better Auth session lookups, CORS and deploys. Admin traffic arrives on a second custom domain on the same Worker.

## 4. Client

### 4.1 Files

| File | Role |
| --- | --- |
| `js/analytics-schema.js` | **One schema for everything.** Event names, params, types, enums, max lengths, `ga: false` for first-party-only params, `summary: true` for events allowed in anonymous mode. Imported by the client, the Worker (bundled from `../js/` by wrangler) and `tools/analytics-check.mjs` |
| `js/analytics.js` | `track()` sends each event to gtag and to the first-party sender (see the GA4 plan, section 4) |
| `js/analytics-1p.js` | First-party sender: ids, sessions, buffer, transport, offline queue, consent modes |
| `js/consent.js` | Region check, banner, Settings toggle, GPC |

### 4.2 Ids and sessions

- `player_id`: UUID in `localStorage['freecellworlds.pid']` (`full` mode only). It's **not** one of the synced save keys (`SAVE_KEYS` in `server/src/data.js`), so each device keeps its own. Account linking happens on the server.
- `session_id`: new after 30 minutes without events, the same rule GA4 uses. Kept in sessionStorage in `full` mode and in memory in `anonymous` mode.
- `seq`: a per-session counter on each event, so the server can measure loss.
- `id`: UUID per event, used for dedupe (`INSERT OR IGNORE`).

### 4.3 Transport

- Events are buffered in memory. A flush happens at 20 events, after 10 s, or on `visibilitychange: hidden` / `pagehide`.
- `fetch(API + '/events', { method: 'POST', body, keepalive: true, credentials: 'include', headers: { 'Content-Type': 'text/plain' } })`. A `text/plain` body avoids a CORS preflight. `keepalive` caps bodies at 64 KB, so batches are capped at 60 KB. `navigator.sendBeacon` is the fallback.
- Optional: gzip the body with `CompressionStream` (marked with a `?z=1` query param). Event JSON compresses 5–10×.
- JSON is stringified in `requestIdleCallback`, never inside card motion or the render loop.
- **Offline queue** (`full` mode): failed batches go to `localStorage['freecellworlds.evq']`, capped at 500 events / 256 KB with the oldest dropped first. They retry with backoff on the next flush, on the `online` event and on boot. A 4xx response drops the batch, a 5xx keeps it.

Payload:

```json
{ "v": 1, "app": "412-6044ba7", "mode": "full", "sid": "…", "pid": "…",
  "events": [ { "id": "…", "n": "voyage_board_end", "t": 1760531234123, "s": 37,
                "c": { "mode": "voyage", "theme_id": "forest", "theme_auto": false, "input": "mouse", "quality": "high", "installed": false },
                "p": { "run_id": "…", "board_idx": 3, "outcome": "cleared", "stars": 2, "held": ["forest.changeling", "…"], "…": "…" } } ] }
```

`logged_in` and `user_id` are **not** taken from the client. The server works them out from the session cookie.

### 4.4 Self-contained summary events (anonymous mode)

In anonymous mode, only events marked `summary: true` are sent, and each must make sense on its own without joins:

- `voyage_board_end` carries `held` (charm ids and levels), `challenge_id`, `strength`, `tier`, `boss_id`, `deal_rating`, the score lines and the interaction counters.
- `voyage_charm_offer` carries the offer list and the pick(s), so pick rate needs no join.
- `voyage_run_end`, `game_end`, `voyage_port_leave` (full purchase list), `theme_select`, `session_end`, `app_ready`, `app_error`.

Every balance report except run-level journeys works on this subset. Reports show "includes anonymous" or "full mode only" so the denominator is clear.

### 4.5 Off switches

Collection is off on `localhost` unless `?analytics=debug` is set (debug sends to the local Worker on :8787). It's also off whenever `navigator.webdriver` is true, which covers every `tools/` browser check, and off when `/config` says `enabled: false`.

## 5. Ingest (`POST /events`)

Mounted **outside** the `v1` router, because `v1` requires a session (`server/src/index.js`). A session is optional here.

1. **Limits:** body ≤ 64 KB (≤ 512 KB after decompressing), ≤ 100 events. A Workers Rate Limiting binding allows 60 requests/min per IP + `pid`.
2. **Validate** each event against `analytics-schema.js`. Unknown names, wrong types, out-of-range enums and over-length strings reject that event, not the whole batch. Unknown params are stripped. Rejections are counted per reason in `ingest_stats` and visible in the admin panel.
3. **Timestamps:** keep the client `t` if it's within 7 days in the past and 5 minutes in the future. Otherwise use the receive time and set `clock_skew = 1`.
4. **Enrich:** `received`, `country` (`cf.country`), `region` (`cf.region`), device class, browser and OS (parsed from the User-Agent, with the raw UA thrown away), and `app_version` from the payload.
5. **Identity:** if the Better Auth session cookie is valid and the mode is `full`, attach `user_id` and upsert `player_link(pid, user_id)`. Turn on Better Auth's `session.cookieCache` so this is a signature check, not a D1 read per batch.
6. **Bot and junk filtering:** drop known bot UAs and `HeadlessChrome`. Flag `suspect = 1` for impossible values, e.g. a board cleared in under 5 s or 10,000 moves. Players marked *internal* in the admin panel (your own devices) are flagged `internal = 1` and left out of reports by default.
7. **Enqueue** one message per accepted batch and return `204`. Ingest never waits on D1.

All client events are stored with `trusted = 0`. They are fine for balance and engagement but can be forged. Revenue numbers come only from server events.

### Server events (`server/src/analytics/emit.js`)

`emit(env, ctx, name, params, { userId })` validates against the same schema, sets `trusted = 1` and calls `Queue.send` inside `waitUntil`. For `purchase` and `refund` it also calls the GA4 Measurement Protocol, so both stores are fed from one call site.

| Where | Events |
| --- | --- |
| Better Auth hooks (`server/src/auth.js`) | `sign_up` (method), `login`, `email_verified`, `account_delete` |
| Stripe webhook (to be built) | `purchase` (with stored `ga_client_id`, `session_id` and `pid`), `refund`, `chargeback` |
| Token ledger writes (`server/src/themes/store.js`) | `token_grant` (admin/purchase/refund), `spend_virtual_currency` (theme tokens) |
| Theme workflow (`server/src/themes/workflow.js`) | `theme_gen_start`, `theme_gen_step` (stage, ms), `theme_gen_done` / `theme_gen_failed` (version, total ms, model calls, **estimated cost in cents**), `theme_prompt_check` (allowed, category) |
| Cron cleanup | `ops_cleanup` counts |

## 6. Storage (D1 `freecell-worlds-analytics`)

Migrations go in `server/migrations-analytics/`, with their own `wrangler d1 migrations apply` scripts.

### 6.1 Raw events (30 days)

```sql
CREATE TABLE event (
  id TEXT PRIMARY KEY,                -- client UUID, dedupe
  ts INTEGER NOT NULL,                -- event time (ms)
  received INTEGER NOT NULL,
  day TEXT NOT NULL,                  -- UTC yyyy-mm-dd of ts
  name TEXT NOT NULL,
  session_id TEXT, player_id TEXT,    -- player_id NULL in anonymous mode; no user_id here (see §2)
  mode TEXT NOT NULL,                 -- full | anonymous | server
  app_version TEXT, country TEXT, device TEXT, browser TEXT, os TEXT,
  ctx TEXT,                           -- context params JSON
  params TEXT NOT NULL,               -- event params JSON
  trusted INTEGER NOT NULL DEFAULT 0, suspect INTEGER NOT NULL DEFAULT 0, internal INTEGER NOT NULL DEFAULT 0,
  run_id TEXT GENERATED ALWAYS AS (json_extract(params, '$.run_id')) VIRTUAL,
  game_id TEXT GENERATED ALWAYS AS (json_extract(params, '$.game_id')) VIRTUAL
);
CREATE INDEX event_day_name ON event(day, name);
CREATE INDEX event_player_ts ON event(player_id, ts);
CREATE INDEX event_run ON event(run_id) WHERE run_id IS NOT NULL;
```

### 6.2 Fact tables (kept; the consumer upserts them)

Events can arrive out of order: offline queues, a board end flushed before its start, two tabs. So every upsert writes only its own columns (`ON CONFLICT DO UPDATE SET col = COALESCE(excluded.col, col)`), and no fact depends on arrival order.

| Table | Key | Contents |
| --- | --- | --- |
| `player` | `player_id` | first/last seen, first `app_version`, first country/device, first referrer + UTM + landing path, sessions, active days, consent mode, `internal` |
| `player_link` | `(player_id, user_id)` | linked_at. Deleted with the account |
| `account` | `user_id` | signup at/method, first purchase at, purchases, revenue (cents), refunds, tokens bought/spent, themes created. From server events |
| `session` | `session_id` | player, start, end, active seconds, foreground seconds, events, modes played, referrer/UTM, country, device, version |
| `f_game` | `game_id` | classic deal: deal, daily, theme, source, outcome, time, moves, undos, hints, checks, cards home, counters JSON |
| `f_run` | `run_id` | daily, boss, outcome, boards cleared, score, stars, coins earned/spent/left, final charms JSON, duration |
| `f_board` | `board_key` | idx, theme, challenge, extra challenges, boss, tier, strength, storm, deal, par, rating, ease, relaxed, boss relented, outcome, stars, score, moves, time, undos used/left, coins, score lines JSON, counters JSON |
| `f_board_charm` | `(board_key, charm_id)` | level, points, coins, ability uses, charges left. **One row per held charm per board.** Every charm-impact query uses this table |
| `f_charm_offer` | `(run_id, board_idx, source, charm_id)` | slot, stars, picked (0/1), price (markets) |
| `f_port_txn` | event id | run, market kind, action, item, price, coins after |
| `f_ability` | event id | board_key, charm, consumed, while_stuck, cards home, outcome of the board (filled in at board end) |
| `f_trigger` | `(board_key, charm_id, what)` | count. From `voyage_challenge_trigger` |
| `f_purchase` | `transaction_id` | user, player, session, pack, value cents, currency, first purchase?, refunded cents. **Trusted only** |
| `f_theme_gen` | `version_id` | theme, user, status, stage timings, cost estimate, failure reason |

### 6.3 Rollups (rebuilt by cron, read by the admin panel)

`r_daily_kpi (day, version, key, value)` covers DAU, sessions, games, wins, runs, run wins, purchases, revenue, signups and so on. Also: `r_charm_daily`, `r_challenge_daily`, `r_board_daily`, `r_theme_daily`, `r_funnel_daily`, `r_retention (cohort_week, first_version, source, week_n, players)`. Each row also stores the counts the admin panel needs for confidence intervals.

### 6.4 Admin and ops tables

`admin_audit (at, email, action, target, detail)`, `ingest_stats (day, accepted, rejected JSON, dedupes, suspect, bytes)`, `remote_config (key, value)` (served by `/config`).

### 6.5 R2 archive (`freecell-worlds-analytics-archive`)

- `raw/day=YYYY-MM-DD/hour=HH/<uuid>.ndjson.gz`: one object per consumer batch, the same rows as `event`.
- `daily/YYYY-MM-DD.ndjson.gz`: the nightly compaction of the day's parts, which are then deleted.
- A lifecycle rule deletes `raw/` and `daily/` after 25 months.
- Full move histories are **not stored** (decided October 15, 2026). The per-board summaries and counters cover the balance questions. Live boards are already saved on the device, so if replays or anti-cheat are ever needed, a `history/` prefix can be added then.

### 6.6 Size and cost estimate

Assumes ~100 events per active player per day: a classic-only player sends ~40, a Voyage run ~140.

| DAU | Events/month | Raw D1 at 30 days | D1 rows written/month (incl. indexes and facts) | R2 archive/year |
| --- | --- | --- | --- | --- |
| 1,000 | 3 M | ~1.5 GB | ~15 M | ~2 GB |
| 5,000 | 15 M | ~7.5 GB | ~75 M | ~10 GB |
| 10,000 | 30 M | ~15 GB (too big) | ~150 M | ~20 GB |

D1 databases max out at 10 GB. Above ~5k DAU, shorten raw retention in D1 to 7 days. Facts and the archive carry everything the reports need, so nothing is lost. At list prices when this was written (Workers Paid $5/month base with 10M requests, D1 with 50M rows written and 5 GB included, then ~$1 per million rows and $0.75/GB-month, Queues with 1M operations included, R2 at ~$0.015/GB-month), the bill stays a few dollars a month at 1k DAU and around $100/month at 10k DAU, mostly D1 writes. Check current pricing before relying on these numbers.

## 7. Scheduled jobs

The Worker already has `17 * * * *`. Add `30 3 * * *` and dispatch on `event.cron`.

| Job | Schedule | What it does |
| --- | --- | --- |
| Rollups | hourly | Rebuild the rollup rows for today and the last 3 days. Offline queues deliver late, so older days settle over the next 72 h |
| Compaction | daily | Merge yesterday's R2 parts into `daily/` |
| Prune | daily | Delete raw `event` rows past retention and facts for players inactive more than 25 months |
| Cohorts | daily | Rebuild `r_retention` |
| Player summaries | daily | Refresh `player` and `account` aggregates (lifetime stats, segments) |
| Health | hourly | Queue backlog, DLQ size, reject rate, event-loss rate (gaps in `seq`). A spike shows up in the panel and **emails the admin** through the existing Resend setup (at most one email per problem per 6 h) |

## 8. Admin panel (`admin.freecellworlds.com`)

### 8.1 Hosting and access

- A second custom domain on the same Worker. Static files come from `server/admin/` via Workers Static Assets. Reports come from `admin.freecellworlds.com/api/*`, which is the same origin, so no CORS. Disable the `workers.dev` route.
- **Cloudflare Access** (Zero Trust, free for up to 50 users) protects the whole hostname: Google login, a one-email allowlist (yours), and 2-step verification enforced by Google.
- **Defence in depth:** the Worker verifies the `Cf-Access-Jwt-Assertion` JWT on every request (signature against the team's certs and the `aud` tag), then checks the email against the `ADMIN_EMAILS` var. This blocks requests that skip Access.
- **One admin, no roles** (decided October 15, 2026). Whoever is in `ADMIN_EMAILS` can do everything. If a second person is ever added, add an `admin_user (email, role)` table then.
- **Audit:** every PII view, export, grant, flag change and SQL query is written to `admin_audit`.
- **Local dev:** a bypass header only when `BETTER_AUTH_URL` is localhost. A startup assertion makes it impossible to enable in production.
- **No staging** (decided October 15, 2026). Development and load tests run against local `wrangler dev` with local D1, Queues and R2. Production changes ship behind the `/config` kill switch, so a bad release can be turned off without a redeploy.

UI: vanilla ES modules with no build step, matching the game's code style. Charts use a vendored `uPlot` (~45 KB), plus small hand-made table and heatmap components. Every page has a shared filter bar: date range, `app_version` (default: latest), mode, device, country, include anonymous, include internal/suspect (off by default).

### 8.2 Pages

1. **Overview.** DAU/WAU/MAU, new vs returning, sessions, median session length, mode split, games and runs, revenue today/7d/30d, payers, conversion rate, all with sparklines. "Active in the last 15 minutes" counter.
2. **Live.** Event tail (filter by name, player or run), queue backlog, rejects by reason, recent `app_error`s, ingest health. Doubles as the QA tool when instrumenting new events.
3. **Engagement.** Stickiness (DAU/MAU), sessions per player, session length distribution, time of day / day of week, daily challenge and daily voyage participation, PWA vs browser, device and quality tiers.
4. **Retention.** D1/D7/D30 cohort grids by first week, split by `first_version`, acquisition source, first mode, device or country.
5. **Acquisition.** Referrers and UTM campaigns → players, D7 retention, sign-up rate, payer rate, revenue per player.
6. **Classic.** Games per day, win rate by theme, abandon rate and the cards-home distribution at abandon, hint/check/solve usage, assisted wins, streak lengths, daily completion, typed deal numbers.
7. **Voyage overview.** Runs per day, run win rate, a **survival curve** by board, loss reasons (stuck / abandoned / replaced), run duration, daily voyage results.
8. **Voyage balance** (the main tuning page):
   - *Charms table*, one row per charm: times offered, pick rate (overall and by offer slot), held boards, held-board clear rate and stars **vs the baseline at the same board index and tier**, lift with 95% interval, win rate of runs that picked it, ability use rate and charges left unused, average points and coins added (`f_board_charm`), sell and upgrade rates. Automatic tags: **dominant** (picked > 60% and positive lift), **trap** (picked often, negative lift), **ignored** (picked < 15%), **unused ability**.
   - *Challenge heatmap*: challenge × strength → clear rate, stars, stuck rate, median time, n.
   - *Bosses*: clear rate, stars, relented rate, top loss reasons, the charms held by winners vs losers.
   - *Difficulty calibration*: tier vs clear rate (target curve overlay); deal rating vs `moves_over_par` (binned); star distribution vs the `SCORE.stars` thresholds; par fit for `SCORE.parFactor`; relaxed-deal rate.
   - *Undo economy*: undos left at death and at run end, undos used per board, how often the finale stipend gets used.
   - *Coin economy*: coins earned per board, spend per market by item, sale rate by price, rerolls, coins left unspent at run end.
   - *Chart decisions*: when two tables are offered, which themes and challenges get picked. Shows which challenges players avoid.
   - *Triggers*: per challenge/boss, the `voyage_challenge_trigger` counts per board, split by board outcome.
   - *Version compare*: pick two `app_version`s and see every metric above side by side, with the change and whether it is significant.
9. **Themes.** Selection share, time played, classic win rate, Voyage clear rate, load time (`theme_load`), custom theme plays.
10. **Revenue** (once Stripe lands). Revenue, purchases, pack mix, ARPDAU/ARPPU, first vs repeat purchases, refunds and chargebacks. The funnel `creator_open → view_item_list → begin_checkout → purchase` by entry point, paywall hits, sessions and days to first purchase. LTV curves by cohort and by segment (preferred mode, skill tier, PWA, device, source, daily habit), and a top spenders list that links to player profiles.
11. **Custom themes ops.** Generations started/finished/failed, stage timings, rolls used per token, prompt rejection rate by category, cancels/refunds, **cost per version and margin per token pack**.
12. **Players.** Search by email (looked up in the accounts DB), user id, player id or run id. The profile shows lifetime summary, devices, sessions timeline, games, runs, purchases and token ledger, custom themes and consent mode. Actions: **grant tokens** (replaces `npm run grant`, writes `token_ledger` with reason `admin_grant`), mark as internal, export analytics data, delete analytics data.
13. **Run inspector.** One run, board by board: theme, challenge, strength, deal, par, moves, stars, score lines, charms held, abilities used, triggers, coins, port actions, and a timeline.
14. **Explorer.** Pick an event, filter on any params, group by up to two params, choose a chart type, save as a named view. Plus a **SQL console** against the analytics DB: `SELECT` only, checked by a statement parser, results capped at 5,000 rows, every query audited.
15. **Settings.** The kill switch and sample rate (written to `remote_config`, served by `/config`), and the schema registry (every event and param, daily volume, last seen, reject counts).

### 8.3 Statistical guardrails

- Show `n` next to every rate. Grey out cells with fewer than 30 samples.
- Rates use Wilson 95% intervals. Lifts use a two-proportion interval. The version-compare page also flags changes that aren't significant.
- Charm impact is an **association, not a cause**: strong players may pick certain charms, and charms picked early only show up on boards that were reached. The charms table compares at the same board index and tier, and can be split by player skill bucket. To prove a cause, use the experiments in section 10.
- Filters default to the latest `app_version` and leave out internal and suspect traffic.

### 8.4 Admin API

Reports are **named, parameterised queries** in `server/src/analytics/reports/*.js`, each `{ id, params, sql }`, reviewed and versioned like the game code. The browser never sends SQL, except in the SQL console. Rollup tables answer anything in the default date range. Drill-downs hit the fact tables through indexes. Responses are cached for 60 s with the Cache API, keyed on the query and its filters.

## 9. Testing

- **Unit tests** in `server/test/` (`node --test`, as today): schema validation, ingest rejects and limits, dedupe, timestamp clamping, order-independent fact upserts (shuffle the events of a full run and compare the results), consent modes (anonymous mode never stores `player_id`), the deletion purge, admin email check, JWT rejection.
- **End to end:** `wrangler dev` with local D1, Queues and R2, plus the game on :8080 with `?analytics=debug`. Extend `tools/analytics-check.mjs` from the GA4 plan: play a classic win, a Voyage board, a charm pick and a port visit, then query the local D1 and check that `f_game`, `f_board`, `f_board_charm` and `f_charm_offer` hold exactly the expected rows. Reload in the middle of a board to prove nothing is counted twice.
- **Offline:** play with the network off, reconnect, and check that events arrive with their original timestamps.
- **Load:** a script that replays synthetic sessions at 20× the expected peak against local `wrangler dev`, and checks queue lag and D1 write time. Repeat it against production once, just before launch.

## 10. Later: balance experiments

Once the pipeline is trusted, add **run-level experiments** so balance changes can be proven rather than inferred:

- `remote_config` defines an experiment, for example `parFactor: { control: 1.6, test: 1.5 }`, or a charm's numbers.
- A run's variant is a deterministic hash of `run.seed` plus the experiment id, so it holds steady across reloads and devices. Daily voyages are excluded, so everyone keeps the same daily.
- Every event in the run carries `exp` (the experiment id and variant). The version-compare page doubles as the experiment results page.

## 11. Phases

| Phase | Branch | Delivers |
| --- | --- | --- |
| **F0. Privacy** ✅ | main | Privacy policy rewrite, `js/consent.js` (regional banner, Settings toggle, GPC). Lawyer review still to do |
| **F1. Client** ✅ | main | `analytics-schema.js`, the `track()` fan-out, `analytics-1p.js` (off until the endpoint exists), `tools/analytics-check.mjs` |
| **F2. Ingest** | player-accounts | `/config`, `/events`, Queue + DLQ, consumer → raw `event` + R2 archive, `emit()` for server events, analytics D1 + migrations |
| **F3. Facts** | player-accounts | Fact upserts, rollups, crons, deletion and export hooks, `tools/analytics-check.mjs` end to end |
| **F4. Admin core** | player-accounts | Access + JWT + admin email check + audit, filter bar, Overview, Live, Players (with token grants), Settings |
| **F5. Balance** | player-accounts | Voyage overview and balance pages, Classic, Themes, Engagement, Retention, Acquisition |
| **F6. Revenue** | with Stripe | Purchase events + MP, Revenue and Custom-themes ops pages, `ga_client_id` and `pid` on `purchase` |
| **F7. Power tools** | later | Explorer, SQL console, version compare, experiments |

F1 can ship before the backend exists: the sender simply stays switched off. F2–F4 together are the smallest useful slice, with data flowing, visible in Live, and searchable by player.

## 12. Decisions

| Question | Decision (October 15, 2026) |
| --- | --- |
| Staging environment | None for now. Develop and load-test locally; use the `/config` kill switch as the safety net in production |
| Admin users | Just you. One email in `ADMIN_EMAILS` and the Access allowlist, no roles |
| Move histories | Not stored. Summaries and counters only |
| Alerts | Email through Resend |
