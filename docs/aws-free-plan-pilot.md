# AWS pilot account constraints

**Recorded:** 24 October 2026 · **Status:** Account and budget inputs for Increment 1; no AWS resources have been deployed.

The product owner initially reported a standalone AWS Free-plan account with USD 100 in credits. The available AWS connection resolves to a different project member account. On 24 October 2026 that connected account was upgraded to **Paid** and the Free Tier API reported **USD 120 remaining credit**. A USD 45 monthly gross-cost budget with alert thresholds is in place. The organisation policy still explicitly denies London compute, database and deployment reads after the upgrade. The account identifiers are held outside this public repository. No resources have been deployed. The intended first environment is non-production, uses synthetic data and is located in **Europe (London), `eu-west-2`**. A shared database is acceptable. A permanent web address and external application identity provider are deferred.

The [Increment 1 pilot cost plan](aws-pilot-cost-plan.md) now gives a bounded Single-AZ EC2 option and a conservative monthly planning allowance. Interim local-account authentication is implemented in the application; account-specific cost and eligibility checks remain a deployment gate.

## What this changes

The [production reference architecture](physical-architecture-aws.md) is a target, not the first deployment bill of materials. Its always-running ALB, Fargate services, Multi-AZ RDS, WAF, network egress and supporting resources must not be provisioned as a group against the remaining credit without an account-specific eligibility check and priced estimate. The connected account is now Paid and can incur charges beyond credits. The proposed single-instance, Single-AZ pilot is suitable only for disposable synthetic data, not the production resilience target. [AWS plan terms](https://docs.aws.amazon.com/accounts/latest/reference/upgrade-account.html).

| Stage | Deployment approach | Exit condition |
| --- | --- | --- |
| Local build | Implement US-001–US-004 against PostgreSQL 16 locally and in CI, using synthetic tenants and test actors. | Stories and isolation/history checks pass without AWS spend. |
| AWS pilot | Price and check eligibility of the smallest `eu-west-2` runtime and PostgreSQL option that demonstrates the same build. Keep it disposable, Single-AZ if using the Free-plan RDS option, and remove idle resources. Public anonymous pages show synthetic, non-sensitive content only; tenant commands wait for application authentication. | Written estimate and credit impact accepted; deploy/teardown procedure tested. |
| Production design | Revisit separate production account, Multi-AZ RDS, resilient ECS/ALB/WAF, enterprise identity federation and approved NFR targets. | Funded and reviewed service profile, security and recovery evidence. |

## Controls before any chargeable deployment

1. In the AWS console, verify the Paid-plan state, remaining credit and eligibility of each proposed service in `eu-west-2`. The connected account's prior Free Tier SCP denial must be resolved before deployment. [AWS managed project policies](https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html).
2. Keep the existing USD 45 monthly gross-cost budget and its alert notifications; consider a project spend limit in AWS Settings. Remaining credit is **not** permission to spend all of it. Record an estimated monthly and total pilot cost before creating persistent resources. [AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html).
3. Use an administrative identity with MFA for account setup and temporary, scoped role credentials for deployment. Do not create root access keys or commit credentials to the repository. [AWS credential guidance](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html).
4. Do not activate advanced AWS features merely to bypass the current block. AWS's Paid project policy normally permits EC2 and RDS; the still-attached denying policy needs investigation first. [AWS managed project policies](https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html).
5. Do not publish the 12-digit account ID, personally identifying billing details or resource endpoints in this public repository. Put account-specific deployment values in a private configuration channel. A custom domain is not required for the pilot.

## Remaining access step

The connected AWS role can read plan, budget and pricing information but is still blocked by an explicit organisation service control policy from London compute, database and deployment services, even though the account reports Paid. AWS documents the project plan SCPs as managed policies that cannot be edited by project roles. If the denial persists, the account owner should raise it with AWS Support or connect a different permitted account. Preparing code and infrastructure configuration does not require that access; creating cloud resources does.

