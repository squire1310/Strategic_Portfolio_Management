import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {createStore,AppError} from '../src/domain.js';
const tenantId='00000000-0000-4000-8000-000000000001',ownerId='00000000-0000-4000-8000-000000000101';
test('B008 independent assessment and criterion coverage', {skip:!process.env.SPM_TEST_DATABASE_URL},async()=>{
 const db=new pg.Client();await db.connect();
 const assessorId=randomUUID(),suffix=randomUUID().slice(0,8);
 const owner=createStore({connectionString:process.env.SPM_TEST_DATABASE_URL,tenantId,actorId:ownerId});
 const assessor=createStore({connectionString:process.env.SPM_TEST_DATABASE_URL,tenantId,actorId:assessorId});
 const ownCtx={tenantId,actorId:ownerId},ctx={tenantId,actorId:assessorId};
 try{
  await db.query('INSERT INTO platform.principal(principal_id,subject,display_name) VALUES($1,$2,$3)',[assessorId,'test:assessor-'+assessorId,'Independent assessor']);
  await db.query("INSERT INTO platform.tenant_member(tenant_id,principal_id,member_role) VALUES($1,$2,'contributor')",[tenantId,assessorId]);
  const draft=await owner.proposal('create',{code:'assessment_'+suffix,title:'Assess me'},ownCtx);
  await owner.proposal('submit',{id:draft.id,expectedVersion:1,summary:'Case',options:[],assumptions:[]},ownCtx);
  const review=await assessor.proposal('review',{id:draft.id,expectedVersion:2,outcome:'accept_for_assessment',feedback:'Proceed'},ctx);
  assert.equal(review.proposal.status,'triage');
  const model=await db.query(`INSERT INTO m04_selection.scoring_model
    (tenant_id,code,name,owner_id,status,effective_during)
    VALUES($1,$2,'Test model',$3,'draft',daterange('2026-01-01','2030-01-01','[)')) RETURNING id`,
    [tenantId,'model_'+suffix,assessorId]);
  const modelId=model.rows[0].id;
  const criterion=await db.query(`INSERT INTO m04_selection.criterion
    (tenant_id,scoring_model_id,code,name,weight,maximum_score,direction)
    VALUES($1,$2,'impact','Impact',1,10,'higher') RETURNING id`,[tenantId,modelId]);
  await db.query("UPDATE m04_selection.scoring_model SET status='active' WHERE tenant_id=$1 AND id=$2",[tenantId,modelId]);
  await assert.rejects(owner.assessment('create',{demandId:draft.id,scoringModelId:modelId},ownCtx),e=>e instanceof AppError&&e.status===403);
  const assessment=await assessor.assessment('create',{demandId:draft.id,scoringModelId:modelId},ctx);
  assert.ok(assessment.case_revision_id,'assessment must cite immutable case revision');
  await assert.rejects(assessor.assessment('complete',{id:assessment.id,expectedVersion:1,rationale:'Premature'},ctx),e=>e instanceof AppError&&e.status===409);
  const saved=await assessor.assessment('score',{id:assessment.id,expectedVersion:1,criterionId:criterion.rows[0].id,score:7,evidence:'Documented evidence'},ctx);
  assert.equal(Number(saved.score.score),7);
  const results=await assessor.assessmentResults(ctx,assessment.id);
  assert.equal(results.complete,true);
  assert.equal(results.weightedTotal,70);
  assert.equal(results.criteria.length,1);
  const completed=await assessor.assessment('complete',{id:assessment.id,expectedVersion:2,rationale:'Assessed independently'},ctx);
  assert.equal(completed.status,'completed');
  const scenario=await assessor.recommendation('create-scenario',{code:'scenario_'+suffix,name:'Selection scenario',scoringModelId:modelId},ctx);
  const recommendation=await assessor.recommendation('recommend',{scenarioId:scenario.id,assessmentId:assessment.id,outcome:'defer',rationale:'Further validation required'},ctx);
  assert.equal(recommendation.recommendation.recommendation,'defer');
  assert.equal(recommendation.recommendation.demand_id,draft.id);
  await assert.rejects(assessor.recommendation('recommend',{scenarioId:scenario.id,assessmentId:assessment.id,outcome:'invalid',rationale:'Bad'},ctx),e=>e instanceof AppError&&e.status===409);
  const exceptionScenario=await assessor.recommendation('create-scenario',{
    code:'exception_'+suffix,name:'Exception scenario',scoringModelId:modelId,
    constraints:{minimumSelectScore:75}},ctx);
  await assert.rejects(assessor.recommendation('recommend',{
    scenarioId:exceptionScenario.id,assessmentId:assessment.id,outcome:'select',
    rationale:'Urgent exceptional selection',overrideReason:'Critical statutory delivery deadline'},ctx),
    e=>e instanceof AppError&&e.status===403);
  const request=await assessor.scenarioOverride('request',{
    scenarioId:exceptionScenario.id,assessmentId:assessment.id,
    justification:'Critical statutory delivery deadline'},ctx);
  await assert.rejects(assessor.scenarioOverride('decide',{
    id:request.id,decision:'approved',reason:'Independent governance review passed'},ctx),
    e=>e instanceof AppError&&e.status===403);
  const approved=await owner.scenarioOverride('decide',{
    id:request.id,decision:'approved',reason:'Independent governance review passed'},ownCtx);
  assert.equal(approved.decision,'approved');
  const selected=await assessor.recommendation('recommend',{
    scenarioId:exceptionScenario.id,assessmentId:assessment.id,outcome:'select',
    rationale:'Urgent exceptional selection',overrideReason:'Critical statutory delivery deadline'},ctx);
  assert.equal(selected.recommendation.recommendation,'select');
  await assert.rejects(assessor.assessment('score',{id:assessment.id,expectedVersion:3,criterionId:criterion.rows[0].id,score:8,evidence:'Late'},ctx),e=>e instanceof AppError&&e.status===409);
 }finally{await Promise.all([owner.close(),assessor.close()]);await db.end();}
});
