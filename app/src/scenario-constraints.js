// B009 policy is deliberately narrow: finite candidate score bands and optional
// explicit justification when a low-scoring candidate is recommended for selection.
export function validateScenarioConstraints(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Constraint object required');
  const keys=Object.keys(input);
  if(keys.some(k=>k!=='minimumSelectScore')) throw new Error('Unsupported scenario constraint');
  const minimum=input.minimumSelectScore;
  if(minimum!==undefined && (typeof minimum!=='number' || !Number.isFinite(minimum) || minimum<0 || minimum>100))
    throw new Error('minimumSelectScore must be between 0 and 100');
  return minimum===undefined ? {} : {minimumSelectScore:minimum};
}
export function evaluateScenarioConstraint(constraints, score, outcome, overrideReason) {
  const policy=validateScenarioConstraints(constraints);
  if(outcome!=='select'||policy.minimumSelectScore===undefined||score>=policy.minimumSelectScore)
    return {exception:false,reason:null};
  if(typeof overrideReason!=='string'||overrideReason.trim().length<20)
    throw new Error('Selecting below threshold requires an override reason of at least 20 characters');
  return {exception:true,reason:overrideReason.trim()};
}

export function rankScenarioCandidates(candidates, constraints = {}) {
  const policy = validateScenarioConstraints(constraints);
  if (!Array.isArray(candidates)) throw new Error('Candidate collection required');
  const seen = new Set();
  const ordered = candidates.map(candidate => {
    if (!candidate || typeof candidate.id !== 'string' || !candidate.id ||
        typeof candidate.score !== 'number' || !Number.isFinite(candidate.score) ||
        candidate.score < 0 || candidate.score > 100 || seen.has(candidate.id))
      throw new Error('Invalid or duplicate scenario candidate');
    seen.add(candidate.id);
    return { id: candidate.id, score: candidate.score };
  }).sort((a,b) => b.score-a.score || a.id.localeCompare(b.id));
  let priorScore, rank = 0;
  return ordered.map((candidate,index) => {
    if (candidate.score !== priorScore) rank = index + 1;
    priorScore = candidate.score;
    return { ...candidate, rank, belowMinimum:
      policy.minimumSelectScore !== undefined && candidate.score < policy.minimumSelectScore };
  });
}
