# Parked ability ideas

Status: open. None of these are implemented or assigned to a theme.

When generating a new charm, read this file before inventing an ability. If an open idea fits the theme, claim it: keep the mechanic, give it that theme's name, icon, and one-sentence tooltip, implement it, and record the charm id under [Claimed](#claimed). Leave the spec in place so a later charm does not grow a second copy.

These are ability shapes. They follow `docs/voyage/charms-design.md` §1. A boon only adds capability. Points still come from the history that remains after undos. Use seeded randomness only. An event-granted undo stays capped per board.

Already shipped, so do not re-skin these:

| Charm | What it actually does |
| --- | --- |
| Holo-Scan, Pocket Compass, Docent | Once or twice per board, `api.hint()` runs the solver and **plays** its first move |
| Eye of Horus | Same played hint, and uncovers up to 3 face-down cards |
| Bookmark | Two-phase: set a mark, then `api.rewind(n)` undoes everything since that mark and spends **one** run undo |
| Lucky Doubloon | Once per board, takes back the last player move (and the auto-plays after it) without spending an undo |

`api.hint()` is `doHint` in `js/main.js`: up to 3 seconds of search, then `solution[0]` is applied. On timeout it plays the highest-scored legal move. `api.rewind(n)` undoes `n` history entries and always spends one run undo. Neither call can preview a line, rewind for free, or step backward as a mode.

---

## Deal Reset

**Shape.** Once per board, one tap restores the dealt position.

**Player text (placeholder).** Once per board, put every card back where it was dealt.

**Use.** The ability use is the whole cost. It does not spend a run undo, so it still works when the run is out of undos. Unavailable when the board is already won, or when history has no player move.

**Effect.** Undo the entire history, one descriptor at a time, so each move's own undo restores state and rules (extra cells, seals, thaws, overrides, custom `X` moves). The board returns to `run.current.initial`, which is the dealt state after `startHome`. Same deal number. Cards animate with the generic relayout.

**History and score.** Undone moves leave history, so the board is scored from whatever is played after the reset. The reset itself is not a move and adds no points.

**Other charms.** Emit one `on.undo` for the batch, with `ev.reset === true` and `ev.moves` covering the whole history. Refund charms (Cache Hit, Echo Canyon, Redundancy, Packet Loss) ignore a reset event: nothing was spent, and the batch must not farm refunds. `sb.undosUsed` does not increase. Ability uses refunded by `voyageUndone` still refund, except this ability's own use, which stays spent. Charms that keep a mid-board anchor in `memo` (Bookmark) clear it when history no longer contains that anchor.

**Kernel.** New `api.resetBoard(): boolean`. Do not implement this as a fresh `deal()` — a new shuffle would change the board the player was given.

**Ease.** `0` on the undo-only row is too low for a free return to the deal. Start at `+0.3` and retune from playtest.

**Build.** Complex. Own module once a theme claims it.

---

## Undo Window

**Shape.** Once per board, open one streak of free undos. Stronger than Bookmark: no mark to set in advance, and each step back is free until the player plays forward again.

**Player text (placeholder).** Once per board, undo as many times as you want; the next move you play closes the window.

**Use.** Arming the window spends the one use. Each later Undo press does not spend another use or a run undo. Unavailable when history has no player move. Arming is legal with zero run undos.

**While the window is open.** The Undo button steps back one player move plus the auto-plays that followed it — the same step as a normal undo — and does not call `spendUndo`. The player may walk all the way back to the deal. There is no redo. The window stays open at the deal until a forward move.

**Closing.** The next manual move closes it. Auto-plays that follow that move are part of the forward line, not a reason to stay open. Closing is permanent for that board.

**Other charms.** Each free step still emits `on.undo` with `ev.free === true`, so anchors and ability refunds keep working. Spend-based charms ignore `ev.free`: they must not refund, double-charge, or count a free step toward "every 3rd undo". `sb.undosUsed` counts only spent undos, so Leeches does not tax the window.

**Kernel.** A board flag, saved in `memo`, that the Voyage undo path checks before the `vy.run.undos <= 0` gate. `api.rewind` stays the one-shot paid batch; this mode is step by step. A forward `on.move` with `ev.manual` clears the flag.

**Ease.** Start at `+0.3`. The window can recover an entire board without spending the undo pool.

**Build.** Complex. The undo-path flag is runtime kernel; the charm module only arms and closes it.

---

## Three-Move Look

**Shape.** Once per board, show the solver's next three moves. The player still plays them.

**Player text (placeholder).** Once per board, show the recommended next three moves.

**Use.** One use. Do not call `api.hint()`. That call plays a move and would re-solve after each one, so three calls are three different lines, not one sequence.

**Search.** `requestSolve` under `game.rules`, same rules the board is actually using, with a 5 second budget. Take `solution.slice(0, 3)`. If the solution is shorter than three, show the moves that exist. If the search returns no solution, say so and do not invent a three-move plan from greedy scores. A one-move fallback belongs to the existing hint charms.

**Presentation.** Show the line; apply nothing. Status text names the three moves in order. Highlight the first move's card and its destination the way a selection does, and number the second and third sources. Playing, undoing, or using another ability clears the preview. The preview is not history, does not change `run.hints` scoring, and does not set the machine-played `run.solved` flag.

**Kernel.** New `api.preview(n): Promise<Move[] | null>` that returns descriptors and does not apply them. The highlight is theme-neutral UI, driven by those descriptors.

**Ease.** `+0.15`. It is information only, and stronger than the one-move hints because the player sees a short plan before committing.

**Build.** Complex. Solver call and preview UI are shared; the charm is a one-use button.

---

## Claimed

| Idea | Charm id | Theme |
| --- | --- | --- |
| — | — | — |
