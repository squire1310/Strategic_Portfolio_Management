# B010 — Committee decision evidence implementation contract (v0.1)

Status: proposed implementation slice; production governance rules and policy thresholds require approval.

## Intent
Evidence collection for M06 decision bodies, linked M05 investment and recorded meeting. Never transform an indicative vote or meeting outcome into an M05 investment approval without the separately validated decision/authority/effectuation transaction.

## Canonical ownership
- M06 owns sessions, quorum requirement snapshots, attendance, conflict declarations, recusals, votes and evidence attribution.
- M05 owns governed investment decision records, conditions and effectuation.
- Platform owns principal identity, tenant membership, audit, immutable revisions and assignments.
- Delegations in M06 remain distinct from application functional group membership.

## Proposed entities
**CommitteeSession:** tenant_id, id, decision_body_id, investment_id, held_at, required_quorum, recorded_by, recorded_at, source_reference, evidence_state (draft/finalised), revision.
**SessionParticipant:** tenant_id, session_id, principal_id, attended, conflict_declared, recused, vote (for/against/abstain/null), conflict_reason, evidence_note, recorded_at.
**SessionEvidenceSnapshot:** tenant_id, session_id, finalised_at, finalised_by, eligibility_snapshot, quorum_result, tally, canonical source hashes. Append-only after finalisation. Updates require a new superseding event rather than rewriting final evidence.

## Rules
1. Scope all reads and writes to tenant, relevant investment and governance body; private conflict disclosures require further field-level policy.
2. Only active, effective delegates of the decision body at the meeting time may count towards quorum; merely attending does not confer voting eligibility.
3. Declared conflict requires recusal unless explicitly handled through approved policy; recused members count neither towards eligible quorum nor votes.
4. A participant cannot vote without attendance, and cannot vote when recused. At most one recorded ballot per eligible participant and decision item.
5. Determine quorum using **eligible, present, unconflicted voters** and the effective quorum policy snapshot. Never derive a threshold solely from the UI.
6. Preserve minority votes, abstentions, conflicts, recusals, evidence and calculation inputs in auditable immutable snapshots.
7. Any change to attendance before finalisation must recalculate quorum and invalidate downstream readiness. After finalisation, no updates-in-place.
8. A finalised session is evidence only. Recording it neither approves an investment nor satisfies delegated financial authority alone.
9. Creation, evidence capture, finalisation and subsequent M05 effectuation require separate role/scoped permissions and separation of duties.
10. Do not expose a write endpoint until authority policy, scope checks, finalisation/idempotency, audit and adverse-path tests are implemented.

## Negative test catalogue
Missing tenant membership; wrong decision body; expired delegation; conflicted voter; recused vote; absent voter; duplicate ballot; below quorum; conflicting or missing authority; late attendance change; cross-tenant access; repeated finalisation; attempt to mutate finalised snapshot; unsigned/unauthorised recorded event; M05 effectuation without verified authority.

## Implementation sequence
A. Confirm the approved committee membership/quorum/conflict policy and precise M06 ownership.
B. Add tenant-scoped evidence schema, DB constraints and append-only finalisation with migration tests.
C. Add a scoped read-only evidence view and a deterministic quorum evaluation function.
D. Add restricted capture/finalisation commands with authority checks.
E. Link finalised evidence to the separate M05 decision service without automatic approval.

ServiceNow catalogue fulfilment and real Entra integration remain deferred.
