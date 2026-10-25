# Strategic Portfolio Management — solution overview

**Version:** 1.2 · **Status:** Target solution overview aligned to the approved hybrid architecture, [canonical domain model v1.1](../reconciled-core/docs/canonical-domain-model-v1.1.md) and [domain decisions D01–D10](../reconciled-core/docs/domain-decisions-v1.0.md)  
**Audience:** Product, enterprise architecture, delivery, security, finance and governance stakeholders  
**Scope:** Target architecture and phased product direction, assessed against the [user stories](../requirements/user-stories.md), [functional requirements](../requirements/functional-requirements.md) and [non-functional requirements](../requirements/non-functional-requirements.md) on 24 October 2026. Requirements are proposed for product review unless supported by D01–D10. This document does not certify production readiness.

The [proposed logical architecture](logical-architecture.md) details component responsibilities, module ownership, contracts, interaction paths and open architecture decisions.

## Executive summary

Strategic Portfolio Management (SPM) gives large enterprises and public sector organisations one governed path from strategy and demand to investment choice, commitment, delivery oversight and benefits evidence. The product connects outcomes, portfolios, proposals, decisions and approved plans so leaders can explain what they chose, why, on whose authority, and what changed afterward.

The approved **hybrid** architecture makes the strategic decision core native to SPM: M01–M06 own strategic intent, portfolio structure, demand, prioritisation, investment commitments and governance records. Finance, resources, roadmaps, delivery, benefits and analytics (M07–M12) are extensible capabilities. They can be implemented natively, integrated from established systems, or combined according to a tenant's source-of-authority policy. This supports end-to-end management without requiring every organisation to replace its ERP, workforce or delivery tools.

The initial deployment is a modular monolith with explicit module ownership, versioned APIs and published event contracts. This limits operational complexity while preserving a route to separate services when scale, release cadence or ownership justify it. A PostgreSQL core schema and validation record exist; application services and operating controls still have [tracked release gaps](https://github.com/squire1310/Strategic_Portfolio_Management/issues/4).

## Objectives and users

The solution aims to:

- Turn strategy and desired outcomes into comparable, traceable investment choices.
- Give decision makers a defensible record of scoring, trade-offs, approvals, commitments and exceptions.
- Maintain a current portfolio view while preserving the exact approved baseline behind each decision.
- Reconcile evidence from authoritative external systems without losing provenance.
- Support enterprise and public sector needs for tenant isolation, role-based access, auditability, accessibility, retention and assurance.

Primary users include strategy leaders, portfolio and programme offices, demand sponsors, case owners, assessors, investment committee chairs and members, finance and resource planners, delivery leaders, benefits owners, assurance leads, auditors and executives. Tenant administrators configure membership and approved operating policy; integration operators manage source identities and message reconciliation. Public sector deployments may additionally require external approval routes, transparency and records-management controls. The [31 role-based stories](../requirements/user-stories.md) define the corresponding user journeys.

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
| **M03 Demand & Business Cases** | Demand, objective alignment, business cases and immutable submitted revisions | Owns intake and case evidence. The proposed case contract covers the case for change, business-as-usual comparator, proportionate options and five case sections; document binaries remain in a document service. |
| **M04 Prioritisation & Selection** | Versioned scoring models and rubrics, assessments, locked scenarios, rankings and immutable recommendations | Owns comparative evaluation; an evidenced override proposal remains distinct from an M05 approval. |
| **M05 Investment Decisions & Commitments** | Investment decisions, approved funding/capacity envelopes, conditions, commitment changes and decision lineage | Owns the authoritative investment approval and commitment record; transactional finance remains with its designated source. |
| **M06 Governance & Assurance** | Governance bodies, gates, delegations, assurance findings, exceptions, actions, strategic investment risks, approved appetite and baselines | Owns the controlled decision process, strategic risk register, authority evidence and immutable approved snapshots. Risk entities are in model v1.1 but not yet in SQL. |
| **M07 Finance** | Budgets, forecasts, actuals and financial views | Extensible; ERP is typically authoritative for posted actuals, while SPM may own portfolio planning scenarios. |
| **M08 Resources** | Capacity, demand, allocations and skills views | Extensible; workforce systems may own people and supply facts. |
| **M09 Roadmaps** | Time-phased milestones, dependencies and portfolio roadmaps | Extensible; coordinates plans across investments and external schedules. |
| **M10 Delivery** | Delivery status, milestones, risks and execution links | Extensible; specialist PPM or agile tools may own detailed work items. |
| **M11 Benefits** | Benefit plans, owners, forecasts, observations and realisation evidence | Extensible; outcome measures remain linked to M01. |
| **M12 Analytics** | Cross-module reporting, scorecards, trend and scenario views | Read-oriented projections; source modules retain write authority. |

The first six modules form the native strategic core. M07–M12 use the same contracts and canonical identities, but their deployment and ownership mode are chosen per capability and tenant.

### Shared platform services

Identity and access manages principals, tenant membership, roles and permissions, with enterprise identity federation as the production target. The first non-production build has no external identity provider; any internet-facing route without application authentication is limited to synthetic, non-sensitive demonstration content. Tenant commands still require a trusted actor and active membership. Each command checks membership and sets transaction-local tenant and actor context. Workflow coordinates submission, review, gate and approval states without becoming the owner of business facts. The platform owns entity revisions, append-only audit, transactional outbox, idempotent inbox, source-system registration and typed external identity mapping. Configuration versions tenant policy, source authority, reference data and lifecycle rules. Document references and checksums, notifications, observability and reporting projections support these services; they do not take ownership of source facts. [FR-038–FR-045](../requirements/functional-requirements.md#essential-platform-and-cross-module-views) set out the proposed application behaviour.

## Module ownership and interaction rules

Each record has one write-owning module. Other modules refer to its canonical identifier or consume a published read model; they do not directly update its tables. Cross-module commands go through application contracts that enforce authorization and lifecycle rules. Within the modular monolith, database transactions can preserve consistency for a single command, but the module API remains the stable boundary.

A demand can be promoted into a canonical investment without erasing its originating case. M04 produces an evaluated recommendation; M05 records the authorised choice and commitment; M06 preserves the governance evidence and approved state. Later forecasts, delivery reports and benefits observations are compared with that state, not used to rewrite it. M07–M11 supply plans and facts under explicit source-authority rules. M12 projects them for analysis.

The proposed [functional requirements](../requirements/functional-requirements.md) make the decision path more precise:

1. **Define and appraise:** M01 establishes objectives, outcomes and measures. M02 records portfolio structure and strategic contribution. M03 accepts demand and preserves exact submitted case revisions, with business-as-usual, options, assumptions, costs, benefits, risks and proportionate five case evidence (FR-001–FR-016).
2. **Compare:** M04 evaluates demand or an existing investment against an immutable active scoring model. D02 fixes the comparable score as `100 × Σ(weight × score / maximum_score)` using unrounded results for ordering; exact ties share rank. A locked scenario freezes candidates and constraints. Missing funding, capacity or dependency evidence is unknown, and a hard-constraint breach cannot silently create a selection recommendation (FR-017–FR-022).
3. **Authorise and commit:** M05 promotes accepted demand once, records a decision against frozen evidence and creates approved envelopes only under an effective mandate. Amendments carry later approval and preserve the original commitment; forecasts and actuals remain separate (FR-023–FR-029).
4. **Assure and baseline:** M06 records bodies, delegations, votes, gates, findings, exceptions, strategic investment risks, appetite versions and approved snapshots. FR-032–FR-033 are modelled in v1.1; the risk entities still need a reviewed physical schema and service contracts. Approved baselines retain the exact items and versions authorised at a decision point (FR-030–FR-037).

## Conceptual data model

The current [canonical model v1.1](../reconciled-core/docs/canonical-domain-model-v1.1.md) is the logical contract for the strategic core and platform. The principal concepts and relationships are:

- A **tenant** contains its portfolios, strategies, demand, investments, decisions and configuration. A principal may have tenant-specific memberships and roles.
- A **strategy** defines objectives and outcomes; measures and dated observations evidence progress. Portfolios and demand link to objectives to state intended contribution, while investments retain their demand origin and portfolio membership.
- A **portfolio** can form a hierarchy and contain time-bounded investment memberships. An **investment** has a stable canonical identity, including when execution is tracked elsewhere.
- A **demand** and its versioned business case describe an opportunity and alternatives. Submitted case revisions freeze the evidence used for appraisal. Assessments and scenarios compare eligible demand and existing investments against governed criteria.
- A **selection recommendation** informs an **investment decision**. Decisions record authority, rationale, conditions, effective state and links to superseding decisions or amendments.
- A **commitment** expresses the authorised funding, capacity, scope or timing envelope. A **baseline** freezes the approved portfolio or investment state at a governance point.
- A **source system** and external identity map connect external facts to canonical records. Source metadata identifies provenance and the authority for each field or fact.

Tenant-owned entities use tenant-scoped composite keys, such as `(tenant_id, entity_id)`, and cross-entity references carry the tenant key. This makes tenant boundaries explicit in persistence and queries. Business identifiers can remain human-readable while canonical identifiers stay stable.

Governance decisions are append-only with explicit supersession lineage. Approved baselines are immutable item/version snapshots with both business-valid and recorded-time intervals. Under D06, a successor replaces the **exact same** business-valid interval and closes the predecessor's recorded interval; partial overlap is rejected in the initial release. Mutable records use optimistic `row_version` checks, entity revisions and audit history. Submitted cases, completed assessments, recommendations, decisions and commitments use explicit successor or amendment records instead of in-place correction. [D02–D09](../reconciled-core/docs/domain-decisions-v1.0.md) define the frozen scoring, evidence, authority and baseline rules.

The [PostgreSQL migrations](../reconciled-core/migrations/) map this model to an initial physical schema; the [data dictionary](../reconciled-core/docs/data-dictionary.md) and [validation record](../reconciled-core/docs/validation.md) describe its tested scope. A table or database constraint alone does not demonstrate that the required application behaviour or service quality is implemented.

## Integration and deployment patterns

The modular monolith exposes versioned command/query APIs for user interfaces and integrations. It publishes domain events for material lifecycle changes, such as demand submitted, assessment completed, investment approved, commitment amended and baseline approved. Events identify tenant, aggregate, version, occurrence time and correlation, and are emitted through a transactional outbox. Consumers process them idempotently; an inbox and external identity map help deduplicate inbound messages.

Adapters integrate enterprise identity, ERP, workforce, delivery, document and reporting systems. For each exchanged fact, the integration contract declares direction, source authority, update frequency, conflict policy, data classification and reconciliation owner. Synchronous APIs serve decisions needing immediate validation; asynchronous events and scheduled feeds serve propagation and reporting. Reporting projections can be rebuilt from authoritative records and events.

An external key maps to one tenant-owned canonical identity. A conflicting reuse is quarantined, not treated as a new owner or a silent overwrite. Inbound retries with the same key and payload are idempotent; reuse with different content is a reconciliation conflict. A business change and its outbox event commit atomically. Imported observations and execution facts never replace native approvals, commitments or approved baselines. These are the product policies in D08 and D10, with proposed application checks in [FR-041–FR-043](../requirements/functional-requirements.md#essential-platform-and-cross-module-views).

A relational transactional store is the initial system of record for the native core. Analytics may use separate read models. Modules may later be extracted into services behind the same contracts when there is a concrete operational need.

## Security, governance and assurance

Tenant isolation is enforced in identity, authorization, APIs, database row-level security, reports, exports and integrations. Access uses least privilege and separation of duties for sponsorship, case ownership, assessment, recommendation, approval and administration. An approval requires one accountable chair or effective delegate with the right scope, period, currency and resulting amount limit; where voting is configured, eligible distinct participants must meet quorum. A conditional approval cannot release a commitment until its conditions are evidenced as satisfied. The platform fails closed if required tenant mandates or operating settings are absent. Changes to decisions and baselines remain attributable and reviewable. D04 and D10 approve these rules; their full application enforcement is a release gap.

The platform design covers encryption in transit and at rest, secrets management, audit logging, records retention and lawful disposal, backup and tested recovery, accessibility, monitoring, support runbooks and secure release practice. The [38 proposed NFRs](../requirements/non-functional-requirements.md) define evidence for these qualities, including threat modelling, independent security testing, load and restore tests, supported browsers, observability, dependency management, data quality and sustainability. The accountable service owner must approve a service profile with tier, supported hours, availability, RTO, RPO, workload, support coverage, residency and retention before go-live. The public [Defra NFR catalogue](https://github.com/DEFRA/architecture/blob/main/nfrs/catalogue.yaml) and [service tiers](https://github.com/DEFRA/architecture/blob/main/nfrs/service-tiers.yaml) are draft; their numbers are candidate targets, and Defra's internal DDTS catalogue takes precedence for a Defra deployment. An audit log complements, rather than replaces, approval records and source provenance.

### Government guidance profile

The functional requirements draw on the [Green Book](https://www.gov.uk/government/publications/the-green-book--2/the-green-book-2026), [business case guidance](https://www.gov.uk/government/publications/guidance-on-developing-business-cases), [Orange Book](https://www.gov.uk/government/publications/orange-book/the-orange-book-management-of-risk-principles-and-concepts), [Magenta Book](https://www.gov.uk/government/publications/the-magenta-book), [Managing Public Money](https://www.gov.uk/government/publications/managing-public-money), [GovS 002](https://www.gov.uk/government/publications/project-delivery-functional-standard) and the [Treasury Approvals Process](https://www.gov.uk/government/publications/treasury-approvals-process-for-programmes-and-projects/treasury-approvals-process-for-projects-and-programmes). They inform proportionate cases, options appraisal, risk and assurance, delegated authority, evaluation and learning. These publications do not impose one approval route or numeric threshold on every SPM tenant.

The proposed UK profile configures relevant Treasury referral triggers, case stages, written external approvals and conditions for tenants to which those rules apply ([FR-053–FR-054](../requirements/functional-requirements.md#optional-planning-delivery-benefits-and-uk-government-profile)). The general product retains tenant-configured approval routes. Public-facing UK government channels may require additional design-system and accessibility controls; the current product overview does not assume that all SPM interfaces are public-facing.

## MVP and phased roadmap

The **Core MVP** is a usable strategic decision loop: tenant and identity setup; M01 strategy/outcomes; M02 portfolio structure; M03 demand and versioned business cases; M04 assessment and scenario comparison; M05 authorised decisions and commitments; and M06 governance, assurance and approved baselines. It includes tenant-scoped APIs, audit, inbox/outbox, source identities and a read-only decision view sufficient to trace a choice end to end. This scope corresponds to [US-001–US-025](../requirements/user-stories.md) and [FR-001–FR-045](../requirements/functional-requirements.md); the M06 risk-register proposals require model review before being committed to the MVP implementation baseline.

The next phase deepens integration and planning: ERP actuals, resource capacity, roadmaps and delivery status through M07–M10, with reconciliation and exceptions. A subsequent phase expands M11 benefits evidence and M12 analytics, including longitudinal outcome and investment performance. Advanced optimisation, richer scenario modelling and selective service extraction follow demonstrated user demand and operational scale.

These phases are capability intent, not committed dates. MVP acceptance requires a complete trace from objective through case, evaluation, approval, commitment and baseline; enforced independence and authority; reproducible historical evidence; tenant isolation; and an approved, evidenced service profile. Database migrations alone do not pass this acceptance gate.

## Assessment against the requirements folder

| Requirement area | Architecture response | Current gap or decision |
| --- | --- | --- |
| Strategy, portfolio and case appraisal (US-001–US-006; FR-001–FR-016) | M01–M03 own canonical records and frozen case revisions. Proposed case contracts add comparator, options and five case evidence. | Define and validate versioned case JSON Schemas and proportionate case templates; implement command workflows. |
| Scoring and selection (US-008–US-011; FR-017–FR-022) | M04 owns frozen models, complete assessments, constraints and recommendations under D02–D03. | Implement and independently test aggregate calculation, tie handling, constraint engine and evidenced override flow. |
| Authority and commitments (US-012–US-016; FR-023–FR-031) | M05 owns decisions/envelopes; M06 owns bodies, delegations and vote evidence under D04–D05. | Complete application checks for independence, amount/currency, quorum, conditions and resulting envelope arithmetic before real approvals. |
| Risk and assurance (US-017–US-019; FR-032–FR-037) | M06 owns gates, findings, exceptions, actions, strategic investment risks, appetite versions and immutable approved baselines in model v1.1. | Publish the risk rating/appetite contract and forward migration before implementing FR-032–FR-033. Baseline item/version validation also remains service work. |
| Platform and integration (US-020–US-025; FR-038–FR-045) | Tenant-scoped persistence, RLS, audit, revisions, inbox/outbox and source identities support traceability. | Implement an interim authenticated command path, then identity federation for production, plus policy setup, source-authority checks, historical read views and operating controls. |
| Extensions and UK profile (US-026–US-031; FR-046–FR-054) | M07–M12 remain optional native or integrated capabilities; UK approval routes are tenant configuration. | Set first tenant's source-authority matrix and applicability; design evaluation, benefit and Treasury-route contracts only for selected capability/profile. |
| Service qualities (SPM-NFR-001–038) | The NFR file assigns evidence and owners across resilience, performance, security, accessibility, operations, data and sustainability. | Approve tier and measurable targets; build test/monitoring evidence. Defra's public draft targets are not an approved service level. |

The [domain decisions](../reconciled-core/docs/domain-decisions-v1.0.md) and [implementation issue #4](https://github.com/squire1310/Strategic_Portfolio_Management/issues/4) remain the detailed record of release blockers. This assessment does not change D01–D10 or mark any proposed requirement as implemented.

## Design principles

- Keep one canonical identity and one declared write owner for every business record.
- Preserve the distinction between proposed, recommended, approved, committed and observed state.
- Make decisions explainable and approved states reproducible.
- Integrate specialist systems through contracts and provenance, avoiding shadow ownership.
- Keep module boundaries explicit inside the initial deployable unit.
- Configure policy differences by tenant without fragmenting the core domain model.
- Design for secure, accessible and auditable operation from the first release.

## Key decisions and assumptions

**Approved decisions:** hybrid product model; native M01–M06 strategic core; extensible M07–M12; shared platform services; initial modular monolith; API/event contracts; canonical model **v1.0** and D01–D10. The product owner subsequently directed model **v1.1** to include M06 strategic risks. The first build prioritises [US-001–US-004](../requirements/build-increment-1.md). These decisions fix tenant-scoped identities, single write ownership, comparable scoring, authority checks, append-only decisions and commitments, source authority, and bitemporal approved-baseline succession.

**Working assumptions to validate:** versioned case and envelope evidence contracts; the new M06 risk/appetite entities; each tenant's service tier, operating targets, source-of-authority matrix, workflow/delegation settings, records schedule and residency; and which M07–M12 capabilities are native at launch. UK-specific approval routes apply only where a tenant enables and validates the relevant profile. The requirements and this overview describe target behaviour, not a production-ready service.

## User roles and experience-design baseline (25 October 2026)

The product owner accepted seven design positions for a balanced multi-persona experience; see the [UX design decision record](ux-design-decisions.md). The [User Role and Persona Catalogue v1.0](user-role-persona-catalogue-v1.0.md) defines 18 business personas, six experience archetypes and six initial prototype anchors, separating persona needs from scoped permissions and delegated decision authority. The [End-to-End User Journey Catalogue v1.0](user-journey-catalogue-v1.0.md) defines J01–J11, cross-role handoffs, decision gates, exceptions and UX-001–UX-036 requirements.

These documents are design/research inputs, not claims of implemented capability. Their architecture references must use this document's authoritative M01–M06 native core and M07–M12 extensible boundaries. Any impacts on the domain schema, workflows or code require separate reconciliation and approval.

## Business governance and decision rights (25 October 2026)

The [Business Rules, Decision Rights and Governance Model v1.0](business-rules-decision-rights-governance-v1.0.md) defines proposed operational rules, formal authority checking, segregation of duties, condition clearance, escalation, governance profiles and acceptance criteria based on the approved D01–D10 domain decisions. It is a design document for review, not a declaration that these controls are implemented or that tenant legal delegations have been established.

## Entra ID and prototype access design (25 October 2026)

The organisation uses **Microsoft Entra ID and security groups** for application access. The [Entra identity and prototype stub design v1.0](entra-identity-access-prototype-design-v1.0.md) defines a production OIDC integration, group/app-role mapping to SPM permissions, independent scoped business roles and approval authorities, and an isolated synthetic identity provider for the prototype. No internal Entra access is assumed; no code, migration or live IAM configuration has been changed.

## Business object lifecycle design (25 October 2026)

[Business Object Lifecycle and State Transition Model v1.0](business-object-lifecycle-transition-model-v1.0.md) proposes M01–M06 state/command matrices, mandatory Entra-aware access and decision-authority guards, cross-object choreography, exceptions, 22 test cases, and 12 reconciliation issues. It observes approved D01–D10 and canonical model v1.1; proposed state refinements are **not ratified** and no implementation/schema changes follow automatically.

## Lifecycle-to-canonical-model gap assessment (25 October 2026)

[Gap Analysis v1.0](lifecycle-canonical-data-model-gap-analysis-v1.0.md) compares the proposed lifecycle transitions with canonical model v1.1 and reconciled-core migrations V001–V008. It identifies 22 severity-ranked gaps, existing V006 safeguards, the unverified execution status of V008 and the required architecture/product decisions before any migrations. This is an assessment only; no implementation work is authorised.

## Domain design reconciliation (25 October 2026)

The [Domain Design Reconciliation and Decision Record v1.0](domain-design-reconciliation-decisions-v1.0.md) proposes dispositions for C01–C08: pre-investment formal decisions, condition ownership, work-item handoffs, Entra entitlement mapping, committee evidence, cross-module effectuation, v1.1 strategic risk and derived UX states. **C01–C08 were approved as target design decisions on 25 October 2026**; approved D01–D10 and existing implementation scope remain unchanged.

## C01–C08 approval record (25 October 2026)

The product owner explicitly accepted all eight design reconciliation decisions. See the [ratified decision record](domain-design-reconciliation-decisions-v1.0.md). This approval establishes design direction, not tenant-specific legal delegation, implementation readiness or approval of database migrations.

## Proposed implementation backlog (25 October 2026)

The [prioritised implementation backlog v1.0](../requirements/implementation-backlog-v1.0.md) sequences 22 traced work items across secure prototype identity, proposal/assessment, formal governance/commitment and expansion. It preserves Increment 1 US-001–US-004 and requires separate work-item/migration approval. No code or schema changes follow from the backlog alone.

## Detailed proposed next increment

[Build Increment 2 — M0/M1 Identity and Authorisation Foundation](../requirements/build-increment-2-identity-foundation.md) scopes PostgreSQL V001–V008 verification and an Entra-compatible identity provider abstraction with prototype security groups and consistent server-side authorisation. The scope and implementation are not yet separately authorised.

## ServiceNow production access fulfilment (25 October 2026)

Production access requests and their administration will use the organisation's **ServiceNow catalogue**. Entra ID remains the authentication and security-group source, while SPM enforces effective permissions and its own scoped assignments. Do **not** implement an SPM production access-request portal. Confirm with IAM whether ServiceNow fulfilment updates only Entra groups, also calls an SPM scoped-assignment provisioning API, or follows a controlled manual process. Preserve synthetic fixture provisioning for prototype tests. See [identity architecture and ServiceNow division of responsibilities](../docs/entra-identity-access-prototype-design-v1.0.md). A catalogue approval is **not** delegated investment approval authority.
