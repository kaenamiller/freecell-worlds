// Eleven additional worlds. Shared construction keeps their card contrast and
// slot treatment consistent; materials, palette, lighting and atmosphere vary.
const rgb = (hex) => parseInt(hex.slice(1), 16);
const channels = (hex) => [16, 8, 0].map((shift) => ((rgb(hex) >> shift) & 255) / 255);
const rgba = (hex, alpha) => `rgba(${channels(hex).map((v) => Math.round(v * 255)).join(',')},${alpha})`;

const WORLDS = [
  {
    id: 'library', name: 'Midnight Library', tagline: 'Leather spines, green glass lamps and rain on tall windows.',
    font: 'Cormorant Garamond', bg: '#211812', panel: '#30231d', accent: '#d3b77b', secondary: '#86ad90',
    paper: ['#fff3db', '#eadbbd'], ink: '#231b16', red: '#a62e43', rail: '#652c38', inlay: '#ba9458',
    detail: 'wood', roughness: 0.8, key: '#ffe2ac', fill: '#aac5e6', ambient: '#efd7a1', count: 22,
  },
  {
    id: 'conservatory', name: 'Glasshouse Conservatory', tagline: 'Misted panes, fern fronds and afternoon rain.',
    font: 'Cormorant Garamond', bg: '#243d32', panel: '#2b483b', accent: '#d5e7bb', secondary: '#e4ae8e',
    paper: ['#fff9e8', '#e9ecd6'], ink: '#173b2c', red: '#b64338', rail: '#638d83', inlay: '#b9c59a',
    detail: 'paint', roughness: 0.85, key: '#f3f4da', fill: '#b9dadc', ambient: '#deedbb', count: 16,
    exposure: 0.98, vignette: 0.23,
  },
  {
    id: 'nighttrain', name: 'Night Train', tagline: 'Burgundy wool, a reading lamp and towns going by.',
    font: 'Cormorant Garamond', bg: '#172637', panel: '#202b39', accent: '#d6b980', secondary: '#dd93a4',
    paper: ['#fff3df', '#e9dbbf'], ink: '#202735', red: '#a62d45', rail: '#743944', inlay: '#b79960',
    detail: 'wood', roughness: 0.65, key: '#ffdfb0', fill: '#92b7e2', ambient: '#ddbb89', count: 14,
    vignette: 0.4,
  },
  {
    id: 'saffron', name: 'Saffron Court', tagline: 'Pierced brass, indigo cloth and tea going cold.',
    font: 'Cinzel', bg: '#20283e', panel: '#2a3045', accent: '#ebbf65', secondary: '#8fc8c0',
    paper: ['#fff3da', '#ebddbe'], ink: '#24314a', red: '#ae3042', rail: '#26334d', inlay: '#b78d50',
    detail: 'wood', roughness: 0.83, key: '#ffdc9e', fill: '#a6b9e9', ambient: '#ecc07a', count: 22,
  },
  {
    id: 'harvest', name: 'Amber Harvest', tagline: 'Barnwood, cider light and the last warm leaves.',
    font: 'Josefin Sans', bg: '#38261a', panel: '#483020', accent: '#f0be72', secondary: '#c7d18e',
    paper: ['#fff3d5', '#ecdbb5'], ink: '#38281b', red: '#b23b29', rail: '#765032', inlay: '#b9824e',
    detail: 'wood', roughness: 0.9, key: '#ffe0a6', fill: '#c4cce0', ambient: '#dfa15a', count: 20,
    particles: 'petals',
  },
  {
    id: 'carnival', name: 'Carnival Nocturne', tagline: 'Candy stripes, ferris bulbs and one last ride.',
    font: 'Josefin Sans', bg: '#24273f', panel: '#30334d', accent: '#efc36a', secondary: '#f0989d',
    paper: ['#fff6e4', '#efdfc7'], ink: '#222a47', red: '#b73547', rail: '#943d4b', inlay: '#efc36a',
    detail: 'cloth', roughness: 0.93, key: '#ffe6bf', fill: '#b3bce8', ambient: '#f8d898', count: 20,
    glow: 0.15,
  },
  {
    id: 'canyon', name: 'Canyon Turquoise', tagline: 'Adobe warmth, mesas at sundown and stone inlay.',
    font: 'Antonio', bg: '#46302c', panel: '#503932', accent: '#8acac1', secondary: '#edb887',
    paper: ['#fff1d9', '#e9d9bb'], ink: '#342725', red: '#b33f33', rail: '#a56248', inlay: '#429b9b',
    detail: 'slate', roughness: 0.94, key: '#ffe0ba', fill: '#c4b8db', ambient: '#e1bc96', count: 12,
    vignette: 0.26,
  },
  {
    id: 'lowtide', name: 'Low Tide', tagline: 'Wet slate, anemones and a pewter sky.',
    font: 'Cormorant Garamond', bg: '#263d46', panel: '#304b54', accent: '#b1d5cd', secondary: '#dfabb7',
    paper: ['#fcf8e9', '#e6e7db'], ink: '#183240', red: '#b13e58', rail: '#667c7d', inlay: '#9fadaa',
    detail: 'slate', roughness: 0.7, key: '#edf1df', fill: '#b4d3e1', ambient: '#c3e0e2', count: 12,
    clearcoat: 0.3, vignette: 0.23, caustics: { color: 0x9dc5c7, opacity: 0.04 },
  },
  {
    id: 'theater', name: 'Between Shows', tagline: 'Painted flats, one spotlight and dust in the beam.',
    font: 'Josefin Sans', bg: '#222226', panel: '#30282e', accent: '#d9bd80', secondary: '#8bc5c5',
    paper: ['#fff2de', '#e9d9be'], ink: '#25232b', red: '#b7384e', rail: '#9c4552', inlay: '#b79a63',
    detail: 'paint', roughness: 0.96, key: '#ffe8c3', fill: '#a7c7d7', ambient: '#eed9af', count: 16,
    vignette: 0.43,
  },
  {
    id: 'forge', name: 'Obsidian Forge', tagline: 'Black stone, molten seams and a hammer’s patience.',
    font: 'Cinzel', bg: '#24232b', panel: '#312c32', accent: '#ecaf60', secondary: '#ee9468',
    paper: ['#fff5e7', '#e8ddca'], ink: '#28232d', red: '#b53535', rail: '#45434b', inlay: '#d26939',
    detail: 'slate', roughness: 0.97, key: '#ffd3a0', fill: '#b2c6e3', ambient: '#ff9752', count: 20,
    glow: 0.35, vignette: 0.4,
  },
  {
    id: 'saloon', name: 'Frontier Saloon', tagline: 'Batwing doors, desert dusk and one more hand.',
    font: 'Antonio', bg: '#34271f', panel: '#48342a', accent: '#e7bd73', secondary: '#cda0c1',
    paper: ['#fff1d6', '#e8d6b2'], ink: '#33251b', red: '#af352e', rail: '#785338', inlay: '#ad8451',
    detail: 'wood', roughness: 0.94, key: '#ffdda7', fill: '#c6b5dc', ambient: '#d8ba8c', count: 18,
    vignette: 0.35,
  },
];

function worldTheme(w) {
  const light = channels(w.accent);
  return {
    id: w.id, name: w.name, tagline: w.tagline, fontFamily: w.font,
    css: {
      '--bg': w.bg, '--panel': rgba(w.panel, 0.94), '--panel-solid': w.panel,
      '--border': rgba(w.accent, 0.42), '--text': w.paper[0], '--muted': w.paper[1],
      '--accent': w.accent, '--accent-2': w.secondary, '--glow': rgba(w.accent, 0.24),
      '--radius': ['canyon', 'saloon', 'forge'].includes(w.id) ? '5px' : '9px',
      '--font-ui': `'${w.font}', ${w.font === 'Antonio' ? "'Arial Narrow', sans-serif" : w.font === 'Josefin Sans' ? "'Trebuchet MS', sans-serif" : 'Georgia, serif'}`,
    },
    card: {
      paper: w.paper, edge: rgb(w.paper[1]), border: w.inlay, indexFont: w.font, indexWeight: 700,
      suits: [w.ink, w.red, w.red, w.ink], outline: w.ink,
      fourColor: ['#205bb6', '#ce6811', w.red, w.ink], fx: 'none', courtFrame: w.inlay,
      courtWash: 0, emissive: 0, clearcoat: 0.08, backFit: 'cover',
    },
    scene: {
      clear: rgb(w.bg), exposure: w.exposure || 0.94, fog: [rgb(w.bg), 20, 46], env: 0.5,
      hemi: [rgb(w.key), rgb(w.bg), 0.65],
      key: { color: rgb(w.key), intensity: 2, pos: [5.5, 13, 6.5] },
      fill: { color: rgb(w.fill), intensity: 0.65, pos: [-7, 8, -5] },
      rim: { color: rgb(w.accent), intensity: 12, pos: [0, 7, -7] },
      accentLights: w.glow ? [{ color: rgb(w.secondary), intensity: 4, pos: [-6.5, 1.5, 1] }] : [],
      bloom: { strength: w.glow ? 0.2 : 0.12, radius: 0.55, threshold: 1.3 },
      vignette: w.vignette || 0.3, grain: 0.025, ao: 0.8,
    },
    table: {
      surface: { detail: w.detail, roughness: w.roughness, metalness: 0, clearcoat: w.clearcoat || 0.06,
        clearcoatRoughness: 0.6, normal: 0.65, emissive: 0, env: 0.2 },
      rail: { color: rgb(w.rail), roughness: 0.72, metalness: 0, clearcoat: 0.12, emissive: 0, emissiveIntensity: 0 },
      inlay: { color: rgb(w.inlay), roughness: 0.42, metalness: w.id === 'canyon' ? 0 : 0.65,
        emissive: w.glow ? rgb(w.inlay) : 0, emissiveIntensity: w.glow || 0 },
      finial: { color: rgb(w.inlay), roughness: 0.4, metalness: 0.55 }, base: rgb(w.bg),
      ...(w.caustics ? { caustics: w.caustics } : {}),
    },
    slots: {
      col: { fill: 'rgba(0,0,0,0.15)', stroke: rgba(w.paper[0], 0.52), dash: [18, 12], glow: 0 },
      free: { fill: 'rgba(0,0,0,0.25)', stroke: rgba(w.paper[0], 0.86), dash: [18, 10], glow: 0, mark: rgba(w.paper[0], 0.68) },
      found: { fill: 'rgba(0,0,0,0.3)', stroke: rgba(w.accent, 1), dash: [], glow: 0, inner: rgba(w.secondary, 0.65) },
    },
    particles: w.particles || 'motes', ambientColor: channels(w.ambient), ambientCount: w.count,
    fx: { spark: light, dust: channels(w.paper[1]), flash: rgb(w.accent) },
    confetti: [w.accent, w.secondary, ...w.paper, w.red].map(rgb),
    art: Object.fromEntries(['board', 'backdrop', 'env', 'back', 'hero', 'thumb', 'court_j', 'court_q', 'court_k']
      .map((key) => [key, `./assets/art/${w.id}/${key}.webp`])),
  };
}

export const EXPANSION_THEME_ORDER = WORLDS.map((w) => w.id);
export const EXPANSION_THEMES = Object.fromEntries(WORLDS.map((w) => [w.id, worldTheme(w)]));
