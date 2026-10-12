// Minimal static file server for local development.
// Serves the current directory with caching disabled so edits always show up.
// Usage: node serve.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const root = process.cwd();
const port = Number(process.argv[2] || process.env.PORT || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    let filePath = normalize(join(root, pathname));
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    let data;
    try {
      data = await readFile(filePath);
    } catch (err) {
      // Match GitHub Pages: /terms serves terms/index.html.
      // A directory read fails with EISDIR; a missing file fails with ENOENT.
      if (!err || (err.code !== 'ENOENT' && err.code !== 'EISDIR') || extname(pathname)) throw err;
      const indexPath = normalize(join(filePath, 'index.html'));
      if (indexPath !== root && !indexPath.startsWith(root + sep)) throw err;
      data = await readFile(indexPath);
      filePath = indexPath;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end('Not found');
  }
}).listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port} (cache disabled)`);
});
