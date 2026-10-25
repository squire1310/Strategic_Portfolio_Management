import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createStore,AppError} from '../src/domain.js';
const tenantId='00000000-0000-4000-8000-000000000001',actorId='00000000-0000-4000-8000-000000000101';
test('B006 draft submission preserves immutable case revision', {skip:!process.env.SPM_TEST_DATABASE_URL},async()=>{
 const store=createStore({connectionString:process.env.SPM_TEST_DATABASE_URL,tenantId,actorId});
 const ctx={tenantId,actorId};
 try {
  const created=await store.proposal('create',{code:'demand_'+randomUUID().slice(0,8),title:'Test proposal',description:'Draft'},ctx);
  assert.equal(created.status,'draft');
  const edited=await store.proposal('edit',{id:created.id,expectedVersion:1,title:'Updated proposal',description:'Reviewed draft'},ctx);
  assert.equal(edited.row_version,2);
  const result=await store.proposal('submit',{id:created.id,expectedVersion:2,summary:'Business need',options:[],assumptions:[]},ctx);
  assert.equal(result.proposal.status,'submitted');
  assert.equal(result.revision.revision_no,1);
  assert.equal(result.revision.summary,'Business need');
  await assert.rejects(store.proposal('submit',{id:created.id,expectedVersion:3,summary:'Duplicate',options:[],assumptions:[]},ctx),
    e=>e instanceof AppError&&e.status===409);
  await assert.rejects(store.proposal('edit',{id:created.id,expectedVersion:3,title:'Changed'},ctx),
    e=>e instanceof AppError&&e.status===409);
 } finally {await store.close();}
});
