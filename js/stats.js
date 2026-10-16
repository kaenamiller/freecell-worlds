// Player statistics, daily challenge and achievements (persisted in localStorage).
import { load, save, track } from './store.js';

const blank = {
  played: 0,
  won: 0,
  streak: 0,
  bestStreak: 0,
  bestTime: 0,
  bestMoves: 0,
  totalTime: 0,
  themesWon: {},
  daily: {},
  achievements: {},
};

export const stats = track('stats', load('stats', blank), blank);
const persist = () => save('stats', stats);

export function resetStats() {
  Object.assign(stats, JSON.parse(JSON.stringify(blank)));
  persist();
}

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Deterministic deal number for a date (FNV-1a hash), so everyone gets the same daily.
export function dailyDealNumber(key = todayKey()) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 1 + ((h >>> 0) % 1000000);
}

export const dailyDone = () => !!stats.daily[todayKey()]?.won;

export const ACHIEVEMENTS = [
  { id: 'first', icon: '★', name: 'First Victory', desc: 'Win your first deal', test: (s) => s.won >= 1 },
  { id: 'ten', icon: 'X', name: 'Veteran', desc: 'Win 10 deals', test: (s) => s.won >= 10 },
  { id: 'streak3', icon: '🔥', name: 'Hot Streak', desc: 'Win 3 in a row', test: (s) => s.streak >= 3 },
  { id: 'speed', icon: '⚡', name: 'Speed Demon', desc: 'Win in under 3 minutes', test: (s, r) => r.time < 180 },
  { id: 'purist', icon: '♛', name: 'Purist', desc: 'Win without undo or hints', test: (s, r) => r.undos === 0 && r.hints === 0 },
  { id: 'daily', icon: '☀', name: 'Daily Driver', desc: 'Complete a daily challenge', test: (s, r) => r.daily },
  { id: 'traveler', icon: '🌍', name: 'World Traveler', desc: 'Win on all three tables', test: (s) => Object.keys(s.themesWon).length >= 3 },
  { id: 'efficient', icon: '✦', name: 'Efficient', desc: 'Win in under 90 moves', test: (s, r) => r.moves < 90 },
];

export function recordStart() {
  stats.played++;
  persist();
}

export function recordLoss() {
  stats.streak = 0;
  persist();
}

// Returns { newBestTime, newBestMoves, unlocked: [achievement] }.
export function recordWin({ time, moves, undos, hints, theme, daily }) {
  stats.won++;
  stats.streak++;
  stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
  stats.totalTime += time;
  stats.themesWon[theme] = (stats.themesWon[theme] || 0) + 1;
  const newBestTime = !stats.bestTime || time < stats.bestTime;
  const newBestMoves = !stats.bestMoves || moves < stats.bestMoves;
  if (newBestTime) stats.bestTime = time;
  if (newBestMoves) stats.bestMoves = moves;
  if (daily) stats.daily[todayKey()] = { won: true, time, moves };
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (!stats.achievements[a.id] && a.test(stats, { time, moves, undos, hints, daily })) {
      stats.achievements[a.id] = Date.now();
      unlocked.push(a);
    }
  }
  persist();
  return { newBestTime, newBestMoves, unlocked };
}

export const fmtTime = (s) => {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};
