# Validation record

**Executed:** GitHub Actions [Validate core schema, run 40075650203](https://github.com/squire1310/Strategic_Portfolio_Management/actions/runs/40075650203) on PostgreSQL 16; completed successfully on 24 October 2026. The workflow applied all four migrations with `ON_ERROR_STOP=1`, then ran `tests/smoke.sql` in a rollback-only transaction.

The smoke test exercised tenant/member setup, M01 strategy and objective, M02 portfolio and investment category, M03 demand and case revision, M04 scoring and recommendation, M05 investment/decision/commitment, M06 baseline approval and supersession, revision history, tenant RLS visibility and cross-tenant write rejection. It also verified that approved baseline items and decisions cannot be changed, an unauthorised decider is rejected, and a rejecting decision cannot authorise a commitment.

**Static checks:** no references to the old M02–M05 schema names remain in the revised files; SQL function dollar-quote delimiters are balanced. The old draft remains under `drafts/physical-schema` for traceability.

**Not tested or not yet decided:** performance at scale, concurrency under simultaneous approvals and outbox publication, migration from any deployed database, backup/restore, partitioning/retention, all status transitions, every tenant policy, external integration contracts, full baseline item target validation, scoring completeness and weight totals, monetary delegation thresholds, and user acceptance of the newly authored canonical domain model. Passing CI is not domain approval or production certification.

