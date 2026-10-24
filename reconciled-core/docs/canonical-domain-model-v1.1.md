# Canonical domain model v1.1

**Status:** Product-directed successor to approved v1.0, updated 24 October 2026 for FR-032–FR-033. This is the canonical design model for M01–M06 and essential platform; its new M06 risk entities are **not yet implemented** in the PostgreSQL migrations. Risk scoring thresholds, the first tenant's appetite, and the migration/API design require review before that feature is built. [Domain decisions v1.0](domain-decisions-v1.0.md) remain the approved policy baseline; this version adds risk ownership without changing D01–D10.

**Change from v1.0:** M06 owns a strategic investment risk register, approved risk-appetite versions, immutable risk assessments and review dispositions. M10 may hold delivery-level risks and observations when enabled, but may only reference the M06 strategic risk identity; it cannot create a competing canonical strategic risk. The [v1.0 model](canonical-domain-model-v1.0.md) remains the historical approved snapshot. The physical schema and ERD still reflect v1.0 plus decision-path migrations until a reviewed forward migration is added.

## Scope and authority

M01–M06 are the native strategic core. M07 Finance, M08 Resources, M09 Roadmaps, M10 Delivery, M11 Benefits, and M12 Analytics remain extension boundaries. M07/M08 planning and facts are deliberately absent from this core schema except for approved commitment envelopes in M05 and source-system identity in Platform. An investment's execution detail may be native or external, but its canonical identity and investment approval remain in M05.

| Module | Owns writes to | Reads by reference |
|---|---|---|
| M01 Strategy & Outcomes | Strategy, Objective, Outcome, Measure, MeasureObservation | Platform identity and source registration |
| M02 Portfolio Architecture | Portfolio, InvestmentCategory, PortfolioObjective, PortfolioMembership | M01 objectives; M05 investments |
| M03 Demand & Business Cases | Demand, DemandObjective, BusinessCase, CaseRevision | M01 objectives; Platform principals |
| M04 Prioritisation & Selection | ScoringModel, Criterion, Assessment, CriterionScore, Scenario, ScenarioCandidate, SelectionRecommendation | M03 demand; M05 investments; M01 objectives |
| M05 Investment Decisions & Commitments | Investment, InvestmentDecision, Commitment, CommitmentAmendment | M03 origin demand, M04 recommendation, M06 decision body |
| M06 Governance & Assurance | DecisionBody, Gate, Delegation, AssuranceFinding, GovernanceException, GovernanceAction, RiskAppetiteVersion, InvestmentRisk, RiskAssessment, RiskDisposition, Baseline, BaselineItem | M02 portfolio; M05 decision/investment; optional M10 delivery risk references |
| Platform | Tenant, Principal, TenantMember, SourceSystem, SourceIdentity, Inbox, Outbox, AuditEvent, EntityRevision, reference codes | Tenant-scoped common services |

## Identity and relationship catalogue

All tenant-owned entities have a stable UUID `id` paired with `tenant_id`; natural codes are unique only inside a tenant (or parent where specified). All references across tenant-owned tables carry `tenant_id`. Cardinalities below state the intended business relationship, including references that are validated by services rather than a single SQL FK.

| Entity | Parent / cardinality | Identity and key business attributes | Lifecycle and history |
|---|---|---|---|
| Strategy | Tenant 1:N | code, name, horizon, owner | draft → active → retired; versioned |
| Objective | Strategy 1:N; parent Objective 0:1 | code, title, priority, owner | draft → active → retired; versioned; cycles forbidden by service |
| Outcome | Objective 1:N | code, statement, target date, owner | draft → active → retired; versioned |
| Measure | Outcome 1:N | code, unit, direction, target and baseline values | versioned |
| MeasureObservation | Measure 1:N | observed date, value, source system | corrections versioned |
| Portfolio | Tenant 1:N; parent Portfolio 0:1 | code, name, owner | active → retired; versioned; cycles forbidden |
| InvestmentCategory | Tenant 1:N | code, label, active flag | versioned |
| PortfolioObjective | Portfolio N:M Objective | contribution narrative | relationship changes governed by service |
| PortfolioMembership | Portfolio N:M Investment over business time | membership period, weight | no overlapping intervals for same pair |
| Demand | Tenant 1:N | code, title, sponsor, submitter, desired dates | draft → submitted → triage/assessed → accepted/rejected/withdrawn; versioned |
| DemandObjective | Demand N:M Objective | alignment rationale | relationship changes governed by service |
| BusinessCase | Demand 1:1 | owner, status, current narrative | draft/submitted/retired; versioned |
| CaseRevision | BusinessCase 1:N | revision number, option and assumption snapshot, submitted time | immutable append-only; revision number unique per case |
| ScoringModel | Tenant 1:N | code, name, status, effective period | draft/active/retired; criteria weights total 1 at activation; formula immutable thereafter |
| Criterion | ScoringModel 1:N | code, weight, scoring range, direction | versioned while model is draft; immutable after activation |
| Assessment | Demand or Investment N:1; ScoringModel N:1 | assessor, case revision or investment version, date, rationale | draft/completed/void; complete scores required; immutable once completed |
| CriterionScore | Assessment 1:N; Criterion 1:N | score, evidence | one score per criterion per assessment |
| Scenario | Tenant 1:N; ScoringModel N:1 | code, name, constraint snapshot, owner | draft/locked/archived; versioned |
| ScenarioCandidate | Scenario N:M Demand or Investment | rank, aggregate score, assessment, inclusion state | versioned while draft; one candidate per subject per scenario |
| SelectionRecommendation | Scenario 1:N; Demand or Investment 1:N | recommendation, rationale, proposed by/at, frozen basis | immutable append-only; not an approval |
| Investment | optional origin Demand 0:1 | code, title, category, sponsor, owner, execution mode | candidate/approved/active/paused/closed/cancelled; versioned |
| InvestmentDecision | Investment 1:N; DecisionBody 1:N; optional Recommendation 0:1 | decision type, authority, rationale, conditions, effective date, supersedes | immutable append-only; supersession records correction |
| Commitment | Investment 1:N; approving InvestmentDecision 1:1 or 1:N | type (funding/capacity/scope/schedule), currency/unit, envelope, valid period | immutable; amendments express later approved changes |
| CommitmentAmendment | Commitment 1:N; InvestmentDecision 1:1 | delta or replacement envelope and rationale | immutable append-only; resulting state computed from lineage |
| DecisionBody | Tenant 1:N | code, name, remit, chair | versioned |
| Gate | Tenant 1:N | code, name, applicable lifecycle stage | versioned |
| Delegation | DecisionBody 1:N; principal 1:N | authority scope, limit, effective period | versioned; approving service checks delegation at decision time |
| AssuranceFinding | Investment 1:N; optional Gate 0:1 | severity, finding, owner, status | versioned; closure requires evidence |
| GovernanceException | Investment 1:N; optional Finding 0:1 | reason, owner, expiry, disposition | versioned |
| GovernanceAction | Finding/Exception 0:1 | title, due date, owner, status | versioned |
| RiskAppetiteVersion | Tenant 1:N; optional Portfolio 0:1 | category, scope, approved tolerance/matrix contract, valid period, approver, approval evidence | draft versions may change; approved versions are immutable and superseded explicitly |
| InvestmentRisk | Investment 1:N | tenant-unique code, cause/event/effect, category, owner, response, review date, status | open → monitoring/treated/closed; mutable header uses `row_version` and revision history |
| RiskAssessment | InvestmentRisk 1:N; each final assessment cites one RiskAppetiteVersion | assessed date, likelihood, impact, inherent and residual ratings, assessment method/version, assessor, evidence, tolerance result | final assessment is append-only; correction creates successor assessment |
| RiskDisposition | RiskAssessment 0:N; GovernanceException 0:1 | decision, rationale, approver, date, action/evidence reference | append-only; an outside-tolerance assessment remains open until an authorised disposition is recorded |
| Baseline | Portfolio 1:N; approving InvestmentDecision 0:1 | type, valid interval, recorded interval, approval | approved snapshot; successor closes prior recorded interval |
| BaselineItem | Baseline 1:N | item type/id/version and JSON snapshot | immutable after approval |

## Cross-module invariants

1. A demand can originate at most one investment. Promotion never erases the originating demand. Each submitted case revision is immutable; the demand and case header may receive later, audited updates.
2. M04 evaluates both proposed demand and existing investments. An active scoring model and its criteria are frozen; a completed assessment cites a submitted case revision or investment row version and contains a complete score set. A locked scenario freezes its candidates. Each recommendation stores the case/investment, scoring, assessment, and scenario basis used for the proposal. Recommendations never change investment or commitment state. M05 decisions require an authorised M06 decision body and record the decision-maker, basis, conditions, and effective date.
3. A commitment must reference an approving investment decision for the same investment. Amendments reference later approving decisions and never rewrite the original commitment.
4. M06 baselines freeze selected records and their exact versions. An approval references a matching M05 investment decision whose subject is the baseline. A successor can close the prior recorded interval only when its business-valid interval is identical; partial overlap requires explicit split design. The governance service validates every polymorphic snapshot reference and the portfolio membership at approval time.
5. Platform `SourceIdentity` maps an external key to one canonical identity. M01 observations and optional future M07–M11 facts retain source metadata. Source authority and conflict rules are explicit integration policy, not inferred from the latest write.
6. Records use `row_version` for optimistic concurrency. The database captures transaction-time history and business-valid intervals for mutable roots. Decisions, case revisions, commitment changes, and audit entries are append-only. Approved baseline history uses both valid and recorded intervals.
7. An application command runs under one tenant and one active tenant member. Module APIs enforce lifecycle transitions, delegation, scoring completeness, cycle prevention, and aggregate financial/capacity limits. PostgreSQL enforces tenant keys, row-level isolation, local ranges, uniqueness, and immutability where feasible.
8. M06 is authoritative for investment-level strategic risks and appetite. Each final risk assessment cites the exact approved appetite version effective for its scope and assessed date; the service checks category, portfolio/tenant scope and valid period. A configured, versioned matrix or threshold determines whether the residual rating is outside tolerance. No universal rating scale or risk threshold is inferred. An outside-tolerance result is flagged for governance review, not automatically accepted or closed. Closure requires an authorised disposition and any required response evidence. A later appetite or assessment version does not rewrite the historical result.
9. M10 delivery risks, if enabled, may link to an M06 `InvestmentRisk` and send observations through a governed contract. M06 alone changes the strategic risk status, final assessment and disposition. `GovernanceAction` may track a response action; a `GovernanceException` may record a time-limited authorised acceptance. Cross-module links retain `(tenant_id, id)` and do not move write ownership.

## Boundary contracts and approved policy

- M02 owns portfolio membership despite the M05 investment FK. M05 never writes M02 tables.
- M03 owns business cases even after investment creation; M05 references the originating demand and M04 recommendation without copying their mutable rows.
- M07/M08 may later consume M05 commitment envelopes but cannot rewrite them. Posted financial actuals and individual HR details remain outside this release.
- [Domain decisions v1.0](domain-decisions-v1.0.md) define product scoring, ranking, decision authority, evidence and baseline rules. Monetary limits, quorum, retention, residency and any currency conversion require explicit tenant configuration before use. SQL ensures weights total 1 at activation and scores are within criterion maxima; the remaining implementation gaps are recorded in the decisions.
- FR-032–FR-033 are modelled in M06 here. Before implementing them, publish the risk rating/appetite contract, decide the accountable appetite approver and disposition authority, add tenant-scoped composite keys and history/immutability rules in a forward migration, and update the ERD, data dictionary, RLS tests and service acceptance tests. The existing V001–V006 migrations do not contain these four risk entities.

