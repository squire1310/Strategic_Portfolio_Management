# Strategic Portfolio Management non-functional requirements

**Version:** 0.2 · **Status:** Proposed for product and tenant review · **Prepared:** 24 October 2026  
**Scope:** Hybrid SPM product, including native M01–M06, essential platform services and any enabled M07–M12 modules or integrations. These requirements define qualities of the service; [functional requirements](functional-requirements.md) define its behaviour.

**Hosting location supplied by the product owner:** The AWS production data plane was specified for Europe (London), `eu-west-2`, interpreting “UK South” as the AWS London Region. On 24 October 2026 the product owner chose Europe (Stockholm), `eu-north-1`, for a **disposable synthetic-data pilot** using the connected AWS (new) project without advanced features. This pilot exception does not approve real or production data outside the UK. The [AWS physical architecture](../docs/physical-architecture-aws.md) retains London as its production reference pending a separate location decision; global services and third-party processing still need a residency review.

## Source and authority

This specification adapts all 33 entries in the public [Defra architecture NFR catalogue](https://github.com/DEFRA/architecture/blob/main/nfrs/catalogue.yaml), its [service tiers](https://github.com/DEFRA/architecture/blob/main/nfrs/service-tiers.yaml), [NFR guidance](https://github.com/DEFRA/architecture/blob/main/docs/nfrs/index.md) and [writing guidance](https://github.com/DEFRA/architecture/blob/main/docs/nfrs/writing-nfrs.md), checked on **24 October 2026**. Defra identifies the public catalogue and tier targets as **draft** and says its internal DDTS catalogue takes precedence for Defra services. This file is an SPM proposal, not an assertion of Defra approval or compliance. A Defra deployment must reconcile it with the current internal catalogue and service owner.

**Traceability:** `DEFRA NFR-…` in the tables is the source ID, not this product's ID. SPM IDs `SPM-NFR-001` onward are stable within this repository. `Dxx` references [approved domain decisions](../reconciled-core/docs/domain-decisions-v1.0.md); `FR-xxx` references [functional requirements](functional-requirements.md). **All** means all production deployments. **Conditional** means the stated deployment condition must be met. **Target pending** means the accountable tenant/service owner must approve a measurable target before go-live; a draft Defra value is not silently adopted.

## Service profile and target decisions

The service owner and operations owner shall record the following in a versioned, approved service profile before production use. Reassess after a material change to user base, data sensitivity, criticality or operating hours. A Defra tenant also confirms its tier against the internal DDTS catalogue.

| Decision | Required record | Why it remains open |
| --- | --- | --- |
| Service criticality and tier | Impact of outage; statutory deadlines; users; workable alternative; selected tier and approver | Defra's public T1–T4 values are draft and SPM can serve different tenants. |
| Supported hours and maintenance | Time zone, supported hours, advance notice and exclusion rule | Availability has no meaningful denominator without this. |
| Availability and recovery | Monthly availability target, RTO, RPO, disaster-recovery test frequency | Targets depend on criticality and architecture. |
| Workload and latency | Named critical journeys/APIs, peak users and request mix, data volume, page/API latency percentiles | A response target needs a repeatable load profile. |
| Support | Coverage hours, alert routing, acknowledgement and escalation times | Depends on tier and operating model. |
| Data and records | `eu-west-2` production location; classification, global-service data flows, retention schedule, lawful basis, disposal exceptions and accountable approver | The AWS Region is fixed, but D10 still requires accountable acceptance of the complete data and records policy. |
| Accessibility and channels | User groups, public/internal channels, assisted digital needs and supported browsers | Public-facing Defra rules are conditional. |

## Requirements

Each **Evidence** entry is the minimum verification method. Numeric values labelled **candidate** are proposed for product review, drawn from Defra's draft public catalogue; they are not approved service levels until recorded in the service profile.

### Availability and resilience

| SPM ID | Requirement and target | Applies | Evidence | Source / owner |
| --- | --- | --- | --- | --- |
| SPM-NFR-001 | The service shall meet its approved monthly availability percentage during supported hours, measured through a synthetic critical journey; planned-maintenance exclusions shall follow the approved notice rule. **Target pending.** | All | Monthly monitor report and outage reconciliation. | DEFRA NFR-AVL-01 · Operations |
| SPM-NFR-002 | Following a declared major failure, the service shall restore the critical journey within its approved recovery time objective (RTO). **Target pending.** | All | Timed disaster-recovery exercise. | DEFRA NFR-AVL-02 · Operations |
| SPM-NFR-003 | A restore after failure shall lose no more committed business data than the approved recovery point objective (RPO). **Target pending.** | All | Point-in-time restore with record-count and event reconciliation. | DEFRA NFR-AVL-03 · Platform |
| SPM-NFR-004 | Where the approved service tier requires multi-zone resilience, loss of one availability zone shall not stop the critical journey or corrupt committed data. | Conditional: tier requires multi-zone | Architecture review and controlled zone-failure test. | DEFRA NFR-AVL-04 · Platform |
| SPM-NFR-005 | Failure of an optional integration shall produce a clear degraded-state message and preserve a user's saved or submitted work; approval commands shall fail closed when authoritative evidence is unavailable. | All | Dependency-failure tests covering save, submit and approve. | DEFRA NFR-AVL-05; D04, D10 · Product + Platform |

### Performance and capacity

| SPM ID | Requirement and target | Applies | Evidence | Source / owner |
| --- | --- | --- | --- | --- |
| SPM-NFR-006 | At the approved peak workload, the 95th percentile server-side response time for named interactive page requests shall meet the approved limit. **Candidate: 2 seconds.** | All UI deployments | Repeatable load test and production percentile dashboard. | DEFRA NFR-PRF-01 · Engineering |
| SPM-NFR-007 | At the approved peak workload, the 95th percentile latency for named synchronous APIs shall meet the approved limit, measured end to end at the API boundary. **Candidate: 500 ms.** | All API deployments | Load test and production latency dashboard. | DEFRA NFR-PRF-02 · Engineering |
| SPM-NFR-008 | The service shall complete critical journeys at the approved peak multiplier without error-rate or latency targets being breached. **Multiplier pending** after tier and demand forecast. | All | Load test using recorded user mix, data volume and peak multiplier. | DEFRA NFR-PRF-03 · Product + Engineering |
| SPM-NFR-009 | Where low-bandwidth access is required, critical browser journeys shall remain usable on the approved throttled connection and meet the approved uncached page-weight budget. **Candidate: 3G and 500 KB excluding cached assets.** | Conditional: low-bandwidth user need | Throttled browser test and page-weight report. | DEFRA NFR-PRF-04 · Product + Front end |

### Security

| SPM ID | Requirement and target | Applies | Evidence | Source / owner |
| --- | --- | --- | --- | --- |
| SPM-NFR-010 | A threat model covering tenant isolation, identity, approvals, evidence stores and integrations shall be reviewed before go-live, after significant change and at least annually. | All | Dated model, change review and resolved risk actions. | DEFRA NFR-SEC-01 · Security |
| SPM-NFR-011 | Critical and high vulnerabilities shall be remediated within approved severity windows or have a time-bound, accountable risk decision. **Candidates: 14 days critical, 30 days high.** | All | Scan results, remediation timestamps and exception register. | DEFRA NFR-SEC-02 · Security + Engineering |
| SPM-NFR-012 | Independent security testing proportionate to the approved risk and tier shall be completed before go-live and after significant change; material findings shall have disposition. | All | Test report, remediation plan and acceptance decision. | DEFRA NFR-SEC-03 · Security |
| SPM-NFR-013 | Data in transit shall use approved TLS configuration and data at rest shall be encrypted, including databases, backups and stored evidence. **Candidate minimum: TLS 1.2.** | All | Configuration review, transport scan and key-management evidence. | DEFRA NFR-SEC-04 · Platform + Security |
| SPM-NFR-014 | Human and service principals shall have least-privilege, role-scoped access; access shall be reviewed at the approved interval. **Candidate maximum: six months.** | All | Role matrix, access review record and denial tests. | DEFRA NFR-SEC-05; D10, FR-038 · Security + Tenant admin |

### Accessibility and usability

| SPM ID | Requirement and target | Applies | Evidence | Source / owner |
| --- | --- | --- | --- | --- |
| SPM-NFR-015 | Browser journeys shall meet WCAG 2.2 AA; public-facing deployments shall publish an accessibility statement. | All browser UI; statement conditional on public service | Automated checks, manual assistive-technology audit and statement review. | DEFRA NFR-ACC-01 · Product + Front end |
| SPM-NFR-016 | All SPM browser UI shall follow the GOV.UK Design System styling and applicable components and patterns. Deployments outside `gov.uk` shall use the generic header and shall not use the GOV.UK logotype or GDS Transport font. | All browser UI | Design and code review against the GOV.UK Design System, plus accessibility and usability testing. | Product decision 2026-10-24; DEFRA NFR-ACC-02 · Product + Front end |
| SPM-NFR-017 | Core browser journeys shall be completable without client-side JavaScript where this is an approved channel requirement; otherwise an accessible fallback shall be specified and tested. | Conditional: channel decision | JavaScript-disabled journey test or approved fallback evidence. | DEFRA NFR-ACC-03 · Product + Front end |
| SPM-NFR-018 | The UI shall work with the approved browser, device and assistive-technology support matrix. | All UI deployments | Cross-browser and assistive-technology test results. | DEFRA NFR-ACC-04 · Product + Front end |

### Observability and supportability

| SPM ID | Requirement and target | Applies | Evidence | Source / owner |
| --- | --- | --- | --- | --- |
| SPM-NFR-019 | Requests and asynchronous business events shall emit structured logs, metrics and traces with correlation IDs, tenant-safe identifiers and no unnecessary sensitive payloads. | All | Trace a decision command through API, database event and consumer; log-sampling review. | DEFRA NFR-OPS-01; D10 · Operations + Platform |
| SPM-NFR-020 | Alerts for user-facing failure or SLO breach shall reach the assigned support route within the approved detection interval and coverage hours. **Candidate detection: five minutes.** | All | Injected alert test and routing record. | DEFRA NFR-OPS-02 · Operations |
| SPM-NFR-021 | Runbooks shall cover deployment, rollback, restart, restore, stuck inbox/outbox messages, failed integrations and escalation contacts. | All | Support-team walkthrough before go-live and after material change. | DEFRA NFR-OPS-03; D10 · Operations |

### Maintainability and testability

| SPM ID | Requirement and target | Applies | Evidence | Source / owner |
| --- | --- | --- | --- | --- |
| SPM-NFR-022 | Production changes shall use an automated, auditable delivery pipeline with a demonstrated safe rollback or forward-recovery procedure for code and schema changes. | All | Pipeline record and release recovery exercise. | DEFRA NFR-MNT-01 · Engineering |
| SPM-NFR-023 | Each change shall run automated unit, integration and critical-journey tests; release gates shall include tenant isolation, approval authority and historical decision reconstruction. | All | Pipeline results and critical-journey coverage map. | DEFRA NFR-MNT-02; D04, D06, D10 · Engineering |
| SPM-NFR-024 | Runtimes, frameworks and dependencies shall remain on supported versions; updates and vulnerability findings shall be tracked to resolution or accepted risk. | All | Dependency inventory and automated update records. | DEFRA NFR-MNT-03 · Engineering |
| SPM-NFR-025 | The repository shall document how to build, test, deploy, restore and operate the service and link significant architecture and domain decisions. | All | README, operations guide and decision-record review. | DEFRA NFR-MNT-04 · Engineering + Operations |

### Interoperability

| SPM ID | Requirement and target | Applies | Evidence | Source / owner |
| --- | --- | --- | --- | --- |
| SPM-NFR-026 | Published synchronous and asynchronous interfaces shall have versioned machine-readable contracts and a discoverable catalogue entry for their consumers. | All exposed interfaces | OpenAPI/AsyncAPI validation, compatibility checks and catalogue entry. | DEFRA NFR-INT-01 · Integration |
| SPM-NFR-027 | Where a tenant exchanges regulated or cross-government entities, integration contracts shall use applicable authoritative identifiers and document mappings to SPM canonical tenant IDs. | Conditional: relevant external entity standard | Data-model review and round-trip mapping test. | DEFRA NFR-INT-02; D08 · Integration + Data |

### Data and compliance

| SPM ID | Requirement and target | Applies | Evidence | Source / owner |
| --- | --- | --- | --- | --- |
| SPM-NFR-028 | Personal data shall be minimised; the accountable organisation shall complete and approve a data protection impact assessment when required before processing begins. | Conditional: personal data and assessment duty | Data inventory, DPIA decision and field-level minimisation review. | DEFRA NFR-DAT-01 · Data protection + Tenant owner |
| SPM-NFR-029 | Records shall be retained and disposed of according to the approved tenant schedule, with legal holds and required decision evidence preserved or lawfully redacted. **Periods pending.** | All | Retention policy, disposal test and hold/redaction audit trail. | DEFRA NFR-DAT-02; D07, D10 · Records owner + Platform |
| SPM-NFR-030 | Production transactional data, evidence, event queues, backups and operational telemetry shall be configured in AWS Europe (London), `eu-west-2`. Global DNS, identity, CI and provider metadata flows shall be separately assessed and recorded. **For a Defra OFFICIAL deployment, verify the current UK-region rule.** | All; Defra rule conditional | Infrastructure, backup, observability and external-flow location review. | DEFRA NFR-DAT-03; D10; product-owner hosting direction · Platform + Tenant owner |
| SPM-NFR-031 | Quality rules for data used in decisions, commitments and official reporting shall define completeness, validity, timeliness and reconciliation thresholds, and report breaches. **Thresholds pending.** | All relevant data feeds | Data-quality dashboard and seeded-defect test. | DEFRA NFR-DAT-04; D08 · Data owner |

### Sustainability

| SPM ID | Requirement and target | Applies | Evidence | Source / owner |
| --- | --- | --- | --- | --- |
| SPM-NFR-032 | Non-production environments shall scale down outside approved working hours where safe; production capacity shall track measured demand. | All hosted deployments | Scaling policy and monthly utilisation/cost review. | DEFRA NFR-SUS-01 · Platform |
| SPM-NFR-033 | Cloud cost and carbon impact shall be reported at an agreed cadence and attributed to the service where provider data permits. **Cadence pending.** | All cloud deployments | Provider cost and carbon reports with coverage caveats. | DEFRA NFR-SUS-02 · Platform + Sustainability |

### SPM-specific quality controls

These extend the Defra categories to cover the approved SPM domain model and operating decisions.

| SPM ID | Requirement and target | Applies | Evidence | Source / owner |
| --- | --- | --- | --- | --- |
| SPM-NFR-034 | Every API, worker, report and database role shall prevent one tenant from reading or changing another tenant's records, including via exports and background processing. **Target: zero cross-tenant disclosures in isolation tests.** | All | Automated adversarial tenant matrix and RLS tests. | D10; FR-038 · Security + Platform |
| SPM-NFR-035 | Approved decisions, commitments, case revisions and baselines shall remain reconstructable from immutable evidence after correction, supersession and restore. **Target: exact match to pre-failure evidence for sampled records.** | All | Restore and as-of reconstruction test. | D06–D09; FR-011, FR-029, FR-037 · Platform + Data |
| SPM-NFR-036 | An accepted command and its outbox event shall commit atomically; repeated inbound delivery shall not create duplicate business effects. **Target: zero duplicates in retry and crash tests.** | All integrations | Fault-injection test around commit/publish/consume boundaries. | D10; FR-041 · Platform + Integration |
| SPM-NFR-037 | Schema and application releases shall preserve supported data and event contracts or provide a tested migration and consumer transition path. | All | Migration rehearsal, rollback/forward plan and contract tests. | D01, D07, D08 · Engineering + Data |
| SPM-NFR-038 | Material tenant policy changes shall be attributable and earlier approvals shall remain interpretable under the policy version effective when made. **Target: 100% of sampled approval records resolve their policy version.** | All | Historical decision trace test across policy changes. | D04, D10; FR-030, FR-045 · Platform + Governance |

## Acceptance and evidence rules

1. A production target is valid only when its metric, measurement point, workload or operating condition, reporting period, accountable owner and approver are recorded in the service profile. A proposed number in this document is not a production promise.
2. Before go-live, each applicable NFR needs a test or review result, date, environment, owner and disposition. A failed or untested mandatory requirement requires a recorded risk decision and agreed exception route; it is not silently treated as passed.
3. Monitoring continues after go-live. Trend reports, incidents and material design changes trigger reassessment of the service profile and affected NFRs.
4. Supplier and platform contracts should cite the approved SPM requirement version, selected tier and targets. A Defra deployment must use the internal DDTS catalogue for the current authoritative wording and route.

## Open product decisions

- Select a default *candidate* service profile for the first deployable product environment, then obtain tenant-specific acceptance. D10 requires records, residency and recovery settings to be approved before go-live.
- Decide which SPM channels are public-facing. This determines the accessibility statement and JavaScript fallback obligations; the GOV.UK Design System styling decision applies to all SPM browser UI.
- Confirm how tenant-by-tenant RTO/RPO, residency and retention are enforced when infrastructure is shared.
- Map these NFRs to implementation backlog items and evidence owners. Existing SQL migrations alone do not demonstrate that a service-level target is met.

