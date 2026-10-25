import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveJourneyStatus } from '../src/journey-projections.js';
test('canonical statuses derive only from visible records, without mutation', () => {
 const workspace={strategies:[{id:'s1',status:'retired',row_version:2}],investments:[{id:'i1',lifecycle:'candidate'}],observations:[{id:'m1',voided:true}],portfolios:[]};
 const before=JSON.stringify(workspace);
 assert.deepEqual(deriveJourneyStatus(workspace),[
 {objectType:'strategy',id:'s1',state:'retired',rowVersion:2,source:'strategies.status'},
 {objectType:'investment',id:'i1',state:'candidate',rowVersion:null,source:'investments.lifecycle'},
 {objectType:'observation',id:'m1',state:'voided',rowVersion:null,source:'observations.voided'}
 ]);
 assert.equal(JSON.stringify(workspace),before);
 assert.deepEqual(deriveJourneyStatus({strategies:[]}),[]);
});
