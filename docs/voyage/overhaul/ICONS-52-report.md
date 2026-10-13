# Voyage charm icons — roster 52 (batches 1–2)

Live registry: **221** non-hidden charms (hidden: `voyage.stickers` only). Each has `assets/art/charms/<id>.webp`. Subjects in `tools/charm-icon-subjects.mjs` match 221/221. Model: `gemini-nano-banana-2.1`.

---

# Batch 1 (renamed themes)

Twenty charms were moved to new themes; the WebPs still showed the old objects (varsity medal/megaphone/football, driftwood rope/anchor/fish/fog, nighttrain coupler/ticket/station, space satellite/UFO/magnet, keep boulder/hearth/bow, canopy camera-trap/pulley/web). Subjects rewritten to the live names in `js/voyage/charms.js`, then regenerated.

Model: `gemini-nano-banana-2.1`. Cut: `tools/cut-charm-icons.py`. Prefixes: `sheet-b1-`, `sheet-b1b-`, retries `sheet-b1r-` / `sheet-b1r2-`.

## Contact sheet

![Existing vs batch 1](../../../assets-src/art/charms/sheets/contact-b1-compare.png)

Top two rows: 16 unchanged icons. Below: this batch.

![Batch 1 at 48px](../../../assets-src/art/charms/sheets/contact-b1-48px.png)

## Regenerated

| id | name | subject |
| --- | --- | --- |
| `rink.lutz` | Triple Lutz | a tan leather figure skate with a steel blade and toe pick |
| `rink.couples` | Couples Skate | a small mirrored disco ball |
| `rink.request` | Request | a small chrome tabletop diner jukebox |
| `rink.challenge` | Judged Routine | a three-step wooden winners podium with no numerals |
| `darkroom.sheet` | Spare Sheet | a single curled sheet of glossy photographic paper |
| `darkroom.closet` | Supply Closet | a brown glass photo-chemical bottle with a rubber stopper |
| `darkroom.keeper` | The Keeper | a round metal 35mm film canister with a strip of film peeking out |
| `darkroom.challenge` | In the Tray | a rectangular photographic developing tray holding a pool of dark liquid |
| `smokewatch.sightline` | Sightline | a pair of field binoculars |
| `smokewatch.relief` | Relief Pack | an olive canvas firefighter backpack with bedroll straps |
| `smokewatch.challenge` | Fire Weather | a hanging red windsock |
| `signal.operator` | Night Operator | a vintage radio headset with one ear cup and a mic boom |
| `signal.pull` | Pull | a three-pronged steel grappling hook |
| `signal.challenge` | Static | a small CRT television filled with grey-and-white static snow |
| `bloodmoon.seal` | Broken Seal | a round blank red wax seal split cleanly in two halves, no letters |
| `bloodmoon.candle` | The Last Candle | a candle stub burned down to a puddle of wax with a tiny remaining flame |
| `bloodmoon.challenge` | Uninvited | a heavy iron ring door knocker |
| `deepsea.sonar` | Sonar | a round analog sonar disc with concentric ping rings and no numerals |
| `deepsea.current` | Current | a three-bladed brass diving propeller |
| `deepsea.openwater` | Open Water | a round brass porthole showing empty deep-blue water |

## Retries

- `bloodmoon.seal`: first pass had “WAX SEAL” lettering. Replaced with a blank split seal.
- `deepsea.sonar`: first pass was a hanging teardrop that read as a lamp. Replaced with a round ping disc, no numerals.
- `rink.lutz` / `rink.couples`: first-pass cream skate and gloves keyed to a mottled mess. Tan skate + disco ball.
- `rink.challenge`: first-pass judging paddle read as `boss.mirror`. Wooden podium, no numerals.

## Distinctness

- Candle stub vs `moth.lampglow` (tall candle) and `muertos.ofrenda` (glass votive).
- Split seal vs `roman.challenge` (scroll with intact seal).
- Static CRT vs `broadcast.bars` (color bars).
- Porthole vs sonar disc (frame + waterline vs sweep rings).
- Disco ball vs single skate; backpack vs `jetset.priority` suitcase.

## QA

- `--ids` filter follows **SUBJECTS file order**, not argv order. Cuts used that order.
- Pale cream objects get eaten by the white key; later rink icons use tan/wood/chrome.
- `gen-charm-icons.mjs` overwrites `assets-src/art/charms/sheets/index.json`. Batch sheets: `index-b1.json`.
- Did not boot Voyage in a browser; files are `assets/art/charms/<id>.webp` (256×256).

---

# Batch 2 (new sets)

Sixteen new charms for `plaster`, `backrooms`, `vaporwave`, `cinema`. One physical object each; no letters or numerals.

![Existing vs batch 2](../../../assets-src/art/charms/sheets/contact-b2-compare.png)

Top two rows: 16 existing (including batch 1). Below: the 16 new icons.

![Batch 2 at 48px](../../../assets-src/art/charms/sheets/contact-b2-48px.png)

## Generated

| id | name | subject |
| --- | --- | --- |
| `plaster.armature` | Armature | a wire bust armature of a head and shoulders |
| `plaster.mould` | Plaster Mould | a two-piece plaster face mould |
| `plaster.commission` | Commission | an ornate gold picture frame around a small plaster bust |
| `plaster.challenge` | Wet Plaster | a grey metal bucket of wet plaster |
| `backrooms.hum` | Fluorescent Hum | a rectangular fluorescent shop-light fixture in a metal housing |
| `backrooms.noclip` | Noclip | a beige office door standing slightly out of its frame |
| `backrooms.exitsign` | Exit Sign | a hanging green emergency box with a right-pointing chevron and no letters |
| `backrooms.challenge` | No Exit | a closed steel fire door with a horizontal push bar and no letters |
| `vaporwave.checkerboard` | Checkerboard Floor | a black-and-white checkerboard floor tile |
| `vaporwave.fountain` | Wishing Fountain | a two-tier stone wishing fountain with water |
| `vaporwave.shuffle` | Shuffle Play | a black VHS cassette tape |
| `vaporwave.challenge` | After Hours | a half-lowered corrugated metal shop shutter |
| `cinema.exposure` | Double Exposure | a strip of film with two overlapping ghosted frames and no letters |
| `cinema.projectionist` | Projectionist | a tabletop film projector |
| `cinema.cliffhanger` | Cliffhanger | a movie clapperboard with empty sticks and no letters |
| `cinema.challenge` | Typecast | a round gold makeup compact with a powder puff |

## Retries

- `cinema.challenge` / `cinema.exposure`: first pass was two cameras (too alike). Compact + overlapping film frames.
- `backrooms.hum`: bare tube was 9% fill and unreadably thin at 48px. Shop-light fixture.

## Distinctness

- Exit box uses a chevron, not the word EXIT; fire door vs noclip office door.
- VHS vs `concrete.mixtape` cassette; compact vs `boss.mirror`; film frames vs `darkroom.keeper` canister.
- Checker tile vs `azulejo` tiles; shop-light vs `arctic.heatlamp`; clapperboard has empty sticks.
- Face mould vs framed bust vs wire armature (three plaster objects).

## Roster check

`node` load of `js/voyage/charms.js`: 221 non-hidden ids, 221 subjects, 221 WebPs present. No placeholders. Hidden `voyage.stickers` has no icon (expected).
