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
