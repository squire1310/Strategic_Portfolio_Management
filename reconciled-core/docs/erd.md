# Mermaid ERDs

Each SQL FK between tenant-owned entities includes `tenant_id`; diagrams suppress this repeated edge label. Polymorphic references are called out below.

## M01–M03: intent, architecture, cases

```mermaid
erDiagram
  TENANT ||--o{ STRATEGY : owns
  STRATEGY ||--o{ OBJECTIVE : defines
  OBJECTIVE o|--o{ OBJECTIVE : parent
  OBJECTIVE ||--o{ OUTCOME : expects
  OUTCOME ||--o{ MEASURE : tracks
  MEASURE ||--o{ OBSERVATION : records
  PORTFOLIO o|--o{ PORTFOLIO : parent
  PORTFOLIO ||--o{ PORTFOLIO_OBJECTIVE : aligns
  OBJECTIVE ||--o{ PORTFOLIO_OBJECTIVE : targeted
  PORTFOLIO ||--o{ PORTFOLIO_MEMBERSHIP : contains
  INVESTMENT ||--o{ PORTFOLIO_MEMBERSHIP : belongs
  DEMAND ||--o{ DEMAND_OBJECTIVE : proposes
  OBJECTIVE ||--o{ DEMAND_OBJECTIVE : targeted
  DEMAND ||--o| BUSINESS_CASE : has
  BUSINESS_CASE ||--o{ CASE_REVISION : submits
  DEMAND o|--o| INVESTMENT : originates
  CATEGORY ||--o{ INVESTMENT : classifies
  STRATEGY { uuid tenant_id PK
             uuid id PK
             string code UK }
  OBJECTIVE { uuid tenant_id PK
              uuid id PK
              uuid strategy_id FK }
  OUTCOME { uuid tenant_id PK
            uuid id PK
            uuid objective_id FK
            string contribution_rationale }
  MEASURE { uuid tenant_id PK
            uuid id PK
            uuid outcome_id FK }
  OBSERVATION { uuid tenant_id PK
                uuid id PK
                date observed_on }
  PORTFOLIO { uuid tenant_id PK
              uuid id PK
              uuid parent_portfolio_id FK }
  PORTFOLIO_OBJECTIVE { uuid tenant_id PK
                        uuid portfolio_id PK
                        uuid objective_id PK }
  PORTFOLIO_MEMBERSHIP { uuid tenant_id PK
                         uuid id PK
                         daterange membership_during }
  DEMAND { uuid tenant_id PK
           uuid id PK
           string code UK }
  DEMAND_OBJECTIVE { uuid tenant_id PK
                     uuid demand_id PK
                     uuid objective_id PK }
  BUSINESS_CASE { uuid tenant_id PK
                  uuid id PK
                  uuid demand_id FK }
  CASE_REVISION { uuid tenant_id PK
                  uuid id PK
                  int revision_no }
  INVESTMENT { uuid tenant_id PK
               uuid id PK
               uuid origin_demand_id FK }
  CATEGORY { uuid tenant_id PK
             uuid id PK }
  TENANT { uuid tenant_id PK }
```

## M04–M06: choice, commitment, assurance

```mermaid
erDiagram
  SCORING_MODEL ||--o{ CRITERION : weights
  SCORING_MODEL ||--o{ ASSESSMENT : governs
  DEMAND ||--o{ ASSESSMENT : evaluated
  INVESTMENT ||--o{ ASSESSMENT : reevaluated
  CASE_REVISION o|--o{ ASSESSMENT : basis
  ASSESSMENT ||--o{ CRITERION_SCORE : contains
  CRITERION ||--o{ CRITERION_SCORE : scored
  SCORING_MODEL ||--o{ SCENARIO : used_by
  SCENARIO ||--o{ SCENARIO_CANDIDATE : compares
  DEMAND ||--o{ SCENARIO_CANDIDATE : considered
  INVESTMENT ||--o{ SCENARIO_CANDIDATE : reconsidered
  SCENARIO ||--o{ RECOMMENDATION : proposes
  DEMAND ||--o{ RECOMMENDATION : proposed
  INVESTMENT ||--o{ RECOMMENDATION : proposed
  DECISION_BODY ||--o{ INVESTMENT_DECISION : authorises
  RECOMMENDATION o|--o{ INVESTMENT_DECISION : informs
  INVESTMENT ||--o{ INVESTMENT_DECISION : decided
  INVESTMENT ||--o{ COMMITMENT : committed
  INVESTMENT_DECISION ||--o{ COMMITMENT : approves
  COMMITMENT ||--o{ AMENDMENT : changed_by
  INVESTMENT_DECISION ||--o{ AMENDMENT : approves
  DECISION_BODY ||--o{ GATE : governs
  DECISION_BODY ||--o{ DELEGATION : delegates
  INVESTMENT ||--o{ FINDING : assures
  GATE o|--o{ FINDING : raises
  INVESTMENT ||--o{ EXCEPTION : records
  FINDING o|--o{ EXCEPTION : relates
  FINDING o|--o{ ACTION : resolves
  EXCEPTION o|--o{ ACTION : resolves
  PORTFOLIO ||--o{ BASELINE : freezes
  BASELINE ||--o{ BASELINE_ITEM : snapshots
  INVESTMENT_DECISION o|--o| BASELINE : approves
  SCORING_MODEL { uuid tenant_id PK
                  uuid id PK }
  CRITERION { uuid tenant_id PK
              uuid id PK
              numeric weight }
  ASSESSMENT { uuid tenant_id PK
               uuid id PK
               uuid demand_id FK }
  CRITERION_SCORE { uuid tenant_id PK
                    uuid id PK
                    numeric score }
  SCENARIO { uuid tenant_id PK
             uuid id PK }
  SCENARIO_CANDIDATE { uuid tenant_id PK
                       uuid id PK
                       int rank
                       numeric aggregate_score }
  RECOMMENDATION { uuid tenant_id PK
                   uuid id PK }
  INVESTMENT { uuid tenant_id PK
               uuid id PK }
  INVESTMENT_DECISION { uuid tenant_id PK
                        uuid id PK
                        uuid subject_id
                        numeric approval_amount
                        string approval_currency
                        jsonb authority_snapshot }
  COMMITMENT { uuid tenant_id PK
               uuid id PK }
  AMENDMENT { uuid tenant_id PK
              uuid id PK }
  DECISION_BODY { uuid tenant_id PK
                  uuid id PK
                  numeric monetary_limit
                  string currency_code
                  int quorum_required }
  GATE { uuid tenant_id PK
         uuid id PK }
  DELEGATION { uuid tenant_id PK
               uuid id PK }
  FINDING { uuid tenant_id PK
            uuid id PK }
  EXCEPTION { uuid tenant_id PK
              uuid id PK }
  ACTION { uuid tenant_id PK
           uuid id PK }
  PORTFOLIO { uuid tenant_id PK
              uuid id PK }
  BASELINE { uuid tenant_id PK
             uuid id PK
             tstzrange valid_during
             tstzrange recorded_during }
  BASELINE_ITEM { uuid tenant_id PK
                  uuid baseline_id PK
                  uuid item_id PK }
  DEMAND { uuid tenant_id PK
           uuid id PK }
  CASE_REVISION { uuid tenant_id PK
                  uuid id PK }
```

`INVESTMENT_DECISION.subject_id` refers to either its investment or a baseline. `BASELINE_ITEM.item_id` can point to several frozen core types. V006 verifies allowed baseline targets, exact current versions and portfolio scope at approval; a single SQL FK cannot express this typed relationship. The command service still owns full lifecycle and authorization policy.

## Platform provenance and event flow

```mermaid
erDiagram
  TENANT ||--o{ TENANT_MEMBER : contains
  PRINCIPAL ||--o{ TENANT_MEMBER : joins
  TENANT ||--o{ SOURCE_SYSTEM : registers
  SOURCE_SYSTEM ||--o{ SOURCE_IDENTITY : maps
  SOURCE_SYSTEM ||--o{ INBOX_MESSAGE : receives
  TENANT ||--o{ AUDIT_EVENT : audits
  TENANT ||--o{ ENTITY_REVISION : histories
  TENANT ||--o{ OUTBOX_EVENT : emits
  TENANT { uuid tenant_id PK }
  PRINCIPAL { uuid principal_id PK }
  TENANT_MEMBER { uuid tenant_id PK
                  uuid principal_id PK }
  SOURCE_SYSTEM { uuid tenant_id PK
                  uuid source_system_id PK }
  SOURCE_IDENTITY { uuid tenant_id PK
                    uuid source_identity_id PK }
  INBOX_MESSAGE { uuid tenant_id PK
                  string message_key PK }
  AUDIT_EVENT { uuid tenant_id PK
                bigint audit_id PK }
  ENTITY_REVISION { uuid tenant_id PK
                    uuid entity_id PK
                    int version_no PK }
  OUTBOX_EVENT { uuid tenant_id PK
                 uuid event_id PK }
```

