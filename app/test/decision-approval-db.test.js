import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {createStore,AppError} from '../src/domain.js';

const tenantId='00000000-0000-4000-8000-000000000001';
const ownerId='00000000-0000-4000-8000-000000000101';

test('B011 approved decision freezes evidence and conditions without effectuation',
  {skip:!process.env.SPM_TEST_DATABASE_URL},async()=>{
  const db=new pg.Client();await db.connect();
  const assessorId=randomUUID(),chairId=randomUUID(),suffix=randomUUID().slice(0,8);
  const owner=createStore({connectionString:process.env.SPM_TEST_DATABASE_URL,tenantId,actorId:ownerId});
  const assessor=createStore({connectionString:process.env.SPM_TEST_DATABASE_URL,tenantId,actorId:assessorId});
  const chair=createStore({connectionString:process.env.SPM_TEST_DATABASE_URL,tenantId,actorId:chairId});
  const ownerContext={tenantId,actorId:ownerId},assessorContext={tenantId,actorId:assessorId};
  const chairContext={tenantId,actorId:chairId};
  try {
    for(const [id,role] of [[assessorId,'contributor'],[chairId,'approver']]){
      await db.query('INSERT INTO platform.principal(principal_id,subject,display_name) VALUES($1,$2,$3)',
        [id,'test:approval-'+id,'B011 '+role]);
      await db.query('INSERT INTO platform.tenant_member(tenant_id,principal_id,member_role) VALUES($1,$2,$3)',
        [tenantId,id,role]);
    }
    const category=await owner.command('category',{code:'b011cat_'+suffix,label:'B011 category'},ownerContext);
    const proposal=await owner.proposal('create',{code:'b011proposal_'+suffix,title:'B011 candidate'},ownerContext);
    await owner.proposal('submit',{id:proposal.id,expectedVersion:1,summary:'Controlled case',options:[],assumptions:[]},ownerContext);
    await assessor.proposal('review',{id:proposal.id,expectedVersion:2,outcome:'accept_for_assessment',feedback:'Proceed'},assessorContext);
    await assessor.proposal('accept',{id:proposal.id,expectedVersion:3},assessorContext);
    const promoted=await owner.proposal('promote',{id:proposal.id,expectedVersion:4,
      code:'b011inv_'+suffix,categoryId:category.id},ownerContext);
    const model=(await db.query(`INSERT INTO m04_selection.scoring_model
      (tenant_id,code,name,owner_id,status,effective_during)
      VALUES($1,$2,'B011 scoring',$3,'draft',daterange('2026-01-01','2030-01-01','[)')) RETURNING id`,
      [tenantId,'b011model_'+suffix,assessorId])).rows[0];
    const criterion=(await db.query(`INSERT INTO m04_selection.criterion
      (tenant_id,scoring_model_id,code,name,weight,maximum_score,direction)
      VALUES($1,$2,'value','Value',1,10,'higher') RETURNING id`,[tenantId,model.id])).rows[0];
    await db.query("UPDATE m04_selection.scoring_model SET status='active' WHERE tenant_id=$1 AND id=$2",[tenantId,model.id]);
    const assessment=await assessor.assessment('create',{demandId:proposal.id,scoringModelId:model.id},assessorContext);
    await assessor.assessment('score',{id:assessment.id,expectedVersion:1,
      criterionId:criterion.id,score:8,evidence:'Documented benefit'},assessorContext);
    await assessor.assessment('complete',{id:assessment.id,expectedVersion:2,rationale:'Independent review'},assessorContext);
    const scenario=await assessor.recommendation('create-scenario',{
      code:'b011scenario_'+suffix,name:'B011 scenario',scoringModelId:model.id},assessorContext);
    const recommendation=(await assessor.recommendation('recommend',{
      scenarioId:scenario.id,assessmentId:assessment.id,outcome:'select',rationale:'Selected for decision'},assessorContext)).recommendation;
    const body=(await db.query(`INSERT INTO m06_governance.decision_body
      (tenant_id,code,name,remit,chair_id,monetary_limit,currency_code)
      VALUES($1,$2,'B011 body','Investment approval',$3,100000,'GBP') RETURNING id`,
      [tenantId,'b011body_'+suffix,chairId])).rows[0];
    await db.query(`INSERT INTO m06_governance.delegation
      (tenant_id,decision_body_id,delegate_id,scope_code,effective_during)
      VALUES($1,$2,$3,'investment',tstzrange(now()-interval '1 day',now()+interval '1 day','[)'))`,
      [tenantId,body.id,chairId]);
    const finalised=await chair.recordCommitteeSession({decisionBodyId:body.id,
      investmentId:promoted.investment.id,heldAt:new Date().toISOString(),quorumRequired:1,
      participants:[{principalId:chairId,attended:true,vote:'for'}]},chairContext);
    const request={sessionId:finalised.session.id,decisionType:'approve',
      recommendationId:recommendation.id,approvalAmount:50000,approvalCurrency:'GBP',
      rationale:'Approve within the recorded mandate',conditions:[
        {conditionType:'precedent',description:'Independent clearance before release'}]};
    await assert.rejects(chair.recordInvestmentDecision({...request,approvalAmount:100001},chairContext),
      /monetary approval exceeds body mandate/);
    await assert.rejects(chair.recordInvestmentDecision({...request,approvalCurrency:'USD'},chairContext),
      /monetary approval exceeds body mandate/);
    await assert.rejects(owner.recordInvestmentDecision(request,ownerContext),
      e=>e instanceof AppError&&e.status===403);
    const approved=await chair.recordInvestmentDecision(request,chairContext);
    assert.equal(approved.decision.decision_type,'approve');
    assert.equal(approved.decision.recommendation_id,recommendation.id);
    assert.equal(approved.conditions.length,1);
    assert.equal(approved.conditions[0].recorded_by,chairId);
    assert.equal(approved.investmentLifecycle,'candidate');
    assert.equal(approved.effectuated,false);
    const result=await db.query(`SELECT
      (SELECT count(*)::int FROM m05_investment.commitment WHERE tenant_id=$1 AND investment_id=$2) AS commitments,
      (SELECT count(*)::int FROM m05_investment.committee_decision_evidence WHERE tenant_id=$1 AND decision_id=$3) AS links`,
      [tenantId,promoted.investment.id,approved.decision.id]);
    assert.deepEqual(result.rows[0],{commitments:0,links:1});
  } finally {await Promise.all([owner.close(),assessor.close(),chair.close()]);await db.end();}
});
