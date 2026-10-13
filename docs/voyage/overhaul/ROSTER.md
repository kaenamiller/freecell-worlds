# Voyage roster v2 — 48 themes × (3 boons + 1 challenge) + bosses

Status: build spec for the content wave. Systems and kernel interfaces are in `SPEC.md` (same folder). Reports from the kernel agents (`K1-report.md`, `K2a-report.md`, `K3-report.md`) are authoritative on exact field/API semantics; if this roster and a report disagree on an interface detail, follow the report and note it.

## Design rules for this pass

1. **No flat pay.** A board only scores when won, and a win sends all 52 cards home. Any condition a win satisfies automatically ("per heart sent home", "first King home", "first 7 home", "first chain of 8+") is banned. Coin/undo conditions must be things the player plans for and can miss: *before N cards are home*, *within N moves*, *before move N*, *under par*, *3★*, *while another suit is below X*, etc. "Before 40 cards are home" excludes the endgame sweep.
2. **Each trio is a real choice.** Most themes offer one ongoing rule bend, one once-per-board decision, and one economy/synergy charm. Pure points are gone: points still decide stars, but the economy charms pay **coins** (`sb.addCoins(key, label, n)`, computed from history) or act at **ports**.
3. **Families and upgrades.** Every boon has a `family` and an `upgrade` (level-2 text; behaviour reads `ctx.level`). Keep L2 a meaningful step, not +1 point.
4. **Undo grants** from charms are capped at 3 per board by the runtime (except `on.stuck`). Write grants normally; the cap applies itself.
5. **Ease.** Use K1's measured numbers (K1-report) where a primitive was calibrated; otherwise the guidance in `charms-design.md` §1. Coin/undo/score charms: ease 0. Abilities: +0.15 (info) to +0.4 (strong rule break).
6. **Text.** One sentence, plain, numbers stated. For challenges `text(s)` states the numbers at that strength. Curses (`pressure: true`) can't change winnability.
7. **Marks.** Charms that single out cards keep using `ctx.api.mark(ids, style)`.

Legend: **K** keep (only add `family`/`upgrade`, fix text), **R** rework (same id/key, new effect), **N** new id (old one removed). **S** simple (theme file `js/voyage/content/<theme>.js`), **C** complex (own module `js/voyage/content/special/<id>.js`).

Removed outright (D-tier / anti-play): `deco.highroller` (High Roller), `risograph.misprint` (wild 2s), `arctic.heatlamp` (frozen cell, negative ease), `pinecone.badge` (paid you to avoid free cells), `forge.temper` (doubled free-cell cost). Their slots are reused below with new effects (same key where the theme name still fits).

---

## Themes

### Neo-Classical (`roman`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| legion | Legion 🛡️ | wild | Tens are wild: they ignore colour when stacking. | Tens and Nines are wild. | `wildRanks` | K S |
| colonnade | Colonnade 🏛️ | columns | Empty columns triple, rather than double, how many cards you can move at once. | Empty columns quadruple it. | `emptyFactor` 3/4 | K S |
| laurel | Laurel Crown 🌿 | coin | The first suit you complete each board pays 1 coin for every 2 cards still in play at that moment. | 1 coin for every card still in play. | `replay` → home count when the 1st King lands | R S |
| challenge | Senate Decree 📜 | — | (unchanged) | | `noCellRanks` | K S |

### Neon Grime (`cyber`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| overclock | Overclock ⚡ | columns | You can move 2 more cards at once. | 3 more. | `moveBonus` | K S |
| ghost | Ghost Cell 👻 | cells | (unchanged) | Twice per board. | existing module | K C |
| cache → **zeroday** | Zero-Day 🔓 | ability | Once per board, your next placement ignores every challenge and boss restriction (rank and colour still apply). | Twice per board. | `api.override({ ignoreRestrictions: true })` | N C |
| challenge | Packet Loss 📶 | — | (unchanged; `pressure: true`) | | | K S |

### Ocean Aero (`aero`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| pocket | Air Pocket 🫧 | cells | One extra free cell. | One extra free cell and +1 move capacity. | `freeCells`, `moveBonus` | K S |
| dolphin | Dolphin Leap 🐬 | foundation | Once per board, a face-up buried card leaps straight home if its foundation will take it. | Twice per board. | pick card → custom move to foundation (counts as an `F`-like home for chains? **No**: record as `X`; scoring helpers count it as home via `stat.cards`) | R C |
| lounge | Lagoon Lounge 🍹 | undo | Once per board, open the lounge: undo as many moves as you like for free until you play forward again. | Twice per board. | `api.openUndoWindow()` | R S |
| challenge | Riptide 🌀 | — | (unchanged) | | | K S |

### Zen Garden (`zen`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| stillness | Stillness 🪷 | cells | Any card may enter any open free cell, whatever the challenge or boss says. | …and one extra free cell. | `freeCards` = all 52 | R S |
| calm | Calm Waters 🎐 | fortune | Every board is dealt half a tier gentler. | A full tier gentler. | `dealShift` | K S |
| mindful → **koan** | Koan 🍵 | vision | Once per board, see the solver's next three moves; you play them yourself. | Twice per board, five moves each. | `api.preview(n)` | N S |
| challenge | Raked Sand 〰️ | — | (unchanged; `pressure: true`) | | | K S |

### Enchanted Forest (`forest`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| changeling | Changeling 🧚 | wild | Jacks are wild. | Jacks and Queens are wild. | `wildRanks` | K S |
| fireflies | Firefly Jar ✨ | coin | 4 buried cards glow; each one you send home before 26 cards are home pays 3 coins. | 6 glowing cards, 4 coins each. | setup marks; `replay` home count | R S |
| moss | Mossy Bed 🌱 | suit | Clubs may also be built down in suit. | Clubs and Spades. | `suitBuild` | K S |
| challenge | Bramble 🌿 | — | (unchanged) | | | K S |

### Art Deco (`deco`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| champagne | Champagne Tower 🥂 | coin | While your boons span 4 or more families, every board's coin payout is +25%. | 3 families, +40%. | `coins(n, ctx)` hook with `ctx.family` / boons | R S |
| highroller → **velvet** | Velvet Rope 🪩 | cells | One extra free cell that only takes Jacks, Queens and Kings. | …takes cards ranked 8 and up. | `freeCells += 1`, `cellLimits[old count] = { minRank }` | N S |
| gilded | Gilded Age 🎺 | sticker | When you take this, a random Jack, Queen or King gets a Gold sticker; your Gold-stickered cards are also wild. | …and Gold stickers pay double. | `onPick` (`run.stickers`), `rules` (wildCards from `ctx.stickers`), `coins` hook | R S |
| challenge | Dress Code 🎩 | — | (unchanged) | | | K S |

### Día de Muertos (`muertos`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| marigold | Marigold Path 🌼 | suit | Hearts may also be built down in suit. | Hearts and Diamonds. | `suitBuild` | K S |
| ofrenda | Ofrenda 🕯️ | undo | At each port, gain 2 coins for every undo you hold (up to 16). | 3 coins per undo (up to 24). | `onPort` | R S |
| skull | Sugar Skull 💀 | undo | (unchanged) | Twice per run. | `on.stuck` | K S |
| challenge | Veil of Marigolds 🎭 | — | (unchanged; `pressure: true`) | | | K S |

### Deep Space Station (`space`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| holoscan | Holo-Scan 🔭 | vision | Twice per board, the station plays the best next move for you. | Three times per board. | `api.hint()` (now works) | K S |
| tractor | Tractor Beam 🛸 | ability | (unchanged) | Twice per board. | existing module | K C |
| mission | Mission Control 🛰️ | ability | (unchanged) | +2 ability uses instead of +1. | `abilityBonus` | K S |
| challenge | Magnetic Storm 🧲 | — | (unchanged) | | | K S |

### Azulejo (`azulejo`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| tessellate | Tessellation 🔷 | coin | +2 coins each time you send home a card of the same rank as the card sent home just before it. | +4 coins. | `foundationSequence` | R S |
| fountain → **glaze** | Glaze 🖌️ | wild | Once per board, repaint a card: it counts one rank higher or lower for stacking for the rest of the board. | Twice per board. | pick card → choose ±1 (second pick or a two-button prompt via `api.pick` on two virtual targets; simplest: two abilities is not allowed — use `pick({kind:'card'})` then `pick` of a target card to decide direction, or a toast-choice; see K3 report) → `X` move mutating `rules.rankShift` | N C |
| kiln | Kiln 🔥 | undo | +1 undo when 26 and when 39 cards are home. | At 13, 26 and 39. | `on.foundation` thresholds | K S |
| challenge | Cracked Tiles 🧱 | — | 1 + s random cards are cracked: nothing can be placed onto them. | | `barrenCards` (seeded), `mark('crack')`; tags STACK; rule | R S |

### Jet Set (`jetset`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| overhead → **priority** | Priority Boarding 🧳 | fortune | Ports stock one extra boon, and your first reroll each visit is free. | Two extra boons, and every reroll is free. | `onPort` / `ctx.port` / `price` | N S |
| firstclass | First Class 💺 | cells | One extra free cell, but you gain 1 fewer undo after each board. | …no undo penalty after a 3★ board. | `freeCells`, `boardUndos` | R S |
| flyer | Frequent Flyer ✈️ | coin | +3 coins for each board cleared at or under par (+6 if also 3★). | +5 / +10. | `score` → `sb.addCoins` | R S |
| challenge | Layover ⏳ | — | (unchanged; `pressure: true`) | | | K S |

### Riverboat Royale (`riverboat`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| sleeve | Ace in the Sleeve 🂡 | foundation | Aces start on the foundations. | Aces and Twos start home. | `startHome` | K S |
| dealer → **longshot** | Long Shot 🎲 | fortune | Before your first move each board, you may stake up to 2 undos: finish with 3★ to get them back plus 12 coins each; otherwise they're gone. | Stake up to 3, 18 coins each. | `ability` (`when: 'start'`), `spendUndos`, `on.win` → `addUndos` (exempt from cap: `undoCapExempt`), coins via `sb.addCoins` from `memo.stake` | N S |
| edge → **markeddeck** | Marked Deck 🃏 | sticker | At each port, put a free Wild sticker on a card of your choice. | …or a free Fool sticker. | `portServices` (price 0, once per visit, `needsCard`) | N S |
| challenge | Ante 🪙 | — | Pay 2 + s coins at the start; each chain of 5+ cards home before 40 are home wins back 3 (twice at most). | | `sb.addCoins` from history; `pressure: true` | R S |

### Coastal Carvings (`carvings`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| raven | Raven's Trick 🐦‍⬛ | ability | (unchanged) | Twice per board. | existing module | K C |
| orca | Orca Pod 🐋 | undo | +1 undo each time you empty a column before 30 cards are home (twice per board). | Three times per board. | `on.columnEmpty` + home count | R S |
| totem | Totem Pole 🪵 | columns | Once per board, turn a column upside down: its deepest card comes to the top. | Twice per board. | pick column → `X` move reversing that column (face-up cards only; a concealed card in it is revealed) | R C |
| challenge | Longhouse Beams 🏠 | — | (unchanged) | | | K S |

### Varsity Club (`varsity`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| hattrick | Hat Trick 🏅 | coin | Three 3★ boards in a row pay 25 coins (then the streak restarts). | Two in a row pay 15. | `on.win` → `api.addCoins` (run-level) | R S |
| spirit | Team Spirit 📣 | fortune | Hold boons from 4 different families: +1 free cell. From 6 families: +1 move capacity too. | Thresholds 3 and 5. | `rules` with `ctx.boons` families | R S |
| comeback → **playbook** | Playbook 📋 | ability | Each time you use an ability, gain 1 undo (twice per board). | Three times per board. | `on.ability` → `addUndos` | N S |
| challenge | Rivalry 🏈 | — | (unchanged; `pressure: true`) | | | K S |

### Driftwood Bay (`driftwood`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| net | Spare Net 🪢 | undo | +4 undos now. | +3 more when upgraded. | `onPick`, `onUpgrade` | K S |
| breeze → **chandler** | Ship's Chandler ⚓ | coin | Port prices are 20% lower. | 35% lower, and selling a boon pays 30 coins. | `price` hook | N S |
| catch | Catch of the Day 🐟 | coin | Each board names a suit; send its King home before any other King to win 12 coins. | 20 coins. | setup rng suit → `badge`; `foundationSequence` | R S |
| challenge | Fog Bank 🌫️ | — | (unchanged; `pressure: true`) | | | K S |

### Camp Pinecone (`pinecone`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| badge → **bounty** | Merit Badge 🎖️ | coin | Each board posts a bounty; complete it for 12 coins. | Two bounties each board. | setup rng picks from: *empty two columns before 20 cards are home* · *complete a suit before 20 cards are home* · *three chains of 4+ before 40 are home* · *finish at or under par* · *send an Ace home from a free cell* · *never fill your last free cell*; `badge` shows it; `score` checks via `replay`; `sb.addCoins` | N S |
| compass → **trailhead** | Trailhead 🧭 | undo | Once per board, put every card back where it was dealt, without spending an undo. | Twice per board. | `api.resetBoard()` | N S |
| campfire | Campfire 🏕️ | undo | At the start of each board, +1 undo if you hold fewer than 3. | +2 if you hold fewer than 3. | `on.start` | K S |
| challenge | Leave No Trace 🍂 | — | After your (10 − s)th free-cell placement, each one costs 2 coins. | | `sb.addCoins` negative; `pressure: true` | R S |

### Winterglass (`winterglass`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| prism | Prism 💎 | wild | Queens are wild. | Queens and Kings are wild. | `wildRanks` | K S |
| snowdrift | Snowdrift ❄️ | columns | Empty columns always multiply your move capacity, even when a challenge limits what they accept. | …and empty columns triple it. | `emptyAlwaysCounts`, `emptyFactor` | R S |
| globe → **icicle** | Icicle 🧊 | ability | Once per board, your next drop may land on a card two ranks higher (colour rule still applies). | Twice per board. | `api.override({ rankGap: 2 })` | N C |
| challenge | Frost Pattern ❄️ | — | Empty columns only accept sequences headed by a set colour: 2 columns (s1–2), 4 (s3–4), all 8 (s5–7), alternating red/black. | | `emptyColors`; tags COLUMN; rule | R S |

### Concrete Playground (`concrete`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| bankshot | Bank Shot 🏀 | coin | +1 coin for every card sent home straight from a free cell. | +2 coins. | history `F` with `src.kind === 'free'` | R S |
| mixtape | Mixtape 📼 | ability | The first time each board you empty a column, your most recently used ability gets its use back. | The first two times. | `on.columnEmpty` + `on.ability` memo → `api.grantUse(id)` | R S |
| spraytag | Spray Tag 🎨 | ability | Once per board, your next drop ignores colour and how many cards you can move. | Twice per board. | `override({ ignoreColour, ignoreCap })` (existing module, edit) | R C |
| challenge | Shot Clock ⏱️ | — | (unchanged; `pressure: true`) | | | K S |

### Midnight Library (`library`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| lending | Lending Desk 📚 | foundation | (unchanged) | …and +1 move capacity. | `foundationReturn`, `moveBonus` | K S |
| bookmark | Bookmark 🔖 | undo | (unchanged) | Twice per board. | existing module | K C |
| quiet | Quiet Study 🤫 | coin | Clear a board without using an undo: +8 coins (+15 on boards 5–7). | +12 / +22. | `score` from `sb.undosUsed` | R S |
| challenge | Overdue ⏰ | — | (unchanged; `pressure: true`) | | | K S |

### Glasshouse Conservatory (`conservatory`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| graft | Grafting 🌿 | wild | The rank below each of your wild ranks is also wild. | …and the rank above. | `rulesAfter` reads `r.wildRanks` | R S |
| mist | Misting System 💧 | cells | Your first free-cell placements each board grant +1 undo each, one per cells-family boon you hold (this one included). | +1 to that count. | `on.freecell` + `ctx.family('cells')` | R S |
| seedbank | Seed Bank 🌰 | coin | Each 3★ board plants a seed; at every port, each seed pays 3 coins. | 5 coins per seed. | `onPort` from `run.results` | R S |
| challenge | Root Bound 🪴 | — | (unchanged) | | | K S |

### Daylight Express (`nighttrain`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| ontime | On Time 🕰️ | coin | Finish a board in under 6 minutes: +10 coins. | Under 8 minutes. | `sb.elapsed` | R S |
| coupling | Express Coupling 🔗 | columns | You can move 1 more card at once for each columns-family boon you hold (this one included). | 2 more per boon. | `rules` + `ctx.family('columns')` | R S |
| railpass | Rail Pass 🎫 | fortune | (unchanged) | …and ports stock one extra boon. | `offers`, `onPort` | K S |
| challenge | Timetable 🚉 | — | Every 5 moves over par cost 1 + ⌈s/2⌉ coins. | | `sb.addCoins`; `pressure: true` | R S |

### Saffron Court (`saffron`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| spice | Spice Blend 🌶️ | coin | +3 coins each time all four foundations reach the same rank below Queen. | +5 coins. | `replay` | R S |
| silkroad | Silk Road 🐫 | cells | (unchanged) | Boards 3–7. | `rules` uses `ctx.idx` | K S |
| loom | Loom 🧵 | columns | Once per board, move the top cards of a column, in order, onto an empty column, even if they aren't a valid run. | Twice per board. | pick column + depth (pick card) + pick empty column → `X` move | R C |
| challenge | Warp and Weft 🧶 | — | Red and black cards home must stay within max(2, 9 − s) of each other. | | `colorSpread`; tags FOUND; rule | R S |

### Amber Harvest (`harvest`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| cellar | Root Cellar 🥔 | ability | Ability uses you didn't spend when a board ends become +1 undo each (up to 2). | Up to 3. | `on.win` reads ability state (K3 report) → `addUndos` | R S |
| hayride | Hayride 🚜 | fortune | (unchanged) | The next 3 boards. | `dealShift` + `runMemo` | K S |
| gleaning | Gleaning 🌾 | coin | +4 coins for every Ace you send home within your first 10 moves. | +6, and Twos count too. | `replay` | R S |
| challenge | Windfall Tax 🍏 | — | (unchanged; `pressure: true`) | | | K S |

### Carnival Nocturne (`carnival`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| wheel | Prize Wheel 🎡 | coin | Each board spins a coin multiplier from ×1 to ×2 for that board's payout. | ×1.5 to ×2.5. | setup rng → `badge`; `coins(n, ctx)` | R S |
| ringmaster | Ringmaster 🎪 | wild | Nines are wild. | Nines and Eights. | `wildRanks` | K S |
| ticket → **fool** | The Fool 🃏 | wild | Each board, one random card is the Fool: anything may be placed on it. | Two Fools. | `rules` rng → `anchorCards`; setup `mark('wild')` (or a fool style if K2b adds one) | N S |
| challenge | Rigged Booth 🎯 | — | (unchanged) | | | K S |

### Canyon Turquoise (`canyon`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| turquoise | Turquoise Inlay 💠 | sticker | When you take this, all four cards of a random rank from 4 to 9 get Wild stickers. | When upgraded, another rank gets them too. | `onPick` / `onUpgrade` → `run.stickers` | R S |
| bloom | Desert Bloom 🌵 | undo | +2 undos when you clear a board at or under par. | +3. | `on.win` | R S |
| echo | Echo Canyon 🔊 | undo | (unchanged) | …undoing a move out of a free cell is refunded too. | `on.undo` | K S |
| challenge | Two-Tone Strata 🏜️ | — | (unchanged) | | | K S |

### Low Tide (`lowtide`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| tidepool | Tide Pool 🦀 | ability | (unchanged) | Twice per board. | existing module | K C |
| ebb → **rockpool** | Rock Pool 🪸 | cells | One extra free cell that only takes cards ranked 5 or lower. | Ranked 7 or lower. | `freeCells`, `cellLimits { maxRank }` | N S |
| starfish | Starfish ⭐ | coin | +3 coins for each chain of 5+ cards home before 40 cards are home. | +5. | `replay` + chains | R S |
| challenge | Barnacles 🐚 | — | (unchanged) | | | K S |

### Between Shows (`theater`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| understudy | Understudy 🎭 | ability | (unchanged) | Twice per board. | existing module | K C |
| curtain | Curtain Call 🎬 | ability | The first ability you use each board doesn't spend its use. | The first two. | `on.ability` → `grantUse(id)` | R S |
| encore | Encore 👏 | fortune | After a 3★ board, the next table's challenge is one strength lower. | Two lower. | `challengeStrength` hook | R S |
| challenge | Stage Directions 📜 | — | (unchanged; `pressure: true`) | | | K S |

### Obsidian Forge (`forge`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| anvil | Anvil ⚒️ | suit | Spades may also be built down in suit. | …and runs of Spades move as one piece. | `suitBuild`, `suitRunFree` | K S |
| temper → **bellows** | Bellows 🔥 | cells | Frozen cells thaw 10 cards sooner, and closing cells close 10 cards later. | 20 cards. | `rulesAfter` adjusts `cellThaw.at` / `cellClose.at` (help only: never later thaw / sooner close) | N S |
| ingot | Ingot 🧱 | coin | Each King sent home while another suit is still below 7 pays 2 coins. | 3 coins. | `replay` | R S |
| challenge | Hot Iron 🌡️ | — | (unchanged; `pressure: true`) | | | K S |

### Frontier Saloon (`saloon`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| seven → **quickdraw** | Quick Draw 🔫 | ability | Once per board, swap a free-cell card with the top card of any column. | Twice per board. | pick freecell + pick column → `X` move (may create an illegal pair, dealt-pile semantics) | N C |
| wanted | Wanted Poster 📜 | coin | Each board one buried card is wanted: bring it home within 8 moves of uncovering it for 15 coins. | 25 coins. | setup mark; `replay` tracks exposure | R S |
| tab | Run a Tab 🍺 | undo | (unchanged) | Upgrading cancels what's left of the tab. | `onUpgrade` | K S |
| challenge | Jailhouse 🔒 | — | (unchanged) | | | K S |

### Pharaoh's Tomb (`lapis`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| ankh | Ankh ☥ | undo | +1 undo each time you complete a suit while 13 or more cards are still in play (twice per board). | Three times. | `on.foundation` + home count | R S |
| canopic | Canopic Jars 🏺 | cells | Cards leaving a free cell for a column ignore colour. | …and +1 move capacity. | `cellExitWild` | R S |
| horus | Eye of Horus 👁️ | vision | (unchanged; hint now works) | Uncovers up to 6. | | K S |
| challenge | Sealed Tombs ⚱️ | — | (unchanged) | | | K S |

### Canopy Station (`canopy`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| zipline | Zip Line 🪢 | ability | (unchanged) | Twice per board. | existing module | K C |
| cameratrap | Camera Trap 📷 | vision | Once per board, check whether this position can still be won. | Twice per board. | `api.solvable()` → notify | R S |
| mistnet | Mist Net 🕸️ | columns | A column holding a single card still counts as empty for move capacity. | Up to two cards. | `shallowCols` | R S |
| challenge | Leeches 🪱 | — | Each undo you spend costs ⌈s/2⌉ coins. | | `sb.undosUsed` → `sb.addCoins`; `pressure: true` | R S |

### Cherry Counter (`diner`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| blueplate | Blue Plate Special 🍽️ | coin | Each board features a rank; send all four of it home before 30 cards are home for 12 coins. | 20 coins. | `replay` | R S |
| coffee | Bottomless Coffee ☕ | undo | (unchanged) | +2 at the start of every board. | `on.start` | K S |
| tipjar | Tip Jar 🫙 | coin | At every port, +2 coins for each board cleared so far. | +3. | `onPort` | R S |
| challenge | Plate Stack 🍽️ | — | Free cells stack like plates: only the last card in can come out — 2 cells (s1–2), 3 (s3–5), all 4 (s6–7). | | `cellStack`; tags CELLS; rule | R S |

### Treasure Cove (`cove`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| treasure | Buried Treasure 💰 | coin | The deepest card of one column is treasure: 15 coins if it goes home before 30 cards are home. | Two treasures. | setup mark; `replay` | R S |
| keg | Lucky Doubloon 🪙 | undo | (unchanged) | Twice per board. | | K S |
| parrot | Parrot 🦜 | ability | Once per board, repeat yourself: your most recently used ability gets one more use. | Twice per board. | `ability` → `grantUse(lastId)` (memo from `on.ability`) | R S |
| challenge | Cursed Gold 🪙 | — | 1 + s cursed cards; each time one enters a free cell, lose 2 coins. | | `sb.addCoins`; `pressure: true` | R S |

### Bannerkeep (`keep`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| siegeengine | Siege Engine 🪨 | ability | Once per board, break an obstacle: unseal a column, thaw or reopen a cell, unpin a card, or uncover a face-down column; with none, refund an undo. | Twice per board. | existing module + `cellClose`/`pinned` | R C |
| banner | Banner 🚩 | fortune | (unchanged) | Always offered 3. | `offers` | K S |
| hearth | Hearth 🔥 | undo | (unchanged) | +2 on board 4, +3 on the finale. | `on.start` | K S |
| challenge | Siege 🏹 | — | (unchanged) | | | K S |

### Hangar 18 (`deepstorage`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| clearance | Clearance 🪪 | vision | (unchanged) | …and +1 undo on every board. | | K S |
| redundancy → **redaction** | Redaction ⬛ | wild | Once per board, choose a face-up card: for the rest of the board, anything may be placed on it. | Twice per board. | pick card → `X` move pushing into `rules.anchorCards` (undo pops) | N C |
| archive | Archive 🗄️ | sticker | At each port, the first sticker you buy is free. | The first two. | `price` hook (+ per-visit memo) | R S |
| challenge | Redacted ⬛ | — | (unchanged; `pressure: true`) | | | K S |

### Morning Ritual (`cafe`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| espresso | Espresso Shot 🫘 | undo | Your first undo each board doesn't spend an undo. | Your first two. | `on.undo` refund (ignore `ev.free` / `ev.reset`) | R S |
| regulars | Regulars 🪑 | coin | +2 coins for each consecutive 2★+ board right before this one (up to +10). | +3 (up to +15). | `run.results` | R S |
| pastry | Pastry Case 🥐 | coin | +1 coin for each Ace, 2 and 3 sent home within your first 30 moves. | +2. | `replay` | R S |
| challenge | Last Orders 🔔 | — | (unchanged; `pressure: true`) | | | K S |

### Arctic Station (`arctic`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| aurora | Aurora 🌌 | foundation | Once per board, send a free card home as the base of a fifth foundation and finish its suit on two piles. | Twice per board. | Suit Spur (K1 kernel) | R C |
| heatlamp | Heat Lamp 💡 | cells | The first time you empty a column each board, an extra free cell switches on. | …the first time 8 cards are home, too (second cell). | `on.columnEmpty` → `api.setFreeCells(n + 1)` (undoable X move) | R C |
| sled | Sled Team 🛷 | undo | +1 undo each time a foundation reaches 7 while another is still below 3 (up to 2 per board). | Up to 3. | `on.foundation` | R S |
| challenge | Deep Freeze 🧊 | — | (unchanged) | | | K S |

### Fossil Hall (`museum`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| digsite | Dig Site ⛏️ | ability | (unchanged) | Twice per board. | existing module | K C |
| fossil | Fossil Record 🦴 | coin | +2 coins for each of the four 7-card columns you empty before 30 cards are home. | +4. | `replay` | R S |
| docent | Docent 🎟️ | ability | Your ability boons get +1 use per board for every 2 ability boons you hold (this one included). | For every ability boon. | `abilityBonus` from `ctx.family('ability')` | R S |
| challenge | Fragile Exhibits 🏺 | — | (unchanged; `pressure: true`) | | | K S |

### The Mint (`mint`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| sterling | Sterling 🪙 | suit | Diamonds may also be built up: a Diamond on a black card one rank lower. | Diamonds and Hearts. | `buildUp` | R S |
| interest | Compound Interest 📈 | coin | At each port, +1 coin for every 5 you hold (up to +10). | Every 4 (up to +15). | `onPort` | R S |
| treasury | Treasury 🏦 | undo | (unchanged) | +3. | `on.win` | K S |
| challenge | Withheld Issue 🪙 | — | One suit can't go home until 6 (s1–2), 10 (s3–4), 14 (s5–6) or 18 (s7) cards of other suits are home. | | `gate` (rng suit); tags FOUND; rule | R S |

### The Toy Box (`toybox`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| foursquare | Building Blocks 🧱 | wild | You can move 1 more card at once for each wild-family boon you hold (this one included). | 2 more per boon. | `rules` + `ctx.family('wild')` | R S |
| jackinbox | Jack-in-the-Box 🎁 | ability | (unchanged) | Twice per board. | existing module | K C |
| tidyup | Tidy Up 📦 | coin | +3 coins each time you empty a column before 20 cards are home. | +5. | `replay` | R S |
| challenge | Tipped Tower 🧱 | — | (unchanged) | | | K S |

### Prize Lights (`prizelights`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| puzzle | Today's Puzzle 🎡 | wild | Each board, one rank from 3 to Queen is wild. | Two ranks. | `wildRanks` rng | K S |
| applause | Applause 👏 | fortune | After a 3★ board, you may take two of the offered boons. | After a 2★ board too. | `picks` hook | R S |
| champion | Returning Champion 🏆 | undo | If the previous board was 3★, start this one with +2 undos. | +3. | `on.start` | R S |
| challenge | Full House 🏠 | — | No more than 3 (s1–2), 2 (s3–4) or 1 (s5–7) columns may be empty at once. | | `maxEmpty`; tags COLUMN; rule | R S |

### Safety Pin (`safetypin`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| threechords | Three Chords 🎸 | ability | Each time you use an ability, your next drop ignores colour. | …ignores colour and rank. | `on.ability` → `api.override` | R S |
| safetypin | Safety Pin 📌 | foundation | Once per board, pin a suit: its next 3 cards home grant +1 undo each. | Next 5. | ability; choose suit (pick a card of that suit); `on.foundation` | R S |
| zine | Zine 📰 | sticker | Ports offer a copier: copy one of your stickers onto another card for 10 coins. | Free once per visit. | `portServices` | R S |
| challenge | Pinned 📌 | — | 1 + ⌊s/2⌋ buried cards are pinned in place until 6 + 2s cards are home. | | `pinned` (rng buried cards), `mark('lock')`; tags MOVE; rule | R S |

### Honey House (`honeyhouse`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| forager | Forager 🐝 | coin | +1 coin for each card sent home while all four foundations are within 2 ranks of each other. | Within 3. | `replay` | R S |
| nectar | Nectar 🍯 | cells | One extra free cell that only takes Hearts. | Hearts or Diamonds. | `freeCells`, `cellLimits { suits }` | R S |
| stores → **royaljelly** | Royal Jelly 👑 | sticker | When you take this, the four Queens get Lucky stickers. | When upgraded, the Kings get them too. | `onPick` / `onUpgrade` | N S |
| challenge | Wax Caps 🍯 | — | Empty free cells close as the foundations fill: 1 at 39 home (s1), 1 at 26 (s2–3), 2 at 20 and 34 (s4–5), 3 at 14, 26 and 38 (s6–7). | | `cellClose`; tags CELLS; rule | R S |

### The Velvet Moth (`moth`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| lampglow | Lampglow 🕯️ | vision | Once per board, light a column: reveal its face-down cards; if none are hidden, show the best next move. | Twice per board. | pick column → `reveal`, else `api.preview(1)` | R S |
| waltz | Waltz 🦋 | wild | A card may also be placed on a card of the same rank and opposite colour (a 9♠ on a 9♥). | Same rank, any colour. | `twinStack` | R S |
| silver | Tarnished Silver 🥈 | coin | Selling a boon at a port pays 40 coins. | 55 coins. | `price` hook (`sell`) | R S |
| challenge | Lights Out 🌙 | — | Every 16 − s moves, one random column goes dark below its top card until uncovered. | | `on.move` counter (count from history length so undo doesn't re-trigger) → `api.conceal`; `pressure: true`; tags VIS | R S |

### Cut-Paper Kingdom (`cutpaper`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| octavo | Octavo 📄 | ability | Once per board, swap any two face-up cards on the tableau. | Twice per board. | pick card ×2 → `X` move | R C |
| musicbox | Music Box 🎶 | coin | Before your first move, you may stake 5 coins: win 15 if you send 6 cards home in a row while 20 or more are still in play. | Win 25. | `ability` (`when: 'start'`) → memo; `sb.addCoins` | R S |
| crown | Paper Crown 👑 | sticker | When you take this, the four Kings get Fool stickers: anything may be placed on them. | When upgraded, the Queens too. | `onPick` / `onUpgrade` | R S |
| challenge | Fold Lines ✂️ | — | The deal is uneven: columns of 8-8-7-7-6-6-5-5 (s1–2), 9-9-7-7-6-6-4-4 (s3–4), 10-10-7-7-6-6-3-3 (s5–6), 11-10-8-6-6-5-3-3 (s7). | | `dealSkew`; tags COLUMN; rule | R S |

### Midnight Broadcast (`broadcast`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| tuning | Tuning 📡 | fortune | You can see one more row ahead on the chart. | Two more rows. | `lookahead` hook | R S |
| bars | Color Bars 📺 | wild | Each board, one random suit is wild: its cards ignore colour when stacking. | Two suits. | `rules` rng → `wildCards` | R S |
| signoff | Sign-off 🌙 | coin | After a 3★ board, the next board's coin payout doubles if it's 3★ too. | Triples. | `coins` hook + `run.results` | R S |
| challenge | Prime Time 📻 | — | Until 34 (s1–2), 26 (s3–5) or 20 (s6–7) cards are home, empty columns don't help you move sequences; after that they triple it but only take cards ranked 6 or lower. | | `phase` (emptyFactor 1 → 3 + `emptyMaxRank 6`); tags COLUMN; rule | R S |

### The Giant's Sewing Box (`sewing`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| thread | Red Thread 🧵 | suit | A run of a single suit moves as one piece, however long. | …and Hearts may also be built down in suit. | `suitRunFree` = 15 | R S |
| button → **pincushion** | Pincushion 📍 | columns | Each board, one random column takes any card on top, whatever its rank or colour. | Two columns. | `openCols` (rng); setup glyph via mark on the column's top? (table visual from K1 if provided) | N S |
| ribbon | Ribbon 🎀 | sticker | Ports offer a tailor: move one of your stickers to another card, free once per visit. | Every move is free. | `portServices` | R S |
| challenge | Short Thread 🪡 | — | Empty columns only accept sequences headed by a card ranked 10 (s1–2), 8 (s3–4), 6 (s5–6) or 5 (s7) or lower. | | `emptyMaxRank`; tags COLUMN; rule | R S |

### Risograph Royalty (`risograph`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| misprint | Misprint 🖨️ | sticker | Once per board, misprint a face-up card: it gets a random sticker for the rest of the run (from the next board). | You choose the sticker. | ability + pick → `api.addSticker` | R S |
| ultramarine | Ultramarine 🔵 | coin | At each port, +1 coin for every sticker you own. | +2 per sticker. | `onPort` | R S |
| edition | Second Edition 🗞️ | coin | Every board's coin payout is +10% for each coin-family boon you hold (this one included). | +15% each. | `coins` hook | R S |
| challenge | Misregistration 🟥 | — | Nothing can be placed onto an even card: 2s–6s (s1–3), all even ranks (s4–7). | | `barren { suits: 15, ranks }`; tags STACK; rule | R S |

### Viking Runes (`runes`)
| key | Name | Fam | Level 1 | Level 2 | Impl | |
| --- | --- | --- | --- | --- | --- | --- |
| amber | Amber 🟠 | sticker | Once per board, press a Gold sticker onto a face-up card (it lasts the rest of the run, from the next board). | Twice per board. | ability + pick → `api.addSticker(card, 'gold')` | R S |
| keel | Shield Wall 🛡️ | cells | With 2 or more other cells-family boons, +1 free cell. | With 1 or more. | `rules` + `ctx.family('cells')` | R S |
| woad | Woad 🫐 | wild | Each board, one random extra rank is wild for every wild-family boon you hold (this one included). | Two per boon. | `rules` rng + `ctx.family('wild')` | R S |
| challenge | Keel Stones 🪨 | — | The deepest card of 2 + ⌊s/2⌋ columns can't enter a free cell. | | `noCellCards` from the dealt state (use the deal in `rules` ctx if available; otherwise compute in a `rules` hook from `deal(n)` via `ctx.seed`; K1 report says which); tags CELLS; rule | R S |

---

## Bosses

| id | Name | Status | Notes |
| --- | --- | --- | --- |
| boss.lockdown, boss.thaw, boss.decree, boss.throne, boss.barren, boss.lockstep, boss.tombs, boss.fog | (existing) | K (K1 re-tunes ease) | |
| boss.eclipse | Eclipse 🌘 | N (K1) | two-phase: court cards banned from cells → foundation spread 3 at 26 home |
| boss.auditor | The Auditor 🧾 | N (K1) | confiscates your strongest boon; −1 free cell |
| boss.hightide | High Tide 🌊 | N (K1) | cells close at 16, 28, 40 home |
| boss.house | The House 🎰 | N (content C) | pressure-only finale, no rule changes: star thresholds +20%, every free-cell placement costs 1 coin, every undo costs 2 coins — and the board's coin payout is tripled. Tags `SCORE`. Identity: a casino night with your whole purse on the table. |
| boss.mirror | The Mirror 🪞 | N (content C) | reads your most-held boon family (ties → seed) and turns it on you: cells → −2 free cells (floor 1); columns → empty columns take only Kings; wild → confiscates all your wild-family boons; suit → confiscates suit boons and Hearts/Spades are barren for Kings; foundation → spread 2; ability → your abilities start each with 0 bonus uses and the first one used costs an undo; undo/coin/fortune/sticker/vision → −1 free cell and fog over buried cards. Shown on the map from board 5 onward ("The Mirror watches your cells"). Uses `rules` with `ctx.family` and `confiscate`. Pre-solve can't know the family early: rely on the dealer's normal restrict verification at pick time. |

---

## Ideas we're parking (append to `docs/voyage/parked-abilities.md`)

Annex (9th column), Bunk Cell (two cards in one cell), a true 53rd Joker card, Lashings (weld a run into one unit), Colour Committee (two colour foundations), Looking Glass (foundations build down), Bedrock / La Brea (cards locked after placement — needs placement state), Switchback / Contrarian per-column direction, Flotilla (same-suit dumps), Heavy Court (pure inconvenience — rejected), Oil and Water (no-op under alternating colours — rejected), Chequer Rule, Discord, Twin Keeps, Toll Lanes, Convoy Requirement, Blowing Sand, Ferryman, Chart Seller, Auction node, Bottle Mail cursed stickers, Shipwright refits, The Collector (ransom boss), Metamorph (three-phase boss), Sargasso (seals + skew boss), Fifth-pile L2 variants.
