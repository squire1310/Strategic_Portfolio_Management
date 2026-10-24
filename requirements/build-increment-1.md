# Build increment 1 — strategic intent and portfolio context

**Decision:** On 24 October 2026 the product owner prioritised [US-001–US-004](user-stories.md) for the first build increment. This is a delivery slice of the approved hybrid core, not a change to the remaining Core MVP scope. A [local-only application slice](../app/README.md) now implements these paths; it has not been deployed to AWS or assessed for public use.

## Outcome and scope

The first usable path lets a strategy leader define a strategy, objectives, outcomes and measures; enter dated observations; and lets a portfolio office maintain portfolio/category structure and link a portfolio to canonical objectives. Historical versions and actor attribution remain visible. The acceptance criteria in US-001–US-004 and FR-001–FR-008 are the functional check. FR-009 portfolio mix reporting can follow once investment and decision state are available.

| Priority | Story | Functional requirements | Demonstrable result |
| --- | --- | --- | --- |
| P0 | US-001 Define strategic intent | FR-001–FR-002 | Strategy and objective hierarchy with ownership, business-valid dates, version history and cycle rejection. |
| P0 | US-002 Define and observe outcomes | FR-003–FR-005 | Outcome, measure and dated observation with source/evidence and correction history. |
| P0 | US-003 Maintain portfolio structure | FR-006–FR-007 | Portfolio/category hierarchy and time-bounded investment membership. This needs a minimal M05 investment identity or a controlled fixture; full M05 approvals are outside Increment 1. |
| P0 | US-004 Explain strategic alignment | FR-008 | Portfolio-to-objective contribution link and navigation to the one M01 canonical objective. |

## First environment decisions

- **AWS location:** Europe (London), `eu-west-2`, is confirmed as the intended meaning of “UK South”.
- **Tenancy:** A shared application and PostgreSQL database is acceptable for the first environment. Keep tenant-scoped composite keys, RLS and tenant isolation tests; shared storage does not remove them.
- **Network:** An internet-facing regional ALB is acceptable. Use the regional WAF and HTTPS baseline in the [physical architecture](../docs/physical-architecture-aws.md).
- **Identity:** No external identity provider is available for the first build. The application now has interim local accounts, scrypt password hashes, server-side sessions, login failure limiting, same-origin mutation checks and session-derived tenant/actor context. D10 still requires an active tenant member for commands. Only synthetic data is permitted in the pilot. Account provisioning, HTTPS, host configuration and operational controls must be completed before internet exposure; identity federation remains a production decision under D10.
- **AWS account and budget:** The connected project account is now on a Paid plan with USD 120 remaining credit reported on 24 October 2026. A USD 45 monthly gross-cost budget and email alerts are configured. The account's organisation policy still denies London hosting services, so deployment is blocked until that restriction is removed or another permitted account is connected. The account ID is intentionally absent from this public repository. The [pilot cost plan](../docs/aws-pilot-cost-plan.md) and [account constraints](../docs/aws-free-plan-pilot.md) govern this stage. Do not put long-lived AWS credentials or real tenant data in this repository.

## Increment exit evidence

1. A user can complete US-001–US-004 through the chosen UI/API using one tenant and can retrieve version/as-of history required by the stories.
2. Automated checks reject cross-tenant references and reads, objective/portfolio hierarchy cycles, stale versions, duplicate tenant codes and overlapping investment membership periods.
3. Application transactions derive a permitted tenant/actor context; audit entries attribute changes and no public route permits anonymous tenant commands.
4. The same versioned deployment can be rebuilt in the non-production `eu-west-2` environment from reviewed configuration and migrations, after the pilot cost/eligibility gate is met.
5. The team records remaining gaps for risk register, decisions/commitments, integrations and production NFR acceptance in the backlog rather than treating this increment as production ready.

## Next decisions for the build team

The first slice uses Node.js, a small browser UI and PostgreSQL 16. Synthetic tenants and contributors are provisioned in CI. Interim local-account authentication is implemented. Before an AWS pilot, provision pilot accounts, complete browser/accessibility review, verify the account-specific cost estimate and billing alerts, choose a temporary HTTPS hostname, and agree the pilot's operating owner. These are engineering decisions, not additional domain-policy approvals.

