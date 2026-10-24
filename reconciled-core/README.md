# Hybrid SPM native core: model and PostgreSQL schema

**Status: canonical model and domain decisions v1.0 approved; PostgreSQL schema remains an implementation candidate.** The v0.3 conversation answer could not be retrieved, so the [newly authored model](docs/canonical-domain-model-v1.0.md) was derived from the approved solution overview and approved by the product owner on 24 October 2026 together with [domain decisions D01–D10](docs/domain-decisions-v1.0.md). M01–M06 are native. Finance and resources remain M07/M08 extensions.

The five forward-only migrations target PostgreSQL 16+ and require `pgcrypto` and `btree_gist`. Use a fresh database or schema namespace; these files replace the earlier `drafts/physical-schema` candidate and are not an in-place upgrade from it.

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/V001__platform.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/V002__strategy_portfolio_demand_selection.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/V003__investment_governance.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/V004__security_seed.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/V005__decision_evidence.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/smoke.sql
```

Migrations assume a database owner able to create extensions, schemas, and NOLOGIN roles. Provision tenants and their first member as owner, then call `platform.seed_tenant_references(tenant_id)`. An application command must begin a transaction and set `app.tenant_id` and `app.actor_id` with `SET LOCAL`. Login roles inherit `spm_app` or `spm_worker`; they must not own tables or have `BYPASSRLS`.

## Contents

- `docs/canonical-domain-model-v1.0.md`: approved entities, ownership, relationships, invariants, and extension boundaries.
- `docs/canonical-domain-model-v0.4-draft.md`: prior draft retained for provenance.
- `migrations/`: versioned PostgreSQL schema and security setup.
- `docs/erd.md`: detailed Mermaid ERDs.
- `docs/data-dictionary.md`: physical table mapping and history rules.
- `docs/assumptions.md`: policy choices and remaining limits.
- `docs/domain-decisions-v1.0.md` and `docs/domain-decision-register.md`: approved product policy and decision record, with implementation gaps.
- `tests/smoke.sql`: rollback-only end-to-end test of core relationships, revisions, approvals, baseline succession, decision immutability, and RLS.
- `docs/validation.md`: executed PostgreSQL checks and remaining coverage.

## Validation status

The five migrations and expanded smoke test passed on PostgreSQL 16 in the repository's [schema validation workflow](https://github.com/squire1310/Strategic_Portfolio_Management/actions/runs/40076526020). PostgreSQL binaries were unavailable locally. Passing SQL checks establishes that the schema executes and the tested invariants hold; the approved policy's [implementation gaps](docs/domain-decisions-v1.0.md) and service-level checks in [assumptions and limits](docs/assumptions.md) remain outstanding. See [validation details](docs/validation.md).

