# Role ownership in the strategic portfolio pilot

**Decision:** 24 October 2026. This is the synthetic-data prototype permission model. Every signed-in role can view all records and their history within its tenant. The server, not the page layout, enforces write permissions. Tenant membership and row-level security remain independent checks.

| Role | Maintains | Available actions |
| --- | --- | --- |
| Executive | Strategy | Create, revise and retire strategies. |
| Policy | Objectives, outcomes, measures and observations | Create and revise objectives/outcomes/measures, retire those records, record and correct observations, and void an observation with a reason. |
| Portfolio Manager | Portfolios and categories | Create, revise and retire portfolios/categories; change portfolio hierarchy; maintain strategic portfolio-to-objective alignments. |
| Engagement Lead | Candidate investments and portfolio assignments | Create and revise candidate investments; cancel an unassigned candidate; create, revise and remove assignments for candidate investments. |
| Viewer | No records | View all tenant data and history. |

The application has separate **Strategy**, **Objectives and outcomes**, **Portfolios and categories**, **Investments and assignments**, and **Record history** pages. Users may navigate to every page; forms appear only where their role permits them. Sending a command directly to the API remains subject to the same role check.

**Removal means:** strategy, objective, outcome, measure, portfolio and category are retired; an observation is voided with a reason; a candidate investment is cancelled only after its assignments have been removed. A candidate investment's portfolio assignment can be deleted, but its audit and revision history remain. Approved or active investments and their assignments are governed records and cannot be cancelled or removed by the Engagement Lead through this prototype.

**Assumption:** strategic alignment belongs to the Portfolio Manager because it describes portfolio contribution to policy objectives. This is outside the nine explicit allocations and can be reassigned later. Ownership is by role, not by the particular person named in a record's `owner_id`. The prototype uses local accounts; production needs identity federation, delegated access management and an agreed records policy.
