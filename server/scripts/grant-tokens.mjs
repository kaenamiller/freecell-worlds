// Grant Theme Tokens to a player by email (support, testing, or before Stripe is live).
//   node scripts/grant-tokens.mjs player@example.com 3            (local database)
//   node scripts/grant-tokens.mjs player@example.com 3 --remote   (production)
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const [email, count, ...flags] = process.argv.slice(2);
const n = Number(count);
if (!email || !Number.isInteger(n) || n === 0) {
  console.error('usage: node scripts/grant-tokens.mjs <email> <count> [--remote]');
  process.exit(1);
}
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const sql = `INSERT INTO token_ledger (id, user_id, delta, reason, created_at)
  SELECT ${q(randomUUID())}, id, ${n}, 'grant', ${Date.now()} FROM user WHERE email = ${q(email.toLowerCase())};
  SELECT u.email, COALESCE(SUM(l.delta), 0) AS tokens FROM user u LEFT JOIN token_ledger l ON l.user_id = u.id WHERE u.email = ${q(email.toLowerCase())} GROUP BY u.id;`;
const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'freecell-worlds', flags.includes('--remote') ? '--remote' : '--local', '--json', '--command', sql], { encoding: 'utf8' });
const rows = JSON.parse(out).at(-1).results;
if (!rows.length) {
  console.error(`No account with email ${email}.`);
  process.exit(1);
}
console.log(`${rows[0].email} now has ${rows[0].tokens} token(s).`);
