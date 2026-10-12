# Voyage bosses: build spec

Builds 8 boss challenges (Hand Carry was dropped: capacity-only limits just force card-by-card play — see `charms-design.md` §1) from `docs/voyage/boss-challenges.md` on top of the charm kernel (`docs/voyage/charms-design.md`, `docs/voyage/charms-build-log.md`). The placeholder `boss.narrows` is removed; Lockdown replaces it. A saved run whose boss id no longer exists simply has no boss (must not crash).

## 1. The bosses

All are `kind: 'boss'`, strength 7. Bosses use only existing kernel rule fields unless noted. "Tell" is the at-a-glance UI cue.

| id | Name | Icon | Tags | Tooltip | Rules | Tell | Agent |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `boss.lockdown` | Lockdown | 🔒 | CELLS | Two of your free cells are sealed. | `freeCells -= 2` (floor 1 via clamp) | sealed cell slots (cell count already shown) | B2 |
| `boss.thaw` | Thaw | 🧊 | CELLS | Three free cells start frozen and thaw at 6, 14 and 24 cards home. | `cellThaw` frozen 3 at [6,14,24], merged with any existing thaw (see `arctic.challenge`) | K1 frost/thaw visuals | B2 |
| `boss.decree` | Royal Decree | 👑 | CELLS | Jacks, Queens and Kings can't enter free cells. | `noCellRanks |= J,Q,K` | `mark(… 'crown')` on all 12 court cards (new style, B1) | B2 |
| `boss.throne` | Kings' Throne | 🪑 | COLUMN, MOVE | Empty columns accept only Kings, and don't help you move sequences. | `emptyMinRank = 13` (K1 already removes empties from capacity at ≥ 2) | K1 empty-rank glyph | B2 |
| `boss.barren` | Barren Suit | 🥀 | STACK | Nothing can be built onto {suit}. | `barren` = seeded suit (ctx.rng), all ranks; merge masks with any existing barren | `mark(… 'thorn')` on that suit's 13 cards (new style, B1); suit named in `text` (see §2.4) | B2 |
| `boss.lockstep` | Lockstep | ⛓️ | FOUND | No foundation may climb more than 3 above the lowest. | `foundationSpread` = min(existing or ∞, 3) | foundation ceiling band (new table visual, B1) | B2 |
| `boss.tombs` | Twin Tombs | ⚱️ | COLUMN | Two columns are sealed until emptied. | `sealedCols` 2 seeded non-adjacent, merged with existing | K1 seal visuals | B2 |
| `boss.fog` | Fog of War | 🌫️ | VIS | Cards more than 3 deep are face-down; press and hold a column to peek. | none (visibility). `dealShift: -0.5`. **Peeks are limited: 3 per board, +1 per emptied column (max 6)**; tooltip says so | mist + peek interaction | **B3** |

Ease: bosses set `ease` from the §2.5 calibration table (`docs/voyage/charms-design.md`) and B1's boss calibration (§2.1). `rules(r, ctx)` must *merge* with whatever the board already has (theme challenge and boons ran first), never overwrite.

## 2. Boss system (B1)

### 2.1 Budget and calibration
`tools/boss-calibrate.mjs` measures, for each boss alone and for each boss combined with each compatible theme challenge at s7 (tags don't clash), the verify yield over ~60 bank deals near the board-7 tier (short budget, run under ~15 min total; sample combos if needed). It writes `tools/boss-calibration.json` and a summary table in this doc (§5).

Rule: on the boss board, if boss + theme challenge exceed the budget, the theme challenge drops one strength step at a time, down to 4, until the pair fits. "Exceeds" means the yield is below ~35%, or the combined ease is worse than −4.6 tiers (3 CE × 1.54). Implement this as a lookup from the calibration JSON, with an ease-sum fallback for unmeasured pairs. The intro shows "Challenge eased for the finale" when this happens.

### 2.2 Draw
The boss draw from the run seed stays as-is (`createRun`), and the final-row theme ban on tag clashes stays too. Exclude bosses with `placeholder`. Same seed ⇒ same boss.

### 2.3 Pre-solving the boss board
Once the final row's nodes exist (they're generated two rows ahead), queue background verification for each final-row theme: the board-7 rules (theme challenge at its budgeted strength + boss, no boons, per K1's rule) over its bank candidates, at the existing duty cycle. The aim is that entering board 7 rarely waits. Cache keyed by `rulesKey`. `dealFor` uses a verified candidate from the cache when its blended score lands in band.

### 2.4 Content API additions (B1 implements; B2 and B3 use)
- `text` for bosses may be `text(strength, ctx)`, where `ctx = { seed }` gives the run seed. This lets Barren Suit name its suit before board 7. `charmView` / `runView` pass the run seed when they render a boss. Its rules hook must pick the same suit: `ctx.rng` in `rules` is `stream(seed,'rules',idx,id)` and idx varies. So bosses that need run-stable randomness use `bossRng(seed, id)`, a new `boardrules.js` export (`stream(seed,'boss',id)`), in both `text` and `rules`.
- New mark styles `crown` and `thorn` (`card.js`), with distinct shapes.
- `boonRelation(boonId, diff) → '+' | '~' | '!'`, an optional boss field. `diff` is the set of rule fields the boon changes (B1 computes it by applying `boon.rules` to `baseRules()` and comparing), plus `ability: bool` and `kind`. B1 provides a sensible default when a boss doesn't define it (`'~'`). Shown as a badge on reward offer cards, on map node boon lists and on the HUD tray once the boss is known, with a tooltip like "Weakened by Kings' Throne" / "Helps against Lockdown".

### 2.5 Finale
- **Finale stipend:** `VOYAGE.finaleUndos = 2`, granted when board 7 starts (once; not again on resume), with a toast.
- **Star normalisation on boss boards:** `SCORE.bossStarScale = 0.92` multiplies the 2★/3★ thresholds on the final board. The free-cell budget line also scales its per-card cost by `4 / max(1, freeCells)` when the board has fewer than 4 free cells, so Lockdown doesn't automatically cost a star.
- **Presentation:** a boss intro card shows before the board intro on board 7 (icon, name, tooltip, "watch for: …" naming the tell). The tell flashes for ~2 s when the board starts. The boss chip stays in the HUD (exists).
- **Lockstep ceiling band:** a subtle glowing line at min+3 across the foundation piles (`table.js`), updated after every move and undo.
- **Kings' Throne capacity readout:** a small "Move up to N" readout in the Voyage HUD whenever the board's capacity differs from classic.

## 3. Fog of War (B3)

`js/voyage/content/special/boss.fog.js`:

- `setup` conceals every card deeper than 3 from the top of its column (`api.conceal`). The kernel already auto-reveals a card once it's exposed.
- **Fog is dynamic.** After each move and undo, the top 3 cards of every column must be face-up, and anything deeper that was never seen stays concealed. Cards that have been seen stay seen; the doc's rule is about information, so re-hiding seen cards would only be annoying.
- **Peek:** press and hold on a column for ≥ 250 ms, and its concealed cards flip face-up while held; release flips them back. Peeking never counts as a move and never reveals permanently. For accessibility, a setting **Tap to peek** (stored with the other settings) turns it into a tap-to-toggle, with keyboard `P` + column digit as well.
- **Mist layer:** a soft mist over the concealed portion of each column, theme-neutral, cheap (one sprite or shader quad per column, no per-frame allocation).
- `dealShift: -0.75`, `tags: ['VIS']`. It must never coexist with a VIS theme challenge on the final row; the tag ban handles that.
- Interacts with Clearance (`deepstorage.clearance`): Clearance reveals everything at start; that's intended (its `boonRelation` is `'!'` for Fog: "nullified"; B3 sets `boonRelation` accordingly).
- Add `tools/charm-checks/boss.fog.mjs`, plus a browser check (hold-peek, tap-peek setting, resume, undo).

## 4. Ownership

| Agent | Model | Owns |
| --- | --- | --- |
| **B1 Boss system** | GPT‑6.1 Sol | `js/voyage/run.js`, `map.js`, `dealer.js`, `config.js`, `scoring.js`, `boardrules.js`, `ui.js`, `css/voyage.css`, `js/card.js` (mark styles), `js/table.js` (Lockstep band), the Voyage section of `js/main.js`, `tools/boss-calibrate.mjs`, removal of `boss.narrows` from `charms.js`, `sw.js` |
| **B2 Boss content** | Composer 2.5 | `js/voyage/content/bosses.js` (8 bosses), `tools/charm-checks/bosses.mjs` |
| **B3 Fog of War** | GPT‑6.1 Sol | `js/voyage/content/special/boss.fog.js`, `tools/charm-checks/boss.fog.mjs`; peek input + Tap to peek setting in `js/main.js` (input handlers only) / `js/ui.js` + `index.html` settings row; mist in `js/table.js` (a separate `fog` section of that file; coordinate with B1, re-read before editing) |

`js/voyage/content/index.js` already imports `./bosses.js` and `./special/boss.fog.js` (stubs). Everyone works in the same checkout. Re-read a shared file right before each edit, make small targeted edits, and never reformat. Never run `git checkout/stash/reset/clean` or commit. Append your summary and any cross-agent requests to `docs/voyage/charms-build-log.md` under "Bosses: B1/B2/B3".

Ports: B1 8160, B2 8161, B3 8162.

## 5. Calibration results

Measured 60 reproducible bank deals from tiers 5–7 per boss and per compatible s7 theme challenge; 40 ms/search, up to three 2,000-node restarts, full sequence generation. Lower-strength failing pairs use 16 of the same deals, stopping when the yield reaches 35% and ease is at least −4.6, or at strength 4. Identical solver rules reuse the same per-deal outcomes (8358 unique searches). Runtime: 317.3 s.

| Boss | Alone verify yield | Alone unknown | Compatible s7 pairs | s7 pair yield range | Pairs eased |
| --- | ---: | ---: | ---: | ---: | ---: |
| Lockdown | 6.7% | 86.7% | 29 | 0.0–6.7% | 29 |
| Thaw | 1.7% | 33.3% | 29 | 0.0–3.3% | 29 |
| Royal Decree | 3.3% | 96.7% | 29 | 0.0–10.0% | 29 |
| Kings' Throne | 15.0% | 85.0% | 35 | 0.0–16.7% | 35 |
| Barren Suit | 0.0% | 100.0% | 35 | 0.0–1.7% | 35 |
| Lockstep | 21.7% | 78.3% | 37 | 0.0–25.0% | 37 |
| Twin Tombs | 23.3% | 76.7% | 35 | 1.7–40.0% | 34 |
| Fog of War | 31.7% | 68.3% | 35 | 0.0–41.7% | 32 |

Unknown means budget/depth exhaustion and counts as failure to verify, separately from proven unsolvability. These are conservative short-budget supply measurements, not human difficulty ratings. A pair still below budget at strength 4 stays at that floor and the dealer must find a verified candidate; it never deals an unverified board. Unmeasured pairs use the ease-sum fallback. Boss ease remains the kernel calibration estimate from §2.5 of charms-design.md; cell loss is already modeled by bank ratings. Runtime verification retains the full 6-second search budget. Raw outcomes and lookup: tools/boss-calibration.json. Re-run: node tools/boss-calibrate.mjs (BOSS_CALIBRATE_DEALS / BOSS_CALIBRATE_MS / BOSS_CALIBRATE_LOWER override defaults).
