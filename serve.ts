// Sunrise Courier — a tiny static file server for local play-testing.
// Run `node serve.ts`, then open http://localhost:8080 in desktop Chrome.
// It serves only files under this directory's game/ folder, sends the MIME
// type each extension needs, and refuses any path that escapes the folder.
// Development convenience only; the shipped game needs no server at all
// beyond any plain static host.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameRoot = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const args = process.argv.slice(2);
const portFlag = args.indexOf('--port');
const wanted = portFlag === -1 ? 8080 : Number(args[portFlag + 1]);
const port = Number.isInteger(wanted) && wanted > 0 && wanted < 65536 ? wanted : 8080;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

createServer((request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';
    const filePath = resolve(join(gameRoot, path));
    if (!filePath.startsWith(gameRoot + sep)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    const stat = statSync(filePath);
    if (!stat.isFile()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
      'Content-Length': stat.size,
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}).listen(port, () => {
  console.log(`Sunrise Courier on http://localhost:${port}`);
});
