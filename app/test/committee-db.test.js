import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {createStore,AppError} from '../src/domain.js';

test('B010 committee evaluation uses effective delegates and excludes recusals', {skip:!process.env.SPM_TEST_DATABASE_URL},async()=>{
 const tenant='00000000-0000-4000-8000-000000000001',chair='00000000-0000-4000-8000-000000000101';
 const db=new pg.Client();await db.connect();
 const store=createStore({connectionString:process.env.SPM_TEST_DATABASE_URL,tenantId:tenant,actorId:chair});
 try {
  const code=randomUUID().slice(0,8);
  const category=await store.command('category',{code:'govcat_'+code,label:'Governance category'});
  const inv=await store.command('investment',{code:'govinv_'+code,title:'Governance candidate',categoryId:category.id});
  const body=await db.query('INSERT INTO m06_governance.decision_body(tenant_id,code,name,remit,chair_id) VALUES($1,$2,$3,$4,$5) RETURNING id',[tenant,'gov_'+code,'Review body','Evidence only',chair]);
  await db.query("INSERT INTO m06_governance.delegation(tenant_id,decision_body_id,delegate_id,scope_code,effective_during) VALUES($1,$2,$3,'review',tstzrange(now()-interval '1 day',now()+interval '1 day','[)'))",[tenant,body.rows[0].id,chair]);
  const session=await db.query('INSERT INTO m06_governance.committee_session(tenant_id,decision_body_id,investment_id,held_at,quorum_required,recorded_by) VALUES($1,$2,$3,now(),1,$4) RETURNING id',[tenant,body.rows[0].id,inv.id,chair]);
  await db.query("INSERT INTO m06_governance.committee_participant(tenant_id,session_id,principal_id,attended,vote) VALUES($1,$2,$3,true,'for')",[tenant,session.rows[0].id,chair]);
  const result=await store.committeeSessionEvaluation({tenantId:tenant,actorId:chair},session.rows[0].id);
  assert.equal(result.summary.quorumMet,true);
  assert.equal(result.summary.forVotes,1);
  await assert.rejects(db.query('UPDATE m06_governance.committee_participant SET vote=$1 WHERE tenant_id=$2 AND session_id=$3',['against',tenant,session.rows[0].id]),/append-only/);
 }finally{await store.close();await db.end();}
});
