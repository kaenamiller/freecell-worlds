import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWorkerNotFound, parseSecretNames, secretsToUpload } from '../scripts/prepare-deploy-secrets.mjs';

const notFound = `Worker "freecell-worlds-api-staging" (env: staging) not found.

If this is a new Worker, run \`wrangler deploy\` first to create it.
Otherwise, check that the Worker name is correct and you're logged into the right account.`;

test('a missing worker is an empty secret list, and other failures are not', () => {
  assert.equal(isWorkerNotFound(1, notFound), true);
  assert.equal(isWorkerNotFound(1, 'Worker "freecell-worlds-api" not found.\n\nIf this is a new Worker, run `wrangler deploy` first to create it.'), true);
  assert.equal(isWorkerNotFound(0, notFound), false);
  assert.equal(isWorkerNotFound(1, 'In a non-interactive environment, it\'s necessary to set a CLOUDFLARE_API_TOKEN'), false);
  assert.equal(isWorkerNotFound(1, 'Authentication error'), false);
});

test('secret names come from the JSON array wrangler prints', () => {
  const stdout = '⛅️ wrangler\n[\n  { "name": "BETTER_AUTH_SECRET", "type": "secret_text" }\n]\n';
  assert.deepEqual(parseSecretNames(stdout), ['BETTER_AUTH_SECRET']);
  assert.throws(() => parseSecretNames('no json here'));
});

test('the first deploy uploads a new auth secret and does not rotate one that exists', () => {
  const created = secretsToUpload({ existing: [], turnstileFromEnv: '', googleFromEnv: '', generateAuth: () => 'generated-secret' });
  assert.deepEqual(created, { BETTER_AUTH_SECRET: 'generated-secret' });

  const kept = secretsToUpload({
    existing: ['BETTER_AUTH_SECRET', 'TURNSTILE_SECRET_KEY', 'GOOGLE_CLIENT_SECRET', 'RESEND_API_KEY'],
    turnstileFromEnv: '',
    googleFromEnv: '',
    resendFromEnv: '',
    generateAuth: () => 'rotated',
  });
  assert.deepEqual(kept, {});
});

test('Turnstile, Google, and Resend secrets from GitHub are written when missing or changed', () => {
  const uploaded = secretsToUpload({
    existing: ['BETTER_AUTH_SECRET', 'TURNSTILE_SECRET_KEY'],
    turnstileFromEnv: 'turnstile-secret',
    googleFromEnv: 'google-secret',
    resendFromEnv: 'resend-secret',
    generateAuth: () => 'rotated',
  });
  assert.deepEqual(uploaded, {
    TURNSTILE_SECRET_KEY: 'turnstile-secret',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    RESEND_API_KEY: 'resend-secret',
  });
  assert.equal(uploaded.BETTER_AUTH_SECRET, undefined);
});
