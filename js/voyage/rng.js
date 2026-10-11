// Seeded randomness for Voyage. Every random choice in a run (map, charm offers, deal picks,
// challenge setup) derives from the run seed plus a label, so a run is reproducible from its
// seed and the player's choices — which is what makes the Daily Voyage shareable.

// 32-bit FNV-1a over a string.
export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32: small, fast, good enough for gameplay.
export function rng(seed) {
  let a = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (n) => Math.floor(next() * n);
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.shuffle = (arr) => {
    const a2 = arr.slice();
    for (let i = a2.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [a2[i], a2[j]] = [a2[j], a2[i]];
    }
    return a2;
  };
  return next;
}

// A stream for one purpose within a run: `stream(run.seed, 'map', row)`.
export const stream = (seed, ...labels) => rng(`${seed}|${labels.join('|')}`);

export const randomSeed = () => Math.random().toString(36).slice(2, 10);
