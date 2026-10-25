# SPM Business Rules, Decision Rights and Governance Model — v1.0

**Prepared:** 25 October 2026  
**Status:** Proposed operational design for review. **D01–D10 are existing approved domain decisions**, not new approvals granted by this document.  
**Audience:** Product owner, strategy, portfolio, finance, assurance, governance, security and engineering.  
**Scope:** Large enterprise and public-sector configurations of the hybrid SPM platform.  
**References:** [Approved domain decisions](../reconciled-core/docs/domain-decisions-v1.0.md) · [Canonical domain model v1.1](../reconciled-core/docs/canonical-domain-model-v1.1.md) · [Personas](user-role-persona-catalogue-v1.0.md) · [Journeys](user-journey-catalogue-v1.0.md) · [P01 service blueprint](investment-decision-service-blueprint-v1.0.md) · [Functional requirements](../requirements/functional-requirements.md).

## 1. Normative hierarchy and interpretation

1. Approved D01–D10 domain decisions and ratified canonical write ownership take precedence over recommendations here.
2. Tenant-specific legal instruments, policy, delegated authority schedules, spending rules, records schedules and governance mandates determine whether a transaction is **actually authorised**. SPM configuration represents these; it cannot create legal authority.
3. This model supplies **proposed business rules** (BR-xxx) and configuration concepts. New rules are not deemed ratified until separately accepted.
4. A UI action or portfolio role is never sufficient evidence of formal authority. Apply server-side, fail-closed authorisation.
5. External ERP, HR, delivery and measurement systems retain authority over their facts according to tenant source-authority policy. M05 retains the approved commitment record.

## 2. Governance principles

- **Accountability:** Every formal decision has one accountable chair or valid delegated decision-maker (D04), even when collective deliberation occurs.
- **Independence:** The accountable approver cannot be the proposal sponsor, case owner, assessor or sole recommendation author for that decision (D04).
- **Separation:** Proposal creation, specialist assessment, recommendation, endorsement, authorisation, effectuation and independent assurance are distinct activities.
- **Scope:** Validate tenant, organisation, portfolio, investment category, programme, time window, currency, monetary envelope, and governing decision type as applicable.
- **Evidence:** Submitted cases, assessments, scenarios, recommendation basis, committee packs and approved baselines retain immutable versions and lineage.
- **Controlled change:** Never alter a completed decision or approved commitment in place; issue successors, append-only amendments and effective-dated baselines (D05, D06, D09).
- **Proportionality:** An organisation can configure different review depth by investment materiality, type, risk and regulatory context, but must not override mandatory invariant checks.

## 3. Decision-rights taxonomy

| Right | Meaning | Typical actor | Effect |
|---|---|---|---|
| Initiate | Draft demand or investment proposal | IN01 sponsor | No financial authority |
| Contribute | Provide source evidence, options, financial or risk assessment | SP01–SP04; DE01–DE03 | Information only |
| Validate intake | Accept/return submitted case for evaluation | PM03 authorised intake | Starts assessment, not approval |
| Assess | Record criterion scores, rationale and findings | IN02 / specialist | Evidence and opinion |
| Recommend | Propose priorities, allocation or scenario | PM02/PM01 | Recommendation only |
| Endorse | Support proposal within advisory remit | EX02/EX03 or board | May be prerequisite but not approval |
| Approve/decline | Record formal investment determination | EX04 authorised body/chair/delegate | Authoritative decision record if all guards pass |
| Accept residual risk | Accept specified risk within mandate | Explicit risk-accepting authority | Does not imply investment funding approval |
| Verify condition | Validate completion of recorded condition | Named authorised verifier | Clears condition, not necessarily effectuation |
| Effectuate | Release an approved envelope/baseline after prerequisites | Assigned authorised operator/owner | Updates governed commitment |
| Escalate | Refer outside local mandate | Any entitled role | No approval by escalation alone |
| Administer | Configure identity, scope, policies or workflow versions | AD01 | No inherent business decision rights |
| Audit/observe | Inspect records within lawful scope | Auditor / ST01 | Read-only |

## 4. Authority resolution and mandatory controls

### BR-001 — Applicable policy selection (proposed)
Resolve policy by tenant and effective date, organisational scope, decision category, investment type and governance stage. Where policies conflict, apply explicit precedence configured and ratified by the tenant; **deny and escalate ambiguous overlapping rules**. Persist the resolved policy version with determination.

### BR-002 — Formal authority (D04 operationalisation)
Before recording approval, verify accountable chair or active explicit delegation; appropriate decision body mandate; investment/portfolio scope; decision type; effective dates; mandatory limits, matching currency and **total resulting approved envelope** (not amendment delta). Missing limit or unsupported currency conversion = refuse approval.

### BR-003 — Independence and interests (D04)
The accountable approver must differ from sponsor, case owner, assessor and sole author of recommendation. Require declarations and recusal according to policy for committee participants. A disqualified vote must not count towards a required quorum.

### BR-004 — Quorum and voting (D04)
Where a governance body requires voting, persist separate attendance/votes and compute eligibility and quorum under effective policy. Do not finalise without sufficient quorum; capture accountable chair and any authorised delegated signatory.

### BR-005 — Evidence snapshot (D07)
Decision references immutable exact versions: submitted case, assessment, scoring model, scenario constraints, recommendation, supporting documents/checksums. Material post-publication changes invalidate readiness or require explicit amended pack per tenant policy.

### BR-006 — Conditional approval (D04)
Conditions precedent block **release of commitment/effectuation** until evidenced satisfied and formally verified. Subsequent conditions create ongoing monitoring tasks. No person can claim a condition is satisfied solely by uploading evidence if independent verification is required.

### BR-007 — Unknown constraints (D03)
Funding, capacity or dependency uncertainty is **unknown**, not treated as zero or available. Hard constraints prohibit automatic selection. A human exception request carries reason/evidence and only an authorised M05 decision may approve an override.

### BR-008 — Envelopes and currency (D05)
Approve nonnegative amount/quantity with unit, currency and period. Append-only increase/decrease (positive magnitudes) and replace operations produce nonnegative resulting envelopes. Different currencies or units are not aggregated without separately approved conversion policy.

### BR-009 — Approved baseline succession (D06)
Successor replaces the same business-valid interval; partial overlap corrections are rejected in current model. Verify version and portfolio scope at approval, and preserve recorded interval and exact approved payload.

### BR-010 — Concurrency and transitions (D09)
Every module publishes a versioned transition matrix. Reject stale row_version updates; show conflict and latest valid version. Completed assessments, recommendations, decisions, commitments and baselines are corrected via successor records, never reopened.

### BR-011 — Integration and data lineage (D08)
A source object key must resolve to one canonical typed tenant object. Conflicts become reconciliation tasks; external updates cannot rewrite native approvals. Display source, last sync, confidence and failure status where decision relevant.

### BR-012 — Audit/records controls (D07, D09, D10)
Record actor, role, scope, mandate/delegation, policy version, reason, exact evidence IDs, action and effective/recorded timestamps. Retain/redact/dispose under approved tenant schedule without erasing legally required decision trails.

## 5. Proposed decision-class and authority matrix

| Decision class | Proposer | Review / endorsement | Accountable formal authority | Required controls |
|---|---|---|---|---|
| Strategy activation or supersession | EX02 | EX01 / strategic governance | Tenant-designated strategy authority | Effective period, ownership, versioned objectives |
| Intake acceptance | PM03 | IN02 if needed | Tenant-designated intake authority | Eligibility, evidence requirements and scope |
| Assessment recommendation | IN02 / PM02 | SP01/SP02/SP03 | PM02 or PM01 within advisory remit | Published scoring model, independent findings |
| Portfolio scenario recommendation | PM01 | EX02, EX03, SP02 | PM01 advisory; investment approval remains M05 | Baseline snapshot, constraints, assumptions |
| New investment commitment | IN01 / PM01 | Finance, assurance, committee as policy | EX04 chair or explicitly scoped delegate | D04 independence, limits, currency, quorum, evidence |
| Commitment amendment | Sponsor / PM01 | Finance, capacity, assurance as needed | Mandated M05 authority | Total resulting envelope; append-only amendment |
| Conditional clearance | IN01 submits evidence | SP03/other verifier | Condition-specific clearance authority | Verification, independence, condition class |
| Approved baseline effectuation | PM02 / designated operator | Conditions verifier, owner | Explicit baseline effectuation authority | Approved decision, satisfied conditions, D06 interval check |
| Risk acceptance | SP03 raises | Independent risk owner | Tenant-authorised residual risk acceptor | Risk tolerance, evidence, recorded acceptance |
| Exception to hard constraint | PM01 | Finance/capacity/assurance | M05 authorised decision-maker | D03 exception rationale and D04 approval |
| Withdrawal or cancellation | Sponsor / PM02 | Relevant affected owners | Policy-designated authority | Reason, effective date, contractual obligations |
| External-system reconciliation override | Integration operator | Canonical owner / security | Authority under approved integration policy | No change to native approval lineage |

All roles are illustrative persona mappings. Governing bodies, powers and monetary thresholds must be defined by each tenant and cannot be inferred from this table.

## 6. Approval authority evaluation sequence

1. Authenticate principal and verify active tenant membership.
2. Resolve active business assignment, object sensitivity, organisational scope and permission for the *requested action*.
3. Fetch target object and latest expected revision (optimistic concurrency).
4. Resolve the effective governance policy, decision body, mandate and delegation.
5. Verify valid currency and total resulting approved financial envelope; enforce declared limits.
6. Check independence, conflicts/recusals, quorum and voting where configured.
7. Verify immutable evidence versions, case completeness, assessments and required assurance.
8. Check funding/capacity/dependency constraints; route exceptional breaches to authorised M05 determination.
9. For conditional decisions, record condition obligations; block guarded commitment release.
10. Persist immutable decision, authority snapshot, evidence pointers and audit within transaction.
11. Publish notifications/outbox only after successful transaction; reconcile downstream effects separately.

Any failure returns a structured reason and suggested responsible route; it does **not** create a partial formal approval.

## 7. Segregation-of-duties rules

| Code | Incompatible acts | Outcome |
|---|---|---|
| SOD-01 | Sponsor approves own proposal | Block (D04) |
| SOD-02 | Business-case owner is accountable approval maker | Block (D04) |
| SOD-03 | Assessment author is accountable approval maker | Block (D04) |
| SOD-04 | Sole recommendation author is accountable approval maker | Block (D04) |
| SOD-05 | Conflicted committee member participates contrary to recusal policy | Exclude and recompute quorum |
| SOD-06 | Condition submitter verifies own evidence where independent verifier required | Block clearance (proposed) |
| SOD-07 | Platform administrator asserts business authorisation without separate delegation | Block |
| SOD-08 | Integration service writes native M05 decision or commitment | Block (D01, D08) |
| SOD-09 | Residual-risk assessor self-accepts beyond delegated risk authority | Block |
| SOD-10 | Reviewer changes a frozen case revision directly | Block (D07/D09) |

## 8. Exception and escalation model

| Exception | Detection | Default proposed disposition | Escalation target |
|---|---|---|---|
| Authority exceeded | Scope/amount/time/currency check | Reject attempted approval | Higher mandate authority |
| Quorum invalid | Eligibility / attendance check | Hold decision | Committee chair / secretariat |
| Conflict declared | Recusal/SoD check | Reassign or exclude | Governance coordinator |
| Pack no longer current | Evidence version mismatch | Hold and republish amended pack | PMO / governance |
| Missing specialist sign-off | Mandatory review incomplete | Return for evidence | Assessment lead |
| Hard constraint breached | Scenario evaluation | Mark infeasible; request documented exception | M05 approval body |
| Conditions precedent unmet | Effectuation check | Keep commitment unreleased | Condition owner and verifier |
| Delegation expired | Time check | Deny pending renewed authority | Delegation grantor |
| Integration mismatch | Correlation/reconciliation check | Hold external-success assertion; queue remediation | Integration owner |
| Reorganisation changes owner | Effective-dated assignment change | Reassign prospectively while preserving past ownership | Portfolio governance |
| Decision appealed or corrected | Formal request | New linked case/determination, retain original | Mandated review/appeal body |
| Material new risk after approval | Tolerance change | Open escalation and potential rebalancing | Portfolio Director / risk authority |

**Escalation does not confer approval authority.** Expired exceptions require disposition and cannot remain implicitly effective (D09).

## 9. Configurable governance profile

| Configuration object | Essential fields | Validation / lifecycle |
|---|---|---|
| Decision body | tenant, code, mandate, chair, quorum/voting rule, effective interval | Published version required before formal use |
| Delegation | grantor, delegate, scope, action type, currency, financial ceiling, start/end, revocation | No overlapping ambiguous powers; active only within validity |
| Decision class | type, governance stage, required decision body, evidence rule | Change creates successor policy |
| Approval threshold | amount basis, currency, limit, included funding sources | Must compare resultant total approved envelope |
| Review rule | investment category/materiality, mandatory reviewers, independence | Incomplete required review blocks readiness |
| Policy exceptions | permitted override class, reason, evidence, authority, expiry | Explicit disposition and expiry escalation |
| Condition template | precedent/subsequent, default owner/verifier, evidence type, deadlines | May block effectuation |
| Record policy | classification, retention schedule, disclosure/redaction authority | Applied without breaking mandatory audit trace |
| Organisation hierarchy | effective-dated units and portfolio scopes | Historical assignments remain queryable |
| Source authority | field-level source, direction, freshness/handling, reconciliation owner | Imported changes cannot override M05 approval |

**Example profiles only:** Enterprise capital board with operating/capital approval thresholds; UK-government department with ring-fenced funds, delegated spending authorities, staged business cases and external approval/assurance when applicable. The application must not assert compliance from profile selection alone.

## 10. Governance operating cadence and responsibilities

- **Strategy review (J01):** EX02 prepares proposals, performance evidence and alignment implications; designated authority endorses/publishes.
- **Demand and portfolio cycle (J02–J04):** sponsors draft; PMO intake; specialists assess; PM01/PM02 recommend.
- **Investment committee (J05):** secretariat freezes packs and checks readiness; committee considers; accountable chair/delegate records authorised determination.
- **Portfolio exception review (J06/J08):** material deviations and forecast effects trigger proposed interventions; formal amendments return to M05 authority.
- **Assurance (J10):** independent reviews, findings and follow-up; residual-risk acceptance separately authorised.
- **Benefits and data cycle (J07/J11):** value owners confirm actual outcomes and PMO verifies decision-grade reporting.

A single person may appear in several sessions but must act under distinct scoped assignments; audit should identify capacity and any delegation actually used.

## 11. Acceptance tests (business rules)

| Test | Given / when | Expected |
|---|---|---|
| GOV-T01 | Sponsor attempts to approve own case | Denied with SOD-01 and no decision written |
| GOV-T02 | Delegate's limit is £5m and resulting envelope is £5.1m after £0.2m amendment | Denied; compare resulting total, not delta |
| GOV-T03 | Decision currency differs from delegation and no conversion policy exists | Denied |
| GOV-T04 | Committee vote falls below configured eligible quorum after recusal | Decision cannot be finalised |
| GOV-T05 | Locked decision pack points to case revision 2 and revision 3 is submitted | Existing decision remains bound to revision 2; policy decides if pack must be amended |
| GOV-T06 | Mandatory condition precedent is open | Commitment effectuation denied despite conditional approval |
| GOV-T07 | Assessor changes submitted score after completion | Modification denied; successor assessment required |
| GOV-T08 | Missing resource capacity data during scenario calculation | Mark unknown, do not treat as spare capacity |
| GOV-T09 | Hard capacity constraint breached and exception requested | No automatic select; route to authorised M05 decision |
| GOV-T10 | Partial overlap in successor baseline interval | Rejected under D06 |
| GOV-T11 | Stale row_version update to proposal state | Conflict returned; no overwritten newer value |
| GOV-T12 | External source key resolves to competing canonical objects | Reconciliation issue, no silent remapping |
| GOV-T13 | Integration acknowledges approval only after failed external sync | Show approved-in-SPM / sync-pending, not synced |
| GOV-T14 | Condition evidence submitted by owner but verifier has not cleared | Still blocked where precedent |
| GOV-T15 | Delegation valid yesterday but revoked today | Today's approval denied |
| GOV-T16 | Approval is corrected after issue | New linked decision, original and rationale preserved |
| GOV-T17 | Platform admin has no business approval assignment | Admin cannot authorise investment |
| GOV-T18 | Tenant policy does not define mandatory committee authority | Fail closed, request governance configuration |

## 12. Architecture alignment and change impacts

- **M01 Strategy and Outcomes:** strategy ownership, activation and evidence of measures.
- **M02 Portfolio Architecture:** organisational and portfolio scope for decisions.
- **M03 Demand and Cases:** authored drafts, immutable submitted case revisions and sponsor accountability.
- **M04 Selection:** scoring, assessment, recommendation and locked scenarios under D02–D03.
- **M05 Decisions and Commitments:** formal determination, resulting authorised envelopes, conditional gating and immutable baseline succession under D04–D06.
- **M06 Governance:** governing bodies, mandates, procedural evidence, exceptions and policy-controlled governance mechanisms per canonical boundaries.
- **Platform:** membership, scoped authorisation, policy evaluation, identity, audit, notifications, concurrency, integration mappings/reconciliation.
- **M07–M12 optional/integrated:** financial actuals, resource supply, roadmaps, delivery, benefits and analytics; do not rewrite native approvals.

**Model review candidates, not approved migrations:** condition verification and evidence links; time-bound delegation/grant metadata; recusals/attendance/votes; assessment/pack readiness; transition-policy versions; exception disposition; decision-to-baseline effectuation guard; reconciliation statuses. Evaluate against current canonical model v1.1 and migrations before proposing new entities.

## 13. Outstanding product decisions for ratification

| ID | Question | Proposed default |
|---|---|---|
| OPEN-01 | Which governance operations can be entirely electronic? | Configured per governing body; support external meeting record |
| OPEN-02 | Can committee quorum vary by financial category? | Yes, effective-dated rules |
| OPEN-03 | Who may verify condition precedents? | Designated independent verifier as configured |
| OPEN-04 | What happens when financial limits overlap? | Explicitly resolved precedence; otherwise block |
| OPEN-05 | What is evidence expiry / revalidation policy? | Per evidence class and decision stage |
| OPEN-06 | Should urgent approvals bypass review? | Only explicitly authorised, never bypass invariant authority and audit |
| OPEN-07 | Who can accept residual risk? | Risk-specific mandate, independent of investment authorisation |
| OPEN-08 | How are appeals handled? | New linked governed determination, preserve original |
| OPEN-09 | What is the cross-agency authority model? | Federated accountability and explicitly defined participating bodies |
| OPEN-10 | Which policy elements require two-person configuration approval? | Authority limits, delegations, SoD and retention-policy changes |

## 14. Next work package

**Business Object Lifecycle and Transition Matrices v1.0:** draft/submit/review/recommend/decide/effectuate/correct/withdraw states for M01–M06, mandatory guards, actors, auditable actions, successor semantics and exception branches. The matrices must implement D09 and reference the governance rules above. No schema/application modifications until reconciled and reviewed.

## Entra ID and prototype access design (25 October 2026)

The organisation uses **Microsoft Entra ID and security groups** for application access. The [Entra identity and prototype stub design v1.0](entra-identity-access-prototype-design-v1.0.md) defines a production OIDC integration, group/app-role mapping to SPM permissions, independent scoped business roles and approval authorities, and an isolated synthetic identity provider for the prototype. No internal Entra access is assumed; no code, migration or live IAM configuration has been changed.
