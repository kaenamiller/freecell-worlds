# Final 52-theme roster — theme changes and charm assignments

Decided in the theme-review thread (thr_v35p87h3p2). This file is the build spec for wiring the final roster and its charms. Systems and kernel interfaces are in `SPEC.md`; the design rules at the top of `ROSTER.md` still apply (no flat pay, family + upgrade on every boon, seeded randomness, solver-visible rules or pressure only).

## Theme changes

**Retired (6):** Deep Space Station (`space`), Varsity Club (`varsity`), Daylight Express (`nighttrain`), Driftwood Bay (`driftwood`), Bannerkeep (`keep`), Canopy Station (`canopy`). Their art and audio stay in the repo; their theme definitions stay in code for old saves, but they leave `THEME_ORDER` (no picker, no Voyage stop). Record them in `docs/parked-themes.md`.

**Unchanged and staying:** Frontier Saloon (keeps all four charms and names), Camp Pinecone, Concrete Playground, Morning Ritual — and every other current theme.

**New (10):**

| Theme id | Name | Art folder (`assets-src/art/…`) | Final hero | Charms |
| --- | --- | --- | --- | --- |
| `signal` | Signal | `signal` | `hero.png` | renamed set from `space` |
| `rink` | Roller Rink | `rink` | `hero.png` | renamed set from `varsity` |
| `darkroom` | The Darkroom | `darkroom` | `hero.png` | renamed set from `driftwood` |
| `smokewatch` | Smoke Watch | `lookout` | `hero-smoke.png` | renamed set from `nighttrain` |
| `bloodmoon` | Bloodmoon | `castle` | `hero-distant.png` | renamed set from `keep` |
| `deepsea` | Deep Sea | `bathysphere` | `hero-deepsea.png` | renamed set from `canopy` (the unassigned pool) |
| `plaster` | Plaster Studio | `plaster` | `hero.png` (the reframed cast; `hero-wrapped.png` is the old one) | new set (below) |
| `backrooms` | Backrooms | `backrooms` | `hero.png` | new set |
| `vaporwave` | Vaporwave | `vaporwave` | `hero.png` | new set |
| `cinema` | Silent Cinema | `cinema` | `hero.png` | new set |

48 − 6 + 10 = **52**.

## Renamed sets (effects unchanged; new ids, names, icons and flavour text)

Charm ids become `<new theme>.<new key>`. Old ids disappear (no save compatibility needed beyond what `loadRun` already handles). Special modules move with them.

| Old id | New id | New name |
| --- | --- | --- |
| `space.holoscan` | `signal.lock` | Lock |
| `space.tractor` (special) | `signal.pull` | Pull |
| `space.mission` | `signal.operator` | Night Operator |
| `space.challenge` | `signal.challenge` | Static |
| `varsity.hattrick` | `rink.lutz` | Triple Lutz |
| `varsity.spirit` | `rink.couples` | Couples Skate |
| `varsity.playbook` | `rink.request` | Request |
| `varsity.challenge` | `rink.challenge` | Judged Routine |
| `driftwood.net` | `darkroom.sheet` | Spare Sheet |
| `driftwood.chandler` | `darkroom.closet` | Supply Closet |
| `driftwood.catch` | `darkroom.keeper` | The Keeper |
| `driftwood.challenge` | `darkroom.challenge` | In the Tray |
| `nighttrain.ontime` | `smokewatch.report` | Smoke Report |
| `nighttrain.coupling` | `smokewatch.sightline` | Sightline |
| `nighttrain.railpass` | `smokewatch.relief` | Relief Pack |
| `nighttrain.challenge` | `smokewatch.challenge` | Fire Weather |
| `keep.siegeengine` (special) | `bloodmoon.seal` | Broken Seal |
| `keep.banner` | `bloodmoon.crest` | The Crest |
| `keep.hearth` | `bloodmoon.candle` | The Last Candle |
| `keep.challenge` | `bloodmoon.challenge` | Uninvited |
| `canopy.zipline` (special) | `deepsea.current` | Current |
| `canopy.cameratrap` | `deepsea.sonar` | Sonar |
| `canopy.mistnet` | `deepsea.openwater` | Open Water |
| `canopy.challenge` | `deepsea.challenge` | Lamprey |

Rewrite each charm's one-sentence `text` / `upgrade` only where the old wording names the old theme's objects (e.g. "the station plays the best next move" → "the dish locks onto the best next move"); numbers and effects stay identical.

## New sets (16 charms)

New kernel fields (K1-style, solver-visible; full rigour as in SPEC §2 — generator/player agreement, undo, rulesKey, hasRestrictions, rules-check coverage, calibration ease):

| Field | Default | Kind | Meaning |
| --- | --- | --- | --- |
| `loneAccepts` | `0` | help | a column holding ≤ n cards (n ≥ 1) accepts **any** card or valid run on top of it, ignoring rank and colour (barren/seals still apply). The loosely placed card doesn't form a run with the card below. |
| `skipBuild` | `0` | help | 1: a card may also be placed on a card of the **same colour** exactly two ranks higher (7♥ on 9♦); 2: two ranks higher, any colour. Build-table entry, so runs may contain such pairs. |
| `fullCellsBonus` | `0` | help | while every active free cell is occupied, sequence-move capacity gains +n. |
| `emptyCure` | `0` (off) | restrict | while cards-home < n, empty columns accept nothing and don't count for move capacity. |
| `cellsNeedEmpty` | `0` (off) | restrict | while no tableau column is empty, the last k active free cells are shut (accept nothing; a card already inside may still leave). |
| `sameColorRanks` | `0` | restrict | rank mask: a card of these ranks may only be placed on a card of its **own** colour (one rank higher). Wild ranks/cards and suit-build still apply as help. |
| `noExitCols` | `0` | restrict | column mask: in these columns, a card that is the only card left in its column can only leave to its foundation (so those columns can't be emptied except by sending the last card home). |

New runtime primitives:
- `api.concedeBoard()` — ends the current board as a cleared board with 1★, 0 coins from the board formula, `result.conceded = true`, a single boon offer, and the normal post-board flow (port if harbour). Used by Exit Sign and Cliffhanger.
- `api.spendCoins(n): boolean` — spends run coins immediately (board-time; not refundable by undo). Used by Wishing Fountain.
- Run hook `offerPool(offers, ctx) → offers` — may replace entries in the theme's offer list before stars cut it (Shuffle Play).

### Plaster Studio (`plaster`)
| key | Name | Fam | Level 1 | Level 2 | Impl |
| --- | --- | --- | --- | --- | --- |
| armature | Armature 🗿 | columns | A column holding a single card accepts any card on top of it. | Columns holding one or two cards. | `loneAccepts` 1/2 |
| mould | Plaster Mould 🫙 | wild | Once per board, cast a mould: choose a rank, and cards of that rank are wild for the rest of the board. | Twice per board. | ability → pick a card (its rank) → `X` move OR-ing `rules.wildRanks` (undo restores); mark the four cards |
| commission | Commission 🖼️ | coin | At each port, you may commission a rank for 10 coins: on your next board, each card of that rank sent home before 26 cards are home pays 4 coins. | 6 coins each. | `portServices` (needsCard → its rank) + `runMemo`; `score` → `sb.addCoins` |
| challenge | Wet Plaster 🪣 | — | Empty columns can't be used until 4 + 2s cards are home. | | `emptyCure`; tags COLUMN |

### Backrooms (`backrooms`)
| key | Name | Fam | Level 1 | Level 2 | Impl |
| --- | --- | --- | --- | --- | --- |
| hum | Fluorescent Hum 💡 | cells | While all your free cells are full, you can move 2 more cards at once. | 3 more. | `fullCellsBonus` |
| noclip | Noclip 🚪 | ability | Once per board, a face-up buried card slips through the wall onto any column top where it fits. | Twice per board. | pick a face-up non-top card → pick a column whose top accepts it (normal rank/colour rules) → `X` move |
| exitsign | Exit Sign 🟩 | fortune | Once per run, before your first move, step out: the board counts as a 1★ clear. | Twice per run. | ability `when: 'start'`, `runMemo` count → `api.concedeBoard()`; not on the final board |
| challenge | No Exit 🔁 | — | The last card in 2 (s1–2), 4 (s3–4) or all 8 (s5–7) columns can only leave to its foundation. | | `noExitCols` (seeded); tags COLUMN |

### Vaporwave (`vaporwave`)
| key | Name | Fam | Level 1 | Level 2 | Impl |
| --- | --- | --- | --- | --- | --- |
| checkerboard | Checkerboard Floor 🏁 | wild | A card may also be placed on a card of the same colour two ranks higher. | …two ranks higher, any colour. | `skipBuild` 1/2 |
| fountain | Wishing Fountain ⛲ | coin | Before your first move, toss 5 coins in the fountain: a random rank is wild for this board. | Two ranks for the same 5 coins. | ability `when: 'start'`, `api.spendCoins(5)` → `X` move OR-ing `wildRanks` (seeded rank 3–Q); marks |
| shuffle | Shuffle Play 📼 | fortune | After each board, one of the offered charms comes from a random other theme. | Two of them. | `offerPool` hook (seeded; never a held or hidden boon) |
| challenge | After Hours 🛍️ | — | While no column is empty, your last free cell (s1–3) or last two (s4–7) are shuttered. | | `cellsNeedEmpty`; tags CELLS |

### Silent Cinema (`cinema`)
| key | Name | Fam | Level 1 | Level 2 | Impl |
| --- | --- | --- | --- | --- | --- |
| exposure | Double Exposure 🎞️ | wild | Once per board, pick a face-up card: it ignores colour for the rest of the board. | Twice per board. | pick card → `X` move pushing `rules.wildCards` (undo pops); mark `wild` |
| projectionist | Projectionist 📽️ | ability | When one of your abilities runs out of uses, it recharges once when 26 cards are home. | …at 20 cards home. | `on.foundation` + `api.abilityUses()` + `api.grantUse` (once per charm per board) |
| cliffhanger | Cliffhanger 🎬 | fortune | Once per run, when you'd be stuck with no undos, the board ends as a 1★ clear instead of ending your voyage. | Twice per run. | `on.stuck` → `api.concedeBoard()` (`runMemo` count); never on the final board (the finale still ends the run) |
| challenge | Typecast 🎭 | — | Queens (s1–2), Queens and Jacks (s3–4), Queens, Jacks and 10s (s5–6) or 9s through Queens (s7) may only be placed on a card of their own colour. | | `sameColorRanks`; tags STACK |

## Art still needed

- Theme assets for the 10 new themes: `assets/art/<id>/{backdrop,back,board,court_j,court_q,court_k,env,hero,thumb}.webp` from the masters (pick the final hero above), via `tools/optimize-assets.sh`.
- Music (`assets/music/<id>.mp3`) and SFX (`assets/sfx/<id>_{ambience,chime,ui,win}.mp3`) for the 10 new themes (ElevenLabs via `tools/gen-sfx.mjs`; add entries to `tools/sfx-manifest.mjs`).
- Sea-chart islands for the 10 new themes (`assets/art/chart/islands/<id>.webp`, same style as the existing 48; `tools/gen-chart-art.mjs`).
- Charm icons for the 16 new charms and for renamed charms whose old object no longer fits the new name (`tools/charm-icon-subjects.mjs` + `tools/gen-charm-icons.mjs --ids=`).
