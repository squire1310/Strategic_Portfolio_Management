# Prioritised Implementation Backlog — v1.0

**Prepared:** 25 October 2026  
**Status:** Proposed implementation plan for review; **not authorisation to build or migrate**.  
**Scope:** SPM hybrid architecture, existing Increment 1 plus sequenced core and optional extensions.

**Governing sources:** [D01–D10](../reconciled-core/docs/domain-decisions-v1.0.md), [approved C01–C08](../docs/domain-design-reconciliation-decisions-v1.0.md), [lifecycle gap assessment](../docs/lifecycle-canonical-data-model-gap-analysis-v1.0.md), [Entra adapter design](../docs/entra-identity-access-prototype-design-v1.0.md), [user journeys](../docs/user-journey-catalogue-v1.0.md), [Increment 1](build-increment-1.md).

## Principles and scope controls

1. Preserve the existing product-owner-selected **US-001–US-004 Increment 1**; this backlog extends it, and does not retroactively change its original acceptance criteria or suggest it has production-grade identity.
2. Distinguish **technical priority** (P0 release-blocking security/integrity; P1 core workflow; P2 extension/operating improvement) from **execution order**. For example B010 is P0 but depends on the foundational work.
3. Design decisions C01–C08 are approved; detailed migrations, service contracts, budget, staffing, release dates and tenant policy settings are not.
4. The prototype identity provider must be impossible to enable in production. Production Entra integrations depend on IAM information and the real tenant; prototype delivery need not.
5. No production approval flow may ship until D04/D05/D06/D07/D09/D10 control tests pass, including quorum and condition verification. A simulated demo decision is not legal financial authority.
6. Preserve M01–M06 write ownership and optional M07–M12 boundaries; follow forward-only migration and full regression practices.

## Implementation backlog

| ID | Wave | Priority | Owning boundary | Item | Design decisions | Gap mapping | Dependencies |
|---|---|---|---|---|---|---|---|
| B001 | Foundation | P0 | Platform | Entra-compatible identity adapter and isolated prototype provider | C04 | G03 | None |
| B002 | Foundation | P0 | Platform | Security-group/app-role entitlement mapping and scoped permissions | C04 | G03 G06 | B001 |
| B003 | Foundation | P0 | Platform + M01–M06 | Module command boundary and transition guards | C08 | G04 G06 | B002 |
| B004 | Foundation | P0 | Reconciled core | PostgreSQL migration and regression baseline through V008 | D09 | G18 | None |
| B005 | Core workflow | P1 | Platform | Scoped work items, reassignment, escalation and inbox projections | C03 | G08 G09 G22 | B002 B003 |
| B006 | Core workflow | P1 | M03 | Proposal submission, controlled case revisions, return and resubmit | C01 C03 | G09 G14 | B003 B005 |
| B007 | Core workflow | P1 | M03/M05 | Candidate investment promotion and formal rejection semantics | C01 | G07 | B006 |
| B008 | Assessment | P1 | M04 | Independent assessments, scoring and selection recommendations | D02 C03 | G10 G19 | B006 B005 |
| B009 | Assessment | P1 | M04 | Scenario constraints and override contracts | D03 | G10 | B008 |
| B010 | Decision | P0 | M06 | Committee mandate, quorum, conflicts, vote evidence | C05 | G01 | B003 |
| B011 | Decision | P0 | M05 | Authorised investment decision service with immutable evidence | C01 C05 | G01 G14 | B007 B008 B010 |
| B012 | Decision | P0 | M05 | Conditional decision obligations and verification | C02 | G02 | B011 B005 |
| B013 | Decision | P0 | M05 | Commitment effectuation and amendment envelope calculation | C02 C06 | G05 G16 | B011 B012 |
| B014 | Decision | P1 | M06/M02 | Baseline succession and full-period portfolio validity | C06 | G13 | B013 |
| B015 | Platform | P1 | Platform + M03–M06 | Versioned evidence schema and controlled pack publishing | D07 C05 | G14 | B006 B008 B010 |
| B016 | Integration | P1 | Platform/M05/M06 | Transactional core choreography and durable outbox reconciliation | C06 | G15 G16 | B011 B013 B014 |
| B017 | Governance | P1 | M06 | Assurance findings, governance actions and expiring exceptions | D09 | G12 G21 | B003 B005 |
| B018 | Governance | P1 | M06 | Strategic risk v1.1 contract and migration | C07 | G11 | B004 B017 |
| B019 | Operating model | P2 | Platform/M06 | Tenant policy precedence, mandate and approval configuration | C04 C05 | G21 | B002 B010 |
| B020 | Lifecycle | P2 | M01/M02 | Effective-dated retirement, impact preview and owner reassignment | D09 | G17 G18 | B004 B003 |
| B021 | Value | P2 | M01/M11 optional | Benefits continuity and measurement source contract | C08 | G20 | B016 |
| B022 | Experience | P1 | Platform read models | Derived lifecycle and permission-aware journey status | C08 | G22 | B005 B006 B011 B012 B016 |

## Detailed item acceptance, interfaces and outcomes

### B001 — Entra-compatible identity adapter and isolated prototype provider

**Priority:** P0 · **Boundary:** Platform · **Depends on:** None · **Traceability:** C04; gaps G03.

**Implementation contract:** Environment-locked prototype provider; trusted principal/session, no arbitrary actor header; issuer/subject interface.

**Minimum automated acceptance:** Provider switch rejects prod stub; forged identity denied; synthetic sign-in tests.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B002 — Security-group/app-role entitlement mapping and scoped permissions

**Priority:** P0 · **Boundary:** Platform · **Depends on:** B001 · **Traceability:** C04; gaps G03 G06.

**Implementation contract:** Stable group IDs; tenant permission bundles; scope; membership expiry; deny on unknown.

**Minimum automated acceptance:** Missing group, revocation and wrong-tenant tests; no admin-as-approver.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B003 — Module command boundary and transition guards

**Priority:** P0 · **Boundary:** Platform + M01–M06 · **Depends on:** B002 · **Traceability:** C08; gaps G04 G06.

**Implementation contract:** Authenticated command service, expected row_version, audit, state matrix per module.

**Minimum automated acceptance:** Reject direct untrusted writes, stale state and invalid transition.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B004 — PostgreSQL migration and regression baseline through V008

**Priority:** P0 · **Boundary:** Reconciled core · **Depends on:** None · **Traceability:** D09; gaps G18.

**Implementation contract:** Clean PG16 CI, V001–V008 migration verification, RLS and history regressions.

**Minimum automated acceptance:** Document CI outcome for V008, retained data and migration rollback strategy.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B005 — Scoped work items, reassignment, escalation and inbox projections

**Priority:** P1 · **Boundary:** Platform · **Depends on:** B002 B003 · **Traceability:** C03; gaps G08 G09 G22.

**Implementation contract:** Business task identity/status with object reference, evidence version, action, due date and audit.

**Minimum automated acceptance:** Work item completion cannot bypass permission or own-domain transition.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B006 — Proposal submission, controlled case revisions, return and resubmit

**Priority:** P1 · **Boundary:** M03 · **Depends on:** B003 B005 · **Traceability:** C01 C03; gaps G09 G14.

**Implementation contract:** Draft/submit; frozen CaseRevision; intake decision; targeted correction and successor revision.

**Minimum automated acceptance:** T02 returned proposal preserves old case, tracks feedback and version diff.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B007 — Candidate investment promotion and formal rejection semantics

**Priority:** P1 · **Boundary:** M03/M05 · **Depends on:** B006 · **Traceability:** C01; gaps G07.

**Implementation contract:** At most one investment per demand; distinguish M03 intake rejection from M05 formal refusal.

**Minimum automated acceptance:** Reject before formal gate without commitment; committee refusal recorded against candidate.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B008 — Independent assessments, scoring and selection recommendations

**Priority:** P1 · **Boundary:** M04 · **Depends on:** B006 B005 · **Traceability:** D02 C03; gaps G10 G19.

**Implementation contract:** Reviewer assignments, complete scores, frozen assessment evidence, tied ranks, void/successor.

**Minimum automated acceptance:** No incomplete assessment; tied rank keeps rationale; previous evidence immutable.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B009 — Scenario constraints and override contracts

**Priority:** P1 · **Boundary:** M04 · **Depends on:** B008 · **Traceability:** D03; gaps G10.

**Implementation contract:** Typed hard/soft/unknown constraint snapshots, exception request for M05 authority.

**Minimum automated acceptance:** Unknown capacity not zero; hard breach blocks auto-select; override auditable.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B010 — Committee mandate, quorum, conflicts, vote evidence

**Priority:** P0 · **Boundary:** M06 · **Depends on:** B003 · **Traceability:** C05; gaps G01.

**Implementation contract:** Decision sessions, attendance, eligibility, vote/recusal snapshot, chair validation.

**Minimum automated acceptance:** Invalid quorum and conflict deny approval; valid mandate frozen.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B011 — Authorised investment decision service with immutable evidence

**Priority:** P0 · **Boundary:** M05 · **Depends on:** B007 B008 B010 · **Traceability:** C01 C05; gaps G01 G14.

**Implementation contract:** Formal determination, exact case/recommendation snapshots, independence/amount/authority checks.

**Minimum automated acceptance:** No self-approval, expired delegation, wrong currency, stale evidence.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B012 — Conditional decision obligations and verification

**Priority:** P0 · **Boundary:** M05 · **Depends on:** B011 B005 · **Traceability:** C02; gaps G02.

**Implementation contract:** Precedent/subsequent condition objects; independent verification and evidence.

**Minimum automated acceptance:** Uncleared precedent prevents commitment release; subsequent condition monitored.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B013 — Commitment effectuation and amendment envelope calculation

**Priority:** P0 · **Boundary:** M05 · **Depends on:** B011 B012 · **Traceability:** C02 C06; gaps G05 G16.

**Implementation contract:** Nonnegative total resulting envelopes, currency/period/unit checks, guarded effectuation.

**Minimum automated acceptance:** Amendment limit uses resulting envelope, no duplicate or negative commitment.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B014 — Baseline succession and full-period portfolio validity

**Priority:** P1 · **Boundary:** M06/M02 · **Depends on:** B013 · **Traceability:** C06; gaps G13.

**Implementation contract:** Exact version snapshots and interval scope checks; separate approval boundary.

**Minimum automated acceptance:** Reject partial overlap or membership not valid for required interval.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B015 — Versioned evidence schema and controlled pack publishing

**Priority:** P1 · **Boundary:** Platform + M03–M06 · **Depends on:** B006 B008 B010 · **Traceability:** D07 C05; gaps G14.

**Implementation contract:** JSON contracts, hashes, provenance, pack publication/amendments.

**Minimum automated acceptance:** Changed evidence requires explicit revised pack; decision retains old basis.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B016 — Transactional core choreography and durable outbox reconciliation

**Priority:** P1 · **Boundary:** Platform/M05/M06 · **Depends on:** B011 B013 B014 · **Traceability:** C06; gaps G15 G16.

**Implementation contract:** Native transaction sequence, correlation/idempotency, source identity mapping, retry/failed state.

**Minimum automated acceptance:** Replay no duplicate, external failure shown pending without rewriting approvals.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B017 — Assurance findings, governance actions and expiring exceptions

**Priority:** P1 · **Boundary:** M06 · **Depends on:** B003 B005 · **Traceability:** D09; gaps G12 G21.

**Implementation contract:** Controlled finding, verification, risk acceptance and exception expiry.

**Minimum automated acceptance:** Expired exception stops authority; closure records independent evidence.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B018 — Strategic risk v1.1 contract and migration

**Priority:** P1 · **Boundary:** M06 · **Depends on:** B004 B017 · **Traceability:** C07; gaps G11.

**Implementation contract:** Appetite scoring version, tenant/portfolio scope, risk assessment/disposition schema.

**Minimum automated acceptance:** Final risk assessment immutable; outside appetite remains unresolved until disposition.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B019 — Tenant policy precedence, mandate and approval configuration

**Priority:** P2 · **Boundary:** Platform/M06 · **Depends on:** B002 B010 · **Traceability:** C04 C05; gaps G21.

**Implementation contract:** Policy version selection, conflict denial, two-person sensitive configuration review.

**Minimum automated acceptance:** Ambiguous authority policy denies; effective historical policy retained.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B020 — Effective-dated retirement, impact preview and owner reassignment

**Priority:** P2 · **Boundary:** M01/M02 · **Depends on:** B004 B003 · **Traceability:** D09; gaps G17 G18.

**Implementation contract:** Measures and observations retirement/void tests, strategy/portfolio dependency checks.

**Minimum automated acceptance:** Archived links preserved; no invalid new memberships.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B021 — Benefits continuity and measurement source contract

**Priority:** P2 · **Boundary:** M01/M11 optional · **Depends on:** B016 · **Traceability:** C08; gaps G20.

**Implementation contract:** Post-delivery benefits ownership, outcome observation provenance and optional source integration.

**Minimum automated acceptance:** Closure does not terminate benefits monitoring.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

### B022 — Derived lifecycle and permission-aware journey status

**Priority:** P1 · **Boundary:** Platform read models · **Depends on:** B005 B006 B011 B012 B016 · **Traceability:** C08; gaps G22.

**Implementation contract:** Compose case, task, decision, conditions and sync status without duplicate canonical states.

**Minimum automated acceptance:** UI/API never label pending integration as synced or condition-blocked as released.

**Definition of done:** approved technical contract; owner-reviewed forward-only migrations if needed; command/API permission checks; positive/negative tests; module ownership and tenant isolation evidence; relevant product and architecture documentation updated. Existing CI and approved behaviour must remain intact.

## Delivery milestones and exit gates

| Milestone | Included backbone | Demonstration | Gate |
|---|---|---|---|
| M0 — Reconciled baseline | B004 plus confirmation of existing Increment 1 | Proven migrations, RLS and existing strategic work | Clean PostgreSQL/CI evidence and no regression |
| M1 — Secure local prototype foundation | B001 B002 B003 B005 | Synthetic Entra-like users and scoped tasks with real SPM guards | Spoofed user/group blocked; prototype provider disabled in production |
| M2 — Proposal and assessment vertical slice | B006 B007 B008 B015 plus basic B022 | Create, return and resubmit case; review, score and recommend | Immutable evidence; correct permissions and handoffs |
| M3 — Governed investment decisions | B010 B011 B012 B013 B014 B016 | Approve/reject/defer/condition; verified release; baseline and integration status | Authority, quorum, SoD, amounts, conditions, lineage and idempotency tested |
| M4 — Portfolio governance expansion | B009 B017 B018 B019 B020 B021 plus completion B022 | Scenario exceptions, strategic risks, policy profiles, long-term value | Policy/risk/source contracts validated; no canonical duplication |

Milestone order is proposed and cross-dependencies are authoritative; a foundational service may need earlier work than the presentation order. M1/M2 remain test or prototype capabilities until M3 controls are verified. Public sector compliance requires separate tenant policy and organisational acceptance.

## Candidate schema and non-schema change register

| Candidate | Boundary | Expected approach | Prior approval needed |
|---|---|---|---|
| Entra external principal and group/app-role mapping | Platform | Reuse TenantMember/Principal; add stable external binding and mapping as required | IAM model / migration review |
| Work item lifecycle and handoff | Platform | New/reused task table(s), references to module owner, assignment and audit | Workflow contract |
| Governance participation and voting | M06 | DecisionSession, attendee, declaration, vote evidence with snapshot | Mandate/quorum policy and migration |
| Decision conditions and verification | M05 | Condition and verification event, linking decisions and guarded effectuation | Data contract, independence policy |
| Typed case/assessment/pack evidence | M03/M04/M05 | JSON Schemas and versioned manifest; minimal new storage if existing revisions suffice | Evidence contract approval |
| Calculated commitment amendments | M05 | Prefer service calculation plus persist approved amendment facts; SQL constraints where feasible | Finance calculation policy |
| Baseline interval/scope | M06/M02 | Service validation using current canonical references; add indexing only if justified | Full-period interpretation |
| Risk v1.1 entities | M06 | Forward migration after appetite approval | Risk-rating and RLS design |
| Derived journey status | Read model | Projection, not new Investment lifecycle columns | Query projection contract |
| Source reconciliation | Platform | Extend typed source maps and inbox/outbox semantics | Integration and retention contract |

**Never edit already deployed migrations.** Verify current schema (including V008) against actual PostgreSQL CI before drafting V009+.

## Proposed release-level acceptance suite

- **AUTH:** valid Entra-compatible identity/prototype fixture, invalid group claim, wrong tenant, access removal, group spoofing, admin without approval.
- **LIFE:** legal versus illegal state transition, stale row_version, versioned revisions, permanent submitted evidence.
- **GOV:** independent accountable approver, committee recusal/quorum, correct delegated scope/currency and total financial envelope, condition verification.
- **EVID:** exact CaseRevision/Assessment/Scenario/Recommendation/pack references and document hashes.
- **FIN:** no negative envelope; period/unit consistency; amendment lineage and limits.
- **BASE:** matching item version, same interval succession, full-period portfolio scope.
- **INTEG:** replay idempotency, rejected source overwrite, quarantine on identity conflict, failed external sync shown accurately.
- **FLOW:** J02→J03→J05 straight approval, return, conditional, rejection, escalation; J01/J06/J07 baseline retention.
- **OPS:** clean migration through V008 then any approved V009+, audit, backup/restore and tenant policy readiness.

## Dependencies and decisions outside engineering

- IAM confirms Entra app-registration ownership, claims/app role approach, group overage, nested membership, guest and service principals, Conditional Access, and refresh/revocation policy.
- Governance owners confirm committee mandates, quorum, votes, authorised decision makers and formal records policy.
- Finance confirms envelope effective-period semantics, currency/limit handling, approvals and amendments.
- Assurance confirms verifier independence, risk tolerance scoring and exception expiry.
- Architecture confirms persistence reuse, per-module APIs, source authority and transaction/outbox boundary.
- Product decides release scope and staffing separately; prioritisation here is not a sprint allocation.

## Definition of ready for implementation

An item is ready only if: accountable engineering owner allocated; source decision/gap traced; authoritative domain entity and module write owner identified; schema change reviewed; command preconditions and denial codes specified; CI automated tests designed; prototype-versus-production security limits stated; and the work does not silently expand Increment 1.

**Next planning task:** review this backlog, ratify specific work items for the next increment, allocate ownership, and prepare individual technical change specifications. No application or database mutations are authorised by this document.
