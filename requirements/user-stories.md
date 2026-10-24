# Strategic Portfolio Management user stories

**Status:** Proposed requirements for product review. **Source:** [solution overview](../docs/solution-overview.md), [canonical model v1.0](../reconciled-core/docs/canonical-domain-model-v1.0.md), and [domain decisions v1.0](../reconciled-core/docs/domain-decisions-v1.0.md). These stories describe intended behavior; they are not a claim that the application is implemented.

**Phase key:** **Core MVP** = native M01–M06 plus essential Platform. **Extension** = M07–M12 capability, implemented natively or integrated according to each tenant's source-authority policy. Each story has one primary write-owning module; cross-module references do not transfer write ownership.

## Strategy and portfolio

### US-001 — Define strategic intent

**Role:** Strategy leader · **Owner:** M01 · **Phase:** Core MVP  
As a strategy leader, I want to define a strategy and its objectives with accountable owners and a time horizon, so that portfolio choices can be traced to approved intent.

**Acceptance criteria**

- Given an authorized strategy leader, when a strategy and objective are saved, then each receives a stable tenant-scoped ID, owner, status, and business-valid period.
- When an objective is linked to a parent objective, then the parent belongs to the same strategy and the hierarchy contains no cycle.
- When an active objective changes, then the prior version and actor remain available for historical review.

### US-002 — Define and observe outcomes

**Role:** Strategy leader · **Owner:** M01 · **Phase:** Core MVP  
As a strategy leader, I want measurable outcomes and dated observations, so that I can see whether investments contribute to intended results.

**Acceptance criteria**

- An outcome belongs to one objective and has an accountable owner; each measure has a unit, direction, baseline, and target where applicable.
- An observation records its date, value, and source or evidence reference, and does not overwrite the measure definition.
- A corrected observation retains its earlier version and can be distinguished from an observation received later for a different date.

### US-003 — Maintain portfolio structure

**Role:** Portfolio office · **Owner:** M02 · **Phase:** Core MVP  
As a portfolio office analyst, I want to maintain portfolios, hierarchy, and investment categories, so that every investment has a governed place in the portfolio landscape.

**Acceptance criteria**

- Portfolio and category codes are unique within a tenant; portfolio hierarchy rejects self-reference and cycles.
- An investment can be assigned to a category and time-bounded portfolio memberships without overlapping periods for the same portfolio/investment pair.
- Retiring a portfolio or category preserves historical memberships and decisions.

### US-004 — Explain strategic alignment

**Role:** Portfolio office · **Owner:** M02 · **Phase:** Core MVP  
As a portfolio office analyst, I want to link portfolios to strategic objectives and explain the contribution, so that selection discussions have explicit strategic context.

**Acceptance criteria**

- An alignment links an existing portfolio and objective in the same tenant and records a contribution narrative.
- A user viewing a portfolio can follow the link to the objective and its strategy without creating a duplicate objective.
- Changes to an alignment are attributable and appear in audit history.

## Demand, evaluation, and selection

### US-005 — Submit demand

**Role:** Demand sponsor · **Owner:** M03 · **Phase:** Core MVP  
As a demand sponsor, I want to submit an opportunity with its purpose, desired dates, and strategic alignment, so that it can enter governed assessment.

**Acceptance criteria**

- A submitted demand has a sponsor, submitter, title, submission time, and tenant-unique code; draft demand remains distinguishable from submitted demand.
- The sponsor can link existing objectives in the same tenant and provide an alignment rationale.
- Submission and later withdrawal or rejection preserve the originating demand and its history.

### US-006 — Submit a business case revision

**Role:** Business case owner · **Owner:** M03 · **Phase:** Core MVP  
As a business case owner, I want to submit versioned options and assumptions, so that evaluators can cite the exact case they reviewed.

**Acceptance criteria**

- A case revision has a unique revision number within its business case, author, submission time, summary, options, assumptions, and evidence references.
- Once submitted, a revision cannot be edited or deleted; a correction creates a new numbered revision.
- Assessments and decisions can retrieve the cited revision even after a newer revision is submitted.

### US-007 — Promote accepted demand

**Role:** Portfolio office · **Owner:** M05 · **Phase:** Core MVP  
As a portfolio office analyst, I want accepted demand to become a canonical investment, so that decisions and later execution use one stable investment identity.

**Acceptance criteria**

- Promotion creates at most one investment for an originating demand and retains the demand and case history.
- The investment has a category, sponsor, owner, execution mode, and tenant-unique code.
- A later change to the investment does not rewrite the case revision or recommendation used for approval.

### US-008 — Configure a scoring model

**Role:** Portfolio office · **Owner:** M04 · **Phase:** Core MVP  
As a portfolio office analyst, I want to configure weighted criteria and published scoring rubrics, so that demand and investments are evaluated consistently.

**Acceptance criteria**

- A model cannot activate without at least one criterion whose weights total exactly 1; every criterion has a positive maximum score.
- Entered points follow a higher-is-better rubric, including reverse-scored cost or risk criteria.
- Once activated, the model, criteria, and rubric cannot be changed in place; a change creates a successor model.

### US-009 — Complete an assessment

**Role:** Assessor · **Owner:** M04 · **Phase:** Core MVP  
As an assessor, I want to score a demand or existing investment against an active model, so that its evaluation can be reproduced.

**Acceptance criteria**

- A completed demand assessment cites an exact case revision; an investment assessment cites an exact investment version.
- Completion requires one evidenced score per criterion, each between zero and its maximum, and records assessor and completion time.
- Completed scores and assessment basis cannot be changed; reassessment creates a new assessment.

### US-010 — Compare selection scenarios

**Role:** Portfolio office · **Owner:** M04 · **Phase:** Core MVP  
As a portfolio office analyst, I want to compare eligible demand and investments under explicit constraints, so that trade-offs are visible before a recommendation.

**Acceptance criteria**

- Each candidate cites a completed assessment under the scenario's active scoring model; normalized score equals `100 × Σ(weight × score / maximum_score)`.
- Locked scenarios freeze candidates and constraints, rank by the calculated score, and give exact ties the same rank.
- Missing funding, capacity, or dependency evidence is shown as unknown; a hard-constraint breach cannot silently become a selected recommendation.

### US-011 — Propose a selection recommendation

**Role:** Portfolio office · **Owner:** M04 · **Phase:** Core MVP  
As a portfolio office analyst, I want to recommend selection, deferral, or rejection with a rationale, so that the decision body sees the evidence and trade-offs.

**Acceptance criteria**

- A recommendation refers to a matching candidate in a locked scenario and freezes the case or investment, scores, model, assessment, and scenario basis.
- The recommendation is immutable and does not itself approve an investment, reserve funds, or change a commitment.
- A human override of a constraint is identifiable, authorized, and supported by a reason and evidence.

## Decisions, commitments, and governance

### US-012 — Make an investment decision

**Role:** Investment committee chair or delegated approver · **Owner:** M05 · **Phase:** Core MVP  
As an authorized decision maker, I want to approve, defer, reject, condition, or revoke an investment decision with reasons, so that the choice and its authority are defensible.

**Acceptance criteria**

- First investment approval cites a selection recommendation; the decision records the decision maker, body, rationale, effective date, conditions if any, and frozen authority evidence.
- An approver cannot approve their own sponsored, owned, assessed, or solely recommended proposal; their active mandate or delegation must cover scope, time, currency, and resulting monetary amount.
- A decision is append-only; correction or reversal creates a linked successor decision. A conditional decision cannot release a commitment until its conditions are evidenced as satisfied.

### US-013 — Record committee participation

**Role:** Investment committee member · **Owner:** M06 · **Phase:** Core MVP  
As a committee member, I want my attendance and vote recorded, so that decisions requiring quorum can be verified.

**Acceptance criteria**

- A body with quorum greater than one cannot approve until the configured count of eligible, distinct participants is met.
- Each vote records member, time, choice, and any conflict declaration; members with a disqualifying conflict do not count toward quorum.
- The approved decision retains the vote and attendance evidence used at the time, even if body membership later changes.

### US-014 — Control delegated authority

**Role:** Governance administrator · **Owner:** M06 · **Phase:** Core MVP  
As a governance administrator, I want to configure bodies and time-bounded delegations, so that only authorized people can make decisions within defined limits.

**Acceptance criteria**

- A delegation specifies body, delegate, scope, effective period, and monetary limit/currency when it permits funding approval.
- An expired, inactive, wrong-scope, wrong-currency, or over-limit delegation cannot authorize a decision.
- Changes to a body or delegation are versioned; a decision preserves the authority version it relied on.

### US-015 — Record a funding or capacity commitment

**Role:** Finance or resource planner · **Owner:** M05 · **Phase:** Core MVP  
As a planner, I want to record the approved funding or capacity envelope, so that plans can be compared with what was authorized.

**Acceptance criteria**

- A commitment cites an approving decision for the same investment and states its type, effective period, amount/unit or structured envelope.
- A funding commitment cannot exceed the decision's approved amount or use a different currency; capacity cannot be mixed across unlike units.
- The commitment is immutable and remains separately identifiable from forecasts, actuals, and staffing allocations.

### US-016 — Amend a commitment

**Role:** Finance planner · **Owner:** M05 · **Phase:** Core MVP  
As a finance planner, I want an approved amendment to change an envelope without rewriting the original, so that the authorized amount can be reconstructed for any date.

**Acceptance criteria**

- An amendment cites a later approving decision for the same investment and records effective date, kind, magnitude or replacement envelope, and rationale.
- Increase and decrease magnitudes are positive; a replacement states the whole resulting envelope; the resulting amount cannot be negative or exceed the applicable authority limit.
- An as-of view shows original envelope, ordered amendments, and the resulting envelope without mixing currencies or units.

### US-017 — Govern gates and assurance findings

**Role:** Assurance lead · **Owner:** M06 · **Phase:** Core MVP  
As an assurance lead, I want to record gate reviews and findings against investments, so that unresolved concerns are visible before approval.

**Acceptance criteria**

- A finding identifies the investment, severity, owner, status, and relevant gate where applicable.
- Closing a finding requires evidence and preserves the original finding and closure history.
- A decision view shows open findings and their dispositions as they stood when the decision was made.

### US-018 — Manage exceptions and actions

**Role:** Assurance lead · **Owner:** M06 · **Phase:** Core MVP  
As an assurance lead, I want controlled exceptions and assigned actions, so that departures from policy are explicit and resolved.

**Acceptance criteria**

- An exception records reason, owner, investment, expiry, disposition, and any linked finding; it cannot silently remain effective after expiry.
- An action has one finding or exception as its source, an owner, due date, and status.
- Approval of an exception does not by itself change a recommendation, decision, or commitment.

### US-019 — Approve a reproducible baseline

**Role:** Portfolio office and investment committee chair · **Owner:** M06 · **Phase:** Core MVP  
As a portfolio office analyst, I want an approved portfolio baseline, so that I can compare later changes with the exact state the decision body approved.

**Acceptance criteria**

- Approval cites a matching authorized baseline decision by someone other than the baseline creator.
- Each item identifies an allowed tenant-owned type, exact current version, matching payload, and portfolio scope; stale or out-of-scope items block approval.
- Approved items cannot be edited. A successor replaces the exact same business-valid interval and preserves the predecessor's recorded interval for as-of queries; partial overlap is rejected in the initial release.

### US-020 — Audit a historical decision

**Role:** Auditor · **Owner:** Platform · **Phase:** Core MVP  
As an auditor, I want to reconstruct what was known and approved at a chosen time, so that I can verify authority and subsequent changes.

**Acceptance criteria**

- The view links objective, demand, case revision, assessment, scenario, recommendation, investment decision, commitment, baseline, and relevant audit events where they exist.
- A query distinguishes business-effective time from recorded time for approved baselines and shows supersession lineage without altering prior evidence.
- Access is read-only, tenant-scoped, attributable, and subject to the tenant's records policy.

### US-021 — Review portfolio decisions

**Role:** Executive · **Owner:** Platform read projection over M01–M06 (M12 later) · **Phase:** Core MVP decision view  
As an executive, I want a portfolio decision view, so that I can see approved choices, conditions, commitments, and strategic contribution in one place.

**Acceptance criteria**

- The view distinguishes proposed, recommended, approved, committed, and observed values and shows data freshness.
- A user can drill from a portfolio investment to its decision rationale, authority, case and scoring basis, and approved baseline.
- Filters and totals use only records the user is authorized to see and do not count a recommendation as a commitment.

## Platform administration and integration

### US-022 — Provision tenants and access

**Role:** Tenant administrator · **Owner:** Platform · **Phase:** Core MVP  
As a tenant administrator, I want to provision memberships and roles, so that users access only their tenant and permitted commands.

**Acceptance criteria**

- A suspended tenant or inactive member cannot execute a command or read tenant data through the application.
- A member of one tenant cannot read or write another tenant's records through an API or database role.
- Membership and role changes are audited; users cannot assign themselves approval authority.

### US-023 — Configure tenant policy

**Role:** Tenant administrator · **Owner:** Platform · **Phase:** Core MVP  
As a tenant administrator, I want to configure mandates, reference codes, source authority, records policy, and residency, so that the product follows our approved operating rules.

**Acceptance criteria**

- Approval commands fail closed when required body mandates, monetary limits, quorum settings, or condition policy are missing.
- Retention, residency, and recovery settings require acceptance by the tenant's accountable officers before go-live; the product provides no permissive default.
- A policy change is versioned and does not reinterpret earlier decisions or baselines.

### US-024 — Register external source identities

**Role:** Integration operator · **Owner:** Platform · **Phase:** Core MVP  
As an integration operator, I want to map external identifiers to canonical records, so that imported evidence remains traceable to its source.

**Acceptance criteria**

- One source/object/external key maps to one canonical tenant-owned type and ID; conflicting reuse is quarantined for reconciliation.
- An integration contract declares direction, source authority, cadence, conflict rule, classification, and reconciliation owner.
- Imported observations retain source and receive time; they cannot overwrite native approvals or commitments.

### US-025 — Process messages reliably

**Role:** Integration operator · **Owner:** Platform · **Phase:** Core MVP  
As an integration operator, I want inbound and outbound messages to be deduplicated and auditable, so that retries do not create duplicate business effects.

**Acceptance criteria**

- Reusing an inbound message key with the same payload is idempotent; reusing it with a different hash is rejected and visible for reconciliation.
- A material business change and its outbox event commit atomically; outbound consumers publish idempotently by event ID.
- Failed deliveries retain attempt/error state and can be retried without changing the source record.

## Extensible planning, delivery, benefits, and analytics

### US-026 — Reconcile financial actuals

**Role:** Finance planner · **Owner:** M07 · **Phase:** Extension  
As a finance planner, I want authoritative budgets, forecasts, and posted actuals alongside M05 commitments, so that I can explain variance without treating actuals as approvals.

**Acceptance criteria**

- The configured finance source is identified for each fact; posted actuals retain external identity, period, currency, and receive time.
- A variance view compares like currency and period, identifies missing or stale feeds, and never rewrites an M05 commitment.
- A conflicting import is surfaced for reconciliation under the tenant's source-authority rule.

### US-027 — Compare capacity with demand

**Role:** Resource planner · **Owner:** M08 · **Phase:** Extension  
As a resource planner, I want capacity and allocation views beside approved investment demand, so that overloads are visible before plans are committed.

**Acceptance criteria**

- Capacity and demand identify period, unit, source, and freshness; unlike units are not silently combined.
- The view distinguishes an M05 approved capacity envelope from M08 detailed supply and allocations.
- Sensitive individual workforce data remains in its authoritative system unless a tenant-approved integration contract permits it.

### US-028 — Maintain a portfolio roadmap

**Role:** Programme office · **Owner:** M09 · **Phase:** Extension  
As a programme office planner, I want milestones and dependencies across investments, so that timing conflicts and sequencing risks are visible.

**Acceptance criteria**

- Milestones and dependencies reference canonical investment IDs, state their source, and have time-phased versions.
- A changed external schedule is shown as a variance from the approved baseline rather than editing the baseline.
- Broken or circular dependencies are identified before a roadmap is published.

### US-029 — Report delivery status

**Role:** Delivery leader · **Owner:** M10 · **Phase:** Extension  
As a delivery leader, I want to report status, risks, and execution links, so that governance can compare progress with approved scope and timing.

**Acceptance criteria**

- Each report references the canonical investment and records period, source, reporter, and freshness.
- The view distinguishes delivery status from the M05 approval and M06 baseline and highlights material variance.
- An external execution item maps through a source identity rather than creating a second canonical investment.

### US-030 — Evidence benefits realization

**Role:** Benefits owner · **Owner:** M11 · **Phase:** Extension  
As a benefits owner, I want to record forecasts and observed benefits linked to outcomes, so that realized value can be compared with the approved case.

**Acceptance criteria**

- A benefit identifies owner, investment, linked M01 outcome or measure, unit, period, and evidence source.
- Forecasts and observations are separate versioned facts; a later observation does not rewrite the case or baseline.
- The view exposes missing evidence and shows the approved target beside the observed result.

### US-031 — Analyze portfolio trends

**Role:** Executive and portfolio office · **Owner:** M12 · **Phase:** Extension  
As an executive, I want cross-module trends and scenario comparisons, so that I can evaluate outcomes, investment performance, and future choices.

**Acceptance criteria**

- Analytics identifies source module, refresh time, and the version or as-of basis behind every reported measure.
- A user can compare current projections with approved baselines without changing source facts.
- Report access enforces tenant and role permissions, and projections can be rebuilt from authoritative records and events.

## Backlog notes

- The **Core MVP** stories require application commands and acceptance tests in addition to the existing PostgreSQL schema. [Implementation issue #4](https://github.com/squire1310/Strategic_Portfolio_Management/issues/4) tracks outstanding release blockers.
- Tenant-specific monetary thresholds, quorum details, retention, residency, and source-authority choices must be configured and approved by the tenant; these stories do not invent universal values.
- Extension stories describe product capabilities, not a commitment that M07–M12 are already implemented or must be native in every tenant.

