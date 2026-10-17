// First-party ingest against a running local API (see test/api.test.mjs).
// Google Analytics stays unwired: js/analytics-config.js has an empty measurement id.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANALYTICS } from '../../js/analytics-config.js';
import { lintSchema } from '../../js/analytics-schema.js';
import { API, ORIGIN, client } from './helpers.mjs';

test('Google Analytics stays disabled until a measurement id exists', () => {
  assert.equal(ANALYTICS.gaMeasurementId, '');
  assert.equal(ANALYTICS.api, '');
});

test('the analytics event schema lints', () => {
  assert.deepEqual(lintSchema(), []);
});

test('public config is separate from the accounts config', async () => {
  const accounts = await client()('/v1/config');
  assert.equal(accounts.status, 200);
  assert.equal(accounts.json.google, false);
  assert.equal('analytics' in accounts.json, false);

  const analytics = await client()('/config');
  assert.equal(analytics.status, 200);
  assert.equal(analytics.json.analytics.enabled, true);
  assert.equal(typeof analytics.json.consentRequired, 'boolean');
});

test('a first-party batch is stored and a duplicate id is ignored', async () => {
  const id = crypto.randomUUID();
  const batch = {
    v: 1,
    app: 'dev',
    mode: 'full',
    pid: crypto.randomUUID(),
    events: [{
      id,
      n: 'app_ready',
      t: Date.now(),
      sid: crypto.randomUUID(),
      s: 1,
      c: { mode: 'menu', theme_id: 'roman' },
      p: { load_ms: 1200, quality_auto: 'high', cores: 4, standalone: false },
    }],
  };
  const send = () => fetch(API + '/events', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'text/plain', 'User-Agent': 'freecell-worlds-test' },
    body: JSON.stringify(batch),
  });
  const first = await send();
  assert.equal(first.status, 204);
  const again = await send();
  assert.equal(again.status, 204);
});

test('an unknown event does not fail the whole batch', async () => {
  const res = await fetch(API + '/events', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'text/plain', 'User-Agent': 'freecell-worlds-test' },
    body: JSON.stringify({
      v: 1,
      mode: 'anonymous',
      events: [
        { id: crypto.randomUUID(), n: 'not_an_event', t: Date.now(), p: {} },
        { id: crypto.randomUUID(), n: 'webgl_context_lost', t: Date.now(), p: {} },
      ],
    }),
  });
  assert.equal(res.status, 204);
});

test('a batch that is not JSON is refused', async () => {
  const res = await fetch(API + '/events', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'text/plain' },
    body: 'hello',
  });
  assert.equal(res.status, 400);
});
