import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createStore, httpError, AppError } from './domain.js';
import { authFromEnvironment, sessionCookie, expiredSessionCookie } from './auth.js';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/login': ['login.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/login.js': ['login.js', 'text/javascript; charset=utf-8'],
  '/govuk.css': ['govuk.css', 'text/css; charset=utf-8']
};

function respond(res, status, body, contentType = 'application/json; charset=utf-8', extraHeaders = {}) {
  res.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...extraHeaders
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

export function createHttpServer(store, { auth = authFromEnvironment(), publicOrigin = process.env.SPM_PUBLIC_ORIGIN } = {}) {
  if (publicOrigin && (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(publicOrigin) || new URL(publicOrigin).pathname !== '/')) {
    throw new Error('SPM_PUBLIC_ORIGIN must be an HTTPS origin without a path');
  }
  const secureCookie = Boolean(publicOrigin);
  return http.createServer(async (req, res) => {
    try {
      const host = req.headers.host || '';
      if (publicOrigin) {
        if (host !== new URL(publicOrigin).host || req.headers['x-forwarded-proto'] !== 'https') throw new AppError(403, 'Host or transport denied');
      } else if (!/^127\.0\.0\.1(:\d+)?$/.test(host) && !/^localhost(:\d+)?$/.test(host)) {
        throw new AppError(403, 'Local development only');
      }
      const expectedOrigin = publicOrigin || `http://${host}`;
      if (req.method === 'POST' && req.headers.origin !== expectedOrigin) throw new AppError(403, 'Origin denied');
      if (req.headers.origin && req.headers.origin !== expectedOrigin) throw new AppError(403, 'Origin denied');
      const path = new URL(req.url || '/', 'http://127.0.0.1').pathname;
      const session = auth.resolve(req.headers.cookie);
      if (req.method === 'POST' && path === '/api/login') {
        const body = await jsonBody(req);
        const result = auth.login(body.username, body.password, req.socket.remoteAddress || '');
        if (!result) throw new AppError(401, 'Username or password is incorrect');
        return respond(res, 200, result.user, undefined, { 'set-cookie': sessionCookie(result.token, secureCookie) });
      }
      if (req.method === 'POST' && path === '/api/logout') {
        auth.logout(session?.token);
        return respond(res, 200, { ok: true }, undefined, { 'set-cookie': expiredSessionCookie(secureCookie) });
      }
      if (req.method === 'GET' && path === '/login' && session) return respond(res, 303, '', 'text/plain; charset=utf-8', { location: '/' });
      if (req.method === 'GET' && path === '/' && !session) return respond(res, 303, '', 'text/plain; charset=utf-8', { location: '/login' });
      if (req.method === 'GET' && files[path]) {
        const [name, type] = files[path];
        return respond(res, 200, await readFile(join(publicDir, name)), type);
      }
      if (path.startsWith('/api/') && !session) throw new AppError(401, 'Sign in required');
      if (req.method === 'GET' && path === '/api/session') return respond(res, 200, session.user);
      if (req.method === 'GET' && path === '/api/workspace') return respond(res, 200, await store.workspace(session.context));
      if (req.method === 'GET' && path.startsWith('/api/history/')) {
        const parts = path.split('/');
        if (parts.length !== 6) throw new AppError(404, 'Unknown history path');
        return respond(res, 200, await store.history(parts[3], parts[4], parts[5], session.context));
      }
      if (req.method === 'POST' && path.startsWith('/api/commands/')) {
        const name = path.slice('/api/commands/'.length);
        if (!/^[a-z-]+$/.test(name)) throw new AppError(404, 'Unknown command');
        return respond(res, 201, await store.command(name, await jsonBody(req), session.context));
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
    connectionString: process.env.SPM_DATABASE_URL
  });
  const port = Number(process.env.SPM_PORT || 3000);
  const server = createHttpServer(store);
  const bind = process.env.SPM_PUBLIC_ORIGIN ? '0.0.0.0' : '127.0.0.1';
  server.listen(port, bind, () => console.log(`SPM listening on ${bind}:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => store.close()));
}

