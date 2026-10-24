# Hybrid SPM native core: model and PostgreSQL schema

**Status: proposed model v0.4 and schema candidate.** The v0.3 conversation answer could not be retrieved, and the user confirmed the full canonical model needs producing. [The newly authored model](docs/canonical-domain-model-v0.4-draft.md) follows the repository's approved solution overview; it is ready for review, not yet approved as a canonical replacement. M01–M06 are native. Finance and resources remain M07/M08 extensions.

The four forward-only migrations target PostgreSQL 16+ and require `pgcrypto` and `btree_gist`. Use a fresh database or schema namespace; these files replace the earlier `drafts/physical-schema` candidate and are not an in-place upgrade from it.

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/V001__platform.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/V002__strategy_portfolio_demand_selection.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/V003__investment_governance.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/V004__security_seed.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/smoke.sql
```

Migrations assume a database owner able to create extensions, schemas, and NOLOGIN roles. Provision tenants and their first member as owner, then call `platform.seed_tenant_references(tenant_id)`. An application command must begin a transaction and set `app.tenant_id` and `app.actor_id` with `SET LOCAL`. Login roles inherit `spm_app` or `spm_worker`; they must not own tables or have `BYPASSRLS`.

## Contents

- `docs/canonical-domain-model-v0.4-draft.md`: entities, ownership, relationships, invariants, and extension boundaries.
- `migrations/`: versioned PostgreSQL schema and security setup.
- `docs/erd.md`: detailed Mermaid ERDs.
- `docs/data-dictionary.md`: physical table mapping and history rules.
- `docs/assumptions.md`: policy choices and remaining limits.
- `tests/smoke.sql`: rollback-only end-to-end test of core relationships, revisions, approvals, baseline succession, and RLS.

## Validation status

The files have undergone static review. They have **not yet passed a PostgreSQL execution test** in this workspace because PostgreSQL server and client binaries were not found locally. The smoke test and any CI result must pass before deployment or promoting this model to approved status. See [assumptions and limits](docs/assumptions.md).

