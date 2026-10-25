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

### Effective-dated object assignments — M1 partial (25 October 2026)

Migration [V009](../reconciled-core/migrations/V009__object_access_assignment.sql) introduces tenant-scoped, versioned and audited `platform.object_access_assignment` records for `strategy` and `portfolio` targets. Assignments carry principal, target ID/type, effective range, optional revocation, assigner and reason. `spm_app` has SELECT only: administrative provisioning is deliberately outside user-facing commands until a governed admin workflow exists. In prototype mode the server resolves active DB assignments on each API request; users without an active assignment get an empty applicable object scope. Existing local compatibility mode remains separate and broader. Entra groups still grant **functional access only**, not assignment or approval rights.

The initial test suite includes [assignments-db.test.js](test/assignments-db.test.js). Deployment teams must apply V009 only through the standard migration path and obtain CI evidence; prototype data remains synthetic. Direct database-owner provisioning is a temporary controlled test mechanism, not the production access-management interface.

### ServiceNow access-fulfilment boundary (25 October 2026)

[Migration V010](../reconciled-core/migrations/V010__access_fulfilment_ledger.sql) introduces a tenant-scoped **correlation ledger** for catalogue request identifiers, grant/revoke intent and processing status. Request keys are idempotency identifiers within a tenant, source system and operation; the table records neither catalogue approvals nor business investment approval powers. The application principal has **read-only** permission, and **no ordinary API route** can write this ledger or provision assignments. The [database test](test/fulfilment-db.test.js) checks uniqueness, status constraints, captured audit evidence and denied write grants.

**Not implemented:** ServiceNow credentials/API integration, authenticated IAM fulfilment worker, catalogue entitlement verification, effective object grant/revoke execution, replay/reconciliation and error recovery. These require agreement with the IAM/ServiceNow owners. Access requests remain in ServiceNow; application access still requires Entra group entitlement and an effective SPM assignment. This limited change is not a production provisioning capability.

### Non-IAM workstream: derived journey status

`GET /api/journey-status` returns a read-only projection of lifecycle states from the current user's scoped workspace. It creates no competing status column, carries canonical source and row version, and conveys no independent approval authority. Initial support covers M01/M02 strategy and portfolio objects, investment lifecycle and observation voiding; additional M03–M06 milestones require their business capabilities. ServiceNow catalogue fulfilment is deferred pending IAM collaboration.

### B005 business work items — initial implementation

Migration [V011](../reconciled-core/migrations/V011__platform_work_items.sql) adds audited and versioned tenant-owned work items for strategy and portfolio business tasks. The local-compatible API supports `GET /api/work-items/inbox`, `POST /api/work-items/create`, `POST /api/work-items/reassign` and `POST /api/work-items/complete`. Assignees must be active tenant members; only the creator may reassign an open task and only the assignee may complete it. The PostgreSQL integration test is [work-items-db.test.js](test/work-items-db.test.js). Prototype-scoped sessions cannot mutate work items pending a complete object-level assignment check. This does not implement access catalogue requests, workflow escalation, approval rights or M03/M04 work items.

### B005 inbox interaction (25 October 2026)

The `/inbox` page now supports creating tasks for visible strategy/portfolio targets, listing tasks assigned to the current principal, completing assigned tasks with a note, listing tasks created by the current principal and reassigning open created tasks by principal UUID. Creation and reassignment require valid active tenant principal identifiers and server-side object-scope checks. Overdue status is derived from the due date. This is an internal SPM business workflow, not a ServiceNow catalogue access request. A searchable assignee directory, escalation rules, notifications and M03 demand-linked tasks remain for later increments.

### B006 proposal triage slice

M03 draft proposals can be created, edited and submitted with immutable numbered case revisions. Migration [V012](../reconciled-core/migrations/V012__demand_intake_review.sql) adds immutable reviewer feedback tied to a specific case revision. The `POST /api/proposals/review` endpoint allows an independently authenticated reviewer with portfolio-manager functional permissions to return a submitted proposal for correction (`return_for_correction`) or pass it to triage (`accept_for_assessment`). A returned proposal becomes an editable draft; resubmission creates the next immutable revision. The submitter cannot review their own proposal. This is not an investment approval/commitment decision. Prototype scoped-group users remain denied pending M03 scoping; reviewer work-item routing, rejection outcome and UI are still pending.

### B006 task handoffs (initial implementation)

Migration [V013](../reconciled-core/migrations/V013__proposal_work_item_handoffs.sql) links optional named reviewer tasks to submitted immutable case revisions. Submitting with `reviewerId` creates a B005 review task in the same database transaction; a designated reviewer must perform its review transition, which completes the review task. Returning a proposal creates a correction task for the original submitter; successful resubmission completes that task. Generic B005 reassignment/completion is disabled for workflow-owned tasks: domain transitions remain authoritative. Existing submissions without an explicit reviewer still use the open role-based review queue for prototype compatibility. This is not an investment approval flow. Reviewer selection is currently by principal UUID, and M03 scoped authorisation and full routing policies remain incomplete.

### B007 candidate investment promotion

Following independent M03 intake review, `POST /api/proposals/accept` moves a triaged demand to `accepted`; `POST /api/proposals/promote` creates one M05 candidate investment linked through `origin_demand_id`, using a selected investment category. PostgreSQL's tenant-scoped unique origin-demand constraint and service checks prevent duplicate promotion. The two steps distinguish intake acceptance and candidate creation from **formal M05 investment approval**, which remains a separate governed process. These commands currently have no UI and the prototype's scoped-access mode remains blocked until M03-specific permissions are developed.

### B008 initial independent assessment slice

`POST /api/assessments/create`, `/score` and `/complete` use canonical M04 scoring models, criteria, assessments and criterion scores. Assessment requires an active effective scoring model and eligible triaged/accepted demand, and rejects the proposal submitter as assessor. Scores must be within configured criterion maxima and have evidence; completion requires every criterion to be scored and a rationale. This is assessment evidence only, not a selection recommendation or investment approval. Initial route access uses the existing local prototype portfolio-manager command entitlement, while full assessor role/scoped permissions, scoring model administration and UI remain future work.

### B008 scenarios and selection recommendations

The initial `POST /api/recommendations/create-scenario` and `/recommend` endpoints create M04 scenarios and append-only selection recommendations (`select`, `defer`, `reject`) against a completed assessment using the same active scoring model. The scenario owner records a supporting rationale; scoped identity mode remains denied pending the dedicated M04 access policy. Recommendations are advisory evidence and **do not** create formal M05 investment decisions, approvals or commitments. Weighted results are read-only and must not substitute for delegated approval authority.

### B010 atomic committee evidence finalisation

Migration [V017](../reconciled-core/migrations/V017__committee_finalisation.sql) stores an immutable evidence snapshot. `POST /api/committee-sessions/finalise` records a meeting, participant evidence and an eligible-quorum snapshot **in one database transaction**. Only the decision-body chair can record it, and only where the authenticated local prototype role has the protected command permission. Effective delegations at meeting time determine voter eligibility. Conflicted members must be recused; non-quorate evidence is rejected. This is an intentionally bounded evidence-capture prototype, **not** a decision approval or effectuation service. It does not yet offer staged drafting, external signatures, delegate authority limits, complete minute attachments, attendance corrections, or production-ready approval pathways. Scoped identity mode is denied until governed M06 permissions are implemented.

### B011 controlled decision-recording prototype

Migration [V018](../reconciled-core/migrations/V018__committee_decision_evidence_link.sql) links a finalised M06 session to one immutable M05 decision. `POST /api/investment-decisions/record` supports only non-effectuating `defer` and `reject` decisions in this initial slice. It requires finalised quorum evidence, decision-body chair or effective investment delegation, a candidate investment, and separation from the investment owner and sponsor. An attempted `approve` is denied, and no commitment or investment lifecycle transition occurs. This is **not** a complete decision service: meeting votes are not yet item-specific, decision-making authority and conditions need policy-based completeness verification, and scope-specific production controls remain blocked. Do not use live decisions.

### B012 independent condition verification

Migrations [V019](../reconciled-core/migrations/V019__decision_conditions.sql)–[V026](../reconciled-core/migrations/V026__condition_creation_and_release_gate.sql) add append-only condition submissions and verification evidence, an effective-dated verifier mandate, condition creation checks, and a database commitment gate. The decision maker records precedent or subsequent obligations on an approving or conditional investment decision with `POST /api/conditions/create`, the `condition-create` entitlement, and active approver or administrator tenant membership. Conditions cannot be added after that decision has effectuated a commitment or amendment. The investment owner or sponsor submits an evidence reference with `POST /api/conditions/evidence` and the `condition-submit` entitlement. `POST /api/conditions/verify` requires the latest `submissionId`, the dedicated `condition-verify` entitlement, active contributor or administrator tenant membership, an effective mandate, and separation from the evidence submitter, decision maker, investment owner, and sponsor. Database guards apply the same actor and independence checks to direct inserts, copy the submitted evidence reference into the verification event, stamp its time, and record the mandate that authorised it. Historical verification rows retain null submission and mandate links rather than being assigned unproven provenance. A revoked mandate stops further verification. `GET /api/investment-decisions/:id/conditions` is available to the decision maker with `condition-create` entitlement, the investment owner or sponsor with `condition-submit` entitlement, or a verifier with `condition-verify` entitlement and an effective mandate. It reports the latest submission, outstanding precedents, outstanding subsequent conditions, overdue subsequent conditions, and clearance. `GET /api/conditions/:id/history` gives the same authorised participants a read-only ordered trail of submissions and verifications, including actor, evidence reference, mandate and time. A newer submission returns a previously cleared condition to pending until that version is verified; a later `not_satisfied` verification also reopens monitoring. The database refuses commitment and amendment inserts while any precedent on the approving decision lacks a satisfied verification of its latest submission. The application read model still reports commitment readiness and effectuation as false; it has no commitment effectuation command. ServiceNow fulfilment remains deferred. Scoped prototype users remain denied until condition-level scope rules are defined.
