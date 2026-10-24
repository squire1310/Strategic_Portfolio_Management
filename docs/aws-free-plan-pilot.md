# AWS free-plan pilot constraints

**Recorded:** 24 October 2026 · **Status:** Account and budget inputs for Increment 1; no AWS resources have been deployed.

The product owner has created a standalone AWS Free-plan account with an initial **USD 100 credit balance**. The account identifier is held outside this public repository. The first environment is non-production, uses synthetic data, and is located in **Europe (London), `eu-west-2`**. A shared database is acceptable. A custom web address and external application identity provider are deferred.

The [Increment 1 pilot cost plan](aws-pilot-cost-plan.md) now gives a bounded Single-AZ EC2 option and a conservative monthly planning allowance. Interim local-account authentication is implemented in the application; account-specific cost and eligibility checks remain a deployment gate.

## What this changes

The [production reference architecture](physical-architecture-aws.md) is a target, not the first deployment bill of materials. Its always-running ALB, Fargate services, Multi-AZ RDS, WAF, network egress and supporting resources must not be provisioned as a group against the USD 100 credit without an account-specific eligibility check and priced estimate. AWS's current [RDS Free Tier documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/) limits its free-plan database option to **Single-AZ**; that is suitable only for a disposable pilot, not the production resilience target. AWS's [Free-plan terms](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html) say the plan ends after six months or when credits are exhausted, whichever comes first, and some services/features are unavailable.

| Stage | Deployment approach | Exit condition |
| --- | --- | --- |
| Local build | Implement US-001–US-004 against PostgreSQL 16 locally and in CI, using synthetic tenants and test actors. | Stories and isolation/history checks pass without AWS spend. |
| AWS pilot | Price and check eligibility of the smallest `eu-west-2` runtime and PostgreSQL option that demonstrates the same build. Keep it disposable, Single-AZ if using the Free-plan RDS option, and remove idle resources. Public anonymous pages show synthetic, non-sensitive content only; tenant commands wait for application authentication. | Written estimate and credit impact accepted; deploy/teardown procedure tested. |
| Production design | Revisit separate production account, Multi-AZ RDS, resilient ECS/ALB/WAF, enterprise identity federation and approved NFR targets. | Funded and reviewed service profile, security and recovery evidence. |

## Controls before any chargeable deployment

1. In the AWS console, verify the Free-plan state, credit balance, expiry date and eligibility of each proposed service in `eu-west-2`. The owner may share the resulting non-secret facts; no root password, access key or secret key is needed. [AWS Free Tier guidance](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier.html).
2. Enable billing/Free Tier alerts and create a cost budget with a threshold chosen by the owner. The USD 100 credit is an upper bound on available credit, **not** permission to spend all of it. Record an estimated monthly and total pilot cost before creating persistent resources. [AWS usage alerts](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/tracking-free-tier-usage.html); [AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/create-cost-budget.html).
3. Use an administrative identity with MFA for account setup and temporary, scoped role credentials for deployment. Do not create root access keys or commit credentials to the repository. [AWS credential guidance](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html).
4. Do not join AWS Organizations or set up Control Tower merely to create this pilot: AWS documents that doing so can automatically change a Free-plan account to a Paid plan. Reassess account separation when a funded production deployment is planned. [AWS plan guidance](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html).
5. Do not publish the 12-digit account ID, personally identifying billing details or resource endpoints in this public repository. Put account-specific deployment values in a private configuration channel. A custom domain is not required for the pilot.

## Remaining access step

The account ID and plan details are enough to plan the build. To inspect or deploy into the account later, the delivery process needs a user-authorised, temporary AWS role or console session scoped to this account. No AWS access is connected to this workspace yet. Preparing code and infrastructure configuration does not require that access; creating cloud resources does.

