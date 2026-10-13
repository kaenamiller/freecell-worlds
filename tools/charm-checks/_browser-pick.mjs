// Shared by the *-browser.mjs checks: answer an ability's target pick by clicking
// the target where it is drawn, through the same pointer path a player uses.
// The content harness imports every extension, so this exports a no-op check.
export async function check() {}

// which: 'first' (lowest legal value, the old picker's first circle), or a value
// (card id, column or cell index). Resolves to the value clicked.
export async function clickTarget(page, which = 'first', { timeout = 15000 } = {}) {
  await page.waitForFunction(() => !!window.FreeCell?.voyage.targeting(), { timeout });
  const point = await page.evaluate((which) => {
    // Some checks throttle rendering (x2 draws every 60th frame); hit-testing reads
    // world matrices, which otherwise refresh only when a frame is drawn.
    FreeCell.scene.updateMatrixWorld();
    const t = FreeCell.voyage.targeting();
    const value = which === 'first' ? Math.min(...t.values) : which;
    if (!t.values.includes(value)) return { error: `${t.kind} ${value} is not a legal target (${t.values.join(', ')})` };
    const p = t.kind === 'card' ? FreeCell.projectCard(value, true) : FreeCell.projectSlot(t.kind === 'column' ? 'col' : 'free', value);
    return { ...p, value };
  }, which);
  if (point.error) throw new Error(point.error);
  await page.mouse.click(point.x, point.y);
  await new Promise((resolve) => setTimeout(resolve, 120));
  return point.value;
}

// Answer an ability's menu (Glaze direction, Misprint sticker, Broken Seal obstacle…).
export async function clickChoice(page, index, { timeout = 15000 } = {}) {
  await page.waitForSelector(`.voyage-choice [data-choice="${index}"]`, { timeout });
  await page.click(`.voyage-choice [data-choice="${index}"]`);
  await new Promise((resolve) => setTimeout(resolve, 120));
}
