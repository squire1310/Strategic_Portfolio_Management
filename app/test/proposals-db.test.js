import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {createStore,AppError} from '../src/domain.js';
const tenantId='00000000-0000-4000-8000-000000000001',actorId='00000000-0000-4000-8000-000000000101';
test('B006 draft submission preserves immutable case revision', {skip:!process.env.SPM_TEST_DATABASE_URL},async()=>{
 const store=createStore({connectionString:process.env.SPM_TEST_DATABASE_URL,tenantId,actorId});
 const ctx={tenantId,actorId};
 try {
  const created=await store.proposal('create',{code:'demand_'+randomUUID().slice(0,8),title:'Test proposal',description:'Draft'},ctx);
  assert.equal(created.status,'draft');
  assert.ok((await store.proposalList(ctx,false)).some(p=>p.id===created.id));
  const edited=await store.proposal('edit',{id:created.id,expectedVersion:1,title:'Updated proposal',description:'Reviewed draft'},ctx);
  assert.equal(edited.row_version,2);
  const result=await store.proposal('submit',{id:created.id,expectedVersion:2,summary:'Business need',options:[],assumptions:[]},ctx);
  assert.equal(result.proposal.status,'submitted');
  assert.ok((await store.proposalList(ctx,false)).some(p=>p.id===created.id&&p.latest_revision===1));
  assert.equal(result.revision.revision_no,1);
  assert.equal(result.revision.summary,'Business need');
  await assert.rejects(store.proposal('submit',{id:created.id,expectedVersion:3,summary:'Duplicate',options:[],assumptions:[]},ctx),
    e=>e instanceof AppError&&e.status===409);
  await assert.rejects(store.proposal('edit',{id:created.id,expectedVersion:3,title:'Changed'},ctx),
    e=>e instanceof AppError&&e.status===409);
 } finally {await store.close();}
});

test('B006 independent review returns proposal and permits immutable revision 2', {skip:!process.env.SPM_TEST_DATABASE_URL}, async()=>{
 const owner=new pg.Client(); await owner.connect();
 const reviewerId=randomUUID(); const ctx={tenantId,actorId};
 const store=createStore({connectionString:process.env.SPM_TEST_DATABASE_URL,tenantId,actorId});
 const reviewer=createStore({connectionString:process.env.SPM_TEST_DATABASE_URL,tenantId,actorId:reviewerId});
 try {
  await owner.query('INSERT INTO platform.principal(principal_id,subject,display_name) VALUES($1,$2,$3)',[reviewerId,'test:review-'+reviewerId,'Independent reviewer']);
  await owner.query("INSERT INTO platform.tenant_member(tenant_id,principal_id,member_role) VALUES($1,$2,'contributor')",[tenantId,reviewerId]);
  const proposal=await store.proposal('create',{code:'review_'+randomUUID().slice(0,8),title:'Review case'},ctx);
  const first=await store.proposal('submit',{id:proposal.id,expectedVersion:1,summary:'First',options:[],assumptions:[],reviewerId},ctx);
  assert.ok((await reviewer.workItem('inbox',null,{tenantId,actorId:reviewerId})).some(t=>t.object_id===proposal.id && t.workflow_kind==='proposal_review'));
  await assert.rejects(store.proposal('review',{id:proposal.id,expectedVersion:2,outcome:'return_for_correction',feedback:'Revise'},ctx),
    e=>e instanceof AppError&&e.status===403);
  const returned=await reviewer.proposal('review',{id:proposal.id,expectedVersion:2,outcome:'return_for_correction',feedback:'Clarify benefits'}, {tenantId,actorId:reviewerId});
  assert.equal(returned.proposal.status,'draft');
  assert.ok((await store.workItem('inbox',null,ctx)).some(t=>t.object_id===proposal.id && t.workflow_kind==='proposal_correction'));
  assert.ok(!(await reviewer.workItem('inbox',null,{tenantId,actorId:reviewerId})).some(t=>t.object_id===proposal.id && t.workflow_kind==='proposal_review' && t.state==='open'));
  assert.equal(returned.review.case_revision_id,first.revision.id);
  const second=await store.proposal('submit',{id:proposal.id,expectedVersion:3,summary:'Revised',options:[],assumptions:[]},ctx);
  assert.equal(second.revision.revision_no,2);
  assert.ok(!(await store.workItem('inbox',null,ctx)).some(t=>t.object_id===proposal.id && t.workflow_kind==='proposal_correction' && t.state==='open'));
  assert.notEqual(second.revision.id,first.revision.id);
 } finally {await Promise.all([store.close(),reviewer.close()]);await owner.end();}
});

test('B007 promotes accepted demand exactly once to candidate investment', {skip:!process.env.SPM_TEST_DATABASE_URL},async()=>{
 const owner=new pg.Client(); await owner.connect();
 const reviewerId=randomUUID(),ctx={tenantId,actorId};
 const store=createStore({connectionString:process.env.SPM_TEST_DATABASE_URL,tenantId,actorId});
 const reviewer=createStore({connectionString:process.env.SPM_TEST_DATABASE_URL,tenantId,actorId:reviewerId});
 try {
  await owner.query('INSERT INTO platform.principal(principal_id,subject,display_name) VALUES($1,$2,$3)',[reviewerId,'test:promote-'+reviewerId,'Intake reviewer']);
  await owner.query("INSERT INTO platform.tenant_member(tenant_id,principal_id,member_role) VALUES($1,$2,'contributor')",[tenantId,reviewerId]);
  const suffix=randomUUID().slice(0,8);
  const category=await store.command('category',{code:'category_'+suffix,label:'Test category'});
  const draft=await store.proposal('create',{code:'promotion_'+suffix,title:'Candidate source'},ctx);
  await assert.rejects(store.proposal('promote',{id:draft.id,expectedVersion:1,code:'inv_'+suffix,categoryId:category.id},ctx),e=>e instanceof AppError&&e.status===409);
  await store.proposal('submit',{id:draft.id,expectedVersion:1,summary:'Case',options:[],assumptions:[]},ctx);
  await reviewer.proposal('review',{id:draft.id,expectedVersion:2,outcome:'accept_for_assessment',feedback:'Proceed'}, {tenantId,actorId:reviewerId});
  const accepted=await reviewer.proposal('accept',{id:draft.id,expectedVersion:3}, {tenantId,actorId:reviewerId});
  assert.equal(accepted.proposal.status,'accepted');
  const promoted=await store.proposal('promote',{id:draft.id,expectedVersion:4,code:'inv_'+suffix,categoryId:category.id},ctx);
  assert.equal(promoted.investment.lifecycle,'candidate');
  assert.equal(promoted.investment.origin_demand_id,draft.id);
  await assert.rejects(store.proposal('promote',{id:draft.id,expectedVersion:4,code:'inv_other_'+suffix,categoryId:category.id},ctx),e=>e instanceof AppError&&e.status===409);
 } finally { await Promise.all([store.close(),reviewer.close()]); await owner.end(); }
});
