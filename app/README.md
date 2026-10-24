# Increment 1 application

This is a **local-only development slice** for US-001–US-004. It exposes strategy, objective, outcome, measure, portfolio, category, candidate investment, membership and alignment workflows. It uses the existing tenant-scoped PostgreSQL schema plus [V007](../reconciled-core/migrations/V007__strategic_intent.sql). It is **not** the public AWS pilot or a production service.

## Run locally

1. Install Node.js 22+, pnpm 11 and PostgreSQL 16. Create a disposable database. Apply [V001–V007](../reconciled-core/migrations/) in order as the database owner, then run `app/test/seed.sql` **only in that disposable database** if you want the synthetic test tenants. The seed creates a known CI-only password; do not use it for a persistent or reachable database.
2. For ordinary local use, create your own PostgreSQL login with a private password and grant it `spm_app`. The login must not own the tables or have `BYPASSRLS`. Provision a synthetic tenant, principal and active `contributor` membership as database owner, or use the disposable CI seed.
3. Set `SPM_DATABASE_URL` to that non-owner login's connection URL, and `SPM_DEV_TENANT_ID` / `SPM_DEV_ACTOR_ID` to the synthetic membership UUIDs. Use your shell's environment mechanism; keep credentials out of files committed to GitHub.
4. In `app/`, run `pnpm install --frozen-lockfile`, then `pnpm start`. Open `http://127.0.0.1:3000`.

The server binds to loopback and accepts only a local host and origin. It has **no user login**. The test actor comes from local environment variables; never bind this build to a public address or put real data into it. A later public pilot must add application authentication before enabling tenant commands. No external identity provider is required to develop this slice locally.

## Interface design

The browser UI uses GOV.UK Frontend 6.6.0 components and a stylesheet built from its Sass during `pnpm start` and `pnpm test`. It uses the generic header and a standard system font because this prototype is not hosted on a `gov.uk` domain. It does not use the GOV.UK logotype or GDS Transport font. The page has a skip link, phase banner, GOV.UK form controls, tables, error summary, success notification, and footer. The neutral brand colour is a provisional choice pending a service owner brand decision.

Date fields currently use native browser date controls styled with the GOV.UK input class. Before public release, assess these with users and replace them with the [GOV.UK date input pattern](https://design-system.service.gov.uk/components/date-input/) where users are entering a known date. The interface has not yet had a full accessibility audit or usability test; component use alone does not establish compliance.

## Command API

`POST /api/commands/{strategy,objective,objective-update,objective-parent,outcome,measure,observation,observation-correction,portfolio,portfolio-parent,portfolio-retire,category,category-retire,investment,membership,alignment}` accepts JSON. `GET /api/workspace` returns tenant-scoped records. `GET /api/history/{schema}/{table}/{id}` returns entity revisions and audit events. The browser UI uses these endpoints. Writes require a synthetic active member with the `contributor` or `administrator` role. IDs and actor context are set on the server; request bodies cannot select a tenant or actor.

The candidate investment command creates **identity only** for US-003 membership. It does not approve or commit an investment. Strategy and portfolio hierarchy changes are serialized and reject cycles. PostgreSQL rejects duplicate tenant codes, cross-tenant references and overlapping membership periods; optimistic versions reject stale corrections and updates. The audit/history triggers run in the same transaction as writes.

## Validation and remaining work

`pnpm test` runs the HTTP/database integration suite when `SPM_TEST_DATABASE_URL` points to a disposable, migrated database with `app/test/seed.sql` applied. Without that variable, the suite is skipped. The [CI workflow](../.github/workflows/validate-increment-1.yml) runs it against PostgreSQL 16 under a non-owner login.

This slice still needs a chosen interim login mechanism, richer role permissions, upload/source contracts, accessibility review, performance checks, and the production security/recovery controls in the [requirements](../requirements/build-increment-1.md). The M06 risk entities in canonical model v1.1 are outside Increment 1 and not in V007.

