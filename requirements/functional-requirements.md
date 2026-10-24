# Strategic Portfolio Management functional requirements

**Version:** 0.1 · **Status:** Proposed for product review · **Prepared:** 24 October 2026  
**Scope:** Hybrid SPM product: native M01–M06 and essential Platform, with M07–M12 available as native or integrated extensions. This document specifies intended application behaviour, not implemented capability or a claim of UK government compliance.

## How to read this specification

- **Core** means required for the native strategic core. **Extension** means an optional module or integration. **UK profile** means a configurable capability for organisations to which the cited UK central government guidance applies; it is not imposed on every tenant.
- Each row states a verifiable system behaviour. The **Check** column is a minimum acceptance test, not a complete test suite. An ID remains stable when wording changes; substantive changes require a versioned review.
- The **Sources** column distinguishes approved product decisions (`Dxx`), existing user stories (`US-xxx`), and external guidance (`GB`, `BC`, `OB`, `MPM`, `MAG`, `GOVS`, `TAP`). Government publications inform product design; they do not directly require a software product to implement every feature below.
- Module names and write ownership follow the [canonical domain model v1.0](../reconciled-core/docs/canonical-domain-model-v1.0.md). `D01–D10` refer to the [approved domain decisions](../reconciled-core/docs/domain-decisions-v1.0.md); `US-001–US-031` refer to the [user stories](user-stories.md).

## Source register

Official editions and landing pages checked on **24 October 2026**. Section references identify the relevant topic; the linked publication remains authoritative if its wording changes.

| Code | Source | Relevant scope |
| --- | --- | --- |
| GB | [HM Treasury, The Green Book (2026)](https://www.gov.uk/government/publications/the-green-book--2/the-green-book-2026) | Appraisal: rationale and objectives, options, costs, benefits, risks, uncertainty, distributional effects, and evaluation. |
| BC | [HM Treasury, Guidance on developing business cases](https://www.gov.uk/government/publications/guidance-on-developing-business-cases) (updated 30 June 2026) | Five Case Model and proportionate project and programme business case development. |
| OB | [HM Treasury, The Orange Book: Management of Risk](https://www.gov.uk/government/publications/orange-book/the-orange-book-management-of-risk-principles-and-concepts) (updated 29 July 2026) | Risk governance, appetite, assessment, response, monitoring and reporting. |
| MPM | [HM Treasury, Managing Public Money](https://www.gov.uk/government/publications/managing-public-money) (2026 publication) | Public money stewardship, delegated authority, regularity, propriety and value for money. Applies according to the organisation's public-sector context. |
| MAG | [HM Treasury, The Magenta Book](https://www.gov.uk/government/publications/the-magenta-book/magenta-book-central-government-guidance-on-evaluation-html) (updated 2026) | Proportionate evaluation planning, evidence, delivery, findings and learning. |
| GOVS | [Government Functional Standard GovS 002: Project Delivery, v2.1 (2025)](https://www.gov.uk/government/publications/project-delivery-functional-standard) | Direction and management of portfolios, programmes and projects; governance, planning, control and assurance. |
| TAP | [HM Treasury, Treasury Approvals Process for programmes and projects](https://www.gov.uk/government/publications/treasury-approvals-process-for-programmes-and-projects/treasury-approvals-process-for-projects-and-programmes) (updated 1 April 2026) | Conditional central government approvals, business case stages, assurance, conditions and monitoring. |

## Functional requirements

### M01 — Strategy and outcomes

| ID | Requirement | Owner / phase | Sources | Check |
| --- | --- | --- | --- | --- |
| FR-001 | The system shall let authorised users define strategies with a purpose, accountable owner, status and business-valid period. | M01 / Core | D01, US-001, GB, GOVS | Save and retrieve a strategy by stable tenant-scoped ID; historical versions remain available. |
| FR-002 | The system shall maintain objectives in a hierarchy under a strategy, with owner, measurable intent and time horizon. | M01 / Core | US-001, GB, GOVS | Reject a cross-strategy parent or cycle; display the parent chain. |
| FR-003 | The system shall link each intended outcome to an objective and capture the causal contribution or theory-of-change rationale. | M01 / Core | US-002, GB, MAG | A reviewer can follow objective → outcome and read the rationale. |
| FR-004 | The system shall define outcome measures with unit, direction, baseline, target and target date where applicable. | M01 / Core | US-002, GB, MAG | Missing required measure fields block activation; baseline and target are separately visible. |
| FR-005 | The system shall record dated measure observations with value, source, evidence reference and receipt time without changing the measure definition. | M01 / Core | D09, US-002, MAG | A correction preserves the previous observation and both recorded times. |

### M02 — Portfolio architecture

| ID | Requirement | Owner / phase | Sources | Check |
| --- | --- | --- | --- | --- |
| FR-006 | The system shall maintain tenant-owned portfolios and categories with unique codes, accountable owners, status and hierarchy. | M02 / Core | D01, US-003, GOVS | Duplicate codes and hierarchy cycles are rejected. |
| FR-007 | The system shall time-bound an investment's membership of a portfolio and preserve earlier memberships. | M02 / Core | US-003, GOVS | An as-of query returns the correct membership; overlapping intervals for the same pair are rejected. |
| FR-008 | The system shall link portfolios to strategic objectives and record the expected contribution. | M02 / Core | US-004, GB, GOVS | A portfolio view reaches the canonical objective and shows the contribution narrative. |
| FR-009 | The system shall show the portfolio mix by category, strategic objective and decision state using authorised records. | M02 / Core | US-003, US-021, GOVS | Counts distinguish proposed, approved and committed investments and match source records. |

### M03 — Demand and business cases

| ID | Requirement | Owner / phase | Sources | Check |
| --- | --- | --- | --- | --- |
| FR-010 | The system shall accept demand in draft and submitted states with sponsor, purpose, desired timing and strategic alignment. | M03 / Core | D01, US-005, GB | Submission stamps submitter and time; withdrawal retains history and reason. |
| FR-011 | The system shall maintain numbered, immutable submitted business case revisions with author, date, assumptions, options and evidence references. | M03 / Core | D07, US-006, BC | Editing a submitted revision fails; an assessment can retrieve the exact cited revision. |
| FR-012 | The system shall capture the case for change, objectives, business-as-usual comparator and a proportionate longlist and shortlist of options. | M03 / Core | US-006, GB, BC | A case reviewer can identify the comparator and rationale for excluding each shortlisted-out option. |
| FR-013 | The system shall support structured Strategic, Economic, Commercial, Financial and Management case sections, with applicability recorded for each. | M03 / Core | US-006, BC | Case completeness reports which applicable sections lack evidence without fabricating a case. |
| FR-014 | The system shall record each option's expected costs, benefits, risks, delivery assumptions, distributional effects and uncertainty with units, periods and evidence. | M03 / Core | US-006, GB, BC | An option comparison exposes missing fields as unknown and retains evidence provenance. |
| FR-015 | The system shall identify a preferred option and document the reasons, trade-offs and sensitivity or scenario analysis used to support it. | M03 / Core | US-006, GB, BC | Reviewers can compare the preferred option with alternatives and trace the stated reasons. |
| FR-016 | The system shall validate case evidence against a published, versioned schema before submission. | M03 / Core | D07, US-006 | An invalid required field blocks submission; the stored revision records its schema version. |

### M04 — Prioritisation and selection

| ID | Requirement | Owner / phase | Sources | Check |
| --- | --- | --- | --- | --- |
| FR-017 | The system shall publish versioned scoring models with criterion weights, maximum scores and higher-is-better rubrics. | M04 / Core | D02, US-008, GOVS | Activation requires weights summing exactly to 1; an active model cannot be edited in place. |
| FR-018 | The system shall assess demand against an exact submitted case revision or an investment against an exact investment version. | M04 / Core | D02, US-009 | Completion requires an evidenced score within bounds for every criterion. |
| FR-019 | The system shall calculate the unrounded comparable score as `100 × Σ(weight × score / maximum_score)` and display it rounded to two decimal places. | M04 / Core | D02, US-010 | Recalculation from frozen criterion data reproduces the stored ordering; exact ties share rank. |
| FR-020 | The system shall compare candidates under a frozen scenario that records funding, capacity, eligibility, dependency and uncertainty assumptions. | M04 / Core | D03, US-010, GB, GOVS | Locked scenarios reject edits; absent evidence appears as unknown. |
| FR-021 | The system shall block an automatic selection recommendation that breaches a hard constraint and allow only an authorised, evidenced override proposal. | M04 / Core | D03, US-010, US-011 | A breached candidate cannot be silently selected; override reason and actor are visible. |
| FR-022 | The system shall issue immutable selection, deferral or rejection recommendations citing the assessment, model, scenario, case or investment version and trade-off rationale. | M04 / Core | D03, US-011, GB | A recommendation is reproducible after source updates and does not create an approval or commitment. |

### M05 — Investment decisions and commitments

| ID | Requirement | Owner / phase | Sources | Check |
| --- | --- | --- | --- | --- |
| FR-023 | The system shall promote an accepted demand to at most one canonical investment while retaining the originating demand and case history. | M05 / Core | D01, US-007 | Repeated promotion is idempotent and preserves one tenant-scoped investment identity. |
| FR-024 | The system shall record an authorised decision to approve, condition, defer, reject or revoke, with subject, rationale, effective date, accountable maker and frozen evidence. | M05 / Core | D04, US-012, GOVS, MPM | Decision retrieval shows its exact recommendation, authority and evidence at decision time. |
| FR-025 | The system shall require an approval decision to cite a matching recommendation and pass independence, mandate, scope, time, currency, amount and quorum checks. | M05 / Core | D04, US-012–US-014, MPM | Self-approval, expired delegation, wrong currency, excess amount or missing quorum blocks approval. |
| FR-026 | The system shall hold conditional approvals until required conditions have recorded satisfaction evidence and authorised release. | M05 / Core | D04, US-012, TAP | A conditional decision alone cannot release a commitment. |
| FR-027 | The system shall record approved funding, capacity, scope or schedule envelopes separately from forecasts, actuals and allocations. | M05 / Core | D05, US-015, GOVS | A commitment cites an approving decision and shows its type, unit or currency, amount and period. |
| FR-028 | The system shall apply append-only commitment amendments against a later matching approval and calculate the resulting envelope as of a date. | M05 / Core | D05, US-016 | Increase, decrease and replacement reconcile; a negative result or over-authority total is rejected. |
| FR-029 | The system shall preserve decision and amendment supersession lineage instead of overwriting approved records. | M05 / Core | D09, US-012, US-016, MPM | An auditor can reconstruct the earlier and current approved states. |

### M06 — Governance, risk and assurance

| ID | Requirement | Owner / phase | Sources | Check |
| --- | --- | --- | --- | --- |
| FR-030 | The system shall configure decision bodies, mandates, scoped delegations, monetary limits, currencies, valid periods and quorum rules per tenant. | M06 / Core | D04, US-013, US-014, MPM, GOVS | Missing approval policy fails closed; a decision retains the authority version used. |
| FR-031 | The system shall record attendance, votes and conflict declarations for decisions requiring a committee vote. | M06 / Core | D04, US-013, GOVS | Only eligible distinct participants count toward quorum; historical votes remain available. |
| FR-032 | The system shall maintain an investment risk register with owner, cause/event/effect description, likelihood, impact, response, residual rating, review date and status. | M06 / Core | OB, GOVS | A risk's changes are versioned and overdue reviews are visible. |
| FR-033 | The system shall record the applicable risk appetite or tolerance and flag assessed exposures outside it for governance review. | M06 / Core | OB | A flagged exposure links to the approved appetite version and a disposition; no universal tolerance is assumed. |
| FR-034 | The system shall schedule gates and assurance reviews and record findings with severity, owner, due date, evidence and disposition. | M06 / Core | US-017, GOVS, TAP | Open findings appear in a decision view; closure requires evidence and retains history. |
| FR-035 | The system shall manage governance exceptions and linked actions with authority, reason, expiry, owner and resolution. | M06 / Core | D09, US-018, OB | An expired exception is flagged and cannot silently remain effective. |
| FR-036 | The system shall approve immutable portfolio baselines containing exact tenant-owned item versions and a matching authorised decision. | M06 / Core | D06, US-019, GOVS | Stale, missing or out-of-scope items block approval; approved payloads remain unchanged. |
| FR-037 | The system shall provide business-valid and recorded-time views of approved baselines and enforce exact-interval succession in the initial release. | M06 / Core | D06, US-019, US-020 | A successor closes the predecessor's recorded interval; partial overlap is rejected. |

### Essential platform and cross-module views

| ID | Requirement | Owner / phase | Sources | Check |
| --- | --- | --- | --- | --- |
| FR-038 | The system shall authenticate principals, authorise active tenant membership and role permissions, and set tenant and actor context for each command. | Platform / Core | D10, US-022 | Suspended membership or cross-tenant access is denied through API and database role. |
| FR-039 | The system shall enforce one write owner per entity and reject stale `row_version` updates with the current version available for reconciliation. | Platform / Core | D01, D09 | A concurrent stale command cannot replace the newer state. |
| FR-040 | The system shall audit material commands and preserve actor, tenant, action, entity, time and correlation details in append-only history. | Platform / Core | D09, D10, US-020 | A decision can be traced through relevant audit events without modifying them. |
| FR-041 | The system shall write an outbox event atomically with each material business change and process inbound message keys idempotently. | Platform / Core | D10, US-025 | Retry of the same hash has one effect; key reuse with a different hash is quarantined. |
| FR-042 | The system shall map external source/object/key triples to one canonical tenant-owned identity and expose conflicts for reconciliation. | Platform / Core | D08, US-024 | Conflicting key reuse cannot reassign a canonical identity. |
| FR-043 | The system shall configure source authority, direction, cadence, classification, conflict rules and reconciliation owner for every integration. | Platform / Core | D08, US-024 | Imports cannot overwrite native decisions, commitments or approved baselines. |
| FR-044 | The system shall provide read-only decision trace views across objectives, demand, case revisions, assessments, recommendations, approvals, commitments, baselines and audit history. | Platform / Core | US-020, US-021, GOVS | A permitted user can reconstruct a decision as of a chosen time; reports honour tenant and role access. |
| FR-045 | The system shall version tenant operating policy for mandates, source authority, records handling and data controls, and block go-live when required settings lack accountable acceptance. | Platform / Core | D10, US-023, MPM | Missing mandated settings fail closed; policy changes do not reinterpret prior decisions. |

### Optional planning, delivery, benefits and UK government profile

| ID | Requirement | Owner / phase | Sources | Check |
| --- | --- | --- | --- | --- |
| FR-046 | The system shall compare M05 approved funding with authoritative budgets, forecasts and posted actuals without treating those facts as approvals. | M07 / Extension | D05, US-026, GOVS, MPM | Variance uses like currency and period and shows source freshness. |
| FR-047 | The system shall compare approved capacity envelopes with sourced capacity and allocations in explicit units and periods. | M08 / Extension | D05, US-027, GOVS | Unlike units are not summed; missing supply is shown as unknown. |
| FR-048 | The system shall maintain versioned milestones and dependencies linked to canonical investments and show variance from an approved baseline. | M09 / Extension | US-028, GOVS | Broken or circular dependencies are identified before publication. |
| FR-049 | The system shall ingest or record dated delivery status and risk reports while retaining their source identity and freshness. | M10 / Extension | US-029, GOVS, OB | Reports do not change M05 approval or M06 baseline state. |
| FR-050 | The system shall maintain benefit forecasts and observations linked to investment outcomes, measures, owners and evidence. | M11 / Extension | US-030, GB, MAG | Approved target and observed result remain separate; missing evidence is visible. |
| FR-051 | The system shall support a proportionate evaluation plan with questions, indicators, method, owner, timing and evidence sources, then capture findings and lessons. | M11 / Extension | MAG, GB, GOVS | Findings trace to an evaluation plan and observations without rewriting the original case. |
| FR-052 | The system shall produce authorised cross-module trends with source, refresh time and as-of or version basis. | M12 / Extension | US-031, GOVS | A report can be rebuilt from authoritative records and distinguishes baseline from current projections. |
| FR-053 | For a tenant enabling the UK profile, the system shall configure delegated authority and Treasury referral triggers, including amount and novel/contentious/repercussive criteria, without preset universal thresholds. | Platform + M06 / UK profile | MPM, TAP, US-023 | A qualifying proposal is flagged for the configured external approval route before release. |
| FR-054 | For a tenant enabling the UK profile, the system shall track applicable business case stages, external approval submissions, written decisions, conditions and assurance evidence. | M03 + M06 / UK profile | BC, TAP | A decision record links its applicable stage and external approval evidence; unmet conditions block release. |

## Boundaries and assumptions

1. **Source authority:** The government publications are design inputs; local policy determines which guidance applies to a tenant. Legal or policy compliance requires tenant-specific review and operation, beyond this product specification.
2. **Approval thresholds:** Monetary delegations, quorum, risk appetite and Treasury referral settings have no product-wide default. An accountable tenant authority supplies and approves them.
3. **Execution boundary:** M01–M06 own strategic decisions and approved envelopes. Detailed finance, workforce and delivery facts belong to M07–M11 or configured external systems. M12 owns projections, not source facts.
4. **Case proportionality:** The five case structure is available, while evidence depth and required sections are configured by case type, scale and tenant policy. The software must not represent every project as requiring the same approval route.
5. **Versioning:** Submitted case revisions, completed assessments, recommendations, decisions, commitments and approved baselines remain immutable under D06–D09. Corrections use explicit successors. Approved baselines retain both business-valid and recorded-time intervals.
6. **Non-functional matters:** Security, availability, performance, accessibility, retention periods, residency and recovery targets need separate non-functional requirements and tenant policy. The functional controls above do not set universal service levels.

## Review and traceability

This draft extends the [role-based user stories](user-stories.md). Product review should confirm requirement priority, applicability by tenant profile, evidence schemas, workflow transitions and the M06 risk-register ownership addition before implementation planning. Implementation gaps already identified by D01–D10 remain tracked in [issue #4](https://github.com/squire1310/Strategic_Portfolio_Management/issues/4). No requirement in this file is marked implemented solely because a table or migration exists.

