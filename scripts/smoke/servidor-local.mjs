/** Servidor estático mínimo que imita a GitHub Pages sirviendo `dist/`. */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { BASE, CONTENT_TYPES, DIST } from './config.mjs';

/** Arranca en un puerto libre y devuelve el servidor y su origen. */
export async function arrancarServidorLocal() {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://local');
    if (!url.pathname.startsWith(BASE)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('fuera del base');
    }
    let rel = decodeURIComponent(url.pathname.slice(BASE.length));
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const abs = normalize(join(DIST, rel));
    if (!abs.startsWith(DIST + sep) || !existsSync(abs) || !statSync(abs).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('no encontrado');
    }
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES[extname(abs).toLowerCase()] ?? 'application/octet-stream' });
    createReadStream(abs).pipe(res);
  });

  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}
