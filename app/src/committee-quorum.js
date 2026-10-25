// B010 deterministic, read-only session quorum projection.
// Delegate eligibility must be supplied from effective M06 delegation records.
export function evaluateCommitteeQuorum({required,participants,eligiblePrincipalIds}) {
 if(!Number.isInteger(required)||required<1) throw new Error('Valid quorum required');
 if(!Array.isArray(participants)||!Array.isArray(eligiblePrincipalIds)) throw new Error('Participants and delegate roster required');
 const eligible=new Set(eligiblePrincipalIds);
 const seen=new Set();
 let counted=0,forVotes=0,against=0,abstentions=0,recused=0;
 for(const p of participants){
  if(!p || !p.principalId || seen.has(p.principalId)) throw new Error('Invalid or duplicate participant');
  seen.add(p.principalId);
  if(p.conflictDeclared&&!p.recused) throw new Error('Conflicted participant must be recused');
  if(p.recused&&p.vote) throw new Error('Recused participant cannot vote');
  if(p.vote&&(!p.attended||!eligible.has(p.principalId))) throw new Error('Only present eligible delegates can vote');
  if(p.recused) recused++;
  if(p.attended&&!p.recused&&eligible.has(p.principalId)){
   counted++;
   if(p.vote==='for')forVotes++;
   else if(p.vote==='against')against++;
   else if(p.vote==='abstain')abstentions++;
   else if(p.vote!=null)throw new Error('Invalid ballot');
  }
 }
 return {quorumMet:counted>=required,required,eligiblePresent:counted,recused,forVotes,against,abstentions};
}
