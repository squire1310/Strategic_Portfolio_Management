# AWS pilot account constraints

**Recorded:** 24 October 2026 · **Status:** Account and budget inputs for Increment 1; no AWS resources have been deployed.

The product owner initially reported a standalone AWS Free-plan account with USD 100 in credits. The available AWS connection resolves to a different project member account. On 24 October 2026 that connected account was upgraded to **Paid** and the Free Tier API reported **USD 120 remaining credit**. A USD 45 monthly gross-cost budget with alert thresholds is in place. The project is assigned to **Europe (Stockholm), `eu-north-1`**: EC2 and RDS read calls succeeded there but were explicitly denied by an organisation service control policy in **Europe (London), `eu-west-2`**. The product owner has now selected whichever Region permits a pilot without advanced features, so **the disposable, synthetic-data pilot will use Stockholm**. This is a pilot exception to the earlier UK hosting direction, not approval to place real or production data outside the UK. The account identifiers are held outside this public repository. A shared database is acceptable. A permanent web address and external application identity provider are deferred. [AWS project Regions](https://docs.aws.amazon.com/accounts/latest/reference/project-regions.html); [AWS-managed project policies](https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html).

The [Increment 1 pilot cost plan](aws-pilot-cost-plan.md) now gives a bounded Single-AZ EC2 option and a conservative monthly planning allowance. Interim local-account authentication is implemented in the application; account-specific cost and eligibility checks remain a deployment gate.

## What this changes

The [production reference architecture](physical-architecture-aws.md) is a target, not the first deployment bill of materials. Its always-running ALB, Fargate services, Multi-AZ RDS, WAF, network egress and supporting resources must not be provisioned as a group against the remaining credit without an account-specific eligibility check and priced estimate. The connected account is now Paid and can incur charges beyond credits. The proposed single-instance, Single-AZ pilot is suitable only for disposable synthetic data, not the production resilience target. [AWS plan terms](https://docs.aws.amazon.com/accounts/latest/reference/upgrade-account.html).

| Stage | Deployment approach | Exit condition |
| --- | --- | --- |
| Local build | Implement US-001–US-004 against PostgreSQL 16 locally and in CI, using synthetic tenants and test actors. | Stories and isolation/history checks pass without AWS spend. |
| AWS pilot | Price and check eligibility of the smallest `eu-north-1` runtime and PostgreSQL option that demonstrates the same build. Keep it disposable and Single-AZ, and remove idle resources. Public anonymous pages show synthetic, non-sensitive content only; tenant commands require application authentication. | Written estimate and credit impact accepted; deploy/teardown procedure tested. |
| Production design | Revisit separate production account, Multi-AZ RDS, resilient ECS/ALB/WAF, enterprise identity federation and approved NFR targets. | Funded and reviewed service profile, security and recovery evidence. |

## Controls before any chargeable deployment

1. Use only `eu-north-1` for this synthetic pilot; verify service and instance eligibility before deployment. In AWS Settings, the project's selected Region is under **Project → Overview → Additional Info**. London remains blocked in this account without advanced features. [AWS project Regions](https://docs.aws.amazon.com/accounts/latest/reference/project-regions.html).
2. Keep the existing USD 45 monthly gross-cost budget and its alert notifications. Remaining credit is **not** permission to spend all of it. Record an estimated monthly and total pilot cost before creating persistent resources. Advanced activation removes any project spend limit and prevents creating another; the AWS Budgets alert is **not** a hard cap. [Advanced activation](https://docs.aws.amazon.com/accounts/latest/reference/activate-advanced-features.html); [AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html).
3. Use an administrative identity with MFA for account setup and temporary, scoped role credentials for deployment. Do not create root access keys or commit credentials to the repository. [AWS credential guidance](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html).
4. Advanced activation is not needed for the Stockholm pilot. It remains an explicit account-owner decision for any future London deployment because it is irreversible, changes organisation administration, and removes project spend limits. [Advanced activation](https://docs.aws.amazon.com/accounts/latest/reference/activate-advanced-features.html).
5. Do not publish the 12-digit account ID, personally identifying billing details or resource endpoints in this public repository. Put account-specific deployment values in a private configuration channel. A custom domain is not required for the pilot.

## Remaining access step

The connected role can use EC2 and RDS in Stockholm but the AWS-managed `RegionFloor` policy denies the same calls in London. An IAM allow cannot override that explicit denial. The current pilot proceeds in Stockholm with synthetic data only. Before any real-data or production deployment, revisit the UK hosting direction and choose a London-capable account or advanced activation with `RegionFloor` updated for `eu-west-2`. [AWS-managed project policies](https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html); [advanced activation preparation](https://docs.aws.amazon.com/accounts/latest/reference/activate-advanced-features.html).

