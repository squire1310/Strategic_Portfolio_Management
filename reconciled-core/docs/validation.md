# Validation record

**Executed:** GitHub Actions [Validate core schema, run 40076403068](https://github.com/squire1310/Strategic_Portfolio_Management/actions/runs/40076403068) on PostgreSQL 16. Its migration and smoke-test steps passed on 24 October 2026. The workflow applied all five migrations with `ON_ERROR_STOP=1`, then ran `tests/smoke.sql` in a rollback-only transaction.

The smoke test exercised tenant/member setup, M01 strategy and objective, M02 portfolio and investment category, M03 demand and case revision, M04 scoring and recommendations for both demand and existing investment, M05 investment/decision/commitment, M06 baseline approval and supersession, revision history, tenant RLS visibility and cross-tenant write rejection. It verified score limits, frozen completed assessments and recommendation evidence, decision authority and immutability, approved baseline item immutability, exact-interval baseline succession and rejection of partial-overlap succession, and rejection of a commitment backed by a rejecting decision.

**Static checks:** no references to the old M02–M05 schema names remain in the revised files; SQL function dollar-quote delimiters are balanced. The old draft remains under `drafts/physical-schema` for traceability.

**Approved but not yet fully implemented or tested:** the [model and product policy](domain-decisions-v1.0.md) were approved on 24 October 2026. Scoring aggregation/ranking, monetary delegation, quorum, separation of duties, condition release, scenario constraints, JSON contracts, full target validation and complete lifecycle transitions still need implementation and acceptance tests. Performance at scale, concurrent approvals/outbox publication, migration from a deployed database, backup/restore, partitioning/retention, every tenant policy and external integration contracts were not tested. Passing CI is not production certification.

