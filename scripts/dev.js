import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import skies from '../api/air.js';
import places from '../api/places.js';
import coach from '../api/coach.js';
import { send } from '../lib/http.js';

const root = fileURLToPath(new URL('../public', import.meta.url));
const routes = { '/api/air': skies, '/api/places': places, '/api/coach': coach };
const mime = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8', jpg: 'image/jpeg', svg: 'image/svg+xml' };
const port = Number(process.env.PORT || 3000);
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));

createServer(async (req, res) => {
  for (const header of config.headers[0].headers) res.setHeader(header.key, header.value);
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (Object.hasOwn(routes, pathname)) return await routes[pathname](req, res);
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
    if (!path.startsWith(root + sep)) return send(res, 404, { error: 'Page not found.' });

    const content = await readFile(path);
    res.writeHead(200, { 'Content-Type': mime[path.split('.').pop()] || 'application/octet-stream' });
    res.end(content);
  } catch (error) {
    if (res.headersSent) return res.end();
    const missing = ['ENOENT', 'EISDIR'].includes(error.code);
    return send(res, missing ? 404 : 500, { error: missing ? 'Page not found.' : 'Something went wrong.' });
  }
}).listen(port, '127.0.0.1', () => console.log('BreatheLocal at http://127.0.0.1:' + port));
