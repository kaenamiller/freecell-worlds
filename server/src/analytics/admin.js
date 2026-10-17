// Private analytics dashboard. The page and the summary are both checked here:
// a Better Auth session, then an email allowlist from ADMIN_EMAILS. The allowlist
// is never sent to the browser. Numbers come only from the 0003 analytics tables.

const RANGES = [7, 30, 90];
const NO_STORE = { 'Cache-Control': 'no-store' };

export function adminEmails(env) {
  return new Set(String(env?.ADMIN_EMAILS || '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean));
}

// Inclusive UTC dates ending today. `days` is 7, 30, or 90.
export function dateRange(days, now = Date.now()) {
  const end = new Date(now);
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const daysList = [];
  for (let i = days - 1; i >= 0; i--) daysList.push(new Date(endUtc - i * 86400000).toISOString().slice(0, 10));
  return { days, start: daysList[0], end: daysList[daysList.length - 1], daysList };
}

// Read-only session lookup. Missing and non-allowlisted sessions are the same result,
// so the response does not reveal who is on the list.
export async function adminUser(c) {
  const session = await c.get('auth').api.getSession({ headers: c.req.raw.headers });
  const email = session?.user?.email;
  if (typeof email !== 'string') return null;
  if (!adminEmails(c.env).has(email.trim().toLowerCase())) return null;
  return session.user;
}

function forbidden(c, html) {
  if (html) return c.html(forbiddenPage(), 403, NO_STORE);
  return c.json({ code: 'FORBIDDEN', message: 'Not available.' }, 403, NO_STORE);
}

export async function adminPage(c) {
  if (!await adminUser(c)) return forbidden(c, true);
  const requested = Number(c.req.query('days') || 7);
  const days = RANGES.includes(requested) ? requested : 7;
  return c.html(dashboardPage(days), 200, {
    ...NO_STORE,
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
}

export async function adminSummary(c) {
  if (!await adminUser(c)) return forbidden(c, false);
  const days = Number(c.req.query('days'));
  if (!RANGES.includes(days)) return c.json({ code: 'BAD_REQUEST', message: 'Range must be 7, 30, or 90 days.' }, 400, NO_STORE);
  try {
    return c.json(await aggregate(c.env.DB, dateRange(days)), 200, NO_STORE);
  } catch {
    return c.json({ code: 'UNAVAILABLE', message: 'Analytics could not be read.' }, 500, NO_STORE);
  }
}

export async function aggregate(db, range) {
  const { start, end, days, daysList } = range;
  const between = 'day >= ? and day <= ?';
  const [totals, daily, events, themes, voyage, errors] = await db.batch([
    db.prepare(
      `select count(distinct player_id) as players, count(distinct session_id) as sessions
       from event where ${between}`,
    ).bind(start, end),
    db.prepare(
      `select day, count(distinct player_id) as players, count(distinct session_id) as sessions
       from event where ${between} group by day`,
    ).bind(start, end),
    db.prepare(
      `select name, count(*) as n from event where ${between} group by name order by n desc, name`,
    ).bind(start, end),
    db.prepare(
      `select json_extract(ctx, '$.theme_id') as theme, count(*) as plays
       from event
       where ${between}
         and name in ('game_start', 'voyage_board_start')
         and json_extract(ctx, '$.theme_id') is not null
         and json_extract(ctx, '$.theme_id') != ''
       group by theme
       order by plays desc, theme
       limit 12`,
    ).bind(start, end),
    db.prepare(
      `select
         count(distinct case when name = 'voyage_run_start' then run_id end) as started,
         count(distinct case when name = 'voyage_run_end' then run_id end) as finished
       from event
       where ${between} and name in ('voyage_run_start', 'voyage_run_end')`,
    ).bind(start, end),
    db.prepare(
      `select ts,
              json_extract(params, '$.message') as message,
              json_extract(params, '$.where') as place,
              json_extract(params, '$.stack') as stack
       from event
       where ${between} and name = 'app_error'
       order by ts desc
       limit 40`,
    ).bind(start, end),
  ]);
  const byDay = new Map((daily.results || []).map((row) => [row.day, row]));
  const total = totals.results?.[0] || {};
  const voyageRow = voyage.results?.[0] || {};
  return {
    days,
    start,
    end,
    players: Number(total.players || 0),
    sessions: Number(total.sessions || 0),
    daily: daysList.map((day) => ({
      day,
      players: Number(byDay.get(day)?.players || 0),
      sessions: Number(byDay.get(day)?.sessions || 0),
    })),
    events: (events.results || []).map((row) => ({ name: row.name, n: Number(row.n || 0) })),
    themes: (themes.results || []).map((row) => ({ theme: String(row.theme), plays: Number(row.plays || 0) })),
    voyage: { started: Number(voyageRow.started || 0), finished: Number(voyageRow.finished || 0) },
    errors: (errors.results || []).map((row) => ({
      ts: Number(row.ts || 0),
      message: row.message || '',
      where: row.place || '',
      stack: row.stack || '',
    })),
  };
}

function forbiddenPage() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Not available</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0806;color:#c2ab84;font:16px Georgia,serif}</style>
</head><body><p>This page isn't available.</p></body></html>`;
}

function dashboardPage(days) {
  const buttons = RANGES.map((n) => `<a class="${n === days ? 'on' : ''}" data-days="${n}" href="/admin?days=${n}">${n} days</a>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Analytics</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0d0806; color: #f6ecd6; font: 16px/1.45 Georgia, "Palatino Linotype", serif; }
  main { max-width: 960px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-weight: 500; letter-spacing: 0.08em; font-size: 28px; margin: 0 0 6px; }
  h2 { font-size: 18px; font-weight: 500; letter-spacing: 0.06em; margin: 32px 0 8px; }
  p.lead, .note { color: #c2ab84; margin: 0; }
  .range { display: flex; gap: 8px; margin: 18px 0; }
  .range a { color: #f6ecd6; text-decoration: none; border: 1px solid rgba(233,196,106,0.28); border-radius: 10px; padding: 8px 14px; letter-spacing: 0.06em; }
  .range a.on { background: #e9c46a; color: #140c06; border-color: transparent; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-top: 12px; }
  .card { background: #1c110c; border: 1px solid rgba(233,196,106,0.28); border-radius: 14px; padding: 14px 16px; }
  .card b { display: block; font-size: 28px; font-variant-numeric: tabular-nums; }
  .card span { color: #c2ab84; font-size: 13px; letter-spacing: 0.04em; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid rgba(233,196,106,0.16); vertical-align: top; }
  th { color: #c2ab84; font-weight: 500; font-size: 13px; letter-spacing: 0.05em; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .bar { height: 8px; border-radius: 99px; background: rgba(233,196,106,0.15); }
  .bar i { display: block; height: 100%; border-radius: 99px; background: #e9c46a; }
  pre { white-space: pre-wrap; word-break: break-word; margin: 4px 0 0; color: #c2ab84; font: 12px/1.4 ui-monospace, monospace; }
  .empty { color: #c2ab84; }
</style>
</head>
<body>
<main id="app">
  <h1>Analytics</h1>
  <p class="lead">First-party counts from the event table. <span id="when"></span></p>
  <nav class="range" aria-label="Range">${buttons}</nav>
  <div class="cards">
    <div class="card"><b id="players">–</b><span>Players in range</span></div>
    <div class="card"><b id="sessions">–</b><span>Sessions in range</span></div>
    <div class="card"><b id="started">–</b><span>Voyage runs started</span></div>
    <div class="card"><b id="finished">–</b><span>Voyage runs finished</span></div>
  </div>
  <h2>Daily active players and sessions</h2>
  <table id="daily"><thead><tr><th>Day</th><th class="num">Players</th><th class="num">Sessions</th><th></th></tr></thead><tbody></tbody></table>
  <h2>Events</h2>
  <table id="events"><thead><tr><th>Name</th><th class="num">Count</th></tr></thead><tbody></tbody></table>
  <h2>Top themes by plays</h2>
  <p class="note">Classic game starts and Voyage board starts, grouped by the theme on the event.</p>
  <table id="themes"><thead><tr><th>Theme</th><th class="num">Plays</th></tr></thead><tbody></tbody></table>
  <h2>Recent errors</h2>
  <div id="errors"></div>
</main>
<script>
(async () => {
const $ = (s) => document.querySelector(s);
const range = new URLSearchParams(location.search).get('days');
const days = ['7', '30', '90'].includes(range) ? range : '${days}';
const refused = () => {
  document.body.replaceChildren(Object.assign(document.createElement('p'), { textContent: "This page isn't available." }));
};
const cell = (text, num) => {
  const td = document.createElement('td');
  td.textContent = text;
  if (num) td.className = 'num';
  return td;
};
const emptyRow = (table, cols, text) => {
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = cols;
  td.className = 'empty';
  td.textContent = text;
  tr.append(td);
  table.querySelector('tbody').append(tr);
};
try {
  const res = await fetch('/admin/summary?days=' + days);
  if (!res.ok) { refused(); }
  else {
    const data = await res.json();
    $('#when').textContent = data.start + ' to ' + data.end + ' UTC';
    $('#players').textContent = data.players;
    $('#sessions').textContent = data.sessions;
    $('#started').textContent = data.voyage.started;
    $('#finished').textContent = data.voyage.finished;
    const max = Math.max(1, ...data.daily.map((d) => d.players));
    const dailyBody = $('#daily tbody');
    for (const row of data.daily) {
      const tr = document.createElement('tr');
      const bar = document.createElement('td');
      const track = document.createElement('div');
      const fill = document.createElement('i');
      track.className = 'bar';
      fill.style.width = Math.round(row.players / max * 100) + '%';
      track.append(fill);
      bar.append(track);
      tr.append(cell(row.day), cell(row.players, true), cell(row.sessions, true), bar);
      dailyBody.append(tr);
    }
    const eventBody = $('#events tbody');
    if (!data.events.length) emptyRow($('#events'), 2, 'No events in this range.');
    for (const row of data.events) {
      const tr = document.createElement('tr');
      tr.append(cell(row.name), cell(row.n, true));
      eventBody.append(tr);
    }
    const themeBody = $('#themes tbody');
    if (!data.themes.length) emptyRow($('#themes'), 2, 'No themed plays in this range.');
    for (const row of data.themes) {
      const tr = document.createElement('tr');
      tr.append(cell(row.theme), cell(row.plays, true));
      themeBody.append(tr);
    }
    const box = $('#errors');
    if (!data.errors.length) box.textContent = 'No errors in this range.';
    for (const row of data.errors) {
      const art = document.createElement('article');
      art.className = 'card';
      const title = document.createElement('b');
      const when = document.createElement('div');
      const pre = document.createElement('pre');
      title.textContent = row.message || 'error';
      when.className = 'note';
      when.textContent = (row.ts ? new Date(row.ts).toISOString() : '') + (row.where ? ' · ' + row.where : '');
      pre.textContent = row.stack || '';
      art.append(title, when, pre);
      box.append(art);
    }
  }
} catch {
  refused();
}
})();
</script>
</body>
</html>`;
}
