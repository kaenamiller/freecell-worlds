import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deployTargets } from './ci-deploy-targets.mjs';

test('a server change deploys the API and leaves the site', () => {
  assert.deepEqual(deployTargets(['server/src/index.js']), { api: true, web: false });
});

test('a game change deploys the site and leaves the API', () => {
  assert.deepEqual(deployTargets(['js/account.js', 'css/style.css']), { api: false, web: true });
  assert.deepEqual(deployTargets(['assets/music/zen.mp3']), { api: false, web: true });
});

test('docs and tool scripts do not deploy either target', () => {
  assert.deepEqual(deployTargets(['docs/accounts.md', 'tools/gen-art.mjs', 'assets-src/theme.png']), { api: false, web: false });
});

test('the workflow file deploys both, and a manual run deploys only the API', () => {
  assert.deepEqual(deployTargets(['.github/workflows/deploy-api.yml']), { api: true, web: true });
  assert.deepEqual(deployTargets([], { event: 'workflow_dispatch' }), { api: true, web: false });
});

test('a push GitHub truncated, or one with no file list, deploys both', () => {
  assert.deepEqual(deployTargets(['docs/accounts.md'], { truncated: true }), { api: true, web: true });
  assert.deepEqual(deployTargets([]), { api: true, web: true });
});

test('the staging site worker is only attached to staging.freecellworlds.com', () => {
  const toml = readFileSync(new URL('../web/wrangler.toml', import.meta.url), 'utf8');
  assert.match(toml, /name = "freecell-worlds-web-staging"/);
  assert.match(toml, /pattern = "staging\.freecellworlds\.com"/);
  assert.match(toml, /custom_domain = true/);
  assert.doesNotMatch(toml, /pattern = "freecellworlds\.com"/);
  assert.doesNotMatch(toml, /pattern = "www\.freecellworlds\.com"/);
  assert.doesNotMatch(toml, /\*\.freecellworlds\.com/);
  assert.match(toml, /directory = "\.\/public"/);
});
