// Shared by the API tests: a cookie-jar client per simulated browser, and email links
// read from the wrangler log.
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

export const API = process.env.FCW_API_URL || 'http://localhost:8787';
export const LOG = process.env.FCW_API_LOG || '/tmp/fcw-api.log';
export const ORIGIN = 'http://localhost:8080';
export const CAPTCHA = 'XXXX.DUMMY.TOKEN.XXXX'; // accepted by the Turnstile test secret
export const PASSWORD = 'tidepool lantern 47 maple';

// Minimal cookie jar for one browser.
// Each client gets its own address so Better Auth's per-IP limits don't spill between tests.
let ipSeq = Math.floor(Math.random() * 200);
export function client() {
  const jar = new Map();
  const ip = `198.18.${ipSeq % 250}.${(ipSeq++ % 250) + 1}`;
  return async (path, { method = 'GET', body, captcha, headers = {} } = {}) => {
    const res = await fetch(API + path, {
      method,
      redirect: 'manual',
      headers: {
        Origin: ORIGIN,
        'cf-connecting-ip': ip,
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(captcha && { 'x-captcha-response': CAPTCHA }),
        ...(jar.size && { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, headers: res.headers };
  };
}

export async function emailLink(to, subject) {
  for (let i = 0; i < 20; i++) {
    const log = readFileSync(LOG, 'utf8');
    const blocks = log.split('[email] ').filter((b) => b.startsWith(`to=${to} subject=${subject}`));
    const url = blocks.at(-1)?.match(/https?:\/\/\S+/)?.[0];
    if (url) return url;
    await sleep(250);
  }
  throw new Error(`no "${subject}" email for ${to}`);
}

