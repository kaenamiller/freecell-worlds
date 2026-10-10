// Tiny persistent key/value store (localStorage) for settings and stats.
const PREFIX = 'freecell3d.';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return fallback && typeof fallback === 'object' && !Array.isArray(fallback) ? { ...fallback, ...parsed } : parsed;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode / quota) — ignore */
  }
}

export const defaultSettings = {
  theme: 'roman',
  master: 0.9,
  sfx: 0.9,
  music: 0.45,
  ambience: 0.5,
  muted: false,
  quality: 'auto', // auto | high | medium | low
  autoFoundation: true,
  fourColor: false,
  highContrast: false,
  reducedMotion: false,
  parallax: true,
};

export const settings = load('settings', defaultSettings);
export function saveSettings() {
  save('settings', settings);
}
