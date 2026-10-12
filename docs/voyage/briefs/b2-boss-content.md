# Brief B2 — Voyage boss content: 8 rule-based bosses (Composer 2.5)

Write the 8 bosses marked **B2** in spec §1 of `docs/voyage/boss-build.md` in `js/voyage/content/bosses.js` (stub exists and is imported). Each: `id`, `kind: 'boss'`, `name`, `icon`, `tags`, `text` (Barren Suit: `text: (s, ctx) => …` naming the suit; guard `ctx?.seed` being absent → "a random suit"), `ease`, `rules(r, ctx)` that **merges** with existing fields (see `arctic.challenge` in `content/arctic.js` for merging `cellThaw`), `setup` for tells (Royal Decree: `api.mark(courtIds, 'crown')`; Barren Suit: `api.mark(suitIds, 'thorn')`), and `boonRelation(boonId, diff)` returning `'+'`, `'~'` or `'!'` (e.g. Lockdown: `'+'` for boons with `diff.freeCells`; Kings' Throne and Hand Carry: `'!'` for boons raising `emptyFactor`; Royal Decree: `'!'` for boons that only help courts into cells, etc. — think through each boss against the boons in `docs/voyage/charms-design.md` §5).

## Read first
1. `docs/voyage/boss-build.md` — the spec for this work (your section + §4 ownership).
2. `docs/voyage/boss-challenges.md` — original boss design (rationale, risks).
3. `docs/voyage/charms-build-log.md` — the kernel API **as built** (K1, K2, S1–S3 sections); `js/voyage/charms.js` header; `js/voyage/content/kit.js`.

## Rules of the road
- Same checkout as other agents working right now (B1 boss system, B2 boss content, B3 Fog of War). Edit only files you own per §4. Re-read a shared file right before each edit, small targeted edits, never reformat. Never run `git checkout/stash/reset/clean`, never commit.
- Keep classic mode unchanged and keep these passing: `node tools/charm-content-check.mjs --strict`, `node tools/rules-check.mjs`.
- Cross-agent needs go in `docs/voyage/charms-build-log.md` under "Requests to B1/B2/B3" (append only).

## Notes
- Run-stable randomness (Barren Suit's suit, Twin Tombs' columns): use `stream(ctx.seed, 'boss', id)` from `../rng.js` in both `text` and `rules`, so the tooltip shown on the map matches the board.
- `crown`/`thorn` mark styles and `boonRelation` rendering are being added by B1 right now; write against the spec. If the check script rejects the new mark styles before B1 lands them, note it in the build log rather than editing kernel files.
- Ease: use the calibration table in `docs/voyage/charms-design.md` §2.5 (1 free cell ≈ −1.54 tiers, modeled exactly by the bank → no ease for the Lockdown cell loss itself).
- Remove nothing; B1 removes `boss.narrows`.
- Add `tools/charm-checks/bosses.mjs`: per boss, the composed rules at s7 alone and merged with a representative theme challenge + boons (merge, not overwrite), seeded suit/columns stable across `text` and `rules`, `boonRelation` returns a valid value for every boon id.

Use port **8161** if you need a server. Done means: 8 bosses registered and passing the check script; a "Bosses: B2" section appended to the build log with ease values and relation choices.
