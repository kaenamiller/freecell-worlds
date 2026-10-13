# K2a — Voyage economy implementation report

Implemented the full K2a brief, §4.8 run-hook addendum, guaranteed Grand Port, and the optional
storm extension. Save format is `RUN_VERSION = 3`; prior run saves are discarded.

## Model and flow

- Board coins are `10 + 6 × stars + floor(score / 150) + sb.coinTotal`, followed by each held
  boon's `coins(n, ctx)` hook. Results retain all coin lines, including adjustments and the
  nonnegative floor; their sum equals `result.coins`. Storms then double the earned amount.
  A status guard prevents paying for the same board twice. `ScoreBreakdown.addCoins` is
  independent of point multipliers and exposes `coinLines`/`coinTotal` in JSON.
- Harbour flags derive from independent seed/node-id streams. Rows 1 and 3 guarantee one
  harbour per choice set; other ordinary siblings have at most one. The orchestrator's
  Grand Port addendum supersedes that rule on row 5: **all** board-six nodes dock. The finale
  never docks, even if its map metadata is erroneously marked as a harbour.
- Rewards open the port only after all required selections. With no unheld rewards, a cleared
  harbour docks directly. Leaving clears `run.port` and returns to the map. Continue resumes
  saved ports. A missing `showPort` implementation has a guarded fallback to the map.
- `port.js` is pure and has no DOM/storage dependencies. Seeded stock uses
  `stream(run.seed, 'port', boardIdx, reroll)`. Purchases validate status, stock, funds and
  targets, returning `true`/`false`; failed actions do not change the run. Provisions are
  capped at three purchases per visit; reroll changes only boon stock, once per visit.
  Sold stock and purchase limits survive JSON save/resume. `createPort` is idempotent for
  the current visit and fires docking hooks once.
- Standard boons cost 45, rare/ease ≥ .4 or ability boons 60, upgrades 40, provisions 15,
  normal sells 20, reroll 10; stickers follow config prices. Grand Port has four boon offers
  before extras and starts sell payouts at 75% of the base boon/rare price (rounded up after
  hooks: 34 or 45 without modifiers). Discounts do not reduce sell payouts.
- Levels and stickers are passed to composition and included in upcoming-plan identity.
  K1 supplied complete dealer keys and retained both through dealer relaxation. Confiscation
  is forwarded from composition/dealer into the current board and map previews.
- The hidden `voyage.stickers` pseudo-boon adds Wild/Fool/Key rules, all five sticker marks,
  Gold coin lines from replayed retained history, and Lucky grants from foundation events.
  Gold pays only with at least 13 other cards still in play and at most once per card per
  board; undo/return cannot farm it. Lucky remembers the first home per board across
  undo/reset/resume and uses K3's capped `addUndos`. Replacement changes the card's type.
- Statistics record coins earned/spent, port visits, stickers bought and upgrades. Saved
  per-run counters/watermarks make resume/repeated persistence idempotent. Run-level coin
  mutations from runtime hooks are reconciled; recent/daily summaries also retain economy
  totals. Reset no longer shares the mutable live stats object with its defaults.

## Content hooks

`runHookContext`/`heldBoonHooks` centralize held-boon dispatch with level, family, purse,
stickers, read-only run context and persistent `runMemo`. Run-level coin/undo grants bypass
board-time caps. Reward/shop boon purchases call `onPick(run, ctx)`; upgrades set level 2
before calling `onUpgrade(run, ctx)` once.

`onPort(run, ctx)` receives mutable `ctx.port.extraBoons`, `discount` (fraction) and
`freeReroll`. Pricing starts with the fractional discount, then invokes held `price` hooks,
rounding up/flooring at zero. Items are `{ kind, id?, type? }`, with kinds
`boon`, `sticker`, `upgrade`, `undo`, `reroll`, `sell`, and `service`. Sell hooks run while the
sold boon is still held. `coins`/`boardUndos` also receive `sb`, stars and scoring context.

`lookahead` clamps to 1–4 revealed/visible rows; `challengeStrength` clamps to 1–7 while
leaving boon and boss strength unchanged. `picks` clamps to 1–2 and available reward stock.
Two-pick combinations are included in background plans.

`portServices(ctx)` defines extra stalls. Service functions are re-derived from held charms,
never serialized. `needsCard` selects an integer card 1–52; `needsBoon` selects a held id;
other services can omit their argument. Application runs synchronously on a cloned run;
returning `false` discards payment and every trial mutation. Services use normal price hooks.

Storms use a seeded 1-in-6 chance on eligible rows 1–5, excluding harbours and the finale.
Their seeded secondary challenge has another theme and no overlapping tags. K1 added
`composeBoard({ extraChallenges: [id] })` and dealer support so both rules sets are verified
and relaxed together. Storms reveal three available reward boons irrespective of stars.

## Exact UI contract shipped

The authoritative contract is appended as the v2 section in `docs/voyage/ui-contract.md`.
K2b was notified of the base contract, §4.8, Grand Port and storm additions.

```js
// Existing view fields remain; these are the additions.
RunView = {
  coins,
  stickers: [{ card, type }], // numeric card, sorted by id
  port: PortView | null,     // non-null only in status 'port'
  confiscated: Charm | null,
  current: null | {
    /* existing fields */ undoGrants, undoCap, confiscated: Charm | null,
    storm, stormChallenge: Charm | null, extraChallenges: [Charm],
  },
  reward: null | { /* existing fields */ picks }, // remaining selections
}
Charm = {
  /* existing fields */ level, family, upgradeText, pressure, hidden,
}
Node = {
  /* existing fields */ port, storm, stormChallenge: Charm | null,
  confiscated: Charm | null, // final-row preview
}
BoardResult = {
  /* existing fields */ coins, coinLines: [{ key, label, coins }], storm,
  charm,   // first selection, for compatibility
  charms,  // all reward selections
}
PortView = {
  coins, grand,
  boons: [{ charm: Charm, price, sold }],
  stickers: [{ type, name, text, price, sold }],
  upgrades: [{ charm: Charm, price }],
  provisions: { price, left },
  sell: [{ charm: Charm, price }],
  reroll: { price, used },
  services: [{ id, label, text, price, needsCard, needsBoon }],
}
```

Charm `text` already reflects the held level; level is 1 or 2, family/upgrade text are nullable,
pressure/hidden are booleans. Hidden charms are excluded from tray/reward/map/shop boon lists.
`undoGrants` reads `current.memo._undoGrants`; `undoCap` reads config. `result.score` also has
its score-hook coin lines/total before the board formula. Reward offers shrink after each pick;
only the last selection transitions away from the result screen.

Handlers supplied to `voyageUI.init`:

```js
portBuyBoon(id)
portBuySticker(offerIdx, cardId) // zero-based offer; numeric card 1–52
portUpgrade(id)
portBuyUndo()
portSell(id)
portReroll()
portService(serviceId, arg)
portLeave()
```

Actions save statistics/run state and re-render `voyageUI.showPort(vyView())`. Leave saves and
shows the map. Reward picks that leave one selection re-render `showResult`. Continue opens
the saved port. The UI owns picker presentation/cancellation.

## Verification

- `node tools/economy-check.mjs` — passes: formulas/hook adjustments, 200 map seeds and all
  harbour/storm constraints, every shop action, insufficient funds/invalid targets, upgrade
  and sell hooks, restickering, reroll/provision limits, Grand Port, saved ports/services,
  rules/marks/sticker timing, gold-return and Lucky-undo protection, levels/dealer keys,
  lookahead/challenge-strength/two-pick hooks, statistics and full seven-board state flow.
  The full script uses a legally won one-move endgame fixture per board to isolate run flow
  from solver timing; real deal/rule verification is supplied by the shared kernel checks.
- `node tools/rules-check.mjs` — passes, including 40 rulesets and classic baseline.
- `node tools/charm-content-check.mjs` — passes, including the hidden pseudo-boon. It reports
  expected v2 migration warnings for the existing roster, which belongs to the content work.
- Browser on `http://[::1]:8142/` — passes reward → port, actual provision and boon buttons,
  reload/Continue preserving purse/stock/limits, Leave → map, and no page errors. The fixture
  won a real one-move endgame before saving its reward screen. Temporary harness:
  `/tmp/k2a-port-smoke.mjs`; screenshots `/tmp/k2a-port-open.png` and
  `/tmp/k2a-port-resumed.png` (visually inspected).
- `node --check js/main.js` and `git diff --check` — pass.

## Coordination / deferred

No K2a work is deferred. K1's composition/dealer integration and K3's hidden filtering,
sticker context, capped grants and separate mark channels are landed. The coexistence
regression covers a normal charm mark and sticker on one card. K2b owns visual rendering
and has implemented port, Grand Port, service/two-pick and secondary storm-challenge UI.
Roster metadata/upgrades and theme-specific uses of the new hooks remain the content wave's
work; the economy accepts and tests these hooks without inventing replacement content.

Only assigned economy files, the single sticker import, the appended contract section, and
surgical imports/Voyage flow functions in `main.js` were edited. No shared-file rewrite,
commit, checkout, stash, reset or cleanup was performed.
