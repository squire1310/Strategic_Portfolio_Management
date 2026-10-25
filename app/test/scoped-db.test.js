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
