# P01 — Investment-to-decision cross-role service blueprint v1.0

**Prepared:** 25 October 2026 · **Status:** Proposed for user validation; design-only, not implemented  
**Scope:** J02 investment proposal → J03 assessment → J05 governance determination  
**Sources:** [Personas](user-role-persona-catalogue-v1.0.md), [Journeys](user-journey-catalogue-v1.0.md), [UX decisions](ux-design-decisions.md), [user stories](../requirements/user-stories.md), [solution overview](solution-overview.md).

## 1. Experience intent and boundaries

A sponsor can develop a proposal, obtain specialist inputs, submit a controlled revision and respond to feedback; portfolio teams can intake, assign, assess, compare and recommend; the committee can review controlled evidence and record a procedurally valid determination, including conditions. Every handoff preserves context and accountability. The operating model is configurable for enterprises and public-sector organisations. The platform does not replicate detailed delivery task management.

**Product controls:** identity is not persona; a user may hold multiple scoped business assignments; workflow participation does not confer delegated authority; recommendation, endorsement, decision, and effectuation are separate acts; committee decisions may be recorded after an externally conducted meeting.

### Service lanes

- **Sponsor (IN01):** owns proposal and business-case accuracy; requests contributions and resolves questions.
- **Portfolio intake / PMO (PM03):** checks completeness, duplicate risk, policy route and evidence maturity; manages pack readiness.
- **Assessment lead (IN02):** orchestrates criteria-based evaluation and review findings; no implicit funding authority.
- **Specialist reviewers (SP01/SP02/SP03, optional DE03/EX02):** independently assess finance, capacity, risk, benefits and alignment.
- **Portfolio manager/director (PM02/PM01):** compare and recommend; scenario analysis J04 may be invoked.
- **Committee member / governance authority (EX04):** challenges options and renders or records authorised determination.
- **Platform:** assignment inbox, evidence revisions, notifications, policy/authority checks, conflict and quorum rules, audit, integrations and freshness warnings.

## 2. Swimlane blueprint

| Stage | Sponsor | PMO / intake | Assessment + specialists | Portfolio leadership | Committee / authority | System, evidence and visible handoff |
|---|---|---|---|---|---|---|
| S01 Initiate | Create draft and select objective | — | — | — | — | Case ID, draft, active organisation scope |
| S02 Elaborate | Options, costs, benefits, risks; invite collaborators | — | Provide optional input | — | — | Autosave, duplicate cues, evidence provenance |
| S03 Submit | Attest and submit revision | Receive intake task | — | — | — | Lock submitted revision; H02 with checklist |
| S04 Intake | Answer correction requests | Check completeness, duplicates and routing; accept/return | — | — | — | Disposition, reason, due action, immutable history |
| S05 Assign | View status | Route accepted case | Lead sets criteria and requests specialist assessments | Oversee work queue | — | H03/H04; due dates; independence and access checks |
| S06 Assess | Clarify evidence only through controlled revision | Follow up | Independently evaluate and sign off findings | View emerging concerns | — | Version-linked opinions, score rationale, conflicts; H05 |
| S07 Prioritise | See disposition | Prepare briefing | Consolidate uncertainties | Compare investments; document recommendation and alternative | — | Selection record, linked evidence snapshot; optional J04 |
| S08 Decision readiness | Read pack status | Check pack and quorum/authority | Confirm findings complete | Submit recommendation | View agenda/pack | H06/H07; freeze pack version; review status |
| S09 Deliberate | Respond when requested | Capture queries and version changes | Supply clarifications | Explain trade-offs | Challenge; declare conflicts; decide | Decision request, conflict checks, version mismatch warning |
| S10 Formalise | Receives outcome | Record minutes or import externally authorised outcome | — | Confirm implementation owner | Chair/authorised recorder confirms determination | H08; decision, authority, reasoning, votes/quorum where required |
| S11 Effectuate | Complete conditions precedent | Verify routing and follow-up | Verify assigned findings/conditions | Authorise baseline update where separately entitled | Approve condition clearance where policy requires | Conditions tasks, permitted activation only after guards; H09 |
| S12 Follow through | Track case and responsibilities | Close process tasks | — | Monitor commitments | Review escalations | Status timeline, notifications, evidence and audit links |

## 3. Decision gates and policy enforcement

| Gate | Responsible capacity | Required input | Outcomes | Failure / safeguard |
|---|---|---|---|---|
| G01 Submit proposal | Sponsor | Mandatory fields, sponsor scope, attachments, policy template | Submitted revision / keep draft | Inline field validation; don't expose partial data to unauthorised users |
| G02 Intake acceptance | PMO assigned intake authority | Duplicate screening, template completeness, classification | Accept / return / redirect / reject per policy | Reasoned disposition and link to original revision |
| G03 Evaluation adequacy | Assessment lead | Reviewer coverage, scoring basis, concerns, evidence age | Ready / request clarification / additional review | No hidden averaging of dissenting findings |
| G04 Recommendation | Portfolio manager/director | Ranking context, constraints, options, reviewer opinions | Recommend / pause / route J04 | Recommendation is not financial approval |
| G05 Pack readiness | Governance coordinator / policy | Locked references, meeting/quorum policy, conflicts, authority | Publish / hold / escalate | Material evidence change invalidates applicable published pack |
| G06 Decision | Authorised body | Delegation, conflict/quorum and decision scope | Approve / conditional / defer / reject / information request / escalate | Fail closed on authority mismatch |
| G07 Effectuation | Separately authorised actor | Final determination, prerequisite conditions, valid baseline version | Activate commitments / remain gated | An approved-with-conditions record cannot auto-start restricted work |

**Versions:** distinguish draft edits, immutable submitted case revisions, reviewer assessments, published decision pack, governance determination, condition resolution and approved baseline. Retrospective corrections append history.

## 4. Alternative paths with explicit user-facing behaviour

### A — Return for information (S04 or S06)
1. Intake/reviewer selects specific deficient sections and explains why evidence is insufficient.
2. Sponsor receives work item linked to the exact submitted revision; previous submission stays immutable.
3. Sponsor edits a new draft revision with retained unchanged fields; status remains visible.
4. Resubmission creates a new version and reopens relevant reviews; unaffected findings may be reused only if policy permits.
5. PMO sees differences and confirms completeness. No automatic approval on resubmission.

### B — Conditional approval (S09–S11)
1. Committee records conditional determination and distinguishes **conditions precedent** (block commencement) from **subsequent conditions** (monitor after start).
2. Each condition has owner, expected evidence, due date if applicable, verifier and permitted clearance authority.
3. The sponsor completes assigned tasks; independent verifier records satisfaction or refusal.
4. Platform checks all prerequisite conditions plus policy/authority and baseline concurrency before allowed effectuation.
5. Overdue/failed conditions generate escalation without silently revoking or granting authority.

### C — Rejection
1. Decision authority records rejected outcome, rationale and any permitted reconsideration route.
2. Sponsor is notified in context, with retained evidence and disposition timeline.
3. Case transitions to an authorised terminal/eligible-for-revision status as configured; no approved commitment is created.
4. Reconsideration uses a new governed review or appeal action; original rejection is never erased.

### D — Defer / more information
Pack item stays unresolved and records reason, new owner/actions, and next review event. A further-information request can reopen assessment without a new full intake if policy permits.

### E — Conflict or authority failure
Member declaration changes eligible participation/quorum; a financial limit or delegated scope breach blocks formalisation and routes to a competent authority. Existing comments and pack remain traceable.

### F — External decision meeting
Pre-read and agenda remain in SPM; recorder uploads meeting artefacts and enters determination with date/effective time, decision-body identity and verification. System must distinguish pending minutes verification from valid authorisation.

### G — Urgent/mandated proposal
Use controlled bypass/exemption rationale as configured, not an uncontrolled skip of financial, legal or authority checks.

## 5. Handoff payloads and notifications

| Handoff | Sender → receiver | Minimum payload | Trigger and user-visible acceptance |
|---|---|---|---|
| H02 | Sponsor → PMO | Case ID, submission revision, classification, strategic links, evidence checklist | Submitted creates intake task; recipient sees requirements and due date |
| H03 | PMO → Assessment lead | Intake disposition, assessment profile, reviewer needs, notes | Acceptance creates assessment work item |
| H04 | Lead → specialist | Assigned criterion, evidence revision, requested opinion, due date | Reviewer receives scoped task; recusal option |
| H05 | Specialist → Portfolio manager | Findings, dissent, confidence, score, linked evidence, restrictions | Work queue indicates pending/concluded reviews |
| H06/H07 | Portfolio leadership → governance | Recommendation, alternatives, constrained choices, reviewed pack version | Readiness validated before publication |
| H08 | Governance → sponsor/portfolio | Decision outcome, rationale, effective authority, explicit conditions | Notifications with actionable conditions; no ambiguous green status |
| H09 | Portfolio → execution system | Authorised approved baseline, source identity and correlation ID | Separate delivery receipt/reconciliation state from approval |

Notifications should provide object, required action, owner, timeline, source, and safe deep link. Avoid exposing confidential data in email subjects or push previews.

## 6. Information and service requirements

- Accessible task inbox and progressive-disclosure forms; visible validation and save states.
- Read-only immutable snapshots for submissions, assessments and packs.
- Per-user scoped access in every view, search and export.
- Explicit source-authority/freshness metadata for imported financial or workforce evidence.
- Audited role, delegation, recusals, quorum and authority validation.
- No downstream commitment on failed baseline synchronisation; display retry/reconciliation status.
- Decision detail should place request, recommendation, alternatives, material caveats and permitted actions above low-level appendix evidence.
- Preserve workflow event/audit log with actor, role, scope, policy version, effective/recorded timestamp, old/new state and document hashes where applicable.

## 7. Traceability

| Stage | Journey | Existing story family | Native logical owner |
|---|---|---|---|
| S01–S04 | J02 | US-005 demand, US-006 revision | M03 Demand and Cases |
| S05–S07 | J03 | Evaluation/selection user stories | M04 Selection; specialist evidence integrated/optional |
| S08–S10 | J05 | Decision/governance user stories | M05 Decisions and Commitments; M06 Governance |
| S11–S12 | J05→J06 | Commitments and delivery oversight | M05 core; M09/M10 optional/external execution |
| Cross-cutting | J10/J11 | Platform, assurance, reporting | M06 governance, platform services, extensible analytics |

Exact story/FR cross-references beyond US-005 and US-006 must be reconciled from the approved requirements register before adding a normative test suite.

## 8. Research validation

Run sessions for IN01, PM03, IN02, SP01, SP03, PM02, PM01 and EX04 (with appropriate public-sector variants). Observe whether each person can identify their current task, the authoritative evidence revision, next owner, decision boundary, and failure remedy without facilitator assistance.

**Core acceptance scenarios:** successful approval; returned case and resubmission; conditional approval with commencement block and verified clearance; rejected case with preserved history; recusal and failed delegation; stale specialist input; changed pack after publication; integration failure post-approval.

**Open product decisions:** eligibility to reuse specialist findings after new revisions; specific committee quorum/minutes policies; submission gate thresholds; exact deadline/escalation rules; appeals policy; condition-verification independence; decision pack export/records formats. These should be configured or validated rather than assumed.

**Next design asset:** [P01 Screen Inventory and Interaction Specification](investment-decision-screen-interaction-spec-v1.0.md).
