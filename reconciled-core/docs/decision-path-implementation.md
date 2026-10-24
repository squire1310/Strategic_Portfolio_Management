# Decision path implementation, increment 1

**Scope:** Migration V006 adds database checks for the demand/investment assessment → scenario → recommendation → independent decision → funding commitment → portfolio baseline path. This is a persistence and policy increment, not a deployed API service or complete implementation of D01–D10.

## Command boundary

The future command service must authenticate an active tenant member, authorize the requested module command, and open one database transaction with transaction-local `app.tenant_id`, `app.actor_id`, and a request/correlation ID. It must never accept tenant or actor settings from an untrusted payload. The service should call module-owned commands rather than grant clients direct table access. The current `spm_app` SQL role still has broad DML grants, so direct SQL must remain restricted to trusted application infrastructure.

| Command | Owning module | Required result |
| --- | --- | --- |
| Submit case revision | M03 | Immutable case evidence linked to submitted demand |
| Complete assessment | M04 | Active scoring model, exact case or investment version, complete bounded criterion scores |
| Lock scenario | M04 | Candidate normalized scores and shared ranks for ties, frozen scenario |
| Recommend selection | M04 | Immutable basis snapshot; does not approve or reserve anything |
| Decide investment | M05 with M06 authority | Authenticated independent approver, scoped mandate and monetary ceiling, frozen authority evidence |
| Record funding commitment | M05 | Same-investment approving decision; amount and currency no greater than approval |
| Approve baseline | M06 with M05 decision | Independent approver; each item matches its current version and snapshot and belongs to the portfolio |

`normalized_score(tenant, assessment)` computes `100 × Σ(weight × score / maximum_score)`. The stored candidate score has ten decimal places; lock assigns `dense_rank` using the calculated numeric result before storage rounding, so exact ties share a rank. A scoring rubric must ensure higher entered points always mean better performance, including cost and risk dimensions.

Funding approvals carry a frozen amount/currency and a snapshot of the body mandate and delegation. A body with `quorum_required > 1` cannot issue a decision through this increment because vote evidence is not yet modeled. This blocks unsupported committee approval instead of treating a single signature as quorum. Funding commitments are checked against the approving decision. Capacity and scope/schedule commitments still need their full policy contracts.

Baseline approval verifies the stored payload against the current row for allowed item types and checks portfolio scope at the baseline's valid start date. The decision maker must differ from the baseline creator. Approval retains exact item versions; later updates do not rewrite the snapshot. Full valid-interval coverage, not just the start date, needs a subsequent policy/test increment.

## Remaining release blockers

Issue [#4](https://github.com/squire1310/Strategic_Portfolio_Management/issues/4) remains open. In particular: typed scenario constraints and override evidence (D03); vote/quorum, conditions and full delegation workflow (D04); amendment resulting-envelope calculation and typed capacity/scope/schedule contracts (D05); versioned JSON evidence schemas (D07); source-identity target and conflict handling (D08); complete lifecycle transitions (D09); and tenant provisioning, retention, recovery and service authorization (D10). The SQL smoke test demonstrates this narrow path and selected negative cases; it is not production acceptance.

