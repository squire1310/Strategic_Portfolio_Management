# Strategic Portfolio Management — solution overview

**Status:** Solution overview based on the approved hybrid architecture and canonical domain model v0.3  
**Audience:** Product, enterprise architecture, delivery, security, finance and governance stakeholders  
**Scope:** Target architecture and phased product direction; this document is not a claim that the described capabilities or physical schema are implemented

## Executive summary

Strategic Portfolio Management (SPM) gives large enterprises and public sector organisations one governed path from strategy and demand to investment choice, commitment, delivery oversight and benefits evidence. The product connects outcomes, portfolios, proposals, decisions and approved plans so leaders can explain what they chose, why, on whose authority, and what changed afterward.

The approved **hybrid** architecture makes the strategic decision core native to SPM: M01–M06 own strategic intent, portfolio structure, demand, prioritisation, investment commitments and governance records. Finance, resources, roadmaps, delivery, benefits and analytics (M07–M12) are extensible capabilities. They can be implemented natively, integrated from established systems, or combined according to a tenant's source-of-authority policy. This supports end-to-end management without requiring every organisation to replace its ERP, workforce or delivery tools.

The initial deployment is a modular monolith with explicit module ownership, versioned APIs and published event contracts. This limits operational complexity while preserving a route to separate services when scale, release cadence or ownership justify it.

## Objectives and users

The solution aims to:

- Turn strategy and desired outcomes into comparable, traceable investment choices.
- Give decision makers a defensible record of scoring, trade-offs, approvals, commitments and exceptions.
- Maintain a current portfolio view while preserving the exact approved baseline behind each decision.
- Reconcile evidence from authoritative external systems without losing provenance.
- Support enterprise and public sector needs for tenant isolation, role-based access, auditability, accessibility, retention and assurance.

Primary users include strategy leaders, portfolio and programme offices, demand sponsors, investment committees, finance and resource planners, delivery leaders, benefits owners, assurance teams, auditors and executives. Administrators configure tenants, roles, workflows, reference data and integrations. Public sector deployments may additionally require explicit delegation, transparency and records-management controls.

## Product position and differentiation

SPM is an end-to-end strategic portfolio decision system. Its centre of gravity is the trace from outcomes to investment decisions and their subsequent evidence. The native core holds stable identities and governed records even when detailed financial transactions, staffing data or execution tasks remain in specialist systems.

Differentiating design choices are:

1. **Decision provenance:** recommendations, approvals, conditions, supersessions and approved snapshots are first-class records.
2. **Configurable source authority:** each fact has a declared owner; imported facts retain source identity and time.
3. **Portfolio-wide comparability:** demand, strategic contribution, scoring, constraints and dependencies use a common model.
4. **Modular adoption:** organisations can start with strategic governance and add native or integrated execution capabilities.
5. **Enterprise controls:** tenant-scoped identifiers, least-privilege access and durable audit trails are part of the platform design.

## Functional architecture

| Module | Purpose and owned records | Boundary |
|---|---|---|
| **M01 Strategy & Outcomes** | Strategies, strategic themes/objectives, outcomes, measures, targets and accountable owners | Authoritative strategic intent and outcome definitions; observations may come from external measurement systems. |
| **M02 Portfolio Architecture** | Portfolios, hierarchy, investment categories, portfolio membership and strategic alignment structure | Defines the managed investment landscape and canonical portfolio relationships. |
| **M03 Demand & Business Cases** | Demand, sponsors, proposals, options, assumptions, business cases and revisions | Owns intake and case development before an investment is selected; attachments can live in a document service. |
| **M04 Prioritisation & Selection** | Criteria, weighting and scoring models, assessments, scenarios, rankings and selection recommendations | Owns comparative evaluation; a recommendation does not itself create an approved commitment. |
| **M05 Investment Decisions & Commitments** | Investment decisions, approved funding/capacity envelopes, conditions, commitment changes and decision lineage | Owns the authoritative investment approval and commitment record; transactional finance remains with its designated source. |
| **M06 Governance & Assurance** | Governance bodies, gates, delegations, assurance findings, exceptions, actions and approved baselines | Owns the controlled decision process, evidence and immutable approved snapshots. |
| **M07 Finance** | Budgets, forecasts, actuals and financial views | Extensible; ERP is typically authoritative for posted actuals, while SPM may own portfolio planning scenarios. |
| **M08 Resources** | Capacity, demand, allocations and skills views | Extensible; workforce systems may own people and supply facts. |
| **M09 Roadmaps** | Time-phased milestones, dependencies and portfolio roadmaps | Extensible; coordinates plans across investments and external schedules. |
| **M10 Delivery** | Delivery status, milestones, risks and execution links | Extensible; specialist PPM or agile tools may own detailed work items. |
| **M11 Benefits** | Benefit plans, owners, forecasts, observations and realisation evidence | Extensible; outcome measures remain linked to M01. |
| **M12 Analytics** | Cross-module reporting, scorecards, trend and scenario views | Read-oriented projections; source modules retain write authority. |

The first six modules form the native strategic core. M07–M12 use the same contracts and canonical identities, but their deployment and ownership mode are chosen per capability and tenant.

### Shared platform services

Identity and access manages principals, tenant membership, roles and permissions, with enterprise identity federation. Workflow coordinates submission, review, gate and approval states without becoming the owner of business facts. Audit records who changed or approved what and when. Integration manages source-system registration, external identity mapping, import/export, retries and reconciliation. Configuration manages tenant policy, reference data, criteria, calendars and workflow definitions. Notifications, document storage and observability support these services as needed.

## Module ownership and interaction rules

Each record has one write-owning module. Other modules refer to its canonical identifier or consume a published read model; they do not directly update its tables. Cross-module commands go through application contracts that enforce authorization and lifecycle rules. Within the modular monolith, database transactions can preserve consistency for a single command, but the module API remains the stable boundary.

A demand can be promoted into a canonical investment without erasing its originating case. M04 produces an evaluated recommendation; M05 records the authorised choice and commitment; M06 preserves the governance evidence and approved state. Later forecasts, delivery reports and benefits observations are compared with that state, not used to rewrite it. M07–M11 supply plans and facts under explicit source-authority rules. M12 projects them for analysis.

## Conceptual data model

Canonical model v0.3 is the logical contract for the strategic core and platform. The principal concepts and relationships are:

- A **tenant** contains its portfolios, strategies, demand, investments, decisions and configuration. A principal may have tenant-specific memberships and roles.
- A **strategy** defines objectives and outcomes; measures and observations evidence progress. Portfolios and investments link to objectives to state intended contribution.
- A **portfolio** can form a hierarchy and contain time-bounded investment memberships. An **investment** has a stable canonical identity, including when execution is tracked elsewhere.
- A **demand** and its versioned business case describe an opportunity and alternatives. Assessments and scenarios compare eligible demand and investments against governed criteria.
- A **selection recommendation** informs an **investment decision**. Decisions record authority, rationale, conditions, effective state and links to superseding decisions or amendments.
- A **commitment** expresses the authorised funding, capacity, scope or timing envelope. A **baseline** freezes the approved portfolio or investment state at a governance point.
- A **source system** and external identity map connect external facts to canonical records. Source metadata identifies provenance and the authority for each field or fact.

Tenant-owned entities use tenant-scoped composite keys, such as `(tenant_id, entity_id)`, and cross-entity references carry the tenant key. This makes tenant boundaries explicit in persistence and queries. Business identifiers can remain human-readable while canonical identifiers stay stable.

Governance decisions are versioned with explicit lineage rather than silently overwritten. Approved baselines are immutable snapshots; a new approval creates a successor. Operational records use optimistic versioning and audit history. Where an organisation needs both business-effective time and the time the system learned a fact, optional bitemporal history can record both intervals. The need, retention period and scope of bitemporality are policy decisions, not a reason to duplicate all data by default.

This overview describes the logical model. It does not prescribe table names, migration files or a deployed PostgreSQL schema.

## Integration and deployment patterns

The modular monolith exposes versioned command/query APIs for user interfaces and integrations. It publishes domain events for material lifecycle changes, such as demand submitted, assessment completed, investment approved, commitment amended and baseline approved. Events identify tenant, aggregate, version, occurrence time and correlation, and are emitted through a transactional outbox. Consumers process them idempotently; an inbox and external identity map help deduplicate inbound messages.

Adapters integrate enterprise identity, ERP, workforce, delivery, document and reporting systems. For each exchanged fact, the integration contract declares direction, source authority, update frequency, conflict policy, data classification and reconciliation owner. Synchronous APIs serve decisions needing immediate validation; asynchronous events and scheduled feeds serve propagation and reporting. Reporting projections can be rebuilt from authoritative records and events.

A relational transactional store is the initial system of record for the native core. Analytics may use separate read models. Modules may later be extracted into services behind the same contracts when there is a concrete operational need.

## Security, governance and assurance

Tenant isolation is enforced in identity, authorization, APIs, data access and integrations. Access uses least privilege and separation of duties for proposal, assessment, approval and administration. Governance rules support delegated authority, approval conditions, controlled exceptions and evidence capture. Changes to decisions and baselines must remain attributable and reviewable.

The platform should support encryption in transit and at rest, secrets management, audit logging, retention and disposal policies, backup/recovery, accessibility and operational monitoring. Regulated deployments must configure residency, records retention, export, privacy and public-sector assurance requirements for their jurisdiction and organisation. An audit log complements, rather than replaces, approval records and source provenance.

## MVP and phased roadmap

The **MVP** is a usable strategic decision loop: tenant and identity setup; M01 strategy/outcomes; M02 portfolio structure; M03 demand and business-case capture; M04 configurable prioritisation and scenario comparison; M05 approval and commitment recording; and M06 governance workflow, audit and immutable baselines. It includes essential API/event contracts, basic source registration and export, and portfolio/decision views sufficient to trace a choice end to end.

The next phase deepens integration and planning: ERP actuals, resource capacity, roadmaps and delivery status through M07–M10, with reconciliation and exceptions. A subsequent phase expands M11 benefits evidence and M12 analytics, including longitudinal outcome and investment performance. Advanced optimisation, richer scenario modelling and selective service extraction follow demonstrated user demand and operational scale.

These phases are capability intent, not committed dates. MVP acceptance should require a complete trace from objective through case, evaluation, approval and baseline, with authorized access and an auditable revision path.

## Design principles

- Keep one canonical identity and one declared write owner for every business record.
- Preserve the distinction between proposed, recommended, approved, committed and observed state.
- Make decisions explainable and approved states reproducible.
- Integrate specialist systems through contracts and provenance, avoiding shadow ownership.
- Keep module boundaries explicit inside the initial deployable unit.
- Configure policy differences by tenant without fragmenting the core domain model.
- Design for secure, accessible and auditable operation from the first release.

## Key decisions and assumptions

**Approved decisions:** hybrid product model; native M01–M06 strategic core; extensible M07–M12; shared identity, workflow, audit, integration and configuration services; initial modular monolith; API/event contracts; canonical model v0.3 with tenant-scoped composite keys, versioned governance decisions, immutable baselines, source authority and optional bitemporal history.

**Working assumptions to validate during detailed design:** exact entity and field names, the granularity of commitments and baselines, each tenant's system-of-record matrix, workflow/delegation policy, retention and residency requirements, and which M07–M12 capabilities will be native at launch. This document intentionally keeps those choices visible rather than treating them as implemented facts.
