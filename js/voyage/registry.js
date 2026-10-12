// The charm registry. Kept free of imports from the rest of Voyage so content modules
// (js/voyage/content/*) can register charms without a circular import through charms.js.
export const CHARMS = {};

export function defineCharm(def) {
  if (CHARMS[def.id]) throw new Error(`Duplicate charm id ${def.id}`);
  CHARMS[def.id] = { on: {}, ...def };
  return CHARMS[def.id];
}
