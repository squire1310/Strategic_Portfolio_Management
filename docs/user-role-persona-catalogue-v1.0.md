# User Role and Persona Catalogue — v1.0

**Date:** 2026-10-25  
**Status:** Approved design positions; personas proposed for user validation  
**Scope:** Balanced multi-persona strategic portfolio management for enterprises and government  
**Related:** [Journey catalogue](user-journey-catalogue-v1.0.md) · [UX decisions](ux-design-decisions.md) · [Solution overview](solution-overview.md)

## Design baseline

- **18 canonical business personas** grouped into five families, not 18 application permission roles.
- **Six experience archetypes**: executive cockpit; decision workspace; portfolio workspace; investment workspace; delivery and value workspace; specialist and administration workspace. The last contains separately protected specialist, consumer and administrative modes.
- **Six research anchors**: EX02, EX04, PM01, PM02, IN01, DE03.
- Persona, business responsibility, membership, permission and delegated authority are independently modelled. Individuals may hold several scoped assignments.
- Cross-role user journeys are primary UX design units; enterprise and government policies are configurable; detailed execution remains integrated or optional.

## Persona catalogue

| ID | Family | Persona | Participation | UX priority |
|---|---|---|---|---|
| EX01 | Executive/governance | Enterprise Executive / Accounting Officer | Decision maker | P1 |
| EX02 | Executive/governance | Strategy Director | Decision maker / primary | P1 |
| EX03 | Executive/governance | Finance Executive / CFO | Decision maker | P1 |
| EX04 | Executive/governance | Investment Committee Member | Decision maker | P1 |
| PM01 | Portfolio | Enterprise Portfolio Director | Primary | P1 |
| PM02 | Portfolio | Portfolio Manager | Primary | P1 |
| PM03 | Portfolio | Portfolio Analyst / PMO | Primary | P1 |
| IN01 | Investment | Investment Sponsor / Business Case Owner | Contributor | P1 |
| IN02 | Investment | Investment Assessment Lead | Contributor | P2 |
| DE01 | Delivery/value | Programme Manager | Contributor / primary | P2 |
| DE02 | Delivery/value | Project / Delivery Lead | Contributor | P2 |
| DE03 | Delivery/value | Benefits / Outcomes Owner | Contributor | P1 |
| SP01 | Specialist | Finance Business Partner | Contributor | P2 |
| SP02 | Specialist | Resource / Capacity Manager | Contributor | P2 |
| SP03 | Specialist | Risk / Assurance Officer | Contributor | P2 |
| SP04 | Specialist | Strategic Performance Analyst | Primary | P2 |
| ST01 | Consumer/admin | Business Stakeholder / Reporting Consumer | Consumer | P3 |
| AD01 | Consumer/admin | Platform / Organisation Administrator | Platform operator | P2 |

P1/P2/P3 are design sequencing indicators, not organisational importance or release commitments.

## Detailed persona needs

| ID | Goal / mission | Decisions and core tasks | Essential information | Main friction | Experience and success |
|---|---|---|---|---|---|
| EX01 | Assure overall strategic delivery and stewardship | Endorse priorities; intervene within authority | Strategic scorecards, commitments, benefits, critical risks | Fragmented reports | Concise executive brief, evidence drill-down; identify material issues without custom reports |
| EX02 | Connect strategy to investments and measured outcomes | Define objectives, targets and priorities; recommend reprioritisation | Hierarchies, investment contribution, performance trends | Strategy disconnected from allocation | Strategy map, gaps, alignment and measurement; explain investment-to-outcome links |
| EX03 | Assure affordability and financial discipline | Review allocations and funding trade-offs; exercise delegated authority | Multi-year funding, forecasts, actuals, capex/opex, exposure | Conflicting baselines | Finance cockpit, variance and scenarios; reconcile financial choices |
| EX04 | Make defensible investment determinations | Review, challenge, approve/reject/defer/condition within mandate | Decision brief, alternatives, assurance, evidence, conditions | Oversized packs and version confusion | Decision inbox, compare options, auditable record; complete sound decisions with little overhead |
| PM01 | Optimise the enterprise portfolio | Recommend start/stop/pause/accelerate and rebalance | Cross-portfolio commitments, risk, capacity, value | Incomparable departmental information | Portfolio cockpit and scenario analysis; defend trade-offs |
| PM02 | Steward a portfolio through its lifecycle | Triage, assess, prioritise, escalate and monitor | Pipeline, dependency, cost, health, risks | Manual consolidation | Analysis tables, exceptions and work queues; manage by exception |
| PM03 | Assure data and governance process quality | Validate submissions, run reporting, follow up data issues | Completeness, freshness, provenance, history, actions | Spreadsheet chasing | Data quality and reporting work queues; decision-grade data on time |
| IN01 | Justify and sponsor investment value | Draft/submit business case, resolve challenges, maintain accountability | Templates, criteria, costs, benefits, feedback, status | Opaque approvals, repeated questions | Guided form, collaborators, transparent progress; high-quality submission |
| IN02 | Produce consistent investment assessments | Apply criteria, seek evidence, record rationale | Scoring criteria, options, reviewer findings | Inconsistent rankings | Structured review, scoring/evidence, versioning; comparable defensible findings |
| DE01 | Coordinate programme outcomes and dependencies | Report material health, propose interventions | Milestones, dependencies, forecasts, benefits | Duplicate reporting | Lightweight integration-backed programme summary |
| DE02 | Deliver work and surface material deviations | Report exceptions and change requests | Approved baseline, source delivery status, obligations | Double entry | Source-linked updates and escalation with minimal overhead |
| DE03 | Account for realised benefits and outcomes | Define baseline/targets; validate evidence; recommend corrective action | Observations, source evidence, realisation periods, contribution | Benefits forgotten after closure | Value realisation workspace; explain actual value and uncertainty |
| SP01 | Validate investment financial evidence | Review cost/forecast/affordability, challenge assumptions | Finance records and approved assumptions | Unreconciled numbers | Review queue and variance evidence; trustworthy funding position |
| SP02 | Validate deliverable capacity | Assess demand, supply, bottlenecks and scenario feasibility | Skills pools, time-phased demand, constraints | Hidden shortages | Capacity heatmaps and scenario checks; surface realistic constraints |
| SP03 | Provide independent risk/assurance challenge | Review evidence, record findings, verify remediation | Risks, controls, evidence, conflicts, governance rules | Compromised independence | Assurance queue and findings; demonstrable challenge and closure |
| SP04 | Maintain strategic performance intelligence | Analyse targets, trends, variance and provenance | Measures, periods, baselines, source lineage | Ambiguous metrics | Measures workspace; credible strategic performance |
| ST01 | Understand relevant portfolio progress | Access published read-only views | Approved roadmap, decisions, performance | Opaque stale reporting | Searchable scoped reports; self-service understanding |
| AD01 | Operate secure configurable platform | Manage membership, policy config, reference data, integrations | Audit, access, workflow versions, source sync health | Hidden dependencies and privilege risks | Controlled admin console; safe, traceable operations |

## Enterprise / public-sector interpretation

| General role | Enterprise illustration | Government illustration |
|---|---|---|
| EX01 | CEO / COO | Permanent Secretary / Agency Head |
| EX02 | Chief Strategy Officer | Director of Strategy / Corporate Planning |
| EX03 | Group CFO | Finance Director / Senior Finance Officer |
| EX04 | Investment committee | Investment board / delegated governance committee |
| PM01–PM02 | Enterprise/portfolio leadership | Departmental portfolio leadership |
| IN01 | Business unit sponsor | Senior Responsible Owner or investment sponsor |
| SP03 | Enterprise risk / assurance | Independent assurance or gated review lead |
| DE03 | Business benefits owner | Service / policy outcomes owner |

Titles are illustrative; authority, quorum, assurance and records rules vary by organisation and jurisdiction. Do not equate a job title with a granted permission.

## Experience architecture

| Archetype | Personas / main tasks |
|---|---|
| Executive cockpit | EX01–EX03; strategic exceptions, funding and value |
| Decision workspace | EX04 and delegated approvers; decision packs and formal determinations |
| Portfolio workspace | PM01–PM03; prioritisation, data quality, scenarios, performance |
| Investment workspace | IN01–IN02; proposals, evaluations, review requests |
| Delivery & value workspace | DE01–DE03; source-linked delivery oversight and benefits |
| Specialist & administration workspace | SP01–SP04, ST01, AD01; separate contextual sub-workspaces with independent authorisation |

Shared navigation: **My Work**, **My Responsibilities**, **Explore**. Workspaces share search, collaboration, history, notifications and evidence. Context switches must reveal active organisational scope and permissions.

## Role model / authorisation

- **Persona** = user-needs pattern; **business role** = accountability; **permission role** = allowed operations; **assignment** = scoped relationship; **delegation** = bounded authority; **membership** = participation in a team or governing body.
- Use RBAC + contextual ABAC + explicit delegated authority checks. Enforce organisation/portfolio/investment boundaries across queries, commands, exports, APIs and integrations.
- Separate recommendation, endorsement, authorisation and application of an approved change.
- Segregate assurance and approval, prevent disallowed self-approval, and enforce conflict/recusal policy.
- Administrative capability must not confer financial authority or unrestricted visibility.

## Prototype anchors and success measures

1. **EX04** — decision inbox, evidence brief; task: make a valid, traceable determination.
2. **EX02** — strategy and alignment; task: locate strategic investment gaps.
3. **PM01** — scenarios; task: explain affordability/capacity trade-offs.
4. **PM02** — portfolio work queue; task: prioritise and escalate exceptions.
5. **IN01** — guided proposal; task: submit, respond to questions, monitor status.
6. **DE03** — benefits workspace; task: evidence benefits after delivery completion.

PM03 and SP01 are cross-cutting research participants; SP03 validates assurance independence. Measure task completion, comprehension of decision authority, evidence retrieval time, reporting effort, duplicate-entry effort and rework frequency. Numeric targets require research baselines.

## Design status

The **seven strategic design positions are approved**. The persona descriptions and prototype assumptions still require validation with real enterprise and public-sector users. They are product-design inputs, not evidence that the current implementation already supports these experiences.
