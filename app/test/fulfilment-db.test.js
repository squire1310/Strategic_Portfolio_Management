import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { createStore } from '../src/domain.js';

const tenant = '00000000-0000-4000-8000-000000000001';
const actor = '00000000-0000-4000-8000-000000000101';

test('ServiceNow fulfilment ledger has tenant-scoped correlation and no user-write grant', { skip: !process.env.SPM_TEST_DATABASE_URL }, async () => {
  const owner = new pg.Client();
  const store = createStore({ connectionString: process.env.SPM_TEST_DATABASE_URL, tenantId: tenant, actorId: actor });
  await owner.connect();
  try {
    const p = await store.command('portfolio', { code: 'fulfill_' + randomUUID().slice(0,8), name:'IAM test' });
    const request = 'CAT-' + randomUUID();
    const args = [tenant, request, actor, p.id];
    const first = await owner.query(`INSERT INTO platform.access_fulfilment_event
      (tenant_id,source_system,request_key,action,principal_id,object_type,object_id)
      VALUES($1,'servicenow',$2,'grant',$3,'portfolio',$4) RETURNING id,status`,args);
    assert.equal(first.rows[0].status,'pending');
    await assert.rejects(owner.query(`INSERT INTO platform.access_fulfilment_event
      (tenant_id,source_system,request_key,action,principal_id,object_type,object_id)
      VALUES($1,'servicenow',$2,'grant',$3,'portfolio',$4)`,args),e=>e.code==='23505');
    await assert.rejects(owner.query(`UPDATE platform.access_fulfilment_event SET status='applied'
      WHERE tenant_id=$1 AND id=$2`,[tenant,first.rows[0].id]),e=>e.code==='23514');
    const rights = await owner.query(`SELECT has_table_privilege('spm_app','platform.access_fulfilment_event','INSERT') AS can_insert,
      has_table_privilege('spm_app','platform.access_fulfilment_event','UPDATE') AS can_update`);
    assert.equal(rights.rows[0].can_insert,false);
    assert.equal(rights.rows[0].can_update,false);
    const audit = await owner.query(`SELECT 1 FROM platform.audit_event WHERE tenant_id=$1 AND
      schema_name='platform' AND table_name='access_fulfilment_event' AND entity_id=$2`,[tenant,first.rows[0].id]);
    assert.equal(audit.rowCount,1);
  } finally { await store.close(); await owner.end(); }
});
