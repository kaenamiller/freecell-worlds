# Voyage charm icons — roster v2

Live registry (`js/voyage/charms.js`): **205** non-hidden, non-dev charms. Each has `assets/art/charms/<id>.webp` (256×256, transparent WebP, ~4–24 KB, average ~11 KB). No leftover files for retired ids.

## UI

`js/voyage/ui.js` loads `../../assets/art/charms/${c.id}.webp` (`charmArt` → `charmGlyph`). Placeholders skip the image; the live roster has none.

`sw.js` does **not** list charm icons. `/assets/` is cache-first at runtime, so new files do not need a SHELL entry. Do not bump VERSION solely for these icons.

## Pipeline

- Subjects: `tools/charm-icon-subjects.mjs` (205 ids, matches live roster).
- Generate: `node tools/gen-charm-icons.mjs --ids=a,b,c --force` (optional `--prefix=`, `--no-cut`). Model: `gemini-nano-banana-2.1`.
- Cut: `tools/cut-charm-icons.py` (white keyed, fit to 256, ffmpeg WebP). Partial sheets crop with `h // rows`.
- Unchanged icons were not regenerated.

## Contact sheet

- Compare (16 existing + 30 new/rewritten/copied): `assets-src/art/charms/sheets/contact-compare.png`
- 48px strip: `assets-src/art/charms/sheets/contact-48px.png`
- HTML preview: `docs/voyage/overhaul/ICONS-contact.html`
- Source sheets: `assets-src/art/charms/sheets/sheet-subset-00.png`, `sheet-subset-01.png` (wave 1 copies `*-wave1.png`), `sheet-retry-00.png` (`prizelights.challenge`)

## Copied (new id, same object)

| id | from | subject |
| --- | --- | --- |
| `zen.koan` | `zen.mindful` | a bowl of tea |
| `jetset.priority` | `jetset.overhead` | a suitcase |
| `pinecone.bounty` | `pinecone.badge` | a round merit-badge medal |
| `pinecone.trailhead` | `pinecone.compass` | a pocket compass |
| `riverboat.longshot` | `riverboat.edge` | two six-sided dice |

## Generated (new ids)

| id | subject |
| --- | --- |
| `azulejo.glaze` | a ceramic paintbrush loaded with wet blue glaze |
| `boss.auditor` | a folded paper receipt |
| `boss.eclipse` | a sun half covered by a dark moon |
| `boss.hightide` | a tall ocean swell curling at the crest |
| `boss.house` | a casino roulette wheel |
| `boss.mirror` | an ornate oval hand mirror |
| `carnival.fool` | a three-pointed jester cap with bells |
| `cyber.zeroday` | an open unlocked padlock |
| `deco.velvet` | a velvet rope hung between two brass stanchions |
| `deepstorage.redaction` | a thick black felt marker |
| `driftwood.chandler` | a heavy ship's anchor |
| `forge.bellows` | a leather blacksmith bellows |
| `honeyhouse.royaljelly` | a tiny gold bee crown |
| `lowtide.rockpool` | a branching piece of coral |
| `riverboat.markeddeck` | a playing-card back with one tiny inked star in the corner |
| `saloon.quickdraw` | a western revolver |
| `sewing.pincushion` | a tomato-shaped pincushion stuck with pins |
| `varsity.playbook` | a closed leather coach clipboard |
| `winterglass.icicle` | a hanging spike of clear ice |

## Regenerated (same id, subject no longer fit the name)

| id | subject |
| --- | --- |
| `moth.challenge` | a snuffed candle with a wisp of smoke |
| `prizelights.challenge` | a tiny cottage with a pitched roof, built from blank playing cards |
| `runes.keel` | a round wooden Viking shield |
| `safetypin.challenge` | a steel thumbtack pinning a scrap of blank cloth |
| `toybox.foursquare` | three stacked wooden building cubes |
| `winterglass.challenge` | a pane of glass etched with frost ferns |

R charms whose **name/object still fit** (e.g. `forest.fireflies`, `deco.champagne`, `arctic.heatlamp`) were left alone.

## Retired files removed

`azulejo.fountain`, `carnival.ticket`, `cyber.cache`, `deco.highroller`, `deepstorage.redundancy`, `driftwood.breeze`, `forge.temper`, `honeyhouse.stores`, `jetset.overhead`, `lowtide.ebb`, `pinecone.badge`, `pinecone.compass`, `riverboat.dealer`, `riverboat.edge`, `saloon.seven`, `sewing.button`, `varsity.comeback`, `winterglass.globe`, `zen.mindful`.

## QA notes

- First 9-icon sheet packed 3 rows into the full canvas; an initial 4-row crop mixed neighbors. Recut with `h // rows`. Later gens always request a 4×4 grid with empty leftover cells.
- `prizelights.challenge` was regenerated (retry sheet): first pass was an unreadable A-frame of cards.
- `boss.auditor` receipt uses scribble lines, not readable words.
- `winterglass.challenge` is pale at 48px (frost on cream glass) but reads as a framed pane at icon size.
- `riverboat.markeddeck` fills its cell (ornate card back); the corner stars are the mark. Distinct from `riverboat.sleeve` (spade pip).
- Dice pips on `riverboat.longshot` are dots, not numerals. Roulette on `boss.house` has no digits.
- Did not boot Voyage in a browser; path check is `charmArt` plus a 205/205 file presence check.
