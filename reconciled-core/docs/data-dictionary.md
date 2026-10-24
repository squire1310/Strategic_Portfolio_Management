# Physical data dictionary

This dictionary traces the approved [canonical model v1.0](canonical-domain-model-v1.0.md) to PostgreSQL tables. M01–M06 are native core boundaries. Each tenant-owned FK contains `tenant_id`; IDs are UUIDs. Unless marked append-only or a link, tables use `(tenant_id,id)` as primary key and carry `valid_during`, `row_version`, `created_at`, and `updated_at`. [Domain decisions v1.0](domain-decisions-v1.0.md) distinguish policy from current SQL enforcement.

| Module / table | Purpose | Key relationships and constraints | Change policy |
|---|---|---|---|
| Platform `tenant` | Isolation and tenant status | Unique `tenant_code` | Provisioning owner |
| Platform `principal` | Global external subject | Unique `subject` | Identity owner |
| Platform `tenant_member` | Tenant role and active membership | PK `(tenant_id,principal_id)` | Identity owner |
| Platform `code_set`, `reference_template` | Tenant codes and seed defaults | Tenant code triple; global template pair | Provisioning |
| Platform `source_system` | Registered external authority | Tenant-local code | Integration admin |
| Platform `source_identity` | External ID to canonical ID | Unique source/object/external key; polymorphic target | Integration worker; audit/outbox |
| Platform `audit_event` | Actor, operation, old/new row | Tenant + identity sequence | Append-only |
| Platform `entity_revision` | Full root snapshot over business and recorded time | Entity/version PK; no overlapping recorded intervals | Database trigger |
| Platform `outbox_event` | Transactional publish queue | Unique aggregate/version/type | Trigger and publisher |
| Platform `inbox_message` | Import deduplication and result | Source/message key PK | Integration worker |
| M01 `strategy` | Strategic horizon | Tenant code, owner | Versioned |
| M01 `objective` | Strategy aim and optional hierarchy | Strategy; tenant/strategy/code unique | Versioned |
| M01 `outcome` | Intended result | Objective; owner | Versioned |
| M01 `measure` | Target and baseline metric | Outcome; unit/direction | Versioned |
| M01 `measure_observation` | Dated measured value | Measure/date unique; optional source | Versioned |
| M02 `portfolio` | Investment grouping hierarchy | Parent portfolio; owner | Versioned |
| M02 `investment_category` | Tenant-local investment classification | Unique code | Versioned |
| M02 `portfolio_objective` | Strategic portfolio alignment | Composite pair PK | Link; service governed |
| M02 `portfolio_membership` | Time-bounded inclusion | Portfolio + M05 investment; GiST non-overlap for pair | Versioned |
| M03 `demand` | Intake request | Unique code; sponsor, submitter | Versioned |
| M03 `demand_objective` | Proposed alignment | Demand/objective pair PK | Link; service governed |
| M03 `business_case` | Case header | One per demand | Versioned |
| M03 `case_revision` | Submitted options and assumptions snapshot | Case/revision number unique | Immutable; audit/outbox |
| M04 `scoring_model` | Evaluation method | Tenant code; effective dates; weights total 1 when activated | Formula frozen after activation |
| M04 `criterion` | Weighted dimension | Unique model/code; weight 0–1 | Versioned while model draft; then frozen |
| M04 `assessment` | Demand or investment evaluation | Exactly one subject; model; case revision or investment version | Complete scores required; frozen when completed |
| M04 `criterion_score` | One bounded score per criterion | Composite FKs ensure same scoring model; score at most criterion maximum | Versioned while assessment draft |
| M04 `scenario` | Selection configuration | Tenant code; model | Versioned while draft; then frozen |
| M04 `scenario_candidate` | Ranked demand or investment | Unique scenario/subject; completed assessment | Versioned while scenario draft |
| M04 `selection_recommendation` | Proposed selection outcome | Scenario and demand/investment; database-frozen basis snapshot | Immutable; no approval effect |
| M05 `investment` | Stable canonical investment | Optional unique origin demand; M02 category | Versioned; approved lifecycle needs decision |
| M05 `investment_decision` | Authorised choice or baseline approval | M06 body, actor, subject; supersedes chain | Immutable; chair or delegation checked |
| M05 `commitment` | Approved funding/capacity/scope/schedule envelope | Same-investment approving decision | Immutable; approval checked |
| M05 `commitment_amendment` | Approved change to commitment | Same-investment commitment and decision | Immutable; approval checked |
| M06 `decision_body` | Investment authority | Tenant code; chair | Versioned |
| M06 `gate` | Governed review point | Decision body and lifecycle stage | Versioned |
| M06 `delegation` | Time-bounded authority grant | Body, delegate, scope and optional limit | Versioned |
| M06 `assurance_finding` | Recorded assurance issue | Investment; optional gate; closure evidence | Versioned |
| M06 `governance_exception` | Controlled exception | Investment; optional same-investment finding | Versioned |
| M06 `governance_action` | Remedial task | Exactly one finding or exception | Versioned |
| M06 `baseline` | Approved portfolio snapshot | Portfolio, matching approval; valid and recorded ranges | Approval and successor pattern |
| M06 `baseline_item` | Frozen item/version/payload | Baseline; typed polymorphic item | Immutable after approval |

## Storage and query rules

- All root updates increment `row_version` in a trigger. A command should use `WHERE tenant_id = ? AND id = ? AND row_version = ?` to detect concurrent edits.
- `entity_revision.valid_during` is the asserted business-effective interval; `recorded_during` is when this database held that version. It stores full JSON row snapshots. `baseline` has its own business-valid and recorded ranges.
- `case_revision`, `selection_recommendation`, `investment_decision`, `commitment`, and `commitment_amendment` are insert-only. Corrections create new records with lineage.
- Mutable portfolio/demand alignment links, baseline draft items, source-system registrations and tenant memberships now emit audit and outbox records. Their surrogate IDs are stable even where business uniqueness remains a composite key.
- Approval of a baseline closes the recorded interval of an earlier approved baseline of the same type, portfolio, and **identical** business-valid interval. A partial overlap is rejected because closing the entire prior interval would lose unaffected valid time. GiST exclusion prevents two simultaneous approved interpretations.
- `source_identity.canonical_id`, `investment_decision.subject_id` for baselines, and `baseline_item.item_id` are typed polymorphic references. Their owning services verify target existence and scope before writing.
- Primary and unique keys provide tenant-first access. Additional indexes cover outbox pending, inbox unprocessed, source identity reverse lookup, assessment/recommendation/decision history, delegation, portfolio membership reverse lookup, and baseline portfolio queries. Reporting workloads should be measured before adding more indexes.

