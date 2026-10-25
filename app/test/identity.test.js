import test from 'node:test';
import assert from 'node:assert/strict';
import { createGroupResolver, prototypeModeAllowed } from '../src/identity.js';
import { createAuth, hashPassword, sessionCookie } from '../src/auth.js';
import { createHttpServer } from '../src/server.js';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ACTOR = '00000000-0000-4000-8000-000000000101';
const GROUP = '00000000-0000-4000-8000-000000000501';
const UNKNOWN = '00000000-0000-4000-8000-000000000502';
const mappings = { [GROUP]: ['policy'] };
const password = 'test-prototype-password-long';
const account = { username: 'prototype-a', displayName: 'Prototype A', tenantId: TENANT, actorId: ACTOR,
  role: 'viewer', passwordHash: hashPassword(password), groupIds: [GROUP], externalSubjectId: ACTOR, externalTenantId: TENANT };

test('group resolver grants only explicitly mapped command bundles', () => {
  const resolve = createGroupResolver(mappings);
  assert.ok(resolve([GROUP]).commands.includes('objective'));
  assert.ok(!resolve([GROUP]).commands.includes('strategy'));
  assert.deepEqual(resolve([UNKNOWN]).commands, []);
  assert.throws(() => resolve(['a-fake-group']));
  assert.throws(() => createGroupResolver({ [GROUP]: ['approver'] }));
});

test('condition verification requires the dedicated verifier entitlement', async () => {
  const verifierGroup = '00000000-0000-4000-8000-000000000503';
  assert.deepEqual(createGroupResolver({ [verifierGroup]: ['verifier'] })([verifierGroup]).commands, ['condition-verify']);
  const calls = [];
  const store = { verifyDecisionCondition: async (body, context) => { calls.push({ body, context }); return { id: 'evidence' }; } };
  const auth = createAuth([
    { ...account, username: 'ordinary-user', role: 'executive', groupIds: undefined },
    { ...account, username: 'mandated-verifier', role: 'verifier', groupIds: undefined }
  ]);
  const server = createHttpServer(store, { auth });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const [username, status] of [['ordinary-user', 403], ['mandated-verifier', 201]]) {
      const login = await fetch(origin + '/api/login', { method: 'POST', headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }) });
      const cookie = login.headers.get('set-cookie').split(';')[0];
      const response = await fetch(origin + '/api/conditions/verify', { method: 'POST',
        headers: { cookie, origin, 'content-type': 'application/json' }, body: JSON.stringify({ conditionId: ACTOR }) });
      assert.equal(response.status, status);
    }
    assert.equal(calls.length, 1);
    assert.equal(calls[0].context.actorId, ACTOR);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('condition evidence submission requires the submitter entitlement', async () => {
  const calls = [];
  const store = { submitConditionEvidence: async (body, context) => { calls.push({ body, context }); return { id: 'submission' }; } };
  const auth = createAuth([
    { ...account, username: 'evidence-owner', role: 'engagement_lead', groupIds: undefined },
    { ...account, username: 'evidence-verifier', role: 'verifier', groupIds: undefined }
  ]);
  const server = createHttpServer(store, { auth });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const [username, status] of [['evidence-verifier', 403], ['evidence-owner', 201]]) {
      const login = await fetch(origin + '/api/login', { method: 'POST', headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }) });
      const cookie = login.headers.get('set-cookie').split(';')[0];
      const response = await fetch(origin + '/api/conditions/evidence', { method: 'POST',
        headers: { cookie, origin, 'content-type': 'application/json' }, body: JSON.stringify({ conditionId: ACTOR }) });
      assert.equal(response.status, status);
    }
    assert.equal(calls.length, 1);
    assert.equal(calls[0].context.actorId, ACTOR);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('condition status is available to submitter and verifier roles only', async () => {
  const calls = [];
  const store = { decisionConditionReadiness: async (context, id) => { calls.push({ context, id }); return { decisionId:id }; } };
  const auth = createAuth([
    { ...account, username: 'status-owner', role: 'engagement_lead', groupIds: undefined },
    { ...account, username: 'status-verifier', role: 'verifier', groupIds: undefined },
    { ...account, username: 'status-viewer', role: 'viewer', groupIds: undefined }
  ]);
  const server = createHttpServer(store, { auth });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const [username, status] of [['status-owner', 200], ['status-verifier', 200], ['status-viewer', 403]]) {
      const login = await fetch(origin + '/api/login', { method: 'POST', headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }) });
      const cookie = login.headers.get('set-cookie').split(';')[0];
      const response = await fetch(origin + `/api/investment-decisions/${ACTOR}/conditions`, { headers: { cookie } });
      assert.equal(response.status, status);
    }
    assert.equal(calls.length, 2);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('prototype mode rejects production and unimplemented Entra provider', () => {
  assert.equal(prototypeModeAllowed({ SPM_IDENTITY_PROVIDER: 'prototype', SPM_DEPLOYMENT_ENV: 'test' }), true);
  assert.throws(() => prototypeModeAllowed({ SPM_IDENTITY_PROVIDER: 'prototype', SPM_DEPLOYMENT_ENV: 'production' }));
  assert.throws(() => prototypeModeAllowed({ SPM_IDENTITY_PROVIDER: 'entra', SPM_DEPLOYMENT_ENV: 'production' }));
});

test('synthetic group mapping is authoritative over legacy local role', () => {
  const auth = createAuth([account], { groupMappings: mappings, requireGroups: true });
  const loggedIn = auth.login('prototype-a', password);
  assert.ok(loggedIn.user.allowedCommands.includes('objective'));
  assert.equal(loggedIn.user.allowedCommands.includes('strategy'), false);
  const session = auth.resolve(sessionCookie(loggedIn.token, false));
  assert.equal(session.context.actorId, ACTOR);
  assert.deepEqual(session.user.allowedCommands, loggedIn.user.allowedCommands);
  assert.throws(() => createAuth([{ ...account, groupIds: [] }], { groupMappings: mappings, requireGroups: true }));
});

test('server never trusts client claimed role or group for command access', async () => {
  const actions = [];
  const store = { command: async name => { actions.push(name); return { name }; }, workspace: async () => ({ ok: true }) };
  const auth = createAuth([account], { groupMappings: mappings, requireGroups: true });
  const server = createHttpServer(store, { auth });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  try {
    const login = await fetch(origin + '/api/login', { method: 'POST',
      headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ username: account.username, password }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const denied = await fetch(origin + '/api/commands/strategy', { method: 'POST',
      headers: { cookie, origin, 'content-type': 'application/json', 'x-spm-role': 'executive' },
      body: JSON.stringify({ groupIds: [UNKNOWN], role: 'executive' }) });
    assert.equal(denied.status, 403);
    const permitted = await fetch(origin + '/api/commands/objective', { method: 'POST',
      headers: { cookie, origin, 'content-type': 'application/json' }, body: '{}' });
    assert.equal(permitted.status, 201);
    assert.deepEqual(actions, ['objective']);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('revoking synthetic groups denies workspace and commands on an existing session', async () => {
  const actions = [];
  const store = { workspace: async () => ({ visible: true }), command: async name => { actions.push(name); return { name }; } };
  const auth = createAuth([account], { groupMappings: mappings, requireGroups: true });
  const server = createHttpServer(store, { auth });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  try {
    const login = await fetch(origin + '/api/login', { method: 'POST',
      headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ username: account.username, password }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(origin + '/api/workspace', { headers: { cookie } })).status, 200);
    auth.updatePrototypeGroups(account.username, [UNKNOWN]);
    assert.equal((await fetch(origin + '/api/workspace', { headers: { cookie } })).status, 403);
    assert.equal((await fetch(origin + '/api/commands/objective', { method: 'POST',
      headers: { cookie, origin, 'content-type': 'application/json' }, body: '{}' })).status, 403);
    assert.deepEqual(actions, []);
    auth.updatePrototypeGroups(account.username, [GROUP]);
    assert.equal((await fetch(origin + '/api/workspace', { headers: { cookie } })).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('prototype module read grants constrain workspace and history', async () => {
  const auth = createAuth([account], { groupMappings: mappings, requireGroups: true });
  const calls = [];
  const store = {
    workspace: async (_ctx, keys) => { calls.push(keys); return { keys }; },
    history: async (_schema, _table, _id, _ctx, keys) => { calls.push(keys); return { keys }; }
  };
  const server = createHttpServer(store, { auth });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  try {
    const login = await fetch(origin + '/api/login', { method: 'POST',
      headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ username: account.username, password }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const workspace = await (await fetch(origin + '/api/workspace', { headers: { cookie } })).json();
    assert.ok(workspace.keys.includes('objectives'));
    assert.ok(!workspace.keys.includes('investments'));
    const history = await (await fetch(origin + '/api/history/m05_investment/investment/00000000-0000-4000-8000-000000000222', { headers: { cookie } })).json();
    assert.ok(!history.keys.includes('investments'));
    assert.equal(calls.length, 2);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('portfolio-scoped prototype routes receive a trusted scope and cannot run unguarded portfolio writes', async () => {
  const portfolio = '00000000-0000-4000-8000-000000000201';
  const scoped = { ...account, username: 'scoped-user', role: 'portfolio_manager', groupIds: [GROUP], portfolioIds: [portfolio] };
  const auth = createAuth([scoped], { groupMappings: { [GROUP]: ['portfolio_manager'] }, requireGroups: true });
  const calls = [];
  const store = {
    workspace: async (_ctx, keys, ids) => { calls.push({ keys, ids }); return { ids }; },
    command: async (name, _body, _ctx, ids) => { calls.push({ name, ids }); return { name }; }
  };
  const server = createHttpServer(store, { auth });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  try {
    const login = await fetch(origin + '/api/login', { method: 'POST', headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ username: scoped.username, password }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const result = await (await fetch(origin + '/api/workspace', { headers: { cookie } })).json();
    assert.deepEqual(result.ids, [portfolio]);
    assert.deepEqual(calls[0].ids, [portfolio]);
    const denied = await fetch(origin + '/api/commands/portfolio-update', { method: 'POST',
      headers: { cookie, origin, 'content-type': 'application/json' }, body: '{}' });
    assert.equal(denied.status, 201);
    assert.deepEqual(calls.at(-1).ids, [portfolio]);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
