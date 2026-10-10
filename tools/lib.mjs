// Shared helpers for the asset-generation scripts. API keys are read from an
// env file outside this repo (FREECELL_ENV or the sibling mahjpods project) and
// are never written into the project.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const candidates = [
  process.env.FREECELL_ENV,
  join(homedir(), 'Documents/mahjpods/.env'),
  join(process.cwd(), '.env'),
].filter(Boolean);

for (const p of candidates) {
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

export function need(name) {
  if (!process.env[name]) throw new Error(`${name} not found (looked in ${candidates.join(', ')})`);
  return process.env[name];
}

export function save(path, buf) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
}

export async function pool(items, limit, fn) {
  const queue = [...items];
  const workers = Array.from({ length: limit }, async () => {
    while (queue.length) await fn(queue.shift());
  });
  await Promise.all(workers);
}

export async function retry(fn, tries = 3) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      err = e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw err;
}
