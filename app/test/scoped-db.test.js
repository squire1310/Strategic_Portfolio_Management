import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createStore, AppError } from '../src/domain.js';

const tenantId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000101';

test('PostgreSQL portfolio-scoped writes, workspace and history', { skip: !process.env.SPM_TEST_DATABASE_URL }, async () => {
  const store = createStore({ connectionString: process.env.SPM_TEST_DATABASE_URL, tenantId, actorId });
  const suffix = randomUUID().slice(0, 8);
  try {
    const assigned = await store.command('portfolio', { code: 'scope_a_' + suffix, name: 'Allowed portfolio' });
    const other = await store.command('portfolio', { code: 'scope_b_' + suffix, name: 'Other portfolio' });
    const scope = [assigned.id];
    const limited = await store.workspace({ tenantId, actorId }, ['portfolios', 'memberships', 'alignments', 'investments'], scope);
    assert.ok(limited.portfolios.some(p => p.id === assigned.id));
    assert.ok(!limited.portfolios.some(p => p.id === other.id));
    assert.deepEqual(limited.categories, []);

    const updated = await store.command('portfolio-update',
      { id: assigned.id, expectedVersion: assigned.row_version, name: 'Allowed updated' }, { tenantId, actorId }, scope);
    assert.equal(updated.name, 'Allowed updated');
    await assert.rejects(
      store.command('portfolio-update',
        { id: other.id, expectedVersion: other.row_version, name: 'Forbidden update' }, { tenantId, actorId }, scope),
      e => e instanceof AppError && e.status === 403
    );
    await assert.rejects(
      store.command('portfolio', { code: 'scope_c_' + suffix, name: 'Unexpected new' }, { tenantId, actorId }, scope),
      e => e instanceof AppError && e.status === 403
    );
    const visibleHistory = await store.history('m02_portfolio', 'portfolio', assigned.id,
      { tenantId, actorId }, ['portfolios'], scope);
    assert.ok(visibleHistory.revisions.length >= 2);
    await assert.rejects(
      store.history('m02_portfolio', 'portfolio', other.id, { tenantId, actorId }, ['portfolios'], scope),
      e => e instanceof AppError && e.status === 404
    );
    const unscoped = await store.workspace({ tenantId, actorId });
    assert.equal(unscoped.portfolios.find(p => p.id === other.id).name, 'Other portfolio');
  } finally { await store.close(); }
});

test('PostgreSQL strategy scope protects descendant reads, history and unguarded writes', { skip: !process.env.SPM_TEST_DATABASE_URL }, async () => {
  const store = createStore({ connectionString: process.env.SPM_TEST_DATABASE_URL, tenantId, actorId });
  const suffix = randomUUID().slice(0, 8);
  const context = { tenantId, actorId };
  try {
    const allowed = await store.command('strategy', { code: 'scope_s_' + suffix, name: 'Allowed strategy', startDate: '2026-01-01', endDate: '2030-01-01' });
    const denied = await store.command('strategy', { code: 'scope_t_' + suffix, name: 'Other strategy', startDate: '2026-01-01', endDate: '2030-01-01' });
    const objective = await store.command('objective', { strategyId: allowed.id, code: 'scope_o_' + suffix, title: 'Objective', validFrom: '2026-01-01', validUntil: '2030-01-01' });
    const result = await store.workspace(context, ['strategies','objectives','outcomes','measures','observations'], null, [allowed.id]);
    assert.ok(result.strategies.some(s => s.id === allowed.id));
    assert.ok(!result.strategies.some(s => s.id === denied.id));
    assert.ok(result.objectives.some(o => o.id === objective.id));
    const history = await store.history('m01_strategy','strategy',allowed.id,context,['strategies'],null,[allowed.id]);
    assert.ok(history.revisions.length >= 1);
    await assert.rejects(store.history('m01_strategy','strategy',denied.id,context,['strategies'],null,[allowed.id]),
      e => e instanceof AppError && e.status === 404);
    await assert.rejects(store.command('strategy-update',
      { id: denied.id, expectedVersion: denied.row_version, name: 'Illegal' },context,null,[allowed.id]),
      e => e instanceof AppError && e.status === 403);
  } finally { await store.close(); }
});
