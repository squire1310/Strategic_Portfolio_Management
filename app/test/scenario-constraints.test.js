import test from 'node:test';
import assert from 'node:assert/strict';
import {validateScenarioConstraints,evaluateScenarioConstraint,rankScenarioCandidates} from '../src/scenario-constraints.js';
test('B009 scenario thresholds are bounded and allow normal decisions',()=>{
 assert.deepEqual(validateScenarioConstraints({minimumSelectScore:75}),{minimumSelectScore:75});
 assert.deepEqual(evaluateScenarioConstraint({minimumSelectScore:75},80,'select'),{exception:false,reason:null});
 assert.deepEqual(evaluateScenarioConstraint({minimumSelectScore:75},40,'defer'),{exception:false,reason:null});
 assert.throws(()=>validateScenarioConstraints({minimumSelectScore:101}));
 assert.throws(()=>validateScenarioConstraints({unknown:true}));
 assert.throws(()=>evaluateScenarioConstraint({minimumSelectScore:75},70,'select','too short'));
 const result=evaluateScenarioConstraint({minimumSelectScore:75},70,'select','Exceptional mandatory statutory requirement');
 assert.equal(result.exception,true);
 assert.match(result.reason,/statutory/);
});

test('B009 multi-candidate ranking uses competition ties and stable identifiers',()=>{
 const ranked=rankScenarioCandidates([{id:'c',score:60},{id:'b',score:80},{id:'a',score:80},{id:'d',score:40}],{minimumSelectScore:70});
 assert.deepEqual(ranked.map(x=>[x.id,x.rank,x.belowMinimum]),[
  ['a',1,false],['b',1,false],['c',3,true],['d',4,true]
 ]);
 assert.throws(()=>rankScenarioCandidates([{id:'a',score:80},{id:'a',score:60}]));
 assert.throws(()=>rankScenarioCandidates([{id:'a',score:NaN}]));
});
