// Copy only the static files GitHub Pages should serve and stamp the SW cache id.
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, '_site');
const version =
  process.env.PAGES_CACHE_VERSION ||
  `freecell3d-local-${Date.now().toString(36)}`;

const paths = [
  'index.html',
  'css',
  'js',
  'vendor',
  'assets',
  'manifest.webmanifest',
  'sw.js',
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

console.log(`Prepared _site/ with service worker cache id ${version}`);
