// Copy only the static files the site should serve and stamp the SW cache id.
// Everything else (server/, docs/, tools/, assets-src/, …) stays out of the upload.
// SITE_OUT overrides the output directory (GitHub Pages uses _site; the staging
// Worker uses web/public).
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, process.env.SITE_OUT || '_site');
const version =
  process.env.PAGES_CACHE_VERSION ||
  `freecellworlds-local-${Date.now().toString(36)}`;

const paths = [
  'index.html',
  'css',
  'js',
  'vendor',
  'assets',
  'manifest.webmanifest',
  'sw.js',
  // Public legal pages for Stripe review. Plain HTML; they are not in the game shell.
  'terms',
  'privacy',
  'refunds',
  'contact',
  // Requested from the site root. Not part of the app shell, so they stay out of sw.js SHELL.
  'robots.txt',
  'sitemap.xml',
  '.nojekyll',
  // js/voyage/boardrules.js now imports js/voyage/boss-yields.json (copied with js/),
  // so the 5.8 MB tools/boss-calibration.json no longer ships.
];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const p of paths) {
  await cp(join(root, p), join(out, p), { recursive: true });
}

const swPath = join(out, 'sw.js');
let sw = await readFile(swPath, 'utf8');
if (!/^const VERSION = '/m.test(sw)) {
  throw new Error('sw.js: expected const VERSION = ...');
}
sw = sw.replace(/^const VERSION = '[^']+'/m, `const VERSION = '${version}'`);
await writeFile(swPath, sw);

// Analytics build id (js/analytics-config.js): run number and short commit, e.g. 412-6044ba7.
const appVersion = (version.match(/-(\d+)-([0-9a-f]{7})[0-9a-f]*$/)?.slice(1).join('-') || version.replace(/^freecell-?worlds-/, '')).slice(0, 40);
const configPath = join(out, 'js/analytics-config.js');
let analyticsConfig = await readFile(configPath, 'utf8');
if (!/^export const APP_VERSION = '[^']*';$/m.test(analyticsConfig)) {
  throw new Error("js/analytics-config.js: expected export const APP_VERSION = '...';");
}
analyticsConfig = analyticsConfig.replace(/^export const APP_VERSION = '[^']*';$/m, `export const APP_VERSION = '${appVersion}';`);
await writeFile(configPath, analyticsConfig);

const shell = sw.match(/const SHELL = \[([\s\S]*?)\];/);
if (!shell) throw new Error('sw.js: expected const SHELL = [...]');
const missing = [];
for (const entry of shell[1].matchAll(/'([^']+)'/g)) {
  const rel = entry[1].replace(/^\.\//, '');
  if (!rel) continue;
  try {
    await access(join(out, rel));
  } catch {
    missing.push(entry[1]);
  }
}
if (missing.length) {
  throw new Error(
    `Pages artifact is missing service worker shell files:\n${missing.join('\n')}`
  );
}

console.log(`Prepared ${out} with service worker cache id ${version}, app version ${appVersion}`);
