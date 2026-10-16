// Decide which Worker secrets a deploy should upload.
// `wrangler secret list` and `wrangler secret put` both fail when the Worker
// does not exist yet, so the first deploy sends missing secrets with
// `wrangler deploy --secrets-file` instead. Existing secrets are left alone.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, chmodSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SECRETS_PATH = join(tmpdir(), 'fcw-deploy-secrets.json');

export function isWorkerNotFound(status, output) {
  // Wrangler prints `Worker "name" not found` or `Worker "name" (env: staging) not found`,
  // then tells you to deploy first. Require both so an auth failure is not treated as empty.
  return status !== 0 && /Worker "[^"]+".* not found/.test(output) && /new Worker/.test(output);
}

export function parseSecretNames(stdout) {
  const start = stdout.indexOf('[');
  const end = stdout.lastIndexOf(']');
  if (start < 0 || end < start) {
    throw new Error('wrangler secret list did not print a JSON array');
  }
  const secrets = JSON.parse(stdout.slice(start, end + 1));
  if (!Array.isArray(secrets)) throw new Error('wrangler secret list JSON was not an array');
  return secrets.map((secret) => secret.name);
}

// Only secrets that are absent. A value already on the Worker is never replaced,
// so a later deploy does not rotate BETTER_AUTH_SECRET.
export function secretsToUpload({ existing, turnstileFromEnv, generateAuth = () => randomBytes(32).toString('base64') }) {
  const toSet = {};
  if (!existing.includes('BETTER_AUTH_SECRET')) toSet.BETTER_AUTH_SECRET = generateAuth();
  if (turnstileFromEnv && !existing.includes('TURNSTILE_SECRET_KEY')) toSet.TURNSTILE_SECRET_KEY = turnstileFromEnv;
  return toSet;
}

function wranglerEnvArgs(envName) {
  if (envName === undefined) return [];
  return [`--env=${envName}`];
}

function readEnvArg(argv) {
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--env') return argv[i + 1] ?? '';
    if (arg.startsWith('--env=')) return arg.slice('--env='.length);
  }
  return undefined;
}

function main() {
  const envName = readEnvArg(process.argv);
  const result = spawnSync('npx', ['--no-install', 'wrangler', 'secret', 'list', '--format', 'json', ...wranglerEnvArgs(envName)], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const status = result.status ?? 1;
  let existing;
  if (isWorkerNotFound(status, `${stderr}\n${stdout}`)) {
    existing = [];
    console.error('Worker does not exist yet. Deploy will create it and upload any missing secrets.');
  } else if (status !== 0) {
    process.stderr.write(stderr);
    process.stdout.write(stdout);
    process.exit(status);
  } else {
    existing = parseSecretNames(stdout);
  }

  const toSet = secretsToUpload({ existing, turnstileFromEnv: process.env.TURNSTILE_SECRET_KEY || '' });
  if (toSet.BETTER_AUTH_SECRET) console.error('Deploy will store a new BETTER_AUTH_SECRET. The value is not printed.');
  else console.error('BETTER_AUTH_SECRET is already set. Leaving it unchanged.');
  if (toSet.TURNSTILE_SECRET_KEY) console.error('Deploy will store TURNSTILE_SECRET_KEY from the GitHub environment secret.');
  else if (existing.includes('TURNSTILE_SECRET_KEY')) console.error('TURNSTILE_SECRET_KEY is already set. Leaving it unchanged.');
  else console.error('::warning::TURNSTILE_SECRET_KEY is not on the worker. Sign-up captcha fails until that secret is set (GitHub environment secret TURNSTILE_SECRET_KEY, or wrangler secret put).');

  let arg = '';
  if (Object.keys(toSet).length > 0) {
    writeFileSync(SECRETS_PATH, JSON.stringify(toSet), { mode: 0o600 });
    chmodSync(SECRETS_PATH, 0o600);
    arg = ` --secrets-file ${SECRETS_PATH}`;
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `secrets_arg=${arg}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
