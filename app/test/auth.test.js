import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuth, hashPassword, sessionCookie } from '../src/auth.js';

const account = { username: 'alice', displayName: 'Alice', tenantId: '00000000-0000-4000-8000-000000000001',
  actorId: '00000000-0000-4000-8000-000000000101', passwordHash: hashPassword('a-long-test-password') };

test('local login creates an opaque session and logout revokes it', () => {
  const auth = createAuth([account]);
  assert.equal(auth.login('alice', 'incorrect', '127.0.0.1'), null);
  const result = auth.login('Alice', 'a-long-test-password', '127.0.0.1');
  assert.ok(result);
  assert.equal(result.user.displayName, 'Alice');
  assert.equal(result.user.passwordHash, undefined);
  const cookie = sessionCookie(result.token, true);
  assert.match(cookie, /HttpOnly; SameSite=Strict; Path=\/; Max-Age=28800; Secure/);
  assert.deepEqual(auth.resolve(cookie).context, { tenantId: account.tenantId, actorId: account.actorId });
  auth.logout(result.token);
  assert.equal(auth.resolve(cookie), null);
});

test('local login locks repeated failures for one source and account', () => {
  const auth = createAuth([account]);
  for (let i = 0; i < 5; i++) assert.equal(auth.login('alice', 'incorrect', '127.0.0.1'), null);
  assert.equal(auth.login('alice', 'a-long-test-password', '127.0.0.1'), null);
  assert.ok(auth.login('alice', 'a-long-test-password', '127.0.0.2'));
});

