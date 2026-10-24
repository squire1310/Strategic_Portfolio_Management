# Increment 1 AWS London pilot cost plan

**Prepared:** 24 October 2026 · **Status:** Public London rates verified through AWS Price List API; no resources deployed.

This plan is for a disposable, synthetic-data pilot of US-001–US-004 in `eu-west-2`. The available AWS connection resolves to a **project member account** distinct from the owner's originally stated account. On 24 October 2026 its plan changed from Free to **Paid**; the Free Tier API then reported **USD 120 remaining credit**. Estimated current-month spend was USD 0. No hosting resources were created.

**Deployment block:** even after the Paid-plan upgrade, the connected role still received an explicit service-control-policy deny for London EC2, RDS and CloudFormation read calls on repeated checks. The policy appears to be the prior Free Tier project restriction, but its exact contents were not readable from the connected role. AWS documents that project plan policies are managed by AWS and cannot be edited by a project role. Do not attempt to deploy through this connection until AWS removes the stale restriction or another permitted account connection is available. [AWS managed project policies](https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html).

## Pilot shape

| Component | Pilot choice | Reason and limit |
| --- | --- | --- |
| Runtime and database | One eligible EC2 `t3.small` Linux instance in London, running Node.js and PostgreSQL 16 | 2 GiB RAM is a safer starting point than 1 GiB for both processes. Single instance and Single-AZ: disposable pilot only. Check AMI and instance eligibility in the account. |
| Storage | One encrypted 20 GiB gp3 EBS volume; PostgreSQL data and app on that volume | Bound storage, no second always-on database bill. Data is synthetic. Snapshot only when needed for pilot recovery rehearsal. |
| Network | One public IPv4 address; security group admits only HTTPS (and HTTP for certificate issuance/redirect if required) | No ALB, NAT gateway, RDS proxy or VPC endpoints in this pilot. Node and PostgreSQL ports are closed to the internet. |
| HTTPS | Temporary hostname, TLS reverse proxy on the instance, and `SPM_PUBLIC_ORIGIN` set to that exact HTTPS origin | A browser-trusted HTTPS hostname is needed before a usable public app link; the final domain can wait. |
| Access | Interim application accounts and server-side sessions | Provision only synthetic pilot users. No external identity provider. Sessions are in one process and are lost on restart. |
| Operations | Small CloudWatch log allowance, EC2 and EBS monitoring, manual stop/teardown | No production availability or recovery promise. Avoid paid monitoring extras unless priced first. |

This differs intentionally from the [production reference architecture](physical-architecture-aws.md), which uses ALB, ECS and RDS Multi-AZ. The pilot does not establish that architecture's resilience, security or recovery properties.

## Conservative planning allowance

The table is a **budgeting allowance**, not an account-specific AWS quote. It uses 720 hours for an always-on 30-day month, a deliberately padded EC2 rate of USD 0.030/hour and gp3 allowance of USD 0.12/GB-month. On 24 October 2026 the AWS Price List API returned public on-demand **EU (London)** rates of **USD 0.0236/hour** for Linux `t3.small` and **USD 0.0928/GB-month** for gp3 storage. The padded values below retain room for rate and usage variation. Credit treatment, tax, transfer and CPU-credit charges remain to be verified. AWS [EC2 pricing](https://aws.amazon.com/ec2/pricing/on-demand/) and [EBS pricing](https://aws.amazon.com/ebs/pricing/) vary by Region and usage. AWS lists a [public IPv4 price](https://aws.amazon.com/vpc/pricing/) of USD 0.005 per address-hour; Free Tier treatment must be checked for the deployment account.

| Line | 30-day arithmetic | Allowance (USD) |
| --- | ---: | ---: |
| EC2 `t3.small` compute | 720 h × $0.030/h | 21.60 |
| 20 GiB gp3 storage | 20 GiB × $0.12/GiB-month | 2.40 |
| One public IPv4 | 720 h × $0.005/h | 3.60 |
| Snapshot allowance | Provisional | 2.00 |
| Logs, data transfer and small variable usage | Provisional | 5.00 |
| **Subtotal** | | **34.60** |
| **30% contingency** | | **10.38** |
| **Planning ceiling** | | **44.98/month** |

At the same usage profile, a **14-day always-on demonstration** is roughly USD 16.14 before contingency or **USD 20.98 with 30% contingency**. Stopping EC2 ends compute usage, but EBS, snapshots and an allocated public IPv4 can continue to accrue costs. Terminate or release all pilot resources after the demonstration. These figures exclude tax and unexpected traffic or burst CPU charges; the account-specific calculator estimate is the go/no-go number.

## Spend controls and deployment gate

1. In the deployment account, confirm plan state, credit balance and expiry; check `t3.small`, the chosen AMI, gp3 and public IPv4 eligibility in `eu-west-2`. The connected account is now Paid but its hosting SCP restriction remains. [AWS Free Tier guidance](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html) lists eligible instance families but account eligibility still needs verification.
2. The connected account now has an account-wide **USD 45/month gross-cost budget** named `SPM-Pilot-Gross-45`, excluding credit offsets, with email notifications at USD 20, USD 30 and USD 40 actual spend and USD 40 forecast spend. [AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html) data may update only a few times daily, so alerts are not a hard spending cap. Set a project spend limit in AWS Settings separately if a hard monthly pause is needed.
3. Produce an AWS Pricing Calculator estimate in `eu-west-2` for the exact selected instance, EBS size, IPv4, snapshot and expected transfer. Confirm it stays within the USD 45/month planning ceiling and the remaining credit for the proposed pilot length. If not, shorten runtime or revise the design before deployment.
4. Provision only synthetic tenants and pilot accounts. Keep PostgreSQL on loopback, block ports 3000 and 5432 from the internet, terminate TLS at the reverse proxy and retain application login. Use an IAM role with MFA for administration; no account access keys in the repo.
5. Run the four story journeys and a restore/teardown rehearsal. Record start and end dates, actual daily spend, resource inventory and the person responsible for stopping the pilot.

The current application is not deployed. The next external inputs are removal of the stale SCP restriction or a connection permitted to create resources in the **intended** AWS account, plus a temporary HTTPS hostname. Neither the account ID, budget notification address nor credentials belong in this public repository.

