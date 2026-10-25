// B012 read-only clearance policy: never equate evidence with commitment authority.
export function evaluateDecisionConditions(decisionType, conditions) {
  if (!Array.isArray(conditions)) throw new Error('Condition collection required');
  const unresolved = conditions.filter(c => c.verification_result !== 'satisfied');
  const outstandingPrecedents = unresolved.filter(c => c.condition_type === 'precedent').length;
  const outstandingSubsequents = unresolved.filter(c => c.condition_type === 'subsequent').length;
  const overdueSubsequents = unresolved.filter(c => c.condition_type === 'subsequent' && c.overdue === true).length;
  return {outstandingPrecedents,outstandingSubsequents,overdueSubsequents,
    precedentClearance:outstandingPrecedents===0,
    commitmentReady:false,effectuationPerformed:false,
    decisionEligible:decisionType==='approve'};
}
