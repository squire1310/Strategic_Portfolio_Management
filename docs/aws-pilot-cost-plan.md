# Increment 1 AWS Stockholm pilot cost plan

**Prepared:** 24 October 2026 · **Status:** Public Stockholm rates verified through AWS Price List API; pilot instance launched later that day.

This plan is for a disposable, synthetic-data pilot of US-001–US-004 in `eu-north-1`. The available AWS connection resolves to a **project member account** distinct from the owner's originally stated account. On 24 October 2026 its plan changed from Free to **Paid**; the Free Tier API then reported **USD 120 remaining credit**. Estimated current-month spend was USD 0 before pilot deployment. One `t3.small` instance with encrypted 20 GiB gp3 storage was subsequently launched in Stockholm.

**Region decision:** read-only EC2 and RDS calls succeeded in Stockholm (`eu-north-1`) but were explicitly denied by an organisation service control policy in London (`eu-west-2`). The product owner chose the available Region to proceed without advanced features. This **pilot-only** change permits synthetic data in Stockholm; it does not satisfy the earlier UK location requirement for real or production data. The existing AWS Budgets alerts are not a hard spending cap. [AWS project Regions](https://docs.aws.amazon.com/accounts/latest/reference/project-regions.html); [AWS-managed project policies](https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html).

## Pilot shape

| Component | Pilot choice | Reason and limit |
| --- | --- | --- |
| Runtime and database | One eligible EC2 `t3.small` Linux instance in Stockholm, running Node.js and PostgreSQL 16 | 2 GiB RAM is a safer starting point than 1 GiB for both processes. Single instance and Single-AZ: disposable pilot only. Check AMI and instance eligibility in the account. |
| Storage | One encrypted 20 GiB gp3 EBS volume; PostgreSQL data and app on that volume | Bound storage, no second always-on database bill. Data is synthetic. Snapshot only when needed for pilot recovery rehearsal. |
| Network | One public IPv4 address; security group admits only HTTPS (and HTTP for certificate issuance/redirect if required) | No ALB, NAT gateway, RDS proxy or VPC endpoints in this pilot. Node and PostgreSQL ports are closed to the internet. |
| HTTPS | Temporary hostname, TLS reverse proxy on the instance, and `SPM_PUBLIC_ORIGIN` set to that exact HTTPS origin | A browser-trusted HTTPS hostname is needed before a usable public app link; the final domain can wait. |
| Access | Interim application accounts and server-side sessions | Provision only synthetic pilot users. No external identity provider. Sessions are in one process and are lost on restart. |
| Operations | Small CloudWatch log allowance, EC2 and EBS monitoring, manual stop/teardown | No production availability or recovery promise. Avoid paid monitoring extras unless priced first. |

This differs intentionally from the [production reference architecture](physical-architecture-aws.md), which uses ALB, ECS and RDS Multi-AZ. The pilot does not establish that architecture's resilience, security or recovery properties.

## Conservative planning allowance

The table is a **budgeting allowance**, not an account-specific AWS quote. It uses 730 hours for a long billing month. On 24 October 2026 the AWS Price List API returned public on-demand **EU (Stockholm)** rates of **USD 0.0216/hour** for Linux `t3.small` and **USD 0.0836/GB-month** for gp3 storage. Credit treatment, tax, transfer and CPU-credit charges remain to be verified. AWS [EC2 pricing](https://aws.amazon.com/ec2/pricing/on-demand/) and [EBS pricing](https://aws.amazon.com/ebs/pricing/) vary by Region and usage. AWS lists a [public IPv4 price](https://aws.amazon.com/vpc/pricing/) of USD 0.005 per address-hour; Free Tier treatment must be checked for the deployment account.

| Line | 30-day arithmetic | Allowance (USD) |
| --- | ---: | ---: |
| EC2 `t3.small` compute | 730 h × $0.0216/h | 15.77 |
| 20 GiB gp3 storage | 20 GiB × $0.0836/GiB-month | 1.67 |
| One public IPv4 | 730 h × $0.005/h | 3.65 |
| Snapshot allowance | Provisional | 2.00 |
| Logs, data transfer and small variable usage | Provisional | 5.00 |
| **Subtotal** | | **28.09** |
| **30% contingency** | | **8.43** |
| **Planning ceiling** | | **36.52/month** |

Stopping EC2 ends compute usage, but EBS, snapshots and an allocated public IPv4 can continue to accrue costs. Terminate or release all pilot resources after the demonstration. These figures exclude tax and unexpected traffic or burst CPU charges; the account-specific calculator estimate is the go/no-go number.

## Spend controls and deployment gate

1. Confirm plan state, credit balance and expiry; check `t3.small`, the chosen AMI, gp3 and public IPv4 eligibility in `eu-north-1`. EC2 `DescribeInstances` and RDS `DescribeDBInstances` calls succeeded there. [AWS Free Tier guidance](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html) lists eligible instance families but account eligibility still needs verification.
2. The connected account has an account-wide **USD 45/month gross-cost budget** named `SPM-Pilot-Gross-45`, excluding credit offsets, with email notifications at USD 20, USD 30 and USD 40 actual spend and USD 40 forecast spend. [AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html) data may update only a few times daily, so alerts are not a hard spending cap. If the account owner activates advanced features, any project spend limit is removed and cannot be recreated. [Advanced activation](https://docs.aws.amazon.com/accounts/latest/reference/activate-advanced-features.html).
3. Produce an AWS Pricing Calculator estimate in `eu-north-1` for the exact selected instance, EBS size, IPv4, snapshot and expected transfer. Confirm it stays within the USD 45/month budget and the remaining credit for the proposed pilot length. If not, shorten runtime or revise the design before deployment.
4. Provision only synthetic tenants and pilot accounts. Keep PostgreSQL on loopback, block ports 3000 and 5432 from the internet, terminate TLS at the reverse proxy and retain application login. Use an IAM role with MFA for administration; no account access keys in the repo.
5. Run the four story journeys and a restore/teardown rehearsal. Record start and end dates, actual daily spend, resource inventory and the person responsible for stopping the pilot.

The pilot is running in Stockholm with synthetic data only. Its temporary HTTPS hostname is derived from the instance's public IP and is shared outside this public repository. Login credentials are generated on the instance and retrievable by the account owner through Systems Manager. To stop the ongoing compute charge, stop or terminate the instance; to end all pilot resource charges, terminate it and check for retained volumes, snapshots and public IPv4 allocations, then remove the pilot security group and IAM instance role/profile. Neither the account ID, budget notification address nor credentials belong in this public repository.
