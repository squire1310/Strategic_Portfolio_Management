# Entity relationship diagrams

Edges represent tenant-scoped composite foreign keys unless marked as an application-validated polymorphic reference. The diagrams focus on ownership; operational timestamp and version columns are omitted for readability.

## Platform and M01–M03

```mermaid
erDiagram
  TENANT ||--o{ TENANT_MEMBER : contains
  PRINCIPAL ||--o{ TENANT_MEMBER : joins
  TENANT ||--o{ SOURCE_SYSTEM : registers
  SOURCE_SYSTEM ||--o{ SOURCE_IDENTITY : maps
  TENANT ||--o{ STRATEGY : owns
  STRATEGY ||--o{ OBJECTIVE : defines
  OBJECTIVE ||--o{ OBJECTIVE : parent
  OBJECTIVE ||--o{ MEASURE : tracks
  MEASURE ||--o{ MEASURE_OBSERVATION : records
  DEMAND ||--o{ DEMAND_OBJECTIVE : proposes
  OBJECTIVE ||--o{ DEMAND_OBJECTIVE : aligns
  DEMAND ||--o{ ASSESSMENT : evaluated_by
  DEMAND o|--o| INITIATIVE : originates
  PORTFOLIO ||--o{ PORTFOLIO_MEMBERSHIP : groups
  INITIATIVE ||--o{ PORTFOLIO_MEMBERSHIP : included_in
  INITIATIVE ||--o{ INITIATIVE_OBJECTIVE : contributes
  OBJECTIVE ||--o{ INITIATIVE_OBJECTIVE : served_by
  INITIATIVE ||--o{ INITIATIVE_DEPENDENCY : predecessor
  INITIATIVE ||--o{ INITIATIVE_DEPENDENCY : successor
  PORTFOLIO o|--o{ PORTFOLIO : parent
  TENANT { uuid tenant_id PK }
  PRINCIPAL { uuid principal_id PK }
  TENANT_MEMBER { uuid tenant_id PK
                  uuid principal_id PK }
  SOURCE_SYSTEM { uuid tenant_id PK
                  uuid source_system_id PK }
  SOURCE_IDENTITY { uuid tenant_id PK
                    uuid source_identity_id PK }
  STRATEGY { uuid tenant_id PK
             uuid id PK
             string code UK }
  OBJECTIVE { uuid tenant_id PK
              uuid id PK
              uuid strategy_id FK }
  MEASURE { uuid tenant_id PK
            uuid id PK
            uuid objective_id FK }
  MEASURE_OBSERVATION { uuid tenant_id PK
                        uuid id PK
                        uuid measure_id FK }
  DEMAND { uuid tenant_id PK
           uuid id PK
           string code UK }
  DEMAND_OBJECTIVE { uuid tenant_id PK
                     uuid demand_id PK
                     uuid objective_id PK }
  ASSESSMENT { uuid tenant_id PK
               uuid id PK
               uuid demand_id FK }
  PORTFOLIO { uuid tenant_id PK
              uuid id PK
              uuid parent_portfolio_id FK }
  INITIATIVE { uuid tenant_id PK
               uuid id PK
               uuid origin_demand_id FK }
  PORTFOLIO_MEMBERSHIP { uuid tenant_id PK
                         uuid portfolio_id PK
                         uuid initiative_id PK }
  INITIATIVE_OBJECTIVE { uuid tenant_id PK
                         uuid initiative_id PK
                         uuid objective_id PK }
  INITIATIVE_DEPENDENCY { uuid tenant_id PK
                          uuid predecessor_id PK
                          uuid successor_id PK }
```

## M04–M06 and history

```mermaid
erDiagram
  INITIATIVE ||--o{ FINANCIAL_PLAN : planned_for
  FUNDING_SOURCE ||--o{ FINANCIAL_PLAN : funds
  FINANCIAL_PLAN ||--o{ PLAN_LINE : contains
  INITIATIVE ||--o{ ACTUAL : incurs
  SOURCE_SYSTEM ||--o{ ACTUAL : imports
  RESOURCE_POOL ||--o{ CAPACITY_PERIOD : supplies
  RESOURCE_POOL ||--o{ ALLOCATION : assigned
  INITIATIVE ||--o{ ALLOCATION : requests
  DECISION_BODY ||--o{ DECISION : makes
  DECISION o|--o| BASELINE : approves
  PORTFOLIO ||--o{ BASELINE : governed_by
  BASELINE ||--o{ BASELINE_ITEM : freezes
  TENANT ||--o{ ENTITY_REVISION : histories
  TENANT ||--o{ AUDIT_EVENT : audits
  TENANT ||--o{ OUTBOX_EVENT : emits
  SOURCE_SYSTEM ||--o{ INBOX_MESSAGE : receives
  INITIATIVE { uuid tenant_id PK
               uuid id PK }
  PORTFOLIO { uuid tenant_id PK
              uuid id PK }
  SOURCE_SYSTEM { uuid tenant_id PK
                  uuid source_system_id PK }
  FUNDING_SOURCE { uuid tenant_id PK
                   uuid id PK }
  FINANCIAL_PLAN { uuid tenant_id PK
                   uuid id PK
                   uuid initiative_id FK }
  PLAN_LINE { uuid tenant_id PK
              uuid id PK
              date period_start }
  ACTUAL { uuid tenant_id PK
           uuid id PK
           string external_transaction_key UK }
  RESOURCE_POOL { uuid tenant_id PK
                  uuid id PK }
  CAPACITY_PERIOD { uuid tenant_id PK
                    uuid id PK
                    date period_start }
  ALLOCATION { uuid tenant_id PK
               uuid id PK
               date period_start }
  DECISION_BODY { uuid tenant_id PK
                  uuid id PK }
  DECISION { uuid tenant_id PK
             uuid id PK
             uuid subject_id }
  BASELINE { uuid tenant_id PK
             uuid id PK
             tstzrange valid_during
             tstzrange recorded_during }
  BASELINE_ITEM { uuid tenant_id PK
                  uuid baseline_id PK
                  uuid item_id PK
                  int item_version }
  TENANT { uuid tenant_id PK }
  ENTITY_REVISION { uuid tenant_id PK
                    uuid entity_id PK
                    int version_no PK }
  AUDIT_EVENT { uuid tenant_id PK
                bigint audit_id PK }
  OUTBOX_EVENT { uuid tenant_id PK
                 uuid event_id PK }
  INBOX_MESSAGE { uuid tenant_id PK
                  uuid source_system_id PK
                  string message_key PK }
```

`SOURCE_IDENTITY.canonical_id`, `DECISION.subject_id`, and `BASELINE_ITEM.item_id` refer to multiple possible tables. They are validated by their owning services, not by a SQL foreign key. `ENTITY_REVISION` and `AUDIT_EVENT` likewise use typed table names and entity IDs.

