# K2b — Voyage UI v2 report

Implemented the full UI brief and the subsequent two-pick reward, service, Grand Port, and storm-route addenda. All changes are confined to K2b-owned files. No edits were made by K2b to `main.js`, `js/ui.js`, `css/style.css`, or other Voyage engine modules.

## What shipped

- Theme-styled Harbour market with Boons, Stickers, Upgrade, Provisions, Sell, Reroll, and optional charm-defined services. The purse and Set sail action remain visible while stalls scroll. Grand Port reads `port.grand`, supports four or more offers, and displays model-supplied sale prices.
- Insufficient funds disable each purchase and show its coin shortfall; sold stock, exhausted provisions, and used rerolls have explicit disabled labels. Sell dispatch waits for the existing confirmation dialog. Re-rendering preserves stall scroll and restores action focus where possible.
- A 52-card picker in four suit rows and thirteen ranks, using engine IDs 1–52 (clubs, diamonds, hearts, spades). Neutral mini faces show existing stickers. Arrow keys navigate ranks/suits; Tab stays in the active dialog; Escape/Cancel restores focus without buying. Services reuse this picker for card targets and have a separate held-boon picker for boon targets. Touch selection is checked.
- Coin purses in the HUD and map; a result coin breakdown under the score sheet, animated after stars and before rewards. User/system reduced motion is respected.
- Harbour anchors and “Port after this table” title/accessibility/detail text. Storm lightning badges, secondary Rule/Curse details/chips/intro blocks, and double-coins/three-choices explanations on storm results; storm summary rows are marked too.
- Family glyphs and names (including the added `fortune` family), level-II badges, active upgraded text, and Now → Upgraded previews. Hidden pseudo-charms are excluded from visible offers/trays/cards. Challenge chips distinguish Rule and Curse.
- Boss confiscation on the chip, intro, final map nodes and node details. The held boon is greyed during the finale, with its ability disabled and a tooltip explanation. Predicted map confiscation never disables a boon on an earlier table.
- `charm undos n/cap` beside Undo whenever the board has granted charm undos.
- Five shape-distinct sticker marks in the corner opposite existing charm marks. A second renderer slot allows both marks on a card and preserves them through theme changes and conceal/reveal.
- Reward headings use remaining `reward.picks` (default 1), including “Choose 2 boons.” Run summaries list all `result.charms` entries with the old `result.charm` fallback, plus every card sticker.
- The existing title, map, intro, result, end, tutorials, and statistics layouts retain their flow. The mobile HUD/dock adapts to the added purse and readable charm/family labels.

## Exact engine integration

The supplied view-model contract is implemented. K2a has landed the base port flow and handlers. The UI calls:

```js
voyageUI.showPort(runView(run)); // entry, resume, and after a port mutation
handlers.portBuyBoon(id);
handlers.portBuySticker(offerIdx, cardId);
handlers.portUpgrade(id);
handlers.portBuyUndo();
handlers.portSell(id); // only after confirmed
handlers.portReroll();
handlers.portLeave();
handlers.portService(serviceId, cardId); // needsCard: integer 1–52
handlers.portService(serviceId, boonId); // needsBoon: held charm ID
handlers.portService(serviceId);         // no target
```

For a reward with remaining picks, `pickCharm(id)` must re-render `voyageUI.showResult(vyView())` until the model advances. The UI uses `current.extraChallenges` with `current.stormChallenge` as a fallback; storm bonus math and offers remain engine-owned. No new storm flow hook is needed. Custom service argument shapes beyond the descriptor's card/boon flags need a picker contract if introduced later.

### Card-slot cleanup hooks needed from K2a/K3 in main.js

```js
import { setCardSticker } from './card.js';
setCardSticker(group, type); // wild | fool | key | gold | lucky, or sticker-* spelling
setCardSticker(group, null); // clears ONLY the sticker
```

`setCardMark(group, 'sticker-'+type)` forwards to the new slot, so the built-in sticker charm already paints through the existing `api.mark(ids, style)` path. Ordinary `setCardMark(group, null)` deliberately clears only the charm. Both slots survive `applyCardStyle(group, style)` and follow `setCardConcealed(group, bool)`.

Remaining owner hooks, also documented in `docs/voyage/ui-notes.md`:

1. **`voyageRuntimeAPI.clearMarks()`** and any mode/reset cleanup that clears all Voyage marks: call `setCardMark(g, null); setCardSticker(g, null);` for each card group before charm setup redraws them.
2. **`disposeCard(g)`**: add `g.userData.stickerMesh?.material.dispose()`. Cached mark textures and face geometry are shared and must not be disposed per card.
3. If explicitly restoring saved stickers outside the pseudo-charm setup, after card groups exist call `setCardSticker(cardGroups.get(Number(cardId)), type)` for each `run.stickers` entry.

K2b did not edit these functions because the brief explicitly assigns `main.js` to other owners. UI work has no remaining deferred items.

## Verification

- Browser server: **8144**. The checker defaults to this port and `/tmp/k2b-shots/`; `VOYAGE_TEST_URL` and `VOYAGE_SHOTS` can override them.
- **77 unique screenshot cases** passed: 69 original/regression/v2 cases in `/tmp/k2b-ui-check-final.log`, followed by eight storm desktop/mobile cases in `/tmp/k2b-storm-check.log`. Every new screen was checked at **1024×768** and **390×844**. Extra mobile port themes: azulejo, jetset, space, muertos. No console errors, failed assets, document/chart horizontal overflow, overflowing cards/stalls/dialogs, or off-screen HUD action buttons.
- Keyboard/touch interaction checks pass at both sizes: all port handlers, picker IDs and arrow navigation, modal focus containment, Esc cancellation and focus restoration, sell cancel/confirm, insufficient funds, exhausted stock, Grand Port, service card/boon/no-target arguments, remaining reward picks, confiscation, undo cap, storms, run sticker lists, and independent mark slots through reskin/conceal/reveal/clearing.
- `node tools/rules-check.mjs`: passed, including 36 rulesets and 58 classic baseline deals. Log: `/tmp/k2b-rules-check.log`.
- `node tools/economy-check.mjs`: passed, including the complete no-UI run, services, Grand Port, two picks, and storms. Log: `/tmp/k2b-economy-check.log`.
- `node tools/charm-content-check.mjs`: exits 0; 2590 charm/strength checks and extension checks pass. It still prints metadata/duplicate-text warnings for content being changed in parallel; these are outside K2b ownership. Log: `/tmp/k2b-content-check-final.log`.
- Syntax checks for all changed JS modules and `git diff --check` for owned files pass.
- Screenshots were visually reviewed individually and in contact sheets. Iterations corrected suit/ID order, cramped mobile dock controls, overlapping confiscation text on compact final nodes, and a partially clipped Continue button in the two-challenge desktop intro. The intro correction and unchanged standard finale intro were rechecked in `/tmp/k2b-intro-check.log`. Supplemental scroll captures review every lower port stall and the Lucky sticker on the mobile card sheet.

## Screenshots reviewed

All images are under `/tmp/k2b-shots/`. Desktop/mobile pairs below use 1024×768 / 390×844 respectively.

| Screen | Desktop | Mobile |
| --- | --- | --- |
| boss-intro | [k2b-boss-intro-desktop.png](/tmp/k2b-shots/k2b-boss-intro-desktop.png) | [k2b-boss-intro-mobile.png](/tmp/k2b-shots/k2b-boss-intro-mobile.png) |
| end-win | [k2b-end-win-desktop.png](/tmp/k2b-shots/k2b-end-win-desktop.png) | [k2b-end-win-mobile.png](/tmp/k2b-shots/k2b-end-win-mobile.png) |
| hud-curse | [k2b-hud-curse-desktop.png](/tmp/k2b-shots/k2b-hud-curse-desktop.png) | [k2b-hud-curse-mobile.png](/tmp/k2b-shots/k2b-hud-curse-mobile.png) |
| hud-finale | [k2b-hud-finale-desktop.png](/tmp/k2b-shots/k2b-hud-finale-desktop.png) | [k2b-hud-finale-mobile.png](/tmp/k2b-shots/k2b-hud-finale-mobile.png) |
| hud-storm | [k2b-hud-storm-desktop.png](/tmp/k2b-shots/k2b-hud-storm-desktop.png) | [k2b-hud-storm-mobile.png](/tmp/k2b-shots/k2b-hud-storm-mobile.png) |
| intro-storm | [k2b-intro-storm-desktop.png](/tmp/k2b-shots/k2b-intro-storm-desktop.png) | [k2b-intro-storm-mobile.png](/tmp/k2b-shots/k2b-intro-storm-mobile.png) |
| map-confiscation | [k2b-map-confiscation-desktop.png](/tmp/k2b-shots/k2b-map-confiscation-desktop.png) | [k2b-map-confiscation-mobile.png](/tmp/k2b-shots/k2b-map-confiscation-mobile.png) |
| map-storm | [k2b-map-storm-desktop.png](/tmp/k2b-shots/k2b-map-storm-desktop.png) | [k2b-map-storm-mobile.png](/tmp/k2b-shots/k2b-map-storm-mobile.png) |
| port | [k2b-port-desktop.png](/tmp/k2b-shots/k2b-port-desktop.png) | [k2b-port-mobile.png](/tmp/k2b-shots/k2b-port-mobile.png) |
| port-grand | [k2b-port-grand-desktop.png](/tmp/k2b-shots/k2b-port-grand-desktop.png) | [k2b-port-grand-mobile.png](/tmp/k2b-shots/k2b-port-grand-mobile.png) |
| port-poor | [k2b-port-poor-desktop.png](/tmp/k2b-shots/k2b-port-poor-desktop.png) | [k2b-port-poor-mobile.png](/tmp/k2b-shots/k2b-port-poor-mobile.png) |
| port-spent | [k2b-port-spent-desktop.png](/tmp/k2b-shots/k2b-port-spent-desktop.png) | [k2b-port-spent-mobile.png](/tmp/k2b-shots/k2b-port-spent-mobile.png) |
| result-coins | [k2b-result-coins-desktop.png](/tmp/k2b-shots/k2b-result-coins-desktop.png) | [k2b-result-coins-mobile.png](/tmp/k2b-shots/k2b-result-coins-mobile.png) |
| result-storm | [k2b-result-storm-desktop.png](/tmp/k2b-shots/k2b-result-storm-desktop.png) | [k2b-result-storm-mobile.png](/tmp/k2b-shots/k2b-result-storm-mobile.png) |
| reward-two | [k2b-reward-two-desktop.png](/tmp/k2b-shots/k2b-reward-two-desktop.png) | [k2b-reward-two-mobile.png](/tmp/k2b-shots/k2b-reward-two-mobile.png) |
| service-boon | [k2b-service-boon-desktop.png](/tmp/k2b-shots/k2b-service-boon-desktop.png) | [k2b-service-boon-mobile.png](/tmp/k2b-shots/k2b-service-boon-mobile.png) |
| service-card | [k2b-service-card-desktop.png](/tmp/k2b-shots/k2b-service-card-desktop.png) | [k2b-service-card-mobile.png](/tmp/k2b-shots/k2b-service-card-mobile.png) |
| sticker-marks | [k2b-sticker-marks-desktop.png](/tmp/k2b-shots/k2b-sticker-marks-desktop.png) | [k2b-sticker-marks-mobile.png](/tmp/k2b-shots/k2b-sticker-marks-mobile.png) |
| sticker-picker | [k2b-sticker-picker-desktop.png](/tmp/k2b-shots/k2b-sticker-picker-desktop.png) | [k2b-sticker-picker-mobile.png](/tmp/k2b-shots/k2b-sticker-picker-mobile.png) |

Additional reviewed port stalls, themes, confirmation, and card-sheet captures:

- [k2b-port-azulejo.png](/tmp/k2b-shots/k2b-port-azulejo.png)
- [k2b-port-desktop-provisions.png](/tmp/k2b-shots/k2b-port-desktop-provisions.png)
- [k2b-port-desktop-reroll.png](/tmp/k2b-shots/k2b-port-desktop-reroll.png)
- [k2b-port-desktop-sell.png](/tmp/k2b-shots/k2b-port-desktop-sell.png)
- [k2b-port-desktop-special-services.png](/tmp/k2b-shots/k2b-port-desktop-special-services.png)
- [k2b-port-desktop-upgrade.png](/tmp/k2b-shots/k2b-port-desktop-upgrade.png)
- [k2b-port-jetset.png](/tmp/k2b-shots/k2b-port-jetset.png)
- [k2b-port-mobile-provisions.png](/tmp/k2b-shots/k2b-port-mobile-provisions.png)
- [k2b-port-mobile-reroll.png](/tmp/k2b-shots/k2b-port-mobile-reroll.png)
- [k2b-port-mobile-sell.png](/tmp/k2b-shots/k2b-port-mobile-sell.png)
- [k2b-port-mobile-special-services.png](/tmp/k2b-shots/k2b-port-mobile-special-services.png)
- [k2b-port-mobile-upgrade.png](/tmp/k2b-shots/k2b-port-mobile-upgrade.png)
- [k2b-port-muertos.png](/tmp/k2b-shots/k2b-port-muertos.png)
- [k2b-port-space.png](/tmp/k2b-shots/k2b-port-space.png)
- [k2b-sell-confirm-1024.png](/tmp/k2b-shots/k2b-sell-confirm-1024.png)
- [k2b-sell-confirm-390.png](/tmp/k2b-shots/k2b-sell-confirm-390.png)
- [k2b-sticker-marks-mobile-lower.png](/tmp/k2b-shots/k2b-sticker-marks-mobile-lower.png)

Review contact sheets:

- [review-extra.png](/tmp/k2b-shots/review-extra.png)
- [review-regression.png](/tmp/k2b-shots/review-regression.png)
- [review-desktop-1.png](/tmp/k2b-shots/review-desktop-1.png)
- [review-desktop-2.png](/tmp/k2b-shots/review-desktop-2.png)
- [review-mobile-1.png](/tmp/k2b-shots/review-mobile-1.png)
- [review-mobile-2.png](/tmp/k2b-shots/review-mobile-2.png)
- [review-stalls-1.png](/tmp/k2b-shots/review-stalls-1.png)
- [review-stalls-2.png](/tmp/k2b-shots/review-stalls-2.png)

Existing-screen regression captures (also visually sampled for additions and layout consistency):

- [desktop-boss.png](/tmp/k2b-shots/desktop-boss.png)
- [desktop-final-result.png](/tmp/k2b-shots/desktop-final-result.png)
- [desktop-hud.png](/tmp/k2b-shots/desktop-hud.png)
- [desktop-map-light.png](/tmp/k2b-shots/desktop-map-light.png)
- [desktop-map.png](/tmp/k2b-shots/desktop-map.png)
- [desktop-reward.png](/tmp/k2b-shots/desktop-reward.png)
- [desktop-title.png](/tmp/k2b-shots/desktop-title.png)
- [laptop-hud.png](/tmp/k2b-shots/laptop-hud.png)
- [phone-confirm.png](/tmp/k2b-shots/phone-confirm.png)
- [phone-end.png](/tmp/k2b-shots/phone-end.png)
- [phone-hud.png](/tmp/k2b-shots/phone-hud.png)
- [phone-intro.png](/tmp/k2b-shots/phone-intro.png)
- [phone-loss.png](/tmp/k2b-shots/phone-loss.png)
- [phone-map-light.png](/tmp/k2b-shots/phone-map-light.png)
- [phone-map.png](/tmp/k2b-shots/phone-map.png)
- [phone-reward.png](/tmp/k2b-shots/phone-reward.png)
- [phone-stats.png](/tmp/k2b-shots/phone-stats.png)
- [phone-title.png](/tmp/k2b-shots/phone-title.png)
- [phone-tutorial-board.png](/tmp/k2b-shots/phone-tutorial-board.png)
- [phone-tutorial-map.png](/tmp/k2b-shots/phone-tutorial-map.png)
- [phone-tutorial-reward.png](/tmp/k2b-shots/phone-tutorial-reward.png)
- [title-classic-desktop.png](/tmp/k2b-shots/title-classic-desktop.png)
- [title-classic-phone.png](/tmp/k2b-shots/title-classic-phone.png)
- [title-classic-run-desktop.png](/tmp/k2b-shots/title-classic-run-desktop.png)
- [title-classic-run-phone.png](/tmp/k2b-shots/title-classic-run-phone.png)
- [title-voyage-desktop.png](/tmp/k2b-shots/title-voyage-desktop.png)
- [title-voyage-phone.png](/tmp/k2b-shots/title-voyage-phone.png)
- [title-voyage-run-desktop.png](/tmp/k2b-shots/title-voyage-run-desktop.png)
- [title-voyage-run-phone.png](/tmp/k2b-shots/title-voyage-run-phone.png)
- [tree-board6-desktop.png](/tmp/k2b-shots/tree-board6-desktop.png)
- [tree-board6-phone.png](/tmp/k2b-shots/tree-board6-phone.png)
- [tree-one-pick-desktop.png](/tmp/k2b-shots/tree-one-pick-desktop.png)
- [tree-one-pick-phone.png](/tmp/k2b-shots/tree-one-pick-phone.png)
- [tree-start-desktop.png](/tmp/k2b-shots/tree-start-desktop.png)
- [tree-start-phone.png](/tmp/k2b-shots/tree-start-phone.png)
