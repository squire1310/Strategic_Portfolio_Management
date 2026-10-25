import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createStore,AppError } from '../src/domain.js';
const tenantId='00000000-0000-4000-8000-000000000001',actorId='00000000-0000-4000-8000-000000000101';
test('B005 work item lifecycle and inbox on PostgreSQL', {skip:!process.env.SPM_TEST_DATABASE_URL},async()=>{
 const store=createStore({connectionString:process.env.SPM_TEST_DATABASE_URL,tenantId,actorId});
 const ctx={tenantId,actorId};
 try{
  const p=await store.command('portfolio',{code:'task_'+randomUUID().slice(0,8),name:'Task target'});
  const item=await store.workItem('create',{objectType:'portfolio',objectId:p.id,title:'Review portfolio',assigneeId:actorId,dueOn:'2026-12-01'},ctx);
  assert.equal(item.state,'open');
  assert.ok((await store.workItem('inbox',null,ctx)).some(x=>x.id===item.id));
  const moved=await store.workItem('reassign',{id:item.id,expectedVersion:1,assigneeId:actorId},ctx);
  assert.equal(moved.row_version,2);
  await assert.rejects(store.workItem('complete',{id:item.id,expectedVersion:1,note:'stale'},ctx),e=>e instanceof AppError&&e.status===409);
  const done=await store.workItem('complete',{id:item.id,expectedVersion:2,note:'Checked'},ctx);
  assert.equal(done.state,'completed');
  await assert.rejects(store.workItem('complete',{id:item.id,expectedVersion:3,note:'duplicate'},ctx),e=>e instanceof AppError&&e.status===409);
 }finally{await store.close();}
});
