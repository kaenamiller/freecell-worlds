import { checkOverrideCharm } from './concrete.spraytag.mjs';
export async function check(h) {
  await checkOverrideCharm(h, 'theater.understudy', { ignoreRank: true, ignoreColour: true }, true, false, [1, 2, 3]);
}
