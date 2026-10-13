// Voyage statistics, kept apart from classic stats (js/stats.js).
import { load, save } from '../store.js';
import { totalScore, totalStars } from './run.js';
import { economy } from './port.js';

const blank = {
  runs: 0,
  wins: 0,
  losses: 0,
  boardsCleared: 0,
  coinsEarned: 0,
  coinsSpent: 0,
  portVisits: 0,
  stickersBought: 0,
  upgrades: 0,
  bestBoard: 0, // furthest board reached (1..7)
  bestScore: 0,
  bestStars: 0,
  winStreak: 0,
  bestWinStreak: 0,
  themeClears: {}, // themeId -> boards cleared on it
  charmPicks: {}, // charmId -> times picked
  daily: {}, // 'YYYY-MM-DD' -> { won, board, score, stars }
  recent: [], // last 10 runs: { seed, daily, won, board, score, stars, at }
};

export const voyageStats = load('voyageStats', JSON.parse(JSON.stringify(blank)));
const persist = () => save('voyageStats', voyageStats);

export function recordRunStart() {
  voyageStats.runs++;
  persist();
}

export function recordBoardCleared(result) {
  voyageStats.boardsCleared++;
  voyageStats.themeClears[result.theme] = (voyageStats.themeClears[result.theme] || 0) + 1;
  voyageStats.bestBoard = Math.max(voyageStats.bestBoard, result.idx + 1);
  persist();
}

export function recordCharmPick(id) {
  voyageStats.charmPicks[id] = (voyageStats.charmPicks[id] || 0) + 1;
  persist();
}

// Model counters and this saved watermark make repeated renders/resumes idempotent.
export function recordEconomy(run) {
  const totals = economy(run);
  // Run-level runtime hooks may mutate the purse directly (on.win, for example).
  const extra = run.coins - (totals.coinsEarned - totals.coinsSpent);
  if (extra > 0) totals.coinsEarned += extra;
  else if (extra < 0) totals.coinsSpent -= extra;
  const recorded = (run.recordedEconomy ??= {});
  for (const key of ['coinsEarned', 'coinsSpent', 'portVisits', 'stickersBought', 'upgrades']) {
    voyageStats[key] += Math.max(0, totals[key] - (recorded[key] || 0));
    recorded[key] = totals[key];
  }
  persist();
}

// Call once when a run ends ('won' or 'lost').
export function recordRunEnd(run) {
  recordEconomy(run);
  const won = run.status === 'won';
  const score = totalScore(run);
  const stars = totalStars(run);
  const board = Math.min(7, run.results.length + (won ? 0 : 1));
  if (won) {
    voyageStats.wins++;
    voyageStats.winStreak++;
    voyageStats.bestWinStreak = Math.max(voyageStats.bestWinStreak, voyageStats.winStreak);
  } else {
    voyageStats.losses++;
    voyageStats.winStreak = 0;
  }
  voyageStats.bestBoard = Math.max(voyageStats.bestBoard, board);
  voyageStats.bestScore = Math.max(voyageStats.bestScore, score);
  voyageStats.bestStars = Math.max(voyageStats.bestStars, stars);
  const purse = { coins: run.coins, ...economy(run) };
  if (run.daily && !voyageStats.daily[run.daily]) voyageStats.daily[run.daily] = { won, board, score, stars, ...purse };
  voyageStats.recent.unshift({ seed: run.seed, daily: run.daily, won, board, score, stars, ...purse, at: Date.now() });
  voyageStats.recent.length = Math.min(voyageStats.recent.length, 10);
  persist();
}

export const dailyVoyageResult = (key) => voyageStats.daily[key] || null;

export function resetVoyageStats() {
  Object.assign(voyageStats, JSON.parse(JSON.stringify(blank)));
  persist();
}
