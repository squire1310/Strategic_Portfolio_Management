# Proposed domain decisions for the hybrid SPM core

**Status:** Proposed for product-owner approval, 24 October 2026. This is a product baseline for a multi-tenant SPM application, not a tenant's delegation instrument or records schedule. Approval of this document would ratify domain policy; it would not claim that every policy is already enforced in the PostgreSQL candidate.

## D01 — Canonical model and ownership

Adopt the entity catalogue and single write-owner boundaries in `canonical-domain-model-v0.4-draft.md` as canonical model **v1.0** for the M01–M06 native core and essential platform. Retain stable `(tenant_id, id)` identities, tenant-local human codes, and explicit origin links from demand to investment. M07–M12 own their own facts when implemented and may not rewrite M01–M06 approvals. Changes after ratification require a versioned model change and migration review. The physical names in migrations V001–V005 are the initial persistence mapping.

## D02 — Comparable scoring

Each criterion has a weight in `[0,1]` and a maximum positive score. On activation, weights must total exactly 1. Assessors enter **higher-is-better** points using a published rubric for each criterion; a cost or risk criterion must describe its reverse scoring in that rubric. The comparable aggregate is `100 × sum(weight × score / maximum_score)`, rounded to two decimal places only for display. Store the unrounded result used for ordering and the model version, criterion scores, and evidence. A missing score blocks completion. Equal unrounded aggregates share a rank; the recommendation must record a reason for choosing between tied candidates. A model or rubric change creates a successor model and new assessments, never a recalculation of historical recommendations.

**Implementation gap:** V005 enforces weights, bounds, completeness and frozen evidence, but application logic must calculate and independently verify the aggregate and rank.

## D03 — Scenario constraints and overrides

The selection service evaluates demand and existing investments in the same scenario. A locked scenario records its scoring model, candidate assessments, funding and capacity ceilings, eligibility rules, dependencies, and assumptions as a versioned constraint snapshot. Hard constraint violations block an automatic `select` recommendation. Unknown funding, capacity or dependency evidence is marked **unknown**, never treated as zero or available. An authorized human may propose an exception with a reason and evidence; only an M05 decision can approve it. Scenario comparison does not itself reserve money or people.

**Implementation gap:** The database freezes the scenario snapshot and candidates; the rule engine, override record and constraint tests are still required.

## D04 — Decision authority

Every approving decision has one accountable decision maker who is the body chair or has an effective, scoped delegation. The approver cannot be the proposal sponsor, case owner, assessor, or sole author of the recommendation for that decision. A delegation is valid only within its stated time, scope, currency and amount limit; a missing limit cannot authorize a monetary commitment. Compare the **total resulting approved envelope**, not just an amendment delta, with the limit. No implicit currency conversion is allowed. A tenant must configure its decision bodies, mandates, monetary thresholds and any committee quorum before issuing decisions. Where a body requires voting, retain a distinct vote/attendance record and block approval until quorum is met. An approval with conditions does not release a commitment until conditions are evidenced as satisfied.

**Implementation gap:** V003/V005 check chair or scoped delegation and matching approval records. They do not yet enforce independence, monetary thresholds, quorum or condition fulfilment. These are release blockers for a production approval flow.

## D05 — Commitment envelopes

M05 is authoritative for approved envelopes; M07 finance owns posted financial actuals and M08 resources owns detailed supply. A funding envelope is a nonnegative amount in one currency for one effective period; capacity is a nonnegative quantity with an explicit unit and period. Scope and schedule use versioned structured envelopes. Amendments are append-only, take effect on a stated date and carry an approving decision. `increase` and `decrease` are positive magnitudes applied in that direction; `replace` states the entire resulting envelope. The computed resulting amount cannot be negative. Different currencies or units cannot be summed without an approved conversion policy. Every decision view must show the original envelope, amendment lineage and resulting envelope as of a chosen date.

**Implementation gap:** The current schema stores envelope types and amendment lineage but does not compute resulting totals or enforce all semantic combinations. A versioned envelope contract and reconciliation tests are required.

## D06 — Baseline succession

An approved baseline is an immutable item/version snapshot with a business-valid interval and a recorded interval. For the initial release, a successor replaces the **exact same** business-valid interval; approval closes the predecessor's recorded interval. A partially overlapping correction is rejected. If interval splitting is later required, introduce a versioned split command and migration with explicit as-of query tests before permitting it. Baseline approval verifies every item against its current canonical version and portfolio scope, and stores the approved payload rather than resolving it live later.

**Implementation gap:** V005 enforces exact-interval succession and immutability. Approval-time polymorphic item/version and portfolio checks remain service work.

## D07 — Evidence contracts

Every submitted case revision and approved recommendation carries a schema version, author, source/correlation metadata, creation time and immutable JSON payload. Publish JSON Schemas for case options, assumptions, scoring rationale, scenario constraints, recommendation basis and scope/schedule envelopes. Reject unknown required types and missing mandatory fields; permit additive optional fields through explicit schema versions. Store document references and checksums, not binary documents, in the core database. An approval retains the evidence version it relied on. Evidence is subject to the tenant's approved records schedule; disposal must preserve a legally required decision trail or create a documented redacted derivative.

**Implementation gap:** The database freezes several JSON snapshots but does not validate these JSON contracts or manage document binaries.

## D08 — Typed external and baseline references

Use a governed target-type registry. A `source_identity` maps one external source/object/key to one canonical `(tenant_id, type, id)`; reuse of the key for a different target is a conflict for reconciliation, not an automatic overwrite. A baseline item must point to an allowed type, existing tenant-owned record and exact version; approval compares its stored snapshot with that version. Integrations declare field-level source authority, update direction, conflict handling and reconciliation owner. Imported observations never overwrite native approvals.

**Implementation gap:** Tenant keys and external-key uniqueness are in SQL; target resolution and source-authority checks require platform services.

## D09 — Lifecycle and exception handling

Publish one versioned transition matrix per module. Draft or submitted records may be revised with an audit trail; completed assessments, recommendations, decisions, commitments and approved baselines are not reopened or edited. Corrections create successor assessments, decisions, amendments or baselines with explicit lineage. Withdrawal or cancellation requires an authorized reason and effective date. An expired governance exception cannot silently remain effective; the service escalates it and records disposition. Reject commands with stale `row_version` and return the current version for reconciliation.

**Implementation gap:** SQL enforces selected immutable states and optimistic versions; complete transition and exception rules belong to command services.

## D10 — Operating controls

Every application command authenticates a principal, authorizes active tenant membership and permissions, then sets transaction-local tenant and actor context. A tenant cannot go live without configured identity federation, role review, decision mandates, source-authority matrix, records schedule, data residency, backup/recovery objectives and tested restore process. Audit and outbox are append-only; consumers are idempotent and inbound key reuse with a changed hash is quarantined. Retention periods, residency and monetary thresholds are tenant settings approved by the tenant's accountable officers; the product supplies no permissive default. Reports and exports honor tenant isolation and approved redaction policy.

**Implementation gap:** RLS, audit, outbox, inbox and source identity are present; provisioning, policy configuration, operational monitoring, retention and recovery need implementation and tenant acceptance.

## Approval and implementation record

Product-owner approval should specify any amendments to D01–D10 and an effective date. On approval, rename the model to v1.0, mark these decisions accepted in the register, and create tracked implementation work for every gap above. Do not label the schema production-ready until those release blockers are implemented and tested.

