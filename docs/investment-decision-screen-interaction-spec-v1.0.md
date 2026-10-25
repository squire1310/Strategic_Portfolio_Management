# P01 — Screen inventory and interaction specification v1.0

**Date:** 25 October 2026 · **Status:** UX design baseline, not an implemented clickable prototype  
**Companion:** [Investment-to-decision service blueprint](investment-decision-service-blueprint-v1.0.md)  
**Coverage:** J02 → J03 → J05; normal, returned, conditional, rejected and exception paths.

## 1. Navigation model

Global shell: **My Work** (assigned items, decisions, requested information, overdue actions), **My Responsibilities** (proposals, assessments, portfolios and committees within active scope), **Explore** (authorised search/reporting), with context switcher for organisation/portfolio, notifications, help, activity/audit access where authorised. Persistent breadcrumbs and object headers communicate active capacity and record state.

Design for desktop-first analytical portfolio work; responsive accessible sponsor and committee tasks on tablet/mobile. Target WCAG 2.2 AA in subsequent UX design/testing, not an assertion of compliance.

## 2. Screen inventory

| Screen | Primary personas | Entry point / purpose | Key content | Primary actions | Guards |
|---|---|---|---|---|---|
| P01-01 My Work | All | Login / assignments | Grouped tasks, urgency, next action, scope, evidence age | Open, acknowledge, delegate where authorised | Task visibility and assignment scope |
| P01-02 Proposal list | IN01 PM03 | My proposals / intake pipeline | Title, stage, owner, last update, blocked reason | Create, open, filter | Tenant/portfolio scope |
| P01-03 Create/edit proposal | IN01 | Draft case | Guided purpose, options, costs, strategic links, benefits, evidence, collaborator tasks | Save, request contribution, preview, submit | Required fields and sponsor authority |
| P01-04 Proposal detail/history | IN01 PM03 | Case link | Version history, current status, reasons, owners, linked strategy | Compare versions, respond, withdraw where allowed | Submitted revisions immutable |
| P01-05 Intake triage | PM03 | Submitted intake queue | Completeness, duplicates, categorisation, applicable route | Accept, return, redirect | Intake policy, reason mandatory for return |
| P01-06 Assessment workspace | IN02 SP01 SP02 SP03 | Assigned review | Locked case revision, evidence, criteria, uncertainty, reviewer comments | Record assessment, request info, declare conflict, submit opinion | Conflict and evidence revision checks |
| P01-07 Evaluation comparison | PM02 PM01 | Candidate portfolio | Scores and explanations, cost, capacity, assurance status, dissent | Compare, recommend, route for scenario | Assessment completeness; no implied authority |
| P01-08 Governance pack builder | PM03 PM01 | Ready for decision | Recommendation, alternatives, specialist opinions, evidence manifest | Validate, freeze/publish, update with amendment | Authority, completeness, pack version control |
| P01-09 Committee agenda / inbox | EX04 | Governance items | Pending decisions, meeting date, conflicts, quorum, packs | Open, declare recusal, request information | Membership, meeting authority |
| P01-10 Decision brief | EX04 | Agenda detail | Ask, options, recommendation, cost/benefits, risks, assumptions, source freshness | Compare, drill into evidence, challenge | Scope-limited evidence access |
| P01-11 Determination recorder | EX04 authorised recorder | Formalise outcome | Authority, resolution, rationale, conditions, validity/effective dates | Record approve/conditional/defer/reject/escalate | Quorum, recusal, amount/delegation, evidence version |
| P01-12 Condition fulfilment | IN01 verifier PM03 | Approval conditions | Precedent/subsequent category, owner, due date, evidence, clearance authority | Submit evidence, verify, reject evidence, escalate | Cannot self-verify if barred; block effectuation |
| P01-13 Decision timeline / audit | Authorised roles | Proposal/decision details | Event history, authorisations, versions, notices, conditions | Inspect/download allowable artefacts | Access and retention policy |
| P01-14 Integration reconciliation | PM03 operator | Approved commitment handoff | Correlation IDs, source/target status, errors, retries | Inspect, retry with permission, escalate | No false success; idempotent handoff |

**Global patterns:** No decorative CTA without a permitted action; disabled buttons must explain reason; statuses distinguish draft, submitted, in review, decision pending, condition blocked, authorised, rejected, integration pending and synced.

## 3. Screen-level interaction states

### P01-03 proposal authoring
- Start with **Purpose / Strategic alignment / Options / Financials / Expected value / Risks & dependencies / Review**.
- Each step exposes completion, validation, provenance, attachments and collaborators; autosave should indicate last successful persistence.
- Save draft permitted without mandatory full-submission completeness, subject to minimal record identity.
- Submit produces a confirmation dialog that names the immutable revision and receiving intake group. Server re-evaluates guards; do not rely on front-end validation.
- When returned, show reviewer-annotated issues adjacent to relevant sections, unchanged evidence reference, and new revision editing context.

### P01-06 specialist review
- Read-only exact submitted version; structured criteria, quantitative/qualitative narrative, rating confidence, evidence source and submission.
- Explicit conflict-of-interest declaration or recusal; returned-for-information creates a handoff to sponsor.
- Divergent specialist findings are separately visible and cannot be silently overridden by a combined score.

### P01-08 pack readiness
- Show coverage checklist, unresolved conditions, named recommendation, alternatives and publishable evidence manifest.
- Publish generates stable pack revision with timestamp. Material new information triggers an explicit amended-pack workflow.
- Export is sensitivity-controlled, watermarked/version-labelled where policy requires.

### P01-10/11 committee decisions
- Decision brief opens with **Decision requested**, recommendation, options, trade-offs, material caveats, conditions and authoritative evidence.
- Review is not equal to vote/approval. Show effective business role, authority source, monetary/scope limits and any conflict declaration.
- Determine outcome in a governed form; reason required for rejection, escalation and conditions; publish only after server-side authority and process checks.
- Support externally made determinations with record provenance and verification state, without pretending that click-to-approve is universal.

### P01-12 condition satisfaction
- Precedent conditions have blocked-commencement label and responsible verification route. Subsequent conditions remain monitored post-authorisation.
- Evidence submitted by owner does not equal clearance; independent verifier attests where policy requires.
- Only a separate authorised effectuation process can change approved commitment/baseline state.

## 4. User interactions: five testable walkthroughs

### T01 Straight-through approval
Sponsor saves draft → submits revision 1 → PMO accepts → reviewer assessments are submitted → PM02 recommends → PMO publishes pack 1 → EX04 reviews and formally approves → authorised effectuation updates commitment with externally visible reconciliation state. **Pass:** actor/role/authority/evidence revision traceable.

### T02 Returned proposal
Sponsor submits revision 1 → PMO returns two named sections → user opens annotated form → saves revision 2 → resubmits → PMO sees version diff and accepts. **Pass:** revision 1 unchanged and requested fixes obvious.

### T03 Conditional approval
Committee approves with one condition precedent and one subsequent → sponsor receives both tasks → attempt to effectuate fails while precedent open → sponsor supplies evidence → verifier validates → authorised effectuation permitted → subsequent condition remains visible. **Pass:** no premature activation and complete clearance trail.

### T04 Rejection and reconsideration
Committee rejects with rationale → sponsor sees final determination → original evidence retained → authorised reconsideration starts a new linked process if allowed. **Pass:** no existing record overwritten and no accidental approved commitment.

### T05 Authority/conflict/integration exception
Member declares conflict; quorum policy reassessed; invalid authority prevents decision; when valid approval recorded, external commitment sync fails. **Pass:** failure is explicit, audit trace remains, authorised retry can reconcile without duplicate commitment.

## 5. Data, behaviour and accessibility acceptance

| Area | Acceptance condition |
|---|---|
| Context | Every governed action shows active organisation, portfolio, business capacity and record ID |
| Provenance | All material values expose source, effective date/version and freshness where imported |
| Immutability | Submitted revisions and published packs cannot be modified in place |
| Permissions | Search, UI, API and exports must respect same data scope |
| Authority | Delegation validity, financial thresholds, conflict/quorum and policy evaluated on server |
| Handoff | Sender, recipient, action, evidence version, status and deadline recorded |
| Feedback | Loading, save, retry, conflict and server failure states are understandable |
| Accessibility | Keyboard access, focus order, semantics, labels, non-colour status communication and screen reader tested |
| Responsive use | Sponsor input and executive review remain usable on smaller displays |
| No false synchronisation | Separate decision success from integration acknowledgement |
| History | Corrections and appeals link to original controlled events |

## 6. Page information hierarchy

- **Executive**: decision question → recommendation/options → risk/cost/benefit → assurance/conditions → evidence → history.
- **Portfolio team**: assigned actions/exceptions → candidate comparison → review completeness → rationale → submission.
- **Sponsor**: next task → current stage/owner → required fields → collaborators → supporting evidence → activity.
- **Specialists**: exact revision and review assignment → criteria and source evidence → conflict control → findings → sign-off.

## 7. Prototype interaction and research checklist

| ID | Participant | Observe |
|---|---|---|
| UT-01 | IN01 | Can find incomplete fields, submit confidently and distinguish draft from locked revision |
| UT-02 | PM03 | Can intake, return targeted corrections and recognise duplicate case risk |
| UT-03 | IN02/SP01/SP03 | Can cite evidence version, disagree and declare conflict |
| UT-04 | PM02 | Can compare prioritisation with uncertainties without implying approval |
| UT-05 | EX04 | Can identify decision requested, alternatives, formal authority and conditions |
| UT-06 | IN01 + verifier | Can satisfy conditions without bypassing independent verification |
| UT-07 | PM03/operator | Can recognise integration failure and reconcile responsibly |
| UT-08 | All | Can answer “what needs my action, why, what evidence, what next” |

Capture success/failure, help requested, navigation errors, decision comprehension, completion time and qualitative friction; do not invent numerical targets before research.

## 8. Non-goals and open questions

No implementation, migration, frontend code, deployment or guarantee of a functioning clickable prototype is included in this specification. It defines the behaviour from which wireframes/prototypes can be built. Policy-specific quorum, formal record requirements, delegated financial limits, appeals and sensitive evidence handling need representative-user and governance validation. Reconcile any derived implementation requirements against the current M01–M06 contracts and existing story/FR IDs before engineering changes.
