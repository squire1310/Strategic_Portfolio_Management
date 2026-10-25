import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createStore, httpError, AppError } from './domain.js';
import { authFromEnvironment, sessionCookie, expiredSessionCookie } from './auth.js';
import { deriveJourneyStatus } from './journey-projections.js';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/login': ['login.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/login.js': ['login.js', 'text/javascript; charset=utf-8'],
  '/govuk.css': ['govuk.css', 'text/css; charset=utf-8']
};
const workspacePages = new Set(['/', '/strategy', '/policy', '/portfolios', '/investments', '/history', '/inbox', '/proposals']);

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
      if (req.method === 'GET' && workspacePages.has(path) && !session) return respond(res, 303, '', 'text/plain; charset=utf-8', { location: '/login' });
      if (req.method === 'GET' && (files[path] || workspacePages.has(path))) {
        const [name, type] = files[path] || files['/'];
        return respond(res, 200, await readFile(join(publicDir, name)), type);
      }
      if (path.startsWith('/api/') && !session) throw new AppError(401, 'Sign in required');
      if (path.startsWith('/api/') && session && session.hasAppAccess === false) throw new AppError(403, 'Application entitlement required');
      // Prototype-only database assignments are authoritative where a real store supports them.
      // Mock stores retain fixture scopes for existing isolated API tests.
      let portfolioScope = session?.user.portfolioIds;
      let strategyScope = session?.user.strategyIds;
      if (session && portfolioScope !== null && typeof store.assignedScopes === 'function') {
        const assignments = await store.assignedScopes(session.context);
        portfolioScope = assignments.portfolioIds;
        strategyScope = assignments.strategyIds;
      }
      if (req.method === 'GET' && path === '/api/session') return respond(res, 200, session.user);
      if (req.method === 'GET' && /^\/api\/scenarios\/[0-9a-f-]{36}\/ranking$/.test(path)) {
        if (portfolioScope !== null || strategyScope !== null) throw new AppError(403,'Scoped scenario access not yet implemented');
        if (!session.user.allowedCommands.includes('portfolio-update')) throw new AppError(403,'Scenario permission required');
        return respond(res,200,await store.scenarioRanking(session.context,path.split('/')[3]));
      }
      if (req.method === 'GET' && /^\/api\/committee-sessions\/[0-9a-f-]{36}\/evaluation$/.test(path)) {
        if (portfolioScope !== null || strategyScope !== null) throw new AppError(403,'Scoped committee read access pending');
        if (!session.user.allowedCommands.includes('strategy-update')) throw new AppError(403,'Governance evidence permission required');
        return respond(res,200,await store.committeeSessionEvaluation(session.context,path.split('/')[3]));
      }
      if (req.method === 'POST' && path.startsWith('/api/scenario-overrides/')) {
        if (portfolioScope !== null || strategyScope !== null) throw new AppError(403,'Scoped override authority not yet configured');
        const action=path.slice('/api/scenario-overrides/'.length);
        if (action==='request' ? !session.user.allowedCommands.includes('portfolio-update')
          : action==='decide' ? !session.user.allowedCommands.includes('strategy-update') : true)
          throw new AppError(403,'Override role permission required');
        return respond(res,201,await store.scenarioOverride(action,await jsonBody(req),session.context));
      }
      if (req.method === 'POST' && path.startsWith('/api/recommendations/')) {
        if (portfolioScope !== null || strategyScope !== null) throw new AppError(403,'Scoped recommendation permission not yet implemented');
        if (!session.user.allowedCommands.includes('portfolio-update')) throw new AppError(403,'Recommendation permission required');
        const action=path.slice('/api/recommendations/'.length);
        if (!['create-scenario','recommend'].includes(action)) throw new AppError(404,'Unknown recommendation action');
        return respond(res,201,await store.recommendation(action,await jsonBody(req),session.context));
      }
      if (req.method === 'GET' && /^\/api\/assessments\/[0-9a-f-]{36}\/results$/.test(path)) {
        if (portfolioScope !== null || strategyScope !== null) throw new AppError(403,'Scoped assessment permissions not yet implemented');
        return respond(res,200,await store.assessmentResults(session.context,path.split('/')[3]));
      }
      if (req.method === 'POST' && path.startsWith('/api/assessments/')) {
        if (portfolioScope !== null || strategyScope !== null) throw new AppError(403,'Scoped assessment permissions not yet implemented');
        if (!session.user.allowedCommands.includes('portfolio-update')) throw new AppError(403,'Assessor permission required');
        const action=path.slice('/api/assessments/'.length);
        if (!['create','score','complete'].includes(action)) throw new AppError(404,'Unknown assessment action');
        return respond(res,201,await store.assessment(action,await jsonBody(req),session.context));
      }
      if (req.method === 'GET' && ['/api/proposals/mine','/api/proposals/review-queue'].includes(path)) {
        if (portfolioScope !== null || strategyScope !== null) throw new AppError(403,'Scoped proposal permissions are not yet implemented');
        const reviewer=path.endsWith('review-queue');
        if (reviewer ? !session.user.allowedCommands.includes('portfolio-update') : !session.user.allowedCommands.includes('investment'))
          throw new AppError(403,'Proposal list permission required');
        return respond(res,200,await store.proposalList(session.context,reviewer));
      }
      if (req.method === 'POST' && path.startsWith('/api/proposals/')) {
        if (portfolioScope !== null || strategyScope !== null) throw new AppError(403,'Scoped proposal permissions are not yet implemented');
        const action=path.slice('/api/proposals/'.length);
        if (['review','accept'].includes(action) ? !session.user.allowedCommands.includes('portfolio-update') : !session.user.allowedCommands.includes('investment')) throw new AppError(403,'Proposal intake permission required');
        if (!['create','edit','submit','review','accept','promote'].includes(action)) throw new AppError(404,'Unknown proposal action');
        return respond(res,201,await store.proposal(action,await jsonBody(req),session.context));
      }
      if (req.method === 'GET' && path === '/api/work-items/created') return respond(res,200,await store.workItem('created',null,session.context,portfolioScope,strategyScope));
      if (req.method === 'GET' && path === '/api/work-items/inbox') {
        return respond(res,200,await store.workItem('inbox',null,session.context,portfolioScope,strategyScope));
      }
      if (req.method === 'POST' && path.startsWith('/api/work-items/')) {
        if (!['executive','policy','portfolio_manager','engagement_lead'].includes(session.user.role))
          throw new AppError(403,'Work item permission required');
        const action=path.slice('/api/work-items/'.length);
        if (!['create','reassign','complete'].includes(action)) throw new AppError(404,'Unknown work item action');
        return respond(res,201,await store.workItem(action,await jsonBody(req),session.context,portfolioScope,strategyScope));
      }
      if (req.method === 'GET' && path === '/api/journey-status') {
        const workspace = await store.workspace(session.context, session.user.readKeys, portfolioScope, strategyScope);
        return respond(res, 200, { items: deriveJourneyStatus(workspace) });
      }
      if (req.method === 'GET' && path === '/api/workspace') {
        if (!session.user.allowedCommands.length && session.user.role !== 'viewer') throw new AppError(403, 'Workspace access denied');
        return respond(res, 200, await store.workspace(session.context, session.user.readKeys, portfolioScope, strategyScope));
      }
      if (req.method === 'GET' && path.startsWith('/api/history/')) {
        const parts = path.split('/');
        if (parts.length !== 6) throw new AppError(404, 'Unknown history path');
        return respond(res, 200, await store.history(parts[3], parts[4], parts[5], session.context, session.user.readKeys, portfolioScope, strategyScope));
      }
      if (req.method === 'POST' && path.startsWith('/api/commands/')) {
        const name = path.slice('/api/commands/'.length);
        if (!/^[a-z-]+$/.test(name)) throw new AppError(404, 'Unknown command');
        if (!session.user.allowedCommands.includes(name)) throw new AppError(403, 'Your role cannot change this record');
        return respond(res, 201, await store.command(name, await jsonBody(req), session.context, portfolioScope, strategyScope));
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
  const bind = process.env.SPM_BIND_ADDRESS || (process.env.SPM_PUBLIC_ORIGIN ? '0.0.0.0' : '127.0.0.1');
  server.listen(port, bind, () => console.log(`SPM listening on ${bind}:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => store.close()));
}
