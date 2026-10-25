# UX and persona design decisions — 2026-10-25

**Status:** Seven design positions explicitly accepted by product owner. These decisions guide discovery and UX, not approval of implementation changes.  
**Source documents:** [Persona catalogue v1.0](user-role-persona-catalogue-v1.0.md) · [User journey catalogue v1.0](user-journey-catalogue-v1.0.md).

| UX decision | Agreed position | Implication |
|---|---|---|
| UXD-01 | Adopt 18 canonical business personas across five families | Model business needs separately from login/permission roles |
| UXD-02 | Use six core experience archetypes | Shared app shell, contextual personalisation, no 18 independent UIs |
| UXD-03 | Use EX02, EX04, PM01, PM02, IN01, DE03 as six initial research and prototype anchors | Prototype cross-role scenarios; specialists participate as supporting reviewers |
| UXD-04 | Keep persona identity, responsibility, permissions and delegated authority distinct | Context-aware RBAC/ABAC and independently validated authority |
| UXD-05 | Make cross-role end-to-end journeys the primary unit of experience design | Handoffs, decision gates and exception paths are core design artifacts |
| UXD-06 | Support enterprise and public-sector variants using configurable policies and governance | Common platform, policy-specific review and authority routes |
| UXD-07 | Prioritise integration rather than reproducing detailed delivery tooling | Source-of-authority and reconciliation remain explicit |

## Scope boundaries and unresolved items

- The journeys are design proposals requiring user testing. They do not assert current application capability.
- The current technical reference is [Solution overview](solution-overview.md) and [logical architecture](logical-architecture.md), with native M01–M06 and optional/integrated M07–M12. Do not apply provisional journey labels as changed module definitions.
- No schema, migration or application changes are authorised by this decision record.
- Next validation: P01 investment proposal → assessment → governance service blueprint and screen inventory, then P02 strategic scenario and P03 benefits-to-rebalance.

## Governance concepts to preserve

Recommendation ≠ endorsement ≠ funding approval ≠ baseline effectuation. Formal committee determinations may occur outside the platform and still require reliable capture. Approval conditions precedent must block disallowed commencement. Technical administrators do not automatically gain business approval rights.

## P01 design artefacts (25 October 2026)

- [Investment-to-decision cross-role service blueprint v1.0](investment-decision-service-blueprint-v1.0.md): J02→J03→J05 lanes, transitions, decision gates, alternate paths, authority and exception handling.
- [Investment-to-decision screen inventory and interaction specification v1.0](investment-decision-screen-interaction-spec-v1.0.md): 14 conceptual screens, role-based information hierarchies, five prototype walkthroughs and user-research checks.

Both are specifications awaiting usability validation; no app or schema changes are authorised.
