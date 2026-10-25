import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {createStore,AppError} from '../src/domain.js';
test('B012 outstanding precedent blocks readiness and evidence does not effectuate', {skip:!process.env.SPM_TEST_DATABASE_URL},async()=>{
 const tenant='00000000-0000-4000-8000-000000000001';
 const actor='00000000-0000-4000-8000-000000000101';
 const approver=randomUUID();
 const verifier=randomUUID();
 const admin=new pg.Client();await admin.connect();
 await admin.query('BEGIN');
 await admin.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.actor_id',$2,true),set_config('app.request_id',$3,true)",[tenant,actor,randomUUID()]);
 const store=createStore({connectionString:process.env.SPM_TEST_DATABASE_URL,tenantId:tenant,actorId:actor});
 const verifierStore=createStore({connectionString:process.env.SPM_TEST_DATABASE_URL,tenantId:tenant,actorId:verifier});
 try {
  const suffix=randomUUID().slice(0,8);
  const category=await store.command('category',{code:'condcat_'+suffix,label:'Condition category'});
  const investment=await store.command('investment',{code:'condinv_'+suffix,title:'Condition candidate',categoryId:category.id});
  await admin.query('INSERT INTO platform.principal(principal_id,subject,display_name) VALUES($1,$2,$3)',[approver,'test:condition-approver-'+approver,'Independent test approver']);
  await admin.query("INSERT INTO platform.tenant_member(tenant_id,principal_id,member_role) VALUES($1,$2,'approver')",[tenant,approver]);
  await admin.query('INSERT INTO platform.principal(principal_id,subject,display_name) VALUES($1,$2,$3)',[verifier,'test:condition-verifier-'+verifier,'Independent test verifier']);
  await admin.query("INSERT INTO platform.tenant_member(tenant_id,principal_id,member_role) VALUES($1,$2,'contributor')",[tenant,verifier]);
  await admin.query("SELECT set_config('app.actor_id',$1,true)",[approver]);
  const body=await admin.query('INSERT INTO m06_governance.decision_body(tenant_id,code,name,remit,chair_id) VALUES($1,$2,$3,$4,$5) RETURNING id',[tenant,'condbody_'+suffix ,'Condition body','Testing',approver]);
  const decision=await admin.query(`INSERT INTO m05_investment.investment_decision
    (tenant_id,decision_body_id,decided_by,investment_id,subject_type,subject_id,decision_type,rationale,decided_at,effective_on)
    VALUES($1,$2,$3,$4,'investment',$4,'defer','Evidence pending',now(),CURRENT_DATE) RETURNING id`,
    [tenant,body.rows[0].id,approver,investment.id]);
  const condition=await admin.query(`INSERT INTO m05_investment.decision_condition
    (tenant_id,decision_id,condition_type,description)
    VALUES($1,$2,'precedent','Provide statutory clearance') RETURNING id`,[tenant,decision.rows[0].id]);
  await admin.query('COMMIT');
  let result=await store.decisionConditionReadiness({tenantId:tenant,actorId:actor},decision.rows[0].id);
  assert.equal(result.outstandingPrecedents,1);
  assert.equal(result.commitmentReady,false);
  const payload={conditionId:condition.rows[0].id,result:'satisfied',evidenceReference:'synthetic:independent-proof'};
  await assert.rejects(verifierStore.verifyDecisionCondition(payload),e=>e instanceof AppError&&e.status===403);
  const direct=async (actingAs,verifiedBy)=>{
    const client=new pg.Client({connectionString:process.env.SPM_TEST_DATABASE_URL});
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.actor_id',$2,true)",[tenant,actingAs]);
      return await client.query(`INSERT INTO m05_investment.condition_verification
        (tenant_id,condition_id,verified_by,result,evidence_reference)
        VALUES($1,$2,$3,'satisfied','synthetic:direct-bypass')`,[tenant,condition.rows[0].id,verifiedBy]);
    } finally {await client.query('ROLLBACK');await client.end();}
  };
  await assert.rejects(direct(verifier,verifier),/Effective verifier mandate required/);
  const mandate=await admin.query(`INSERT INTO m05_investment.condition_verifier_mandate
    (tenant_id,principal_id,granted_by,effective_during,reason)
    VALUES($1,$2,$3,tstzrange(now()-interval '1 hour',now()+interval '1 day','[)'),$4) RETURNING id`,
    [tenant,verifier,approver,'Test mandate for independent condition evidence verification']);
  const evidence=await verifierStore.verifyDecisionCondition(payload);
  assert.equal(evidence.result,'satisfied');
  await assert.rejects(direct(actor,verifier),/Verification actor and tenant context required/);
  result=await store.decisionConditionReadiness({tenantId:tenant,actorId:actor},decision.rows[0].id);
  assert.equal(result.outstandingPrecedents,0);
  assert.equal(result.precedentClearance,true);
  assert.equal(result.commitmentReady,false);
  assert.equal(result.effectuationPerformed,false);
  await admin.query(`UPDATE m05_investment.condition_verifier_mandate SET revoked_at=now()
    WHERE tenant_id=$1 AND id=$2`,[tenant,mandate.rows[0].id]);
  await assert.rejects(verifierStore.verifyDecisionCondition(payload),e=>e instanceof AppError&&e.status===403);
  await assert.rejects(direct(verifier,verifier),/Effective verifier mandate required/);
  await admin.query(`INSERT INTO m05_investment.condition_verifier_mandate
    (tenant_id,principal_id,granted_by,effective_during,reason)
    VALUES($1,$2,$3,tstzrange(now()-interval '1 hour',now()+interval '1 day','[)'),$4)`,
    [tenant,actor,approver,'Test mandate must not permit investment owner self verification']);
  await assert.rejects(store.verifyDecisionCondition(payload),e=>e instanceof AppError&&e.status===403);
  await assert.rejects(direct(actor,actor),/Independent verifier required/);
 } finally {await store.close();await verifierStore.close();await admin.end();}
});
