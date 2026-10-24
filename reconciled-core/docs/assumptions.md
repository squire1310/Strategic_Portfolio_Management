# Assumptions and remaining decisions

## Source and scope

The prior v0.3 answer was unavailable as text. The user confirmed that a full canonical model needs to be produced. The accompanying v0.4 draft derives module boundaries from the approved `docs/solution-overview.md` in this repository. Exact naming and attributes are new proposals. This schema does not implement M07–M12.

## Guarantees implemented in SQL

- Composite tenant keys and FKs prevent cross-tenant references; RLS policies require an active member in the selected tenant.
- Mutable roots have optimistic row versions, business-valid ranges, trigger-written system-time revisions, audit rows and outbox events.
- Submitted case revisions, selection recommendations, investment decisions, commitments, and amendments cannot be updated or deleted.
- Investment approval state requires a matching approving decision by a deferred constraint trigger. Decision makers must chair the body or hold an effective delegation for the subject scope.
- Commitments and amendments require an approving decision for the same investment. A baseline approval requires a decision whose subject is that baseline.
- Approved baseline snapshots cannot be edited; a successor with the same business-valid interval closes the earlier baseline's recorded interval. Partial overlap is rejected pending an explicit interval-splitting design. Exclusion constraints prevent concurrent approved interpretations over the same valid time.
- Inbound messages have a unique source/message key. External identity mappings have a unique source/object/external key. Outbox events are written in the source transaction.

## Service-level rules still required

- The API must authenticate the identity and set transaction-local tenant/actor values. Do not expose arbitrary SQL or let untrusted clients choose those settings. RLS is defense in depth, not the complete authorization system.
- Lifecycle transition order, quorum, delegated monetary limits, separation of duties, expired membership, and evidence sufficiency need command-service policy. The decision trigger checks delegation scope/time but not an amount threshold.
- The scoring formula, direction transformation, aggregate-score calculation, tie-breaking, and portfolio constraints need a versioned policy. SQL now ensures active model weights total 1, completed assessments have one bounded score per criterion, and recommendations use locked scenarios with frozen evidence.
- Objective/portfolio hierarchies and portfolio dependencies must be acyclic. Membership weight sums and commitment totals are aggregate rules requiring command or reporting logic.
- The service must validate polymorphic targets in `source_identity`, baseline-subject decisions, and baseline items; it must freeze the exact current version and verify portfolio scope before approval.
- `case_revision.options` and `assumptions` have array checks but require a versioned JSON contract or normalized tables if analytics needs option-level querying.
- Outbox consumers publish idempotently by `event_id`, claim with `FOR UPDATE SKIP LOCKED`, and mark delivery. Inbox processors compare the stored hash when a message key is reused.

## Deployment and records policy

- Tenant creation, role assignment, source-system registration, and default-code seeding are privileged provisioning steps.
- `audit_event` is append-only; `entity_revision` closes the prior recorded interval on change. It stores whole-row JSON. Regulated use requires a retention, partitioning, redaction, encryption, and export policy before production.
- Business-valid intervals use half-open ranges. PostgreSQL timestamps are stored as `timestamptz`; API display uses the tenant's timezone. Codes are tenant-local. Currency and units in commitment envelopes require a governed registry in a later migration.
- The draft has no dedicated M07 financial actuals, M08 individual resource records, document binaries, workflow engine, or analytical warehouse. Approved commitment envelopes are the native M05 authority that those capabilities will consume.

