import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resendResultLine, sendEmail } from '../src/email.js';

test('a successful Resend response logs the id and not the message', () => {
  assert.equal(
    resendResultLine(200, '{"id":"49a3999c-0ce1-4ea6-ab68-afcd6dc2e794"}'),
    '[email] Resend 200 id=49a3999c-0ce1-4ea6-ab68-afcd6dc2e794',
  );
});

test('a Resend error keeps the message and drops links and keys', () => {
  const line = resendResultLine(403, '{"message":"domain not verified https://resend.com/docs/x","name":"validation_error"} re_secretkey');
  assert.match(line, /^\[email\] Resend 403:/);
  assert.match(line, /domain not verified/);
  assert.doesNotMatch(line, /https?:/);
  assert.match(line, /\[redacted\]/);
  assert.doesNotMatch(line, /re_secretkey/);
});

test('sendEmail reports a thrown request without throwing', async () => {
  const lines = [];
  const original = console.error;
  console.error = (line) => lines.push(line);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('network down https://api.resend.com/emails'); };
  try {
    await sendEmail(
      { RESEND_API_KEY: 're_testkey', EMAIL_FROM: 'FreeCell Worlds <accounts@mail.freecellworlds.com>' },
      { to: 'opsdoug+staging2@mail.grokbot.com', subject: 's', text: 't', html: '<p>t</p>' },
    );
  } finally {
    console.error = original;
    globalThis.fetch = originalFetch;
  }
  assert.equal(lines.length, 1);
  assert.match(lines[0], /Resend request failed: network down \[url\] to=opsdoug\+staging2@mail.grokbot.com/);
  assert.doesNotMatch(lines[0], /re_testkey/);
});
