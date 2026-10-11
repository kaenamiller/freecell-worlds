// Tiny persistent key/value store (localStorage) for settings and stats.
const PREFIX = 'freecellworlds.';
const LEGACY_PREFIX = 'freecell3d.';

// One-time migration from the pre-rename namespace so existing players keep
// their settings, stats and daily progress.
try {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LEGACY_PREFIX)) {
      const migrated = PREFIX + key.slice(LEGACY_PREFIX.length);
      if (localStorage.getItem(migrated) == null) localStorage.setItem(migrated, localStorage.getItem(key));
    }
  }
} catch {
  /* storage unavailable (private mode / quota) — ignore */
}

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
  titleMode: 'classic',
  autoRandomTheme: true,
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
  cursorLight: true,
};

export const settings = load('settings', defaultSettings);
// Preserve the old pointer-effect preference when upgrading existing settings.
const savedSettings = load('settings', {});
if (savedSettings.cursorLight === undefined && savedSettings.parallax !== undefined) {
  settings.cursorLight = !!savedSettings.parallax;
}
delete settings.parallax;
export function saveSettings() {
  save('settings', settings);
}
