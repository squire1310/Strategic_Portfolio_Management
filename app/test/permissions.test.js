import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpServer } from '../src/server.js';
import { createAuth, hashPassword } from '../src/auth.js';

const tenantId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000101';
const expected = {
  executive: ['strategy', 'strategy-update', 'strategy-retire'],
  policy: ['objective', 'objective-update', 'objective-parent', 'outcome', 'outcome-update', 'outcome-retire',
    'measure', 'measure-update', 'measure-retire', 'observation', 'observation-correction', 'observation-void'],
  portfolio_manager: ['portfolio', 'portfolio-update', 'portfolio-parent', 'portfolio-retire',
    'category', 'category-update', 'category-retire', 'alignment', 'alignment-remove'],
  engagement_lead: ['investment', 'investment-update', 'investment-retire',
    'membership', 'membership-update', 'membership-remove', 'condition-submit'],
  verifier: ['condition-verify'],
  condition_recorder: ['condition-create'],
  decision_maker: ['committee-finalise','investment-approve','condition-create'],
  viewer: []
};

test('each role can read all data but only run its own commands', async () => {
  const calls = [];
  const store = { workspace: async () => ({ allRecordsVisible: true }),
    command: async name => { calls.push(name); return { name }; } };
  const auth = createAuth(Object.keys(expected).map(role => ({ username: `user-${role.replaceAll('_', '-')}`,
    displayName: role, tenantId, actorId, role, passwordHash: hashPassword('test-role-password-long') })));
  const server = createHttpServer(store, { auth });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const commands = [...new Set(Object.values(expected).flat())];
    for (const [role, allowed] of Object.entries(expected)) {
      const login = await fetch(`${base}/api/login`, { method: 'POST', headers: { origin: base, 'content-type': 'application/json' },
        body: JSON.stringify({ username: `user-${role.replaceAll('_', '-')}`, password: 'test-role-password-long' }) });
      assert.equal(login.status, 200);
      const cookie = login.headers.get('set-cookie').split(';')[0];
      const session = await (await fetch(`${base}/api/session`, { headers: { cookie } })).json();
      assert.equal(session.role, role);
      assert.deepEqual(session.allowedCommands, allowed);
      const workspace = await fetch(`${base}/api/workspace`, { headers: { cookie } });
      assert.equal(workspace.status, 200);
      assert.deepEqual(await workspace.json(), { allRecordsVisible: true });
      for (const command of commands) {
        const before = calls.length;
        const response = await fetch(`${base}/api/commands/${command}`, { method: 'POST',
          headers: { cookie, origin: base, 'content-type': 'application/json' }, body: '{}' });
        assert.equal(response.status, allowed.includes(command) ? 201 : 403, `${role} and ${command}`);
        assert.equal(calls.length, before + (allowed.includes(command) ? 1 : 0));
      }
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
