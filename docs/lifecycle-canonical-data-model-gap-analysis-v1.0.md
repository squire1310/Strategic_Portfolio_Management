# Lifecycle-to-Canonical-Data-Model Gap Assessment v1.0

**Date:** 25 October 2026. **Status:** Proposed design review; no code/schema changes authorised.

**Compared:** [Lifecycle design](business-object-lifecycle-transition-model-v1.0.md), [canonical model v1.1](../reconciled-core/docs/canonical-domain-model-v1.1.md), [approved D01–D10](../reconciled-core/docs/domain-decisions-v1.0.md), [governance](business-rules-decision-rights-governance-v1.0.md), [Entra architecture](entra-identity-access-prototype-design-v1.0.md) against reconciled-core PostgreSQL migrations V001–V008, [decision-path implementation](../reconciled-core/docs/decision-path-implementation.md) and [validation](../reconciled-core/docs/validation.md).

## Executive finding

The native M01–M06 canonical model covers much of strategy, demand, selection and commitment identity. It does **not yet deliver all lifecycle journeys** or the complete approval/security obligations. Distinguish existing SQL enforcement from unbuilt services. This is a static code/document review, not a fresh database execution or production signoff.

**Severity:** Critical = production approval/security gate; High = core journey or invariant gap; Medium = operational/extension or design refinement. **State:** Partial = some implementation; Model only = canonical entity exists without physical schema; Proposed = ratification required; Unverified = code exists but no execution evidence.

## Gap register (22 findings)

| ID | Severity | Module | State | Observed issue | Recommended resolution | Basis |
|---|---|---|---|---|---|---|
| G01 | Critical | M05/M06 | Partial | Committee vote/quorum and full decision authority versus V006 limited checks | Versioned voting, attendance, recusal and mandate checks; fail-closed service | D04 |
| G02 | Critical | M05/M06 | Partial | Conditional decision exists; no proven condition fulfilment and commitment-release gate | Condition identity, predecessor/subsequent type, verifier, evidence, clearance and release guard | D04 |
| G03 | Critical | Platform | Missing | Entra OIDC and group access mapping not implemented; Increment 1 synthetic actor is not equivalent | Separate real identity adapter and production-disabled stub; group ID to permission mappings, revocation/freshness | D10 |
| G04 | Critical | M01-M06 | Partial | No complete versioned service transition matrices | Command services with role, state, row_version, audit and guard validation | D09 |
| G05 | Critical | M05 | Partial | Amendment envelope arithmetic, resulting total and typed unit semantics incomplete | Publish contract and arithmetic tests across effective periods and currencies | D05 |
| G06 | Critical | Platform | Partial | Broad trusted application SQL DML; no complete secure command perimeter | Enforce command-only write access and robust tenant/actor authorization; bypass tests | D10 |
| G07 | High | M03/M05 | Ambiguous | Negative formal decision before Investment exists conflicts with InvestmentDecision's Investment parent | Resolve candidate-first versus governed demand/case-decision entity | Design decision |
| G08 | High | Platform | Partial | Inbox/outbox not an agreed business task/handoff state machine | Scoped assignment, return, due-date, escalation and evidence-version handoffs | UX design |
| G09 | High | M03 | Partial | Returned for information not a native Demand state | Review task + successor CaseRevision; no mutation of submitted record | D07/D09 |
| G10 | High | M04 | Partial | Scoring/ranking and scenario locks present; constraints/override engine missing | Typed hard/soft/unknown constraints and authorised M05 override evidence | D02/D03 |
| G11 | High | M06 | Model only | v1.1 risk entities absent from migrations | Approve risk appetite rating contract and add forward-only migration, services and tests | Canonical v1.1 |
| G12 | High | M06 | Partial | Assurance action/finding/exception states and independent clearance not complete | Authoritative state matrix, finding closure and exception expiry routes | D09 |
| G13 | High | M06/M02 | Partial | Baseline snapshot checks exist but full valid-period portfolio scope not validated | Check entire interval and exact snapshot, including overlapping membership changes | D06 |
| G14 | High | M03-M05 | Partial | JSON snapshots exist without complete versioned evidence schemas and decision-pack contracts | Publish JSON Schemas, document hashes and controlled pack amendment policy | D07 |
| G15 | High | Platform | Partial | SourceIdentity, inbox/outbox exist; source-authority resolution/reconciliation incomplete | Typed registry, quarantining, idempotent retries and freshness display | D08/D10 |
| G16 | High | M05/M06 | Proposed | Cross-module approval, commitment and baseline effectuation/recovery undefined | Atomic local changes or durable saga with idempotency and truthful pending state | Architecture |
| G17 | Medium | M01/M02 | Partial | Effective-dated revision and retirement impact rules incomplete | Impact preview, retention of historical links, successor ownership | D09 |
| G18 | Medium | M01 | Unverified | V008 source adds measure retirement and observation voiding; validation record does not certify V008 | Run V008 on clean PostgreSQL and extend smoke/RLS/audit tests | V008 |
| G19 | Medium | M04 | Partial | Assessment void with immutable completed content needs explicit successor/void semantics | Versioned void disposition, reason and successor link | D09 |
| G20 | Medium | M01/M11 | Extension | Benefit monitoring continuity beyond delivery closure dependent on optional M11 | Define native outcome vs optional benefit source contract and persistent ownership | Hybrid architecture |
| G21 | Medium | Platform/M06 | Proposed | Policy precedence, effective versions and conflict handling not fully implemented | Tenant governance policy versions, deny ambiguity, sensitive config approval | Governance model |
| G22 | Medium | Cross-cutting | Projection | UX state names exceed persisted canonical lifecycle vocabulary | Derive status from case, assessment, decision, conditions, sync; no new columns without approval | Lifecycle design |

## Verified repository facts

- Canonical v1.1 owns M01 Strategy/Outcomes, M02 Portfolio Architecture, M03 Demand/Cases, M04 Selection, M05 Decisions/Commitments and M06 Governance/Risk; M07–M12 are optional or integrated extensions.
- M03 CaseRevision and M04 recommendations are immutable; models and scenarios lock appropriately; the canonical Investment lifecycle is candidate/approved/active/paused/closed/cancelled. Do not persist UX labels like "ready for decision" or "sync pending" as Investment states without a ratified model change.
- V006 supplies normalised scoring, ranking, some SoD and monetary checks, and baseline constraints. The implementation document explicitly states that body quorum above one cannot presently use its single-approver path. This is deliberate fail-closed behaviour, not evidence of working committee voting.
- The validation record covers earlier migrations and explicitly lists missing committee quorum, conditions, scenario constraints, amendment arithmetic, JSON contracts, full-period scope, external identity and complete transitions.
- V008 is in source with measure retirement and observation void provisions, but its execution is **not proven** by the inspected validation record.
- RiskAppetiteVersion, InvestmentRisk, RiskAssessment and RiskDisposition are described in canonical v1.1 but no corresponding CREATE TABLE migration was found in the reviewed schema set.
- The root-level inferred schema is historical; the reconciled-core migrations remain the candidate baseline.

## Resolution patterns

### Service-level resolution preferred (no new canonical states by default)
Returned proposals should create review tasks and new immutable CaseRevisions, not revert a submitted revision. Decision-pending, condition-blocked and sync-pending are composed user-facing process statuses. Active strategy updates preserve prior versions. Scenario unknown constraints require explicit typed evaluation, not assumptions of zero demand or available capacity.

### Changes requiring model approval before forward migration
Define condition satisfaction/verification ownership across M05/M06; persist voting/attendance/recusal evidence where required; settle candidate-investment-first versus formal pre-investment negative determinations; design cross-role work-item records; map Entra groups into scoped application permissions with a test-only adapter; implement the v1.1 risk tables after appetite/rating contract signoff.

### Security invariants
For each command validate verified principal, tenant membership, Entra group-derived functional entitlement (or synthetic stub), scoped business assignment, row_version and transition policy. For formal decision check accountable chair/delegation, independence, eligible quorum, mandate, total resulting envelope/currency and evidence. No frontend claim or raw group membership is formal approval. Do not grant native M05 write authority to external integration feeds.

## Suggested product decisions

| Ref | Design decision required | Recommendation |
|---|---|---|
| C01 | Formal rejection before Investment exists | Decide candidate-first vs separate case-decision object; avoid inconsistent foreign keys |
| C02 | Owner of condition fulfilment | Assign one canonical owner and auditable independent verification |
| C03 | Cross-role handoff state | Shared Platform task records referencing module objects |
| C04 | Entra membership projection | Stable group object ID/app-role mappings; separate delegated authority |
| C05 | Committee deliberation | Immutable vote/attendance/recusal evidence under versioned quorum policy |
| C06 | Cross-module effectuation | Atomic core transaction where feasible; durable outbox to external systems |
| C07 | Risk migration | Approve appetite scoring and authority before implementing v1.1 tables |
| C08 | Journey statuses | Derived read projections, not duplicate canonical lifecycle columns |

## Delivery sequence (proposed, not approved scope)

1. **Security and governance gates:** G01–G06, including Entra/stub architecture, approval independence, conditions, command enforcement and envelope integrity.
2. **Decision and evidence consistency:** G07, G13–G16, including rejection representation, full baseline scope, JSON contracts and reliable effectuation.
3. **Journey orchestration:** G08–G10, G15, G19 and G22, including return/resubmit, reviewer handoffs, constraints and truthful derived statuses.
4. **Governance and risk:** G11–G12 and G21, with schema migration and verified policy.
5. **Supporting capabilities:** G17–G18 and G20.

Keep the previously agreed Increment 1 (US-001–US-004) build scope as-is until sequencing is explicitly reviewed.

## Verification and exit criteria

- Clean PostgreSQL 16 migration through V008 with CI and RLS regression tests.
- Server-side denial tests for identity, tenant membership, scoped permission, delegation, self-approval, expired delegation, quorum, missing conditions and stale object version.
- J02→J03→J05 normal, returned, conditional and rejected case tests retaining complete evidence lineage.
- D05 total resulting envelope and D06 full-period snapshot checks.
- Integration contract tests for source authority, inbox deduplication/outbox replay, quarantine and accurate sync status.
- Risk-specific tests for exact approved appetite version and independent disposition once its schema is approved.
- Architecture review of C01–C08 and explicit approved backlog before migrations or application work.

**Disposition:** Gap analysis ready for review. No model, database or application change is authorised by this document.
