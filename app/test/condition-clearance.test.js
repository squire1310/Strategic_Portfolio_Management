import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateDecisionConditions} from '../src/condition-clearance.js';

test('B012 precedent clearance is separate from financial release',()=>{
 const items=[
  {condition_type:'precedent',verification_result:null},
  {condition_type:'subsequent',verification_result:'not_satisfied',overdue:true}
 ];
 const pending=evaluateDecisionConditions('approve',items);
 assert.equal(pending.outstandingPrecedents,1);
 assert.equal(pending.commitmentReady,false);
 const cleared=evaluateDecisionConditions('approve',[
  {...items[0],verification_result:'satisfied'},items[1]]);
 assert.equal(cleared.precedentClearance,true);
 assert.equal(cleared.outstandingSubsequents,1);
 assert.equal(cleared.overdueSubsequents,1);
 assert.equal(evaluateDecisionConditions('approve',[{...items[1],verification_result:'satisfied',overdue:false}]).overdueSubsequents,0);
 assert.equal(cleared.commitmentReady,false);
 assert.equal(cleared.effectuationPerformed,false);
 assert.equal(evaluateDecisionConditions('defer',[]).decisionEligible,false);
 assert.throws(()=>evaluateDecisionConditions('approve',{}));
});
