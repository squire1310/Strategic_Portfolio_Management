# Hybrid SPM native core: model and PostgreSQL schema

**Status: canonical model v1.1 is the current design; domain decisions D01–D10 remain approved; PostgreSQL schema remains an implementation candidate.** The original [v1.0 model](docs/canonical-domain-model-v1.0.md) was approved on 24 October 2026. The product owner then requested [v1.1](docs/canonical-domain-model-v1.1.md) to add M06 strategic investment risks and appetite. Those entities are not in migrations V001–V006 and require a forward migration and tests before implementation. M01–M06 are native. Finance and resources remain M07/M08 extensions.

The six forward-only migrations target PostgreSQL 16+ and require `pgcrypto` and `btree_gist`. Use a fresh database or schema namespace; these files replace the earlier `drafts/physical-schema` candidate and are not an in-place upgrade from it.

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/V001__platform.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/V002__strategy_portfolio_demand_selection.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/V003__investment_governance.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/V004__security_seed.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/V005__decision_evidence.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/V006__decision_path.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/smoke.sql
```

Migrations assume a database owner able to create extensions, schemas, and NOLOGIN roles. Provision tenants and their first member as owner, then call `platform.seed_tenant_references(tenant_id)`. An application command must begin a transaction and set `app.tenant_id` and `app.actor_id` with `SET LOCAL`. Login roles inherit `spm_app` or `spm_worker`; they must not own tables or have `BYPASSRLS`.

## Contents

- `docs/canonical-domain-model-v1.1.md`: current design model, including M06 risk ownership, entities and invariants.
- `docs/canonical-domain-model-v1.0.md`: approved historical model before the risk addition.
- `docs/canonical-domain-model-v0.4-draft.md`: prior draft retained for provenance.
- `migrations/`: versioned PostgreSQL schema and security setup.
- `docs/erd.md`: detailed Mermaid ERDs.
- `docs/data-dictionary.md`: physical table mapping and history rules.
- `docs/assumptions.md`: policy choices and remaining limits.
- `docs/domain-decisions-v1.0.md` and `docs/domain-decision-register.md`: approved product policy and decision record, with implementation gaps.
- `docs/decision-path-implementation.md`: first executable decision-path increment and command boundary.
- `tests/smoke.sql`: rollback-only end-to-end test of core relationships, revisions, approvals, baseline succession, decision immutability, and RLS.
- `docs/validation.md`: executed PostgreSQL checks and remaining coverage.

## Validation status

All six migrations and the expanded smoke test passed on PostgreSQL 16 in the repository's [schema validation workflow](https://github.com/squire1310/Strategic_Portfolio_Management/actions/runs/40079135175). PostgreSQL binaries were unavailable locally. The approved policy's [implementation gaps](docs/domain-decisions-v1.0.md) and service-level checks in [assumptions and limits](docs/assumptions.md) remain outstanding. See [validation details](docs/validation.md).

