import test from 'node:test';
import assert from 'node:assert/strict';
import {validateScenarioConstraints,evaluateScenarioConstraint} from '../src/scenario-constraints.js';
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
