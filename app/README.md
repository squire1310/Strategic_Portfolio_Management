# Increment 1 application

This is a **development slice** for US-001–US-004. It exposes strategy, objective, outcome, measure, portfolio, category, candidate investment, membership and alignment workflows. It uses the tenant-scoped PostgreSQL schema through [V008](../reconciled-core/migrations/V008__role_owned_record_retirement.sql). A disposable synthetic-data pilot is deployed in AWS Stockholm; it is **not production ready**. See the [pilot deployment notes](../deploy/aws-stockholm-pilot/README.md) and [role ownership rules](../requirements/role-ownership-prototype.md).

## Run locally

1. Install Node.js 22+, pnpm 11 and PostgreSQL 16. Create a disposable database. Apply [V001–V008](../reconciled-core/migrations/) in order as the database owner, then run `app/test/seed.sql` **only in that disposable database** if you want the synthetic test tenants. The seed creates a known CI-only password; do not use it for a persistent or reachable database.
2. For ordinary local use, create your own PostgreSQL login with a private password and grant it `spm_app`. The login must not own the tables or have `BYPASSRLS`. Provision a synthetic tenant, principal and active `contributor` membership as database owner, or use the disposable CI seed.
3. Set `SPM_DATABASE_URL` to that non-owner login's connection URL. Configure `SPM_LOCAL_USERS_JSON` as an array of local accounts. Each account needs a unique lowercase `username`, `displayName`, `tenantId`, `actorId`, `role` and `passwordHash`. `role` must be `executive`, `policy`, `portfolio_manager`, `engagement_lead` or `viewer`. The actor must have an active membership in that tenant. Use a password of at least 16 characters and generate its scrypt hash with `node src/hash-password.js`, passing the password through standard input. Keep the password and account JSON out of GitHub. For the disposable CI seed, the two tenant/actor pairs are in [seed.sql](test/seed.sql).
4. In `app/`, run `pnpm install --frozen-lockfile`, then `pnpm start`. Open `http://127.0.0.1:3000` and sign in.

The server binds to loopback by default. A sample PowerShell setup for the **disposable synthetic seed** is:

```powershell
$pw = Read-Host 'Pilot password' -AsSecureString
$plain = [System.Net.NetworkCredential]::new('', $pw).Password
$hash = $plain | node src/hash-password.js
Remove-Variable plain,pw
$env:SPM_LOCAL_USERS_JSON = @(@{
  username = 'pilot-one'; displayName = 'Pilot one'
  tenantId = '00000000-0000-4000-8000-000000000001'
  actorId = '00000000-0000-4000-8000-000000000101'
  role = 'executive'
  passwordHash = $hash
}) | ConvertTo-Json -Compress
```

The server stores opaque sessions in memory for eight hours; a restart signs users out. Login failures are temporarily limited in memory. Cookies are HTTP-only and SameSite Strict, and mutating requests require the expected `Origin`. Each request derives tenant, actor and prototype role from its session. The server checks every write against the role-to-command matrix; the database separately checks active tenant membership and its coarse contributor permission. All roles can read tenant data and navigate all sections. Do not put real tenant data into this disposable pilot. Before internet exposure, provide an HTTPS reverse proxy, a chosen temporary hostname, a firewall that blocks direct access to the Node port and private PostgreSQL, and set `SPM_PUBLIC_ORIGIN` to that exact HTTPS origin. Public-origin mode also requires the proxy to set `X-Forwarded-Proto: https`. This is an interim single-instance mechanism, not the production identity design.

## Interface design

The browser UI uses GOV.UK Frontend 6.6.0 components and a stylesheet built from its Sass during `pnpm start` and `pnpm test`. It uses the generic header and a standard system font because this prototype is not hosted on a `gov.uk` domain. It does not use the GOV.UK logotype or GDS Transport font. The page has a skip link, phase banner, GOV.UK form controls, tables, error summary, success notification, and footer. The neutral brand colour is a provisional choice pending a service owner brand decision.

Date fields currently use native browser date controls styled with the GOV.UK input class. Before public release, assess these with users and replace them with the [GOV.UK date input pattern](https://design-system.service.gov.uk/components/date-input/) where users are entering a known date. The interface has not yet had a full accessibility audit or usability test; component use alone does not establish compliance.

## Command API

`POST /api/commands/{command}` accepts JSON for commands listed in [the role matrix](src/permissions.js). `GET /api/workspace` returns tenant-scoped records. `GET /api/history/{schema}/{table}/{id}` returns entity revisions and audit events. The browser UI uses these endpoints. Writes require both an allowed application role and a synthetic active database member with the `contributor` or `administrator` role. IDs and actor context are set on the server; request bodies cannot select a tenant, actor or role.

The candidate investment command creates **identity only** for US-003 membership. It does not approve or commit an investment. Strategy and portfolio hierarchy changes are serialized and reject cycles. PostgreSQL rejects duplicate tenant codes, cross-tenant references and overlapping membership periods; optimistic versions reject stale corrections and updates. The audit/history triggers run in the same transaction as writes.

## Validation and remaining work

`pnpm test` always runs login and UI asset tests. It also runs the HTTP/database integration suite when `SPM_TEST_DATABASE_URL` points to a disposable, migrated database with `app/test/seed.sql` applied. Without that variable, only the database suite is skipped. The [CI workflow](../.github/workflows/validate-increment-1.yml) runs it against PostgreSQL 16 under a non-owner login.

This slice still needs production identity and account provisioning, recovery procedures, finer permissions, upload/source contracts, accessibility review, performance checks, and the production security/recovery controls in the [requirements](../requirements/build-increment-1.md). The M06 risk entities in canonical model v1.1 remain outside Increment 1.

## Increment 2 identity foundation — partial implementation

The initial identity-provider seam is now in `src/identity.js`. The existing local password/session provider remains available in `SPM_IDENTITY_PROVIDER=local` mode for development compatibility. `SPM_IDENTITY_PROVIDER=prototype` requires each synthetic local account to include nonempty `groupIds` of UUIDs. Configure `SPM_GROUP_MAPPINGS_JSON` as a JSON object mapping **synthetic group UUIDs** to existing permission-bundle names (`executive`, `policy`, `portfolio_manager`, `engagement_lead`, `viewer`). Commands are checked against resolved session permissions, not the display role.

For example, in an isolated synthetic environment, configure:

```sh
export SPM_DEPLOYMENT_ENV=test
export SPM_IDENTITY_PROVIDER=prototype
export SPM_GROUP_MAPPINGS_JSON='{"00000000-0000-4000-8000-000000000501":["policy"]}'
```

Add `"groupIds":["00000000-0000-4000-8000-000000000501"]` to a **test-only** user in `SPM_LOCAL_USERS_JSON`. Do not place passwords or real Entra IDs in version control. Any unmapped group grants no commands. This is **not a real Entra integration**; choosing `SPM_IDENTITY_PROVIDER=entra` fails closed until OIDC verification is implemented. `SPM_DEPLOYMENT_ENV=production` rejects local/prototype authentication. Set production mode explicitly for any production build/deployment, rather than relying on the default development mode.

**Known limits:** The current prototype keeps existing password-based synthetic login, local in-memory sessions and broad legacy workspace read behaviour. Fine-grained read scopes, real Entra claims/overage handling, membership expiry/revocation, durable SPM group mappings, impersonation-resistant identity provisioning and complete command isolation remain open work. **Do not expose this prototype to real or sensitive data** and do not treat these initial changes as completion of M1 or approval controls. See [Build Increment 2](../requirements/build-increment-2-identity-foundation.md).

### Portfolio-scoped prototype read slice (25 October 2026)

Synthetic users in prototype group mode may specify `portfolioIds` (an array of portfolio UUIDs) in their **server-side account fixture**. Workspace portfolio records, memberships, alignments and investments are filtered by those IDs in PostgreSQL query predicates; portfolio history requires current scoped ownership. Global categories are hidden in this restricted view. Empty scope grants no portfolio objects. Client-supplied scope headers or body fields are not used. Existing local compatibility mode retains its broader reads.

**Safe limitation:** Portfolio-scoped prototype users cannot currently issue portfolio/investment/membership/alignment write commands. Those writes fail closed until ownership/scoped command checks are designed and implemented. Strategic M01 read scope and record-level permissions outside portfolio-linked objects remain incomplete; this is not an all-module security solution. Synthetic group membership and portfolio assignment are configured in-process and do not yet have production revocation, authorisation mapping persistence or Entra verification. Do not use live or sensitive data.
