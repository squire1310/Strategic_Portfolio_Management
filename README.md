# Hybrid SPM PostgreSQL schema

**Current work:** [Increment 1 application](app/README.md) implements the first local-only strategic intent and portfolio slice (US-001–US-004), using the [reconciled core schema](reconciled-core/README.md) and [build scope](requirements/build-increment-1.md). The AWS account is on the Free plan; read the [pilot constraints](docs/aws-free-plan-pilot.md) before deploying. The content below documents an earlier inferred schema kept for provenance.

**Status: draft requiring architecture reconciliation. Do not deploy.** The repository's approved [solution overview](https://github.com/squire1310/Strategic_Portfolio_Management/blob/main/docs/solution-overview.md) defines different M02–M06 boundaries than this inferred draft. See `docs/reconciliation.md`.

Implementation target: PostgreSQL 16+. After reconciliation and PostgreSQL validation, apply `migrations/V001__platform.sql` through `V004__security_seed.sql` in lexical order, each in its own transaction, as a database owner. See `docs/assumptions.md` for the inferred mapping and deployment requirements.

These files are an implementation draft aligned to the user's approved **hybrid** direction. The referenced conversation exposed only opaque content references for canonical model v0.3. The repository overview now provides a higher-level boundary map that conflicts with the inferred module labels in this draft. Reconcile both boundaries and entity coverage before production deployment.

## Migration commands

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/V001__platform.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/V002__core_domains.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/V003__plans_governance.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migrations/V004__security_seed.sql
```

Applications must set `app.tenant_id` and `app.actor_id` with `SET LOCAL` inside every transaction. Ordinary app roles must not own tables or have `BYPASSRLS`. `platform.application_context` checks that the actor is an active member of the tenant. All tenant-owned tables have composite primary and foreign keys. UUIDs are generated in PostgreSQL.

## Files

- `migrations/`: forward-only, versioned SQL; never edit after deployment.
- `docs/erd.md`: Mermaid ERDs by boundary.
- `docs/data-dictionary.md`: tables, keys, history, and write ownership.
- `docs/assumptions.md`: inferred model points, guarantees, and limits.
- `tests/smoke.sql`: transaction-rolled-back SQL checks for a PostgreSQL instance.

## Validation status

Local command discovery found no `psql`, PostgreSQL server binaries, Docker, or Python executable in PATH. The SQL has been reviewed statically, but the migrations and smoke test have **not** been executed against PostgreSQL in this workspace. Run the commands above and `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/smoke.sql` in CI before treating this as deployable.

