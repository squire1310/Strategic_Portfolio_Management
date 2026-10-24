import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createStore, httpError, AppError } from './domain.js';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/govuk.css': ['govuk.css', 'text/css; charset=utf-8']
};

function respond(res, status, body, contentType = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  });
  res.end(contentType.startsWith('application/json') ? JSON.stringify(body) : body);
}

async function jsonBody(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new AppError(415, 'Use application/json');
  let value = '';
  for await (const chunk of req) {
    value += chunk;
    if (value.length > 65536) throw new AppError(413, 'Request too large');
  }
  try { return JSON.parse(value); } catch { throw new AppError(400, 'Invalid JSON'); }
}

export function createHttpServer(store) {
  return http.createServer(async (req, res) => {
    try {
      const host = req.headers.host || '';
      if (!/^127\.0\.0\.1(:\d+)?$/.test(host) && !/^localhost(:\d+)?$/.test(host)) throw new AppError(403, 'Local development only');
      const origin = req.headers.origin;
      if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) throw new AppError(403, 'Origin denied');
      const path = new URL(req.url || '/', 'http://127.0.0.1').pathname;
      if (req.method === 'GET' && files[path]) {
        const [name, type] = files[path];
        return respond(res, 200, await readFile(join(publicDir, name)), type);
      }
      if (req.method === 'GET' && path === '/api/workspace') return respond(res, 200, await store.workspace());
      if (req.method === 'GET' && path.startsWith('/api/history/')) {
        const parts = path.split('/');
        if (parts.length !== 6) throw new AppError(404, 'Unknown history path');
        return respond(res, 200, await store.history(parts[3], parts[4], parts[5]));
      }
      if (req.method === 'POST' && path.startsWith('/api/commands/')) {
        const name = path.slice('/api/commands/'.length);
        if (!/^[a-z-]+$/.test(name)) throw new AppError(404, 'Unknown command');
        return respond(res, 201, await store.command(name, await jsonBody(req)));
      }
      throw new AppError(404, 'Not found');
    } catch (error) {
      const { status, message } = httpError(error);
      if (status === 500) console.error(error);
      respond(res, status, { error: message });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const store = createStore({
    connectionString: process.env.SPM_DATABASE_URL,
    tenantId: process.env.SPM_DEV_TENANT_ID,
    actorId: process.env.SPM_DEV_ACTOR_ID
  });
  const port = Number(process.env.SPM_PORT || 3000);
  const server = createHttpServer(store);
  server.listen(port, '127.0.0.1', () => console.log(`SPM local development: http://127.0.0.1:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => store.close()));
}

