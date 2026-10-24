# Validation record

**Executed:** GitHub Actions [Validate core schema, run 40076403068](https://github.com/squire1310/Strategic_Portfolio_Management/actions/runs/40076403068) on PostgreSQL 16. Its migration and smoke-test steps passed on 24 October 2026. The workflow applied all five migrations with `ON_ERROR_STOP=1`, then ran `tests/smoke.sql` in a rollback-only transaction.

The smoke test exercised tenant/member setup, M01 strategy and objective, M02 portfolio and investment category, M03 demand and case revision, M04 scoring and recommendations for both demand and existing investment, M05 investment/decision/commitment, M06 baseline approval and supersession, revision history, tenant RLS visibility and cross-tenant write rejection. It verified score limits, frozen completed assessments and recommendation evidence, decision authority and immutability, approved baseline item immutability, exact-interval baseline succession and rejection of partial-overlap succession, and rejection of a commitment backed by a rejecting decision.

**Static checks:** no references to the old M02–M05 schema names remain in the revised files; SQL function dollar-quote delimiters are balanced. The old draft remains under `drafts/physical-schema` for traceability.

**Not tested or not yet decided:** performance at scale, concurrency under simultaneous approvals and outbox publication, migration from any deployed database, backup/restore, partitioning/retention, all status transitions, every tenant policy, external integration contracts, full baseline item target validation, monetary delegation thresholds, scoring aggregation and ranking formula, and user acceptance of the newly authored canonical domain model. The [decision register](domain-decision-register.md) lists business and operating sign-offs. Passing CI is not domain approval or production certification.

