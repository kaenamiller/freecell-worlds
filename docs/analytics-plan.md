# GA4 analytics plan

Status (October 15, 2026): phases 1–3 are built on `main` (core, app, Classic and Voyage events, and `tools/analytics-check.mjs`). GA4 stays inert until `gaMeasurementId` is set in `js/analytics-config.js`. Accounts and Theme Token events (phase 4) wait for the accounts branch. Notes on how Voyage was built are in §5.7.

## 1. Goals

1. **Balance.** Measure how often each charm, challenge, boss, theme and difficulty tier leads to wins, stars, deaths and abandons, so `js/voyage/config.js` and the charm content can be tuned from data instead of guesses.
2. **Engagement.** Learn what keeps people playing: modes, themes, daily challenges, sessions, retention.
3. **Revenue.** Find the behaviour that comes before buying Theme Tokens, and describe the players who spend the most so more players can be steered toward that path.

GA4 is good for goal 2 and the top-line view of goal 3. Goals 1 and 3 need row-level queries (for example, "win rate of runs that held charm X at board 4"), which GA4's interface can't do well. Those queries run against our **first-party analytics store** ([first-party-analytics-plan.md](first-party-analytics-plan.md)). It receives every event in this catalog, is not blocked by ad blockers, and has its own admin panel. BigQuery export is deferred. Every event carries IDs (`run_id`, `game_id`) so rows can be joined.

## 2. Things to settle first

| Issue | Why it matters | Recommendation |
| --- | --- | --- |
| **The privacy policy says "We don't run ad trackers or profiling analytics."** (`privacy/index.html:22`) | Adding GA4 makes that line false. | Rewrite the section to name Google Analytics, what it collects and how to opt out. Add Google to the processor list on line 34. |
| Consent (**decided: banner for EEA/UK/CH only**) | GA4 sets cookies, so EEA/UK users must agree first. GDPR covers *monitoring the behaviour* of people in the EU even if you don't target them, and selling tokens to EU buyers counts as offering them a service. | Use Consent Mode v2 with a small banner shown only in those regions. The region comes from `cf.country` (section 2 of the first-party plan), with a `Europe/*` timezone fallback. `gtag('consent', 'default', { analytics_storage: 'denied', region: [...] })` covers the GA side even if the lookup fails. `analytics_storage` defaults to denied in the EEA/UK/CH and granted elsewhere. `ad_storage`, `ad_user_data` and `ad_personalization` stay **denied everywhere**, since there is no advertising. **As built:** gtag.js only loads in full mode (Consent Mode "basic"), so players who decline or haven't answered send nothing to Google. Their play is still counted anonymously by the first-party store. |
| Google signals and ads linking | Turning on signals adds data thresholds that hide rows in reports. Accounts start at age 13, but the game can be played by anyone. | Leave Google signals **off**, turn off ads personalization, and set data retention to 14 months. |
| PII | GA4's terms forbid it. | Never send emails, names or custom-theme prompt text. `user_id` is the account UUID (`user.id` in freecell-accounts). |
| Ad blockers (**decided: first-party store**) | 15–35% of desktop players will block `googletagmanager.com`. | GA4 numbers will run low. The first-party store on `api.freecellworlds.com` is the complete record, and GA4 is used for attribution and quick top-line reports. Purchases also go to GA4 from the server (section 8). |
| Offline / PWA play | gtag drops events when there's no network. | GA4 loses them. The first-party sender queues events locally and sends them when the connection returns, with their original timestamps. |
| Measurement ID | | Supplied later. `initAnalytics` does nothing on the GA4 side until it's set. The first-party side works without it. |

## 3. GA4 limits that shape the design

- Event names: 40 chars max, 500 distinct names. Each event can carry up to 25 params, and param values are limited to 100 chars.
- Custom dimensions: **50 event-scoped and 25 user-scoped**. Custom metrics: 50.
- High-cardinality dimensions get grouped into `(other)` in reports. Deal numbers, run IDs and seeds therefore go **only to the first-party store**. Send them as params but don't register them as dimensions.
- Never send one event per card move. A run is about 7 boards × ~100 moves. Per-board and per-game summaries carry the same balance information at about 1% of the volume.
- BigQuery export is deferred. If it is turned on later, standard properties export up to **1M events/day**, far above this plan's volume.

## 4. Architecture

### `js/analytics.js` (new, the only module that touches gtag)

`track()` sends every event to two places: gtag, and the first-party sender (`js/analytics-1p.js`, described in the first-party plan). Both are checked against one shared schema, `js/analytics-schema.js`. The schema marks which params are first-party only and trims the GA4 copy to GA4's limits, so the two stores always agree on names and meanings.

```js
// API sketch
initAnalytics({ measurementId, appVersion })  // loads gtag on idle after the first frame, sets consent defaults
track(name, params = {})                      // merges in context params, validates in dev, calls gtag('event', ...)
setUser({ userId, props })                    // user_id + user properties
setContext(patch)                             // mode, theme_id, logged_in, ...
screen(name, extra)                           // virtual page_view for SPA screens
flushOnHide()                                 // pagehide/visibilitychange → transport_type: 'beacon'
```

- **No-op by default** on `localhost` and under the `tools/` browser checks (`tools/e2e.mjs`, `autotest.mjs` and the rest). `?analytics=debug` turns it on with `debug_mode: true` so events appear in DebugView.
- **Deferred load.** Inject `gtag.js` from `requestIdleCallback` after boot (`js/main.js:3951`) so it doesn't compete with three.js and texture uploads. Events tracked before it loads go into the `dataLayer` queue as usual.
- **Dev-time schema check.** In debug builds `track()` asserts that the name is at most 40 chars, there are at most 25 params, and string values are at most 100 chars. It warns when an event name isn't in the catalog below.
- **Idempotency for saved runs.** Voyage runs and classic games survive reloads. Keep `run.analytics = { boardStarted: idx, ended: true, ... }` in the saved run so a reload never repeats `voyage_board_start` or `voyage_run_end`. This works the same way as the `recordedEconomy` watermark in `js/voyage/stats.js:52`.
- `sw.js` only intercepts same-origin GETs (`sw.js:174`), so gtag requests already bypass the service worker. No change is needed there.

### Context params (added to every event automatically)

| Param | Values | Source |
| --- | --- | --- |
| `app_version` | build id (e.g. `run_number-sha7`) | `PAGES_CACHE_VERSION` from `tools/prepare-pages.mjs`, written into the page at build time. **This is essential for balance work:** charm stats must be compared before and after each patch. |
| `mode` | `classic` / `voyage` / `menu` | `mode` in main.js plus title-screen state |
| `theme_id` | e.g. `forest`, `custom` | `currentTheme.id`. Custom themes report `custom`, never their UUID. |
| `theme_auto` | `true`/`false` | `settings.autoRandomTheme` |
| `logged_in` | `true`/`false` | account state (freecell-accounts `js/account.js`) |
| `input` | `touch` / `mouse` | `isTouch` |
| `quality` | `ultra`…`low` | the current tier after `applyTier` |
| `installed` | `true`/`false` | `.is-installed` class set in `index.html` |

That's 8 of the 25 params, which leaves 17 for each event's own data.

### IDs (sent as params, used for joins in the first-party store)

- `game_id`: random id per classic deal, created in `dealGame` and saved with the `game` save so a resumed game keeps it.
- `run_id`: random id per Voyage run, stored on the run object at `createRun`.
- `board_key`: `${run_id}:${board_idx}`.
- `deal`: classic deal number, or the Voyage seed-bank deal.
- `player_id`: a random UUID kept in localStorage, so anonymous players can be followed across sessions independently of the GA cookie. After sign-in, `user_id` takes over.

## 5. Event catalog

GA4 recommended event names are used where they fit (`level_start`, `level_end`, `post_score`, `unlock_achievement`, `earn_virtual_currency`, `spend_virtual_currency`, `tutorial_begin`, `tutorial_complete`, `login`, `sign_up`, `begin_checkout`, `purchase`, `refund`). Those names feed GA4's built-in game and monetization reports. Voyage events also get a `voyage_` name of their own, so filtering stays easy.

### 5.1 App and navigation

| Event | When | Params | Hook |
| --- | --- | --- | --- |
| `page_view` (virtual) | Screen changes: `title`, `classic_board`, `voyage_map`, `voyage_board`, `voyage_reward`, `voyage_port`, `voyage_run_end`, plus the `privacy`/`terms`/`contact` pages | `screen_name`, `page_location` like `/app/voyage/map` | `ui.hideTitle/showTitle`, `voyageUI.show*` |
| `app_ready` | First playable frame | `load_ms`, `gpu_tier`, `quality_auto`, `cores`, `standalone` | `boot()` main.js:3951 |
| `perf_downgrade` | Adaptive quality drops a tier | `from`, `to`, `fps` | main.js:3778 |
| `title_tab` | Switching between the Classic and Voyage tabs | `tab` | `ui.setTitleMode` js/ui.js:106 |
| `modal_open` | Stats, settings, themes, all-themes | `modal` | `ui.openModal` js/ui.js:358 |
| `theme_select` | The player picks a theme | `theme_id`, `source` (`title_tile`, `all_themes`, `in_game`, `random`) | `ui.handlers.theme/randomTheme` main.js:3628 |
| `settings_change` | Any setting changes | `setting`, `setting_value` (stringified; not `value`, which GA4 treats as money) | `ui.handlers.settings` main.js:3665 |
| `fullscreen_toggle` | | `on` | `js/fullscreen.js` |
| `pwa_install_prompt` / `pwa_installed` | `beforeinstallprompt` / `appinstalled` | `outcome` | new listeners |
| `stats_reset` | | — | `ui.handlers.resetStats` |
| `app_error` | Uncaught error (sampled; Sentry stays the source of truth) | `message` (truncated), `where` | `window.onerror` |

### 5.2 Classic

| Event | When | Key params | Hook |
| --- | --- | --- | --- |
| `level_start` + `game_start` | New deal dealt (not on restore) | `game_id`, `deal`, `daily`, `source` (`play`, `new_button`, `deal_number`, `daily`, `win_again`), `free_cells` | `dealGame` main.js:2460 |
| `game_resume` | Saved deal restored | `game_id`, `moves_so_far`, `elapsed_s` | `dealGame` with `opts.restore` |
| `hint_used` / `check_used` / `solve_used` | Each assist | `game_id`, `moves_so_far`, `result` (check: solvable/unsolvable/unknown) | `doHint` 2317, `doCheck` 2298, `doSolve` 2357 |
| `level_end` + `game_end` | The game ends | `game_id`, `outcome` (`win`, `solved`, `abandoned_new_deal`, `abandoned_daily`), `time_s`, `moves`, `undos`, `hints`, `checks`, `cards_home`, `daily`, `streak` | win: `handleWin` 2522. Abandon: the `recordLoss()` branch in `dealGame` 2462 |
| `game_exit` | Tab hidden or closed with a deal in progress (beacon) | `game_id`, `cards_home`, `elapsed_s`, `moves` | `pagehide` |
| `post_score` | After a win | `score` (moves), `level` = deal, `character` = theme | `handleWin` |
| `unlock_achievement` | Each unlock | `achievement_id` | `recordWin` result in `handleWin` |
| `daily_complete` | Daily won | `deal`, `time_s`, `moves` | `handleWin` |

"Dropped" games (exited and never resumed) are worked out in the first-party store: a `game_exit` with no later `game_resume` or `game_end` for the same `game_id`.

### 5.3 Voyage

Run lifecycle:

| Event | When | Key params | Hook |
| --- | --- | --- | --- |
| `voyage_run_start` | `createRun` | `run_id`, `daily`, `boss_id`, `replaced_run` (true if an old run was abandoned to start this one), `runs_lifetime` | `voyageStart` main.js:2842 |
| `voyage_run_resume` | Continue from title | `run_id`, `status`, `board_idx` | `voyageContinue` 2866 |
| `voyage_node_pick` | A table is chosen on the chart | `run_id`, `board_idx`, `theme_id`, `challenge_id`, `strength`, `storm`, `is_final`, `offered_themes` (comma-joined, ≤3), `prep_wait_ms` (time on the loading screen) | `voyagePickNode` 2897 |
| `level_start` + `voyage_board_start` | Board dealt | `run_id`, `board_idx`, `theme_id`, `challenge_id`, `extra_challenges`, `boss_id` (final only), `tier`, `strength`, `deal`, `par`, `deal_rating`, `relaxed`, `boss_relented`, `ease_total`, `free_cells`, `undos_available`, `charms_held` (count) | `voyageDealBoard` 3267, from `run.current` (run.js:177) |
| `voyage_stuck_warning` | A dead-end warning is shown | `run_id`, `board_idx`, `kind` (`no_moves`, `proven_dead`), `undos_left`, `ability_available` | `voyageWarnStuck` 3391 |
| `voyage_ability_use` | A charm ability is used | `run_id`, `board_idx`, `charm_id`, `uses_left`, `consumed`, `while_stuck`, `cards_home`, `moves_so_far` | `voyageHandlers.useAbility` 3562 |
| `voyage_undo` | Each paid undo | `run_id`, `board_idx`, `undos_left` | `doUndo` 2694 (voyage branch) |
| `level_end` + `voyage_board_end` | Board cleared, conceded or lost | `run_id`, `board_idx`, `theme_id`, `challenge_id`, `outcome` (`cleared`, `conceded`, `stuck`, `abandoned`), `stars`, `score`, `par`, `moves`, `moves_over_par` (moves − par), `time_s`, `undos_used`, `undos_left`, `coins_earned`, `ability_uses`, `score_cards`, `score_efficiency`, `score_freecells`, `score_chains`, `score_charms`, `cards_home` | clear: `voyageWin` 3488 (from `winBoard` result). Loss: `voyageLose` 3463 |
| `earn_virtual_currency` | Coins awarded | `virtual_currency_name: 'coins'`, `value`, `source` (`board`, `charm`, `storm`) | `voyageWin` |
| `voyage_run_end` | Run finished | `run_id`, `outcome` (`won`, `stuck`, `abandoned`, `abandoned_for_new`), `boards_cleared`, `total_score`, `total_stars`, `coins_earned`, `coins_spent`, `coins_left`, `charms_held`, `boss_id`, `died_on_theme`, `died_on_challenge`, `duration_min`, `daily` | wherever `recordRunEnd` is called (main.js:2853, 3469, 3494) |

Charms:

| Event | When | Key params | Hook |
| --- | --- | --- | --- |
| `voyage_charm_offer` | The reward screen shows offers | `run_id`, `board_idx`, `stars`, `picks_allowed`, `offered` (comma-joined ids), `offer_count`, `source` (`reward`, `market`) | `voyageWin` (reward state) and the port show |
| `voyage_charm_pick` | One per pick | `run_id`, `board_idx`, `charm_id`, `charm_theme`, `charm_family`, `pick_slot` (1–3, position in the offer list), `offered`, `held_before` (count), `source` | `voyagePickCharm` 3514, `buyBoon` |
| `voyage_charm_upgrade` | Upgrade market | `charm_id`, `price` | `upgradeBoon` |
| `voyage_charm_sell` | Sold at port | `charm_id`, `price`, `held_boards` (boards it was held for) | `sellBoon` |
| `voyage_challenge_trigger` (optional) | Notable moments inside a challenge, e.g. a boss "tell", a thaw milestone, a fog peek spent | `charm_id`, `what` | content calls a new `ctx.api.track(what)`, rate-limited to about 20 per board |

Port and economy:

| Event | When | Key params | Hook |
| --- | --- | --- | --- |
| `voyage_port_enter` | Port shown | `run_id`, `market_kind` (`stickers`/`boons`/`upgrades`), `coins` | `voyagePortShow` 3530 |
| `spend_virtual_currency` | Any coin spend | `virtual_currency_name: 'coins'`, `value`, `item_name` (`boon:<id>`, `sticker:<type>`, `upgrade:<id>`, `undo`, `reroll`, `service:<id>`, `charm_spend:<id>` for in-board spends) | `voyagePortAction` 3543 (compare `run.coins` before and after), `api.spendCoins` |
| `voyage_port_leave` | Leave port | `run_id`, `market_kind`, `coins_before`, `coins_after`, `items_bought`, `rerolls` | `voyagePortLeave` 3552 |

Tutorial:

| Event | When | Params | Hook |
| --- | --- | --- | --- |
| `tutorial_begin` / `tutorial_complete` | Each tutorial step | `step` (`map`, `board`, `reward`), `replay` | `voyageUI.tutorial` js/voyage/ui.js:802 |

### 5.4 Accounts (freecell-accounts branch)

| Event | When | Params |
| --- | --- | --- |
| `sign_up_start` | The sign-up form opens | `entry` (`menu`, `creator`, `save_prompt`, …) |
| `sign_up` | Account created | `method` (`google`, `email`) |
| `login` | Sign-in succeeds | `method` |
| `logout` | | — |
| `email_verified` | Sent from the server (MP) | — |
| `sync_conflict` | `js/sync.js` gets a 409 | `key`, `resolution` (`merged`, `local_wins`) |
| `account_delete` | Sent from the server (MP) | — |

On sign-in, call `setUser({ userId: user.id })` and set `logged_in` in the context. On sign-out, clear both.

### 5.5 Theme Tokens and custom themes (once Stripe lands)

This is the revenue funnel. The client sends the steps up to checkout. **The server sends `purchase` and `refund`** from the Stripe webhook through the GA4 Measurement Protocol. Those can't be blocked by ad blockers or missed when a tab closes, and they can't be faked.

| Event | Sent from | When | Params |
| --- | --- | --- | --- |
| `creator_open` | client | Theme creator opened | `entry` (`title`, `theme_picker`, `paywall`, …), `token_balance` |
| `view_item_list` | client | Token packs shown | `item_list_id: 'token_packs'`, `items[]` (`token_1` $4, `token_3` $10, `token_6` $15) |
| `select_item` | client | Pack chosen | `items[]` |
| `paywall_hit` | client | API answered 402 `NO_TOKENS` | `entry` |
| `begin_checkout` | client | Redirect to Stripe Checkout | `currency`, `value`, `items[]`, `checkout_id` |
| `purchase` | **server (MP)** | `checkout.session.completed` webhook | `transaction_id` (Stripe session id), `currency`, `value`, `items[]`, `is_first_purchase`, `purchase_number` |
| `refund` | **server (MP)** | Refund webhook | `transaction_id`, `value` |
| `spend_virtual_currency` | server or client | Token spent on a theme | `virtual_currency_name: 'theme_tokens'`, `value: 1`, `item_name: 'custom_theme'` |
| `theme_prompt_rejected` | client | 422 `PROMPT_REJECTED` | `category` (never the prompt text) |
| `theme_version_ready` / `theme_version_failed` | client (polling) | Version done or failed | `version_n` (1–3), `gen_seconds` |
| `theme_pick` | client | Version finalized | `version_n`, `rolls_used` |
| `theme_cancel_refund` | client | Token refunded on cancel | — |
| `custom_theme_play` | client | Classic deal or Voyage started on a custom theme | `mode` |

**Joining client and server.** When the client calls the checkout endpoint, it also sends the GA `client_id` (read with `gtag('get', MEASUREMENT_ID, 'client_id', cb)`) and the `session_id`. The Worker stores both on the `purchase` row (one new column) and sends them back with the MP `purchase`. GA4 then credits the purchase to the right session, traffic source and user. Keep `MP_API_SECRET` in Wrangler secrets.

### 5.6 Detail events and counters

These go to both GA4 and the first-party store unless marked **first-party only**. Counters are added to the per-board and per-game summary events instead of being sent once per action, which keeps volume flat.

**Interaction counters** added to `game_end` and `voyage_board_end`. They are **first-party only**: with them, these events would exceed GA4's 25-param limit.

| Param | Meaning | Why |
| --- | --- | --- |
| `invalid_moves` | Drops rejected by the rules (`audio.invalid()` paths in `tryDrop`) | Frustration and how well the rules are understood |
| `drags`, `double_clicks`, `key_moves`, `auto_moves` | How cards were moved | Input style by device. Tells us whether auto-play does too much |
| `freecell_uses` | Cards placed in a free cell | Already scored, but useful across classic as well |
| `first_move_ms` | Time from the end of the deal to the first move | Reading time. Compare across challenges |
| `idle_max_s` | Longest pause between moves | Separates "thinking" from "stuck and leaving" |
| `undo_max_streak` | Longest run of undos in a row | Backtracking from a dead end vs fixing a slip |
| `rank_highlight_uses` | Held-rank key highlights | Feature discovery |
| `peeks` | Fog peeks / tap-to-peek | Fog boss balance |
| `bg_seconds` | Time the tab was hidden during the board | Removes AFK time from `time_s` |
| `auto_finished` | `canFinishWithFoundationOnly` played out the end | |
| `after_invalid_burst` | On abandon only: 3+ invalid moves in the last 30 s | Rage-quit signal |

**Voyage detail events:**

| Event | When | Key params | Hook |
| --- | --- | --- | --- |
| `voyage_charm_score` | Board end, one per held charm that changed score or coins | `run_id`, `board_idx`, `charm_id`, `points`, `coins`, `mult` | Diff `sb.subtotal`, `sb.mults` and `sb.coinTotal` before and after each charm's `score()` call in `BoardEffects.score` (js/voyage/charms.js:383), plus the `charm.coins` adjustments in `winBoard`. Score line keys are free-form (`'tessellate'`, `'clock'`), so they can't be used for attribution |
| `voyage_challenge_trigger` | A challenge or boss does something visible: thaw milestone, seal broken, crown/thorn penalty, fog peek budget spent, current shift, Shot Clock penalty | `run_id`, `board_idx`, `charm_id`, `what`, `n` | New `ctx.api.track(what, n)` in the charm API, rate-limited to 20 per board per charm. Content files opt in one line at a time |
| `voyage_loss_saved` | An `on.stuck` hook cancelled a loss | `charm_id`, `board_idx`, `undos_left` | `voyageProveStuck` / `voyageCheckStuck` when `emit('stuck')` returns true |
| `voyage_undo_cap_hit` | A charm's undo grant hit `VOYAGE.charmUndoCap` | `charm_id`, `board_idx` | `BoardEffects.addUndos` |
| `voyage_ability_cancel` | An ability started but was cancelled (target pick dismissed, `use` returned false) | `charm_id`, `stage` (`pick`, `choose`, `use`) | `BoardEffects.useAbility` (`consumed === false`) |
| `voyage_sonar_result` | Sonar finished | `steps` (null if none found), `ms` | `voyageSonar` main.js:3053 |
| `voyage_preview_used` | Charm preview shown | `n`, `found` | `voyagePreview` |
| `voyage_chart_decision` | Added to `voyage_node_pick` | `decide_ms` (chart open → pick), `inspected` (nodes opened for details), `offered_challenges` | `voyageUI.showMap` / `pickNode` |
| `voyage_port_stock` | Added to `voyage_port_enter` | `stock` (the items on sale; **first-party only** for the full list, GA4 gets the first 100 chars) | `portView` |
| `voyage_sticker_trigger` | A sticker changed a move (wild played, lucky paid, key opened…) | `sticker`, `card`, `board_idx` | sticker code in `js/voyage/stickers.js` |

**Classic detail:**

| Event | When | Key params |
| --- | --- | --- |
| `streak_lost` | A win streak ends (abandon) | `streak` |
| `deal_number_entered` | Player typed a deal number | `deal` (first-party only) |
| `check_result` | Folded into `check_used.result` | — |

**App and stability:**

| Event | When | Key params |
| --- | --- | --- |
| `theme_load` | A theme's assets finish loading | `theme_id`, `ms`, `from_cache` (service worker hit) |
| `webgl_context_lost` / `_restored` | GPU context events | `quality`, `gpu_tier` |
| `audio_unlock_failed` | Web Audio couldn't start | `reason` |
| `mute_toggle` | Mute button | `muted` |
| `session_start` / `session_end` | **First-party only** (GA4 has its own). Start carries referrer, UTM tags, landing path and `first_visit`. End is sent by beacon on `pagehide` with `active_s`, `foreground_s` and `events` | |

### 5.7 Voyage as built

- Event params are built in `js/voyage/analytics.js`. Its bookkeeping lives in `run.analytics` (run id, which board has started and ended, the reward and port in progress, per-board ability uses and trigger tallies) and is saved with the run. A reload therefore never repeats an event, and finished runs leave nothing behind because saved runs are cleared when they end.
- `voyage_charm_offer` fires once a reward is **settled**, with both `offered` and `picked`, so pick rate needs no join. A charm market sends one at `voyage_port_leave` (`source: market`).
- `voyage_charm_score`: `BoardEffects.score` records what each charm's `score()` added (`sb.charmDeltas`, saved as `result.score.charms`). Coin adjustments from `charm.coins` hooks are added from coin lines keyed by charm id. Challenges and bosses are included, so penalties show up as negative points.
- `voyage_challenge_trigger` is a **per-board tally**, sent at board end as one event per charm and kind of moment. The tally caps at 20 per charm per board. Every charm's `notify` and `spendUndos` are counted automatically. Content can add its own moments with `ctx.api.track(what, n)`; the Lucky sticker does (`voyage.stickers` / `lucky`). This replaces the planned `voyage_sticker_trigger`. Gold sticker coins appear in `voyage_charm_score` for `voyage.stickers`.
- `voyage_node_pick.inspected` counts the tables the player opened on the chart before choosing.
- Not sent: `ease_total`. The dealer's ease isn't kept on `run.current`; add it there if it's needed.
- `tutorial_complete` has `skipped: true` when the guide is closed with × instead of *Got it*.

## 6. Custom dimensions and metrics to register

Register these in GA4 Admin → Custom definitions. Params not listed here (ids, deal numbers, comma lists) still reach the first-party store.

**Event-scoped dimensions (30 of 50)**

`app_version`, `mode`, `theme_id`, `theme_auto`, `logged_in`, `input`, `quality`, `installed`, `screen_name`, `source`, `outcome`, `daily`, `board_idx`, `charm_id`, `charm_theme`, `charm_family`, `challenge_id`, `boss_id`, `strength`, `tier`, `stars`, `storm`, `market_kind`, `item_name`, `kind`, `step`, `setting`, `setting_value`, `method`, `entry`

**User-scoped dimensions (14 of 25)**, set from local stats at boot and refreshed when they change:

| Property | Values | Why |
| --- | --- | --- |
| `account_status` | `anonymous`, `registered` | Core segment |
| `signup_method` | `google`, `email` | |
| `preferred_mode` | `classic`, `voyage`, `both` | From `stats.played` vs `voyageStats.runs` |
| `classic_games_bucket` | `0`, `1-4`, `5-19`, `20-99`, `100+` | Engagement tier |
| `classic_winrate_bucket` | `<40`, `40-70`, `70-90`, `90+` | Skill tier |
| `voyage_runs_bucket` | same buckets | |
| `voyage_best_board` | `0`–`7` | Voyage skill and depth |
| `voyage_wins_bucket` | `0`, `1`, `2-4`, `5+` | |
| `is_payer` | `true`/`false` | Revenue segment |
| `spend_bucket` | `0`, `<$10`, `$10-24`, `$25-49`, `$50+` | LTV tier (set from `/v1/me`) |
| `custom_themes_bucket` | `0`, `1`, `2-4`, `5+` | |
| `pwa_installed` | `true`/`false` | |
| `first_version` | `app_version` of the first visit | Cohort by release |
| `daily_player` | `true` if a daily was played in the last 7 days | Habit signal |

**Custom metrics (13 of 50):** `time_s`, `moves`, `moves_over_par`, `undos_used`, `undos_left`, `hints`, `score`, `cards_home`, `coins_earned`, `coins_spent`, `ability_uses`, `price`, `duration_min`.

## 7. Balance questions and where the answers come from

| Question | Data | Where |
| --- | --- | --- |
| Which boards kill runs? | `voyage_board_end` `outcome≠cleared` by `board_idx` | GA funnel + first-party |
| Is the difficulty curve right? Clear rate and stars by `tier` × `strength` | `voyage_board_end` | GA exploration |
| Is each **challenge** fair? Clear rate, stars and abandon rate by `challenge_id` × `strength` | `voyage_board_end` | GA exploration |
| Which boss is hardest? | final-board `voyage_board_end` by `boss_id`, plus `boss_relented` rate | GA |
| **Charm pick rate:** picks ÷ times offered, by `charm_id`, controlling for slot position | `voyage_charm_offer` + `voyage_charm_pick` | First-party (`f_charm_offer`) |
| **Charm win impact:** run win rate and mean stars per later board for runs holding charm X, vs the same board without it | pick + board_end joined on `run_id` | First-party |
| Are active abilities used, or hoarded until the run ends? | `voyage_ability_use` vs charms held at `voyage_run_end` | First-party |
| Do abilities save runs? | `voyage_ability_use.while_stuck` followed by a clear on the same `board_key` | First-party |
| Is `parFactor` right? | distribution of `moves_over_par` and stars | GA / first-party |
| Does the seed-bank rating predict difficulty? (validates `VOYAGE.compensation`) | `deal_rating` / `ease_total` vs outcome and moves | First-party |
| Is the undo budget too tight or too loose? | `undos_left` at death and at run end | GA |
| Coin economy: are markets worth visiting? What sells? | `spend_virtual_currency` by `item_name`, `coins_left` at run end | GA |
| Theme popularity vs theme difficulty | `theme_select`, `level_start` by `theme_id`, Voyage clear rate by theme | GA |
| Classic: abandon rate and where players quit | `game_end.outcome`, `cards_home` at abandon | GA |

Tag every balance chart with `app_version` so a charm change can be read before and after.

## 8. Revenue analysis plan

**Data path:** client funnel events → server MP `purchase`/`refund` with the same `client_id` and `user_id` → GA4. The same events, plus every purchase from D1, land in the first-party store. D1's `purchase` table stays the source of truth for money. GA4 is used for behaviour and attribution.

**Audiences** (GA4 Admin → Audiences; they fill up over time, so create them early):

- `payers`: `purchase` at least once.
- `high_value`: lifetime purchase value ≥ $25 (sum the purchase `value` in the audience builder).
- `repeat_buyers`: `purchase` count ≥ 2.
- `engaged_nonpayers`: `logged_in`, 5+ sessions in 30 days, no purchase.
- `paywall_bounced`: `paywall_hit` or `begin_checkout` with no `purchase` within 1 day.
- `voyage_devotees`: 5+ `voyage_run_start` in 30 days.
- `daily_habit`: `daily_complete` on 3+ days in 7.

**Questions to answer in the first-party admin panel once there are about 100 purchasers:**

1. **Path to first purchase.** Sessions, days since first visit, games and runs played, themes tried and best Voyage board before the first `purchase`.
2. **Which entry point converts.** `creator_open.entry` → `begin_checkout` → `purchase` funnel.
3. **LTV by acquisition.** `traffic_source` from the first session, joined to lifetime purchase value.
4. **LTV by behaviour segment.** `preferred_mode`, skill tier, installed PWA, daily habit, device.
5. **Theme affinity.** Do players who rotate through many themes (`theme_select` breadth) buy custom themes more?
6. **Repeat purchase drivers.** Do players who *play* their custom theme (`custom_theme_play`) buy again sooner?
7. **Churn after purchase.** Sessions in the 30 days after `purchase`, compared with matched non-payers.

GA4 predictive metrics (purchase probability, predicted revenue) unlock automatically after **1,000 purchasers and 1,000 non-purchasers** within 28 days. Expect them later, not at launch.

## 9. Reporting setup

1. **GA4 property** with a single web stream for `freecellworlds.com`. Leave enhanced measurement on (scrolls, outbound clicks) and turn its *page changes based on history events* option **off**, since virtual `page_view`s are sent by hand.
2. Mark **key events**: `purchase`, `sign_up`, `voyage_run_end` (outcome=won is filtered in reports), `daily_complete`, `begin_checkout`.
3. **BigQuery export:** deferred. The first-party store covers row-level analysis. Turning it on later costs nothing up front, but it never backfills earlier data.
4. **Saved explorations:**
   - Voyage funnel: run start → board 1 … 7 cleared → run won.
   - Classic funnel: game start → 50% cards home → win.
   - Revenue funnel: creator_open → view_item_list → begin_checkout → purchase.
   - Path exploration backward from `purchase`.
   - Cohort retention by `first_version`.
5. **Looker Studio dashboards** (optional; the first-party admin panel is the main dashboard):
   - *Balance*: charm pick rate and win impact table, challenge × strength heatmap, board death curve, par distribution, economy flow.
   - *Engagement*: DAU/WAU, sessions, mode split, theme popularity, daily participation.
   - *Revenue*: purchases, ARPPU, conversion by entry point, LTV by segment.
6. **Saved queries** for charm pick rate, charm win impact, challenge clear rate and path to purchase live in the first-party admin API (`server/src/analytics/reports/`), so they are reviewed and versioned with the game.

## 10. Implementation phases

| Phase | Scope | Notes |
| --- | --- | --- |
| **0. Setup** | Create the GA4 property, decide on consent, rewrite the privacy policy, add the banner | Needs your decisions (section 11) |
| **1. Core + classic** ✅ | `js/analytics.js`, context params, virtual page views, app events, classic events, `app_version` stamped in `tools/prepare-pages.mjs` | Built October 15, 2026 |
| **2. Voyage** ✅ | Run, board, charm, ability, port and tutorial events. `run_id`, `board_key` and idempotency flags on the run (bump `RUN_VERSION` handling so old saves get an id) | The biggest piece. It touches `main.js` voyage handlers, `run.js` (ids) and `port.js` (spend deltas) |
| **3. Validation tooling** ✅ | `tools/analytics-check.mjs`: a headless run against a stand-in `/events` endpoint that plays classic games (built) and, with phase 2, a Voyage board clear and a port visit, then checks every event against the catalog (names, required params, the 25-param and 100-char limits, no duplicates on reload) | Same style as the existing `tools/*-check.mjs` scripts |
| **4. Accounts + monetization** | In freecell-accounts: sign-in events, `user_id`, creator funnel, MP `purchase`/`refund` from the Stripe webhook, a `ga_client_id` column on `purchase` | Lands together with Stripe Checkout |
| **5. Reporting** | GA4 key events, audiences and saved explorations. Dashboards live in the first-party admin panel | |

Phases 1 and 2 can ship before accounts exist. `logged_in` will be `false` until then.

## 11. Decisions

| Question | Decision (October 15, 2026) |
| --- | --- |
| Consent banner | Shown only in the EEA, UK and Switzerland. GDPR reaches analytics on people there even without targeting them, and EU card holders can buy tokens. The region-limited banner is cheap insurance. (This is a reading of the rules, not legal advice.) |
| GA4 measurement ID | Supplied later. The GA4 side stays inert until it's set |
| BigQuery | Not yet. Row-level analysis runs in the first-party store |
| Ad blockers | Build first-party analytics that mirrors every GA4 event, plus an admin panel: [first-party-analytics-plan.md](first-party-analytics-plan.md) |
| Detail events | Yes: section 5.6 |
