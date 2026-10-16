// Cookie and wrangler config. These do not need a running API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authOptions } from '../src/auth.js';

const base = {
  BETTER_AUTH_URL: 'https://api.freecellworlds.com',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  TRUSTED_ORIGINS: 'https://freecellworlds.com',
  TURNSTILE_SECRET_KEY: 'turnstile',
};

test('production sessions use the parent domain and the fcw cookie name', () => {
  const options = authOptions({ ...base, COOKIE_DOMAIN: 'freecellworlds.com', COOKIE_PREFIX: 'fcw' });
  assert.equal(options.advanced.cookiePrefix, 'fcw');
  assert.deepEqual(options.advanced.crossSubDomainCookies, { enabled: true, domain: 'freecellworlds.com' });
});

test('staging sessions are host-only and do not reuse the production cookie name', () => {
  const options = authOptions({
    ...base,
    BETTER_AUTH_URL: 'https://api-staging.freecellworlds.com',
    TRUSTED_ORIGINS: 'https://staging.freecellworlds.com,http://localhost:8080,http://127.0.0.1:8080',
    COOKIE_DOMAIN: '',
    COOKIE_PREFIX: 'fcw-staging',
  });
  assert.equal(options.advanced.cookiePrefix, 'fcw-staging');
  assert.equal(options.advanced.crossSubDomainCookies, undefined);
  assert.notEqual(options.advanced.cookiePrefix, 'fcw');
  assert.deepEqual(options.trustedOrigins, ['https://staging.freecellworlds.com', 'http://localhost:8080', 'http://127.0.0.1:8080']);
});

test('wrangler.toml points production and staging at the provisioned resources', () => {
  const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const staging = toml.split(/^\[env\.staging\]$/m)[1];
  assert.ok(staging, 'missing [env.staging]');
  assert.match(toml, /account_id = "489793938d73b69a961a8b3795cc1f11"/);
  assert.match(toml, /database_name = "freecell-worlds"\ndatabase_id = "8d4f72c3-98ac-4ad1-af49-60b9252b27bb"/);
  assert.match(staging, /name = "freecell-worlds-api-staging"/);
  assert.match(staging, /api-staging\.freecellworlds\.com/);
  assert.match(staging, /staging\.freecellworlds\.com/);
  assert.match(staging, /http:\/\/localhost:8080/);
  assert.match(staging, /database_name = "freecell-worlds-staging"\ndatabase_id = "c1af33a8-3b29-4146-b396-7ead7aa4b6e9"/);
  assert.match(staging, /bucket_name = "freecell-worlds-theme-assets-staging"/);
  assert.match(staging, /name = "freecell-worlds-theme-generation-staging"/);
  assert.match(staging, /COOKIE_DOMAIN = ""/);
  assert.match(staging, /COOKIE_PREFIX = "fcw-staging"/);
  assert.match(staging, /GEN_MOCK = "1"/);
  assert.doesNotMatch(staging, /COOKIE_DOMAIN = "freecellworlds.com"/);
  assert.doesNotMatch(staging, /TURNSTILE_SECRET_KEY/);
  const clientId = '895742309264-uprjg6dj8eliu9sr7mf9u866gpfnbuol.apps.googleusercontent.com';
  assert.equal(toml.split(clientId).length - 1, 2);
  assert.match(staging, new RegExp(clientId.replace(/[.]/g, '\\.')));
});

test('hosted pages use the real Turnstile site key and localhost keeps the test key', () => {
  const src = readFileSync(new URL('../../js/account.js', import.meta.url), 'utf8');
  assert.match(src, /0x4AAAAAAFYovaiTyTegTnzy/);
  assert.match(src, /1x00000000000000000000AA/);
  assert.doesNotMatch(src, /0x4AAAAAAA_REPLACE_ME/);
  assert.match(src, /turnstileSiteKey: local \? '1x00000000000000000000AA' : '0x4AAAAAAFYovaiTyTegTnzy'/);
});
