import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { createStore } from '../src/domain.js';

const tenantId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000101';

test('audited effective assignment and revocation change DB-backed scope', { skip: !process.env.SPM_TEST_DATABASE_URL }, async () => {
  const admin = new pg.Client();
  const store = createStore({ connectionString: process.env.SPM_TEST_DATABASE_URL, tenantId, actorId });
  await admin.connect();
  const ctx = { tenantId, actorId };
  try {
    const portfolio = await store.command('portfolio', {
      code: 'assigned_' + randomUUID().slice(0, 8), name: 'Assigned test portfolio'
    });
    assert.deepEqual((await store.assignedScopes(ctx)).portfolioIds.filter(id => id === portfolio.id), []);
    const assignmentId = randomUUID();
    await admin.query(`INSERT INTO platform.object_access_assignment
      (tenant_id,id,principal_id,object_type,object_id,effective_during,reason,assigned_by)
      VALUES($1,$2,$3,'portfolio',$4,tstzrange(now()-interval '1 hour',now()+interval '1 day','[)'),'CI assignment',$3)`,
      [tenantId, assignmentId, actorId, portfolio.id]);
    assert.ok((await store.assignedScopes(ctx)).portfolioIds.includes(portfolio.id));
    const restricted = await store.workspace(ctx,['portfolios'],(await store.assignedScopes(ctx)).portfolioIds,[]);
    assert.ok(restricted.portfolios.some(item => item.id === portfolio.id));
    await admin.query('UPDATE platform.object_access_assignment SET revoked_at=now() WHERE tenant_id=$1 AND id=$2',
      [tenantId, assignmentId]);
    assert.equal((await store.assignedScopes(ctx)).portfolioIds.includes(portfolio.id),false);
    const audit = await admin.query(`SELECT operation FROM platform.audit_event
      WHERE tenant_id=$1 AND schema_name='platform' AND table_name='object_access_assignment'
      AND entity_id=$2 ORDER BY occurred_at`,[tenantId,assignmentId]);
    assert.deepEqual(audit.rows.map(r=>r.operation),['INSERT','UPDATE']);
    await assert.rejects(admin.query('DELETE FROM platform.object_access_assignment WHERE tenant_id=$1 AND id=$2',
      [tenantId,assignmentId]), /./);
  } finally { await store.close(); await admin.end(); }
});
