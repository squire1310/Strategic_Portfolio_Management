# Next Build Increment — M0 Baseline and M1 Identity/Authorisation Foundation v1.0

**Prepared:** 25 October 2026  
**Status:** Detailed proposed execution specification. Approved architecture choices C01–C08 apply; this document is **not approval to change code or migrations**.  
**Objective:** Extend existing Increment 1 (US-001–US-004) with a verified PostgreSQL baseline and an Entra-compatible, prototype-capable, scoped authorisation foundation that future J02→J03→J05 workflows can reuse.

**References:** [Implementation backlog B001–B004/B005](implementation-backlog-v1.0.md), [Increment 1](build-increment-1.md), [approved reconciliation C01–C08](../docs/domain-design-reconciliation-decisions-v1.0.md), [identity design](../docs/entra-identity-access-prototype-design-v1.0.md), [governance](../docs/business-rules-decision-rights-governance-v1.0.md), [D01–D10](../reconciled-core/docs/domain-decisions-v1.0.md), [canonical v1.1](../reconciled-core/docs/canonical-domain-model-v1.1.md).

## 1. Current-state baseline and constraints

Repository inspection on 25 October 2026 established that:
- Increment 1 currently uses `app/src/auth.js` with local scrypt-based accounts and in-memory opaque sessions; `app/src/permissions.js` maps prototype roles to allowed commands. It is **not** an Entra stub yet, and group membership is not simulated.
- Database-backed operations use actor/tenant context; trust boundaries must continue to be server-controlled. SQL role `spm_app` requires command-perimeter review before exposure beyond restricted prototype use.
- `app/README.md` reports a synthetic-data AWS Stockholm pilot, whereas older Increment 1 notes describe prior local-only state. Treat current deployment status as **reported by repository documentation**, not independently audited in this design step.
- Reconciled PostgreSQL migrations V001–V008 exist. Earlier validation documentation covers V001–V007 but does not establish V008 execution in that run. Do not assume V008 untested in all environments; gather updated CI evidence.
- Proposed work does not require internal Entra tenant access, production app registration or real employee/group data.

### Explicitly in scope

**M0:** verify migration V001–V008 on a fresh PostgreSQL 16 database; reconcile the validation record, core RLS/audit coverage and rollback/recovery approach.

**M1:** B001 trusted identity provider abstraction; B002 simulated group-to-permission mapping and scoped access; B003 protected command boundary and transition guards on existing commands. Minimum B005 design groundwork for work item semantics, but **no complete cross-role workflow engine** is required for M1 completion.

### Explicitly out of scope

Live Entra connectivity or Graph queries, external tenant credentials, real staff/group synchronisation, provisioning SCIM, committee voting, monetary approvals, M03 business cases, M04 scoring, M05 decisions, AWS production deployment, risk V1.1 migrations, full WorkItem implementation, visual redesign and non-synthetic data.

## 2. Proposed execution order and work breakdown

| Seq | Engineering item | Required work | Artifacts / exit proof |
|---|---|---|---|
| M0.1 | Baseline inventory | Record commit SHA, Node/pnpm/PostgreSQL versions and migration list; compare README and validation run evidence | Reproducible baseline manifest |
| M0.2 | Migration verification | Apply V001→V008 in isolated PG16 and execute existing SQL smoke/Increment 1 tests | CI run with version-by-version log |
| M0.3 | Regression hardening | Test M01 measure retired and voided observation, RLS cross-tenant isolation, revision history and migrations | Focused V008 regression suite |
| M0.4 | Security baseline | Review table grants, search_path, tenant/actor session context, public-surface assumptions | Risk register and required change candidates |
| M1.1 | Identity provider contract | Extract trusted principal/session creation behind configurable provider interface | Auth contract, fake/test provider |
| M1.2 | Local synthetic Entra-like group fixture | Add stable fake external tenant/user/group IDs and synthetic role assignments | Repeatable fixture generator and sessions |
| M1.3 | Permission mapping | Map group object IDs or app-role strings to SPM permission bundles, separately from persona/business assignment | Versioned mapping and strict deny defaults |
| M1.4 | Scoped command service | Enforce active tenant membership, permission, object/organisation scope, expected row_version and audit on existing Increment 1 endpoints | Denial-code contract and tests |
| M1.5 | Prototype disable switch | Configuration validate env: real production/deployment mode must reject prototype and local bypass modes; safety against forged identity headers | Configuration/abuse tests |
| M1.6 | Documentation and demonstrations | Document account creation, safe environment config, revocation, audit, limitations and IAM handoff | Updated runbook and M1 acceptance evidence |

## 3. Application identity contract

Server-internal trusted identity context, **not accepted from client JSON**:

```ts
type TrustedIdentityContext = {
  provider: "prototype" | "entra";
  issuer: string;
  externalTenantId: string;
  externalSubjectId: string;       // Entra oid or synthetic immutable object ID
  principalId: string;             // internal SPM principal UUID
  spmTenantId: string;
  authenticatedAt: string;
  resolvedMembershipAt: string;
  membershipStatus: "verified" | "unavailable";
  externalGroupIds: string[];      // immutable IDs, never group display names
  appRoles: string[];
  effectivePermissionCodes: string[];
  permissionPolicyVersion: string;
  activeBusinessAssignmentId?: string;
};
```

**Provider boundary:** `authenticate` / `resolveSession` / `resolveEntitlements` / `logout` (exact implementation APIs to be reviewed). Existing local login may be refactored into a test-only provider without exposing opaque raw identity headers. Session cookies should remain HTTP-only, Secure in HTTPS settings, and protected against CSRF/session fixation. Session store persistence and deployment scale require separate evaluation; avoid changing semantics silently.

**Trust:** In production, cryptographically validate Entra tokens, tenant issuer, audience, expiry, signature and claim type; user identity key is external tenant + object ID. Do **not** trust email/name as key. Entitlements are resolved from validated app role/group claims or approved Microsoft Graph lookup. Handle group claim overage and missing values fail-closed. Group names are only labels.

**Mapping:** Entra (or synthetic) security-group UUID → SPM permission bundles; business assignments and D04 delegated authority remain separate. Multiple memberships union allowed functional permissions **only within independently authorised tenant and object scope**. No automatic all-tenant read or admin-as-approver. Explicit permission mapping version and expiry in audit.

### Prototype identity fixtures (synthetic examples)

| Test fixture | Groups (symbolic test IDs) | Business context | Negative test |
|---|---|---|---|
| test-strategy | G-STRATEGY | Assigned M01 strategy scope | Cannot edit unassigned portfolio |
| test-portfolio | G-PORTFOLIO | M02 portfolio stewardship | Cannot approve commitment |
| test-sponsor | G-SPONSOR | Assigned future case | Sponsor self-approval blocked |
| test-reviewer | G-REVIEW | Assigned assessment context | Cannot see unrelated cases |
| test-committee | G-COMMITTEE | Committee membership only | No chair/delegation = no formal approval |
| test-admin | G-ADMIN | Tenant platform administration | No automatic business authority |
| test-multi-role | G-STRATEGY + G-PORTFOLIO | Two scoped assignments | Must switch context and enforce scope |
| test-unmapped | G-UNKNOWN | Active identity without app entitlement | Denied |
| test-revoked | Former G-PORTFOLIO | Membership removed or expired | Denied on revalidation |

Actual fixture UUID values will be generated in the implementation and remain synthetic. The group's code is a developer fixture alias and **not** an organisation's real Entra group.

## 4. Authorisation acceptance contract

Decision sequence for each protected command:

1. Validate session using the configured identity adapter.
2. Map the principal to an active SPM tenant member.
3. Resolve verified external groups/app roles and effective permission version; deny if mapping/membership unavailable.
4. Verify requested command entitlement, module owner, resource tenant, organisational/portfolio scope, and any business assignment.
5. Evaluate current transition policy and expected `row_version`; reject optimistic conflict.
6. Execute using transaction-local tenant and actor settings through trusted service.
7. Commit canonical event/audit and return next allowable actions, or return safe structured denial.
8. Remove/refresh access when session entitlements expire or membership is revoked. Define explicit maximum staleness and revalidation trigger before production launch.

**Safety:** a group membership must not produce formal approval powers. D04 quorum, independence, currency and amount checks are deferred to M3 and must not be faked by M1's command matrix.

### Stable proposed denial reasons

| Code | Meaning | Expected action |
|---|---|---|
| AUTH-401 | No valid authenticated session | Sign in again |
| AUTH-403 | No tenant membership, group entitlement or scoped permission | Deny without revealing inaccessible object |
| AUTH-STALE | Group/member mapping unresolved or expired | Revalidate / deny pending verification |
| AUTH-CONFLICT | Expected row_version differs from canonical record | Return current allowed summary for reconciliation |
| AUTH-BLOCK | Operation unavailable under prototype-only permissions or environment | Deny and audit |

Codes are a **proposal**; align with existing API conventions before implementation.

## 5. M0 database verification details

- Use a **disposable PostgreSQL 16 instance**; apply migrations V001 through V008 in filename order, each forward-only and individually fail-fast.
- Confirm `V008` creates status on `m01_strategy.measure` (`active`, `retired`) and `voided` / `void_reason` on `m01_strategy.measure_observation`, with reason constraint.
- Execute schema smoke tests, app integration/auth/permissions/UI tests against disposable synthetic tenants; capture separate success/failure counts and migration commit SHA.
- Add cross-tenant RLS read/write tests on changed fields; verify actor-attributed revisions and that legitimate record retirement preserves historical reads.
- Inspect existing SQL `spm_app` grants and prevent direct untrusted client database access. Do not assume that passing SQL tests proves secure API authorisation.
- Document failure recovery: disposable rebuild now; production forward-only migrations with backup/restore, rollback plan and contingency for non-reversible changes later.
- Update validation document **only with evidence from actual executed CI/test runs**.

## 6. M1 automated acceptance tests

| Test | Scenario | Expected outcome |
|---|---|---|
| M1-T01 | Valid synthetic test principal and authorised group, active tenant member | Can execute permitted M01/M02 command |
| M1-T02 | Valid identity without mapped group | Protected command denied |
| M1-T03 | Group claim forged in request body/header | Ignored or rejected; no effective privilege |
| M1-T04 | Wrong tenant identity or object ID | No cross-tenant read/write |
| M1-T05 | Multiple groups, one out-of-scope portfolio | Only scoped objects visible/actionable |
| M1-T06 | Group revocation/expiry | Permission denied after agreed freshness/revalidation rule |
| M1-T07 | Platform administrator attempts investment authorisation | No delegated financial decision permission |
| M1-T08 | Test committee user lacks mandate | Cannot make formal financial decision |
| M1-T09 | Production environment has `prototype` identity mode | Application refuses startup or deployment |
| M1-T10 | Expired/invalid session | Rejected; session cannot be recreated from browser actor claim |
| M1-T11 | Optimistic update with old `row_version` | Conflict and no lost update |
| M1-T12 | Same signed-in user attempts unpermitted module command | Clear denial; no DB mutation |
| M1-T13 | Two synthetic tenant fixtures share group fixture aliases | No cross-tenant permission leakage |
| M1-T14 | Unresolved group overage or missing verified entitlements | No inferred grant |
| M1-T15 | Existing US-001–US-004 flows repeated under allowed synthetic fixture | Functional regression passes |
| M1-T16 | Test-only local credential implementation disabled in production | No alternate production login bypass |

For later M3, independently test D04 delegation, approval amount/currency and committee quorum; M1 tests must not claim those controls are complete.

## 7. Milestone exit criteria

### M0 exit (database baseline)
- Evidence of migration run V001–V008 on PostgreSQL 16 at a recorded commit; green smoke/integration test results and explicit exceptions.
- Cross-tenant access, history and V008 void/retire regression evidenced.
- Deployment/runbook discrepancies reconciled without asserting a new production readiness level.

### M1 exit (prototype identity/authorisation)
- All sixteen tests above pass, together with retained Increment 1 acceptance suite.
- Provider can be swapped without rewriting M01/M02 commands or role/persona model; exact real Entra integration remains a later IAM activity.
- No untrusted client path can impersonate actor/tenant or grant a group.
- Prototype provider impossible to activate in production configuration.
- Policies are tenant-scoped and versioned; integration entitlement loss denies protected operations.
- A sample demo shows differing synthetic users seeing different authorised actions and an attempted unauthorised action failing with an audit record.

**Non-exit:** This is not certification for investment approvals, legal delegations, public-sector compliance, live Entra tenant connectivity, commercial uptime or production readiness.

## 8. Design dependencies, risks and handoff

| Risk / dependency | Mitigation or outstanding choice |
|---|---|
| Current local password/session model differs from Entra OIDC | Refactor trusted adapter boundary before expanding account features |
| Existing roles hardcoded (`executive`, `policy`, `portfolio_manager`, `engagement_lead`, `viewer`) | Map to permission bundles as compatibility layer; avoid replacing them with business personas |
| Group nesting / claims overage semantics unknown | Test both Entra app-role and group-claim strategies; fail closed pending IAM resolution |
| Scope policy not yet fully persisted | Review current TenantMember, Portfolio and owner relationships before adding mappings |
| Existing AWS pilot and interim accounts | Keep synthetic-only and deployment-safe; do not expose a new login method without threat-model review |
| V008 test evidence inconclusive | Reproduce clean CI and update record with observed results |
| Service boundary vs broad table grants | Introduce restricted application commands and regression tests, preserving app behaviour |

## 9. Definition of ready for engineering

Before beginning implementation: agree the M1 group-mapping preference and fixture semantics; assign module/security owners; inspect existing app routes and database RLS/grants; choose persistence migrations using forward-only design; define token/session contract and environment enforcement; create test cases in CI; record acceptance of this increment's scope.

**Planning output:** M0 and M1 are now decomposed sufficiently for technical estimation and implementation sequencing. This specification alone does not modify runtime infrastructure, code, security groups, SQL or credentials.
