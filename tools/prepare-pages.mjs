// Copy only the static files GitHub Pages should serve and stamp the SW cache id.
import { access, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, '_site');
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
  // Imported by js/voyage/boardrules.js. A missing module fails the whole graph
  // and the title loader never advances past its initial text.
  'tools/boss-calibration.json',
];

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

console.log(`Prepared _site/ with service worker cache id ${version}`);
