// The charm registry. Kept free of imports from the rest of Voyage so content modules
// (js/voyage/content/*) can register charms without a circular import through charms.js.
export const CHARMS = {};

export const CHARM_FAMILIES = Object.freeze(['cells', 'columns', 'wild', 'suit', 'foundation', 'ability', 'undo', 'coin', 'vision', 'sticker', 'fortune']);
export const familyCount = (ids, name) => ids.filter((id) => CHARMS[id]?.kind === 'boon' && CHARMS[id].family === name).length;

export function defineCharm(def) {
  if (CHARMS[def.id]) throw new Error(`Duplicate charm id ${def.id}`);
  CHARMS[def.id] = { on: {}, ...def };
  return CHARMS[def.id];
}
