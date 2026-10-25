import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {createStore} from '../src/domain.js';
test('B012 outstanding precedent blocks readiness and evidence does not effectuate', {skip:!process.env.SPM_TEST_DATABASE_URL},async()=>{
 const tenant='00000000-0000-4000-8000-000000000001';
 const actor='00000000-0000-4000-8000-000000000101';
 const admin=new pg.Client();await admin.connect();
 await admin.query('BEGIN');
 await admin.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.actor_id',$2,true),set_config('app.request_id',$3,true)",[tenant,actor,randomUUID()]);
 const store=createStore({connectionString:process.env.SPM_TEST_DATABASE_URL,tenantId:tenant,actorId:actor});
 try {
  const suffix=randomUUID().slice(0,8);
  const category=await store.command('category',{code:'condcat_'+suffix,label:'Condition category'});
  const investment=await store.command('investment',{code:'condinv_'+suffix,title:'Condition candidate',categoryId:category.id});
  const body=await admin.query('INSERT INTO m06_governance.decision_body(tenant_id,code,name,remit,chair_id) VALUES($1,$2,$3,$4,$5) RETURNING id',[tenant,'condbody_'+suffix,'Condition body','Testing',actor]);
  const decision=await admin.query(`INSERT INTO m05_investment.investment_decision
    (tenant_id,decision_body_id,decided_by,investment_id,subject_type,subject_id,decision_type,rationale,decided_at,effective_on)
    VALUES($1,$2,$3,$4,'investment',$4,'defer','Evidence pending',now(),CURRENT_DATE) RETURNING id`,
    [tenant,body.rows[0].id,actor,investment.id]);
  const condition=await admin.query(`INSERT INTO m05_investment.decision_condition
    (tenant_id,decision_id,condition_type,description)
    VALUES($1,$2,'precedent','Provide statutory clearance') RETURNING id`,[tenant,decision.rows[0].id]);
  let result=await store.decisionConditionReadiness({tenantId:tenant,actorId:actor},decision.rows[0].id);
  assert.equal(result.outstandingPrecedents,1);
  assert.equal(result.commitmentReady,false);
  await admin.query(`INSERT INTO m05_investment.condition_verification
    (tenant_id,condition_id,verified_by,result,evidence_reference)
    VALUES($1,$2,$3,'satisfied','synthetic:test-evidence')`,[tenant,condition.rows[0].id,actor]);
  result=await store.decisionConditionReadiness({tenantId:tenant,actorId:actor},decision.rows[0].id);
  assert.equal(result.outstandingPrecedents,0);
  assert.equal(result.precedentClearance,true);
  assert.equal(result.commitmentReady,false);
  assert.equal(result.effectuationPerformed,false);
 } finally {await admin.query('ROLLBACK');await store.close();await admin.end();}
});
