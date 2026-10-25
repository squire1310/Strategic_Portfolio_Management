import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCommitteeQuorum} from '../src/committee-quorum.js';
test('B010 quorum counts only present eligible unconflicted delegates',()=>{
 const result=evaluateCommitteeQuorum({required:2,eligiblePrincipalIds:['chair','member','other'],participants:[
 {principalId:'chair',attended:true,recused:false,vote:'for'},
 {principalId:'member',attended:true,recused:false,vote:'abstain'},
 {principalId:'other',attended:true,conflictDeclared:true,recused:true,vote:null},
 {principalId:'visitor',attended:true,recused:false,vote:null}
 ]});
 assert.deepEqual(result,{quorumMet:true,required:2,eligiblePresent:2,recused:1,forVotes:1,against:0,abstentions:1});
 assert.equal(evaluateCommitteeQuorum({required:3,eligiblePrincipalIds:['chair'],participants:[{principalId:'chair',attended:true,vote:'for'}]}).quorumMet,false);
 assert.throws(()=>evaluateCommitteeQuorum({required:1,eligiblePrincipalIds:['a'],participants:[{principalId:'a',attended:true,conflictDeclared:true,recused:false}]}));
 assert.throws(()=>evaluateCommitteeQuorum({required:1,eligiblePrincipalIds:['a'],participants:[{principalId:'a',attended:true,recused:true,vote:'for'}]}));
});
