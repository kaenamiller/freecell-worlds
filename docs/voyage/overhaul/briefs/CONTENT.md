# Content wave brief (v2 roster)

You are implementing part of the new Voyage charm roster for FreeCell Worlds (static three.js FreeCell, plain ES modules, no build step). Several content agents work **in the same checkout at the same time**, each on its own files. Your assignment (themes or special modules) is in the message that started you.

## Read first
1. `docs/voyage/overhaul/ROSTER.md` — the design rules at the top, and the rows for your themes / modules. **This is your spec.**
2. `docs/voyage/overhaul/SPEC.md` — systems and kernel interfaces (rules fields, runtime API, hooks).
3. The kernel reports, which are authoritative on exact semantics: `docs/voyage/overhaul/K1-report.md` (rules fields, overrides, Suit Spur, measured ease), `K2a-report.md` (coins, `sb.addCoins`, ports, hooks like `onPort`, `price`, `portServices`, `picks`, `lookahead`, `challengeStrength`, `onUpgrade`, `boardUndos`), `K3-report.md` (ctx.level / ctx.family, api.preview / resetBoard / openUndoWindow / solvable / grantUse / addSticker / addUndos cap, `on.ability`, `ability.when`). If a report is missing a detail, read the code (`js/rules.js`, `js/voyage/charms.js`, `js/voyage/run.js`, `js/voyage/port.js`, `js/voyage/scoring.js`, `js/voyage/content/kit.js`).
4. The current file(s) you're rewriting, and 2–3 neighbouring theme files / special modules for style (`js/voyage/content/forest.js`, `js/voyage/content/special/space.tractor.js`).

## Rules
- Edit **only** the files in your assignment. Theme files: `js/voyage/content/<theme>.js`. Special modules: `js/voyage/content/special/<id>.js` (stub files and their imports in `content/index.js` already exist — do not edit `index.js`). If your theme row is marked **C**, that charm is written by a complex-charm agent in its special module: **remove** its old definition from your theme file (if present) and don't define it.
- Keep each theme at exactly 3 boons + 1 challenge. Charm ids are `<theme>.<key>` with the key from the roster (renamed keys like `cyber.zeroday` replace the old id).
- Every boon: `family`, `upgrade` (level-2 text), behaviour reading `ctx.level` where L2 differs, a one-sentence `text`. Challenges: `pressure: true` for curses; rule challenges keep `tags` and `ease`.
- Coins from play come only from `sb.addCoins(key, label, n)` inside `score(sb, ctx)`, computed from `sb.history` (use `replay` from `kit.js` when you need the state at each step). Run-level coin grants (`onPick`, `onPort`, `on.win`) use the documented hooks.
- Seeded randomness only (`ctx.rng`). No `Math.random`.
- Follow the file's existing style and comment density. Keep marks for singled-out cards.
- Never run `git checkout/stash/reset/clean/commit`.

## Verification (all must pass before you finish)
- `node -e "import('./js/voyage/charms.js')"` loads with no placeholders for your themes.
- `STRICT_V2=1 node tools/charm-content-check.mjs` passes **for your charms** (other agents' themes may still warn while they work; report anything that blocks you).
- `node tools/rules-check.mjs` still passes.
- Add a check file `tools/charm-checks/v2-<your-agent-name>.mjs` (same export shape as the existing ones in that folder) that exercises each of your charms at level 1 and level 2: rules produced, score/coin lines from a synthetic history (`fakeBoard` / `stubAPI` helpers in `tools/charm-content-check.mjs`), ability availability/use with a stub API, and at least one negative case per conditional coin charm (the condition fails → no coins).
- For abilities / special modules: a browser check on your assigned port (`node serve.mjs <port>`, then a puppeteer script modelled on `tools/charm-runtime-check.mjs`, saved as `tools/charm-checks/v2-<your-agent-name>-browser.mjs`) that uses the ability on a real board, undoes it, and checks no console errors.

When done, reply with: the charms you implemented, any roster change you had to make (and why), anything you couldn't do, and the commands you ran with their results.
