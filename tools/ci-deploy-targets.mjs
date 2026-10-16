// Which deploy jobs a push should run. The workflow calls this and writes
// api=true/false and web=true/false to GITHUB_OUTPUT.
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const WEB_PREFIXES = ['css/', 'js/', 'vendor/', 'assets/', 'terms/', 'privacy/', 'refunds/', 'contact/', 'web/'];
const WEB_FILES = new Set([
  'index.html',
  'sw.js',
  'manifest.webmanifest',
  'robots.txt',
  'sitemap.xml',
  '.nojekyll',
  'tools/prepare-pages.mjs',
  'tools/ci-deploy-targets.mjs',
  '.github/workflows/deploy-api.yml',
]);

export function deployTargets(files, { event = 'push', truncated = false } = {}) {
  if (event !== 'push') return { api: true, web: false };
  if (truncated || files.length === 0) return { api: true, web: true };
  const api = files.some((file) => file.startsWith('server/') || file === '.github/workflows/deploy-api.yml');
  const web = files.some((file) => WEB_FILES.has(file) || WEB_PREFIXES.some((prefix) => file.startsWith(prefix)));
  return { api, web };
}

function main() {
  const event = process.env.EVENT_NAME || 'push';
  let commits = [];
  if (process.env.COMMITS_JSON && process.env.COMMITS_JSON !== 'null') {
    commits = JSON.parse(process.env.COMMITS_JSON);
  }
  const files = [];
  for (const commit of commits) {
    for (const key of ['added', 'removed', 'modified']) {
      if (Array.isArray(commit[key])) files.push(...commit[key]);
    }
  }
  const plan = deployTargets(files, { event, truncated: commits.length >= 20 });
  const lines = [`api=${plan.api}`, `web=${plan.web}`];
  console.error(`Deploy plan: ${lines.join(' ')} (${files.length} files, event ${event})`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  else console.log(lines.join('\n'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
