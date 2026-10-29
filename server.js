// Local development server (no dependencies). On Vercel this file is not used.
// Run: npm start  →  http://localhost:3000
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

// Load .env if present (KEY=value lines).
if (existsSync(path.join(root, '.env'))) {
  for (const line of readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const { default: planHandler } = await import('./api/plan.js');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const PUBLIC = new Set(['/index.html', '/styles.css', '/app.js', '/lib/plan-core.js', '/lib/fallback.js']);
const PORT = Number(process.env.PORT) || 3000;

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/plan') {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 100_000) { res.writeHead(413).end(); return; }
    }
    req.body = raw;
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); return res; };
    return planHandler(req, res);
  }

  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!PUBLIC.has(file)) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
  try {
    const body = await readFile(path.join(root, file));
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(500).end();
  }
}).listen(PORT, () => {
  console.log(`Celebrate running at http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) console.log('GEMINI_API_KEY not set: the app will show sample plans.');
});
