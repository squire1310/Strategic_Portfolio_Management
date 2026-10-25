import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {createStore,AppError} from '../src/domain.js';
test('B012 outstanding precedent blocks readiness and evidence does not effectuate', {skip:!process.env.SPM_TEST_DATABASE_URL},async()=>{
 const tenant='00000000-0000-4000-8000-000000000001';
 const actor='00000000-0000-4000-8000-000000000101';
 const otherTenant='00000000-0000-4000-8000-000000000002';
 const otherActor='00000000-0000-4000-8000-000000000102';
 const approver=randomUUID();
 const verifier=randomUUID();
 const admin=new pg.Client();await admin.connect();
 await admin.query('BEGIN');
 await admin.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.actor_id',$2,true),set_config('app.request_id',$3,true)",[tenant,actor,randomUUID()]);
 const store=createStore({connectionString:process.env.SPM_TEST_DATABASE_URL,tenantId:tenant,actorId:actor});
 const verifierStore=createStore({connectionString:process.env.SPM_TEST_DATABASE_URL,tenantId:tenant,actorId:verifier});
 const otherStore=createStore({connectionString:process.env.SPM_TEST_DATABASE_URL,tenantId:otherTenant,actorId:otherActor});
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
  const subsequent=await admin.query(`INSERT INTO m05_investment.decision_condition
    (tenant_id,decision_id,condition_type,description,due_on)
    VALUES($1,$2,'subsequent','Submit ongoing monitoring report',CURRENT_DATE-1) RETURNING id`,[tenant,decision.rows[0].id]);
  await admin.query('COMMIT');
  let result=await store.decisionConditionReadiness({tenantId:tenant,actorId:actor},decision.rows[0].id);
  assert.equal(result.outstandingPrecedents,1);
  assert.equal(result.outstandingSubsequents,1);
  assert.equal(result.overdueSubsequents,1);
  assert.equal(result.conditions.find(c=>c.id===subsequent.rows[0].id).overdue,true);
  assert.equal(result.commitmentReady,false);
  await assert.rejects(verifierStore.decisionConditionReadiness({tenantId:tenant,actorId:verifier},decision.rows[0].id),
    e=>e instanceof AppError&&e.status===403);
  const submitted=await store.submitConditionEvidence({conditionId:condition.rows[0].id,
    evidenceReference:'synthetic:independent-proof'},{tenantId:tenant,actorId:actor});
  assert.equal(submitted.submitted_by,actor);
  const payload={conditionId:condition.rows[0].id,submissionId:submitted.id,result:'satisfied'};
  await assert.rejects(verifierStore.verifyDecisionCondition({conditionId:condition.rows[0].id,result:'satisfied'},
    {tenantId:tenant,actorId:verifier}),e=>e instanceof AppError&&e.status===400);
  await assert.rejects(verifierStore.submitConditionEvidence({conditionId:condition.rows[0].id,
    evidenceReference:'synthetic:self-submitted'},{tenantId:tenant,actorId:verifier}),
    e=>e instanceof AppError&&e.status===403);
  await assert.rejects(admin.query(`UPDATE m05_investment.condition_evidence_submission SET evidence_reference='changed'
    WHERE tenant_id=$1 AND id=$2`,[tenant,submitted.id]),/Decision condition evidence is immutable/);
  await assert.rejects(otherStore.decisionConditionReadiness({tenantId:otherTenant,actorId:otherActor},decision.rows[0].id),
    e=>e instanceof AppError&&e.status===404);
  await assert.rejects(otherStore.verifyDecisionCondition(payload,{tenantId:otherTenant,actorId:otherActor}),
    e=>e instanceof AppError&&e.status===404);
  await assert.rejects(verifierStore.verifyDecisionCondition(payload,{tenantId:tenant,actorId:verifier}),e=>e instanceof AppError&&e.status===403);
  const direct=async (actingAs,verifiedBy,verifiedAt=null,mandateId=null,submissionId=submitted.id)=>{
    const client=new pg.Client({connectionString:process.env.SPM_TEST_DATABASE_URL});
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id',$1,true),set_config('app.actor_id',$2,true)",[tenant,actingAs]);
      return await client.query(`INSERT INTO m05_investment.condition_verification
        (tenant_id,condition_id,verified_by,result,evidence_reference,verified_at,mandate_id,submission_id)
        VALUES($1,$2,$3,'satisfied','synthetic:direct-bypass',COALESCE($4::timestamptz,now()),$5,$6)
        RETURNING verified_at,mandate_id,evidence_reference,submission_id`,
        [tenant,condition.rows[0].id,verifiedBy,verifiedAt,mandateId,submissionId]);
    } finally {await client.query('ROLLBACK');await client.end();}
  };
  await assert.rejects(direct(verifier,verifier),/Effective verifier mandate required/);
  const mandate=await admin.query(`INSERT INTO m05_investment.condition_verifier_mandate
    (tenant_id,principal_id,granted_by,effective_during,reason)
    VALUES($1,$2,$3,tstzrange(now()-interval '1 hour',now()+interval '1 day','[)'),$4) RETURNING id`,
    [tenant,verifier,approver,'Test mandate for independent condition evidence verification']);
  assert.equal((await verifierStore.decisionConditionReadiness({tenantId:tenant,actorId:verifier},decision.rows[0].id)).outstandingPrecedents,1);
  const evidence=await verifierStore.verifyDecisionCondition(payload,{tenantId:tenant,actorId:verifier});
  assert.equal(evidence.result,'satisfied');
  assert.equal(evidence.mandate_id,mandate.rows[0].id);
  assert.equal(evidence.submission_id,submitted.id);
  assert.equal(evidence.evidence_reference,submitted.evidence_reference);
  await assert.rejects(admin.query(`UPDATE m05_investment.condition_verification SET result='not_satisfied'
    WHERE tenant_id=$1 AND id=$2`,[tenant,evidence.id]),/Decision condition evidence is immutable/);
  const forgedTime=await direct(verifier,verifier,'9999-01-01T00:00:00Z',randomUUID());
  assert.ok(forgedTime.rows[0].verified_at.getTime()<=Date.now());
  assert.ok(forgedTime.rows[0].verified_at.getTime()>=Date.now()-60_000);
  assert.equal(forgedTime.rows[0].mandate_id,mandate.rows[0].id);
  assert.equal(forgedTime.rows[0].evidence_reference,submitted.evidence_reference);
  await assert.rejects(direct(verifier,verifier,null,null,null),/Newer condition evidence requires verification/);
  await assert.rejects(direct(actor,verifier),/Verification actor and tenant context required/);
  result=await store.decisionConditionReadiness({tenantId:tenant,actorId:actor},decision.rows[0].id);
  assert.equal(result.outstandingPrecedents,0);
  assert.equal(result.precedentClearance,true);
  assert.equal(result.commitmentReady,false);
  assert.equal(result.effectuationPerformed,false);
  const revisedSubmission=await store.submitConditionEvidence({conditionId:condition.rows[0].id,
    evidenceReference:'synthetic:revised-proof'},{tenantId:tenant,actorId:actor});
  result=await store.decisionConditionReadiness({tenantId:tenant,actorId:actor},decision.rows[0].id);
  assert.equal(result.outstandingPrecedents,1);
  assert.equal(result.conditions.find(c=>c.id===condition.rows[0].id).latest_submission_id,revisedSubmission.id);
  assert.equal(result.conditions.find(c=>c.id===condition.rows[0].id).verification_result,null);
  assert.equal(result.commitmentReady,false);
  await assert.rejects(verifierStore.verifyDecisionCondition(payload,{tenantId:tenant,actorId:verifier}),
    e=>e instanceof AppError&&e.status===409);
  await assert.rejects(direct(verifier,verifier),/Newer condition evidence requires verification/);
  const currentPayload={...payload,submissionId:revisedSubmission.id};
  const revisedVerification=await verifierStore.verifyDecisionCondition(currentPayload,{tenantId:tenant,actorId:verifier});
  assert.equal(revisedVerification.evidence_reference,'synthetic:revised-proof');
  result=await store.decisionConditionReadiness({tenantId:tenant,actorId:actor},decision.rows[0].id);
  assert.equal(result.outstandingPrecedents,0);
  assert.equal(result.precedentClearance,true);
  const subsequentSubmission=await store.submitConditionEvidence({conditionId:subsequent.rows[0].id,
    evidenceReference:'synthetic:monitoring-proof'},{tenantId:tenant,actorId:actor});
  await assert.rejects(direct(verifier,verifier,null,null,subsequentSubmission.id),
    /Newer condition evidence requires verification/);
  const later={conditionId:subsequent.rows[0].id,submissionId:subsequentSubmission.id,result:'satisfied'};
  await verifierStore.verifyDecisionCondition(later,{tenantId:tenant,actorId:verifier});
  result=await store.decisionConditionReadiness({tenantId:tenant,actorId:actor},decision.rows[0].id);
  assert.equal(result.outstandingSubsequents,0);
  assert.equal(result.overdueSubsequents,0);
  await verifierStore.verifyDecisionCondition({...later,result:'not_satisfied'},
    {tenantId:tenant,actorId:verifier});
  result=await store.decisionConditionReadiness({tenantId:tenant,actorId:actor},decision.rows[0].id);
  assert.equal(result.outstandingSubsequents,1);
  assert.equal(result.overdueSubsequents,1);
  assert.equal(result.commitmentReady,false);
  await admin.query(`UPDATE m05_investment.condition_verifier_mandate SET revoked_at=now()
    WHERE tenant_id=$1 AND id=$2`,[tenant,mandate.rows[0].id]);
  await assert.rejects(verifierStore.decisionConditionReadiness({tenantId:tenant,actorId:verifier},decision.rows[0].id),
    e=>e instanceof AppError&&e.status===403);
  await assert.rejects(verifierStore.verifyDecisionCondition(currentPayload,{tenantId:tenant,actorId:verifier}),e=>e instanceof AppError&&e.status===403);
  await assert.rejects(direct(verifier,verifier),/Effective verifier mandate required/);
  await admin.query(`INSERT INTO m05_investment.condition_verifier_mandate
    (tenant_id,principal_id,granted_by,effective_during,reason)
    VALUES($1,$2,$3,tstzrange(now()+interval '1 day',now()+interval '2 days','[)'),$4),
          ($1,$2,$3,tstzrange(now()-interval '2 days',now()-interval '1 day','[)'),$5)`,
    [tenant,verifier,approver,'Future mandate must not authorise current verification',
      'Expired mandate must not authorise current verification']);
  await assert.rejects(verifierStore.verifyDecisionCondition(currentPayload,{tenantId:tenant,actorId:verifier}),e=>e instanceof AppError&&e.status===403);
  await assert.rejects(direct(verifier,verifier),/Effective verifier mandate required/);
  await admin.query(`INSERT INTO m05_investment.condition_verifier_mandate
    (tenant_id,principal_id,granted_by,effective_during,reason)
    VALUES($1,$2,$3,tstzrange(now()-interval '1 hour',now()+interval '1 day','[)'),$4)`,
    [tenant,actor,approver,'Test mandate must not permit investment owner self verification']);
  await assert.rejects(store.verifyDecisionCondition(payload,{tenantId:tenant,actorId:actor}),e=>e instanceof AppError&&e.status===403);
  await assert.rejects(direct(actor,actor),/Independent verifier required/);
 } finally {await store.close();await verifierStore.close();await otherStore.close();await admin.end();}
});
