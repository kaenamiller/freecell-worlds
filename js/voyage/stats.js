// Voyage statistics, kept apart from classic stats (js/stats.js).
import { load, save } from '../store.js';
import { totalScore, totalStars } from './run.js';

const blank = {
  runs: 0,
  wins: 0,
  losses: 0,
  boardsCleared: 0,
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

export const voyageStats = load('voyageStats', blank);
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

// Call once when a run ends ('won' or 'lost').
export function recordRunEnd(run) {
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
  if (run.daily && !voyageStats.daily[run.daily]) voyageStats.daily[run.daily] = { won, board, score, stars };
  voyageStats.recent.unshift({ seed: run.seed, daily: run.daily, won, board, score, stars, at: Date.now() });
  voyageStats.recent.length = Math.min(voyageStats.recent.length, 10);
  persist();
}

export const dailyVoyageResult = (key) => voyageStats.daily[key] || null;

export function resetVoyageStats() {
  Object.assign(voyageStats, JSON.parse(JSON.stringify(blank)));
  persist();
}
