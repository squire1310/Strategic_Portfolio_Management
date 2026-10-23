# Assumptions, invariants, and reconciliation points

## Source and module mapping

The referenced ChatGPT conversation returned only opaque content references, not canonical model v0.3 text. This is a documented inference from the approved hybrid SPM direction. The repository's `docs/solution-overview.md` has since revealed that this draft's M02–M05 mapping conflicts with the approved architecture. See `reconciliation.md`. The original v0.3 names, attributes, and relationships must be checked before production release.

| Boundary | Assumed ownership | Integration stance |
|---|---|---|
| M01 Strategy | strategy, objective, measure, observations | Native system of record for strategic intent and outcome definitions |
| M02 Intake | demand, objective alignment, assessment | Native front door; submissions may arrive through adapters |
| M03 Portfolio | portfolio, initiative, membership, alignment, dependencies | Native investment identity; delivery execution can be native or external |
| M04 Finance | funding source, financial plan and lines, actuals | Native plans; ERP can own actual transactions |
| M05 Capacity | resource pool, monthly capacity and allocation | Native planning; workforce systems can own supply facts |
| M06 Governance | decision body, decision, approved baseline and snapshots | Native authority and approval record |

## Identity and tenancy

- Every tenant-owned key begins with `tenant_id`. Cross-boundary foreign keys include `tenant_id`, preventing accidental cross-tenant joins through constraints.
- `source_identity` maps an external `(source system, object type, key)` to one canonical object. The polymorphic canonical target is checked in the integration service because PostgreSQL cannot use one FK to six module schemas. Uniqueness prevents duplicate mappings, but target existence is not enforced in SQL.
- Principal identities are global; memberships and authorizations are tenant-local. An application connection supplies trusted `app.tenant_id` and `app.actor_id` within a transaction. The role must be granted only to an identity-aware service that prevents clients from sending arbitrary SQL or changing those settings.
- A tenant and its first administrator are provisioned by the database owner, then `platform.seed_tenant_references(tenant_id)` is called. There is intentionally no sample tenant in a production migration.

## Versioning and time

- Versioned roots have `row_version`, `valid_during`, `created_at`, `updated_at`. Triggers assign version numbers and append full JSON snapshots to `platform.entity_revision`. Updates close the prior `recorded_during` system-time interval. The application supplies domain-valid periods; `recorded_during` is database generated.
- Revisions are append-oriented except closing the prior system-time range. `audit_event` is strictly append-only. Versioned roots can be deleted, which records a tombstone revision; business services should normally retire or cancel instead. Link tables are not versioned; material changes to membership or alignment should be reflected in an approved baseline when a durable decision is required.
- A baseline captures approved item ID, version number, and snapshot. On approval, its system-time interval starts; approving a successor with overlapping valid time closes the earlier baseline's recorded interval and marks it superseded. An exclusion constraint disallows two overlapping approved baselines for the same portfolio/type at the same valid and recorded time. The baseline is a point-in-time snapshot; its polymorphic item references are not SQL FKs and must be assembled and validated by the governance service before approval.
- Governance decisions are immutable; a corrective decision points to `supersedes_decision_id`. This schema validates the approving decision's subject and type for baselines. It does not implement quorum, delegation, workflow, or verify that each other decision's polymorphic subject exists.

## Deployment and operational contracts

- PostgreSQL 16+ and extensions `pgcrypto` and `btree_gist` are required. Migration owner needs permission to create schemas, extensions, and NOLOGIN roles. If role creation is centralized, remove role DDL from V004 and pre-create exactly scoped roles before deployment.
- App roles must not own tables or have `BYPASSRLS`; connection poolers must reset session state. Use `SET LOCAL` or `set_config(..., true)` after `BEGIN`. RLS is defense in depth alongside service authorization. Policies do not implement per-module or per-role business privileges.
- Audit and outbox are emitted in the same transaction as versioned-root mutations. Outbox publishers should claim rows with `FOR UPDATE SKIP LOCKED`, publish idempotently by `event_id`, and mark `published_at`. Inbox consumers should upsert on `(tenant_id,source_system_id,message_key)` and compare `payload_hash` for conflicting reuse.
- Financial values use ISO 4217-style three-letter codes but do not validate against a currency registry. Planning periods are monthly. Exchange rates, fiscal calendars, escalation, benefits realization methods, individual employee capacity, and execution task structures are outside this first schema.
- Status transition rules beyond check constraints belong in command services. Application updates should use `WHERE tenant_id=? AND id=? AND row_version=?` to enforce optimistic concurrency.

## Known SQL-level gaps for later design

- Cycles in objective hierarchy, portfolio hierarchy, and initiative dependency graphs are not prevented by constraints; command services must reject them.
- Summed portfolio weights and committed capacity are not cross-row constrained because valid periods and scenario policy determine how they are calculated.
- The generic `entity_revision` payload stores full rows. Data retention, redaction, partitioning, and encryption requirements need a tenant-specific policy before regulated production use.
- Baseline item snapshots are checked for shape only as JSON; service validation must ensure the item belongs to the baseline's portfolio and its `item_version` matches the committed revision.

