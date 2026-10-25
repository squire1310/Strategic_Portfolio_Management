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
  await assert.rejects(store.recordCommitteeSession({
    decisionBodyId:body.rows[0].id,investmentId:inv.id,heldAt:new Date().toISOString(),quorumRequired:2,
    participants:[{principalId:chair,attended:true,vote:'for'}]
  },{tenantId:tenant,actorId:chair}),e=>e instanceof AppError&&e.status===409);
  await assert.rejects(store.recordCommitteeSession({
    decisionBodyId:body.rows[0].id,investmentId:inv.id,heldAt:new Date().toISOString(),quorumRequired:1,
    participants:[{principalId:chair,attended:true,conflictDeclared:true,recused:false,vote:'for',evidenceNote:'Conflicted'}]
  },{tenantId:tenant,actorId:chair}),e=>e instanceof AppError&&e.status===400);
  const finalised=await store.recordCommitteeSession({
    decisionBodyId:body.rows[0].id,investmentId:inv.id,heldAt:new Date().toISOString(),quorumRequired:1,
    participants:[{principalId:chair,attended:true,vote:'for'}]
  },{tenantId:tenant,actorId:chair});
  assert.equal(finalised.summary.quorumMet,true);
  assert.equal(finalised.finalisation.session_id,finalised.session.id);
  assert.equal(finalised.finalisation.evidence_snapshot.summary.forVotes,1);
  const readiness=await store.committeeDecisionReadiness({tenantId:tenant,actorId:chair},finalised.session.id);
  assert.equal(readiness.status,'evidence_ready_only');
  assert.equal(readiness.approvalGranted,false);
  await assert.rejects(store.recordInvestmentDecision({sessionId:finalised.session.id,decisionType:'approve',rationale:'Unverified approval'}, {tenantId:tenant,actorId:chair}),e=>e instanceof AppError&&e.status===403);
  await assert.rejects(store.recordInvestmentDecision({sessionId:finalised.session.id,decisionType:'defer',rationale:'Insufficient documentation'}, {tenantId:tenant,actorId:chair}),e=>e instanceof AppError&&e.status===403);
  assert.equal(readiness.quorumVerified,true);
  await assert.rejects(db.query('DELETE FROM m06_governance.committee_finalisation WHERE tenant_id=$1 AND session_id=$2',
    [tenant,finalised.session.id]),/append-only/);
  await assert.rejects(db.query('UPDATE m06_governance.committee_participant SET vote=$1 WHERE tenant_id=$2 AND session_id=$3',['against',tenant,session.rows[0].id]),/append-only/);
 }finally{await store.close();await db.end();}
});
