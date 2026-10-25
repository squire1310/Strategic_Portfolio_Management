# End-to-End User Journey Catalogue — v1.0

**Date:** 2026-10-25 · **Status:** Proposed detailed journey baseline for UX research  
**Related:** [Personas](user-role-persona-catalogue-v1.0.md) · [Design decisions](ux-design-decisions.md) · [Logical architecture](logical-architecture.md)

## Scope and rules

Eleven journeys connect strategic intent, investment intake, evaluation, scenarios, governance, execution oversight, benefits, rebalancing, capacity, assurance and reporting. J01–J08 constitute the recurrent strategic value cycle; J09–J11 are cross-cutting. This catalogue is not a claim of implemented functionality.

Every governed handoff must identify: work item ID, source/receiving business roles, scoped assignee, linked record, required action, due date where applicable, submitted evidence version, review outcome, timestamps, audit trail and escalation. Handoffs do **not** transfer decision authority.

Principles: decision outcome separate from investment lifecycle; historical evidence/version immutability after submission; effective-dated strategies and baselines; never mistake missing data for good performance; no automatic authority by title or platform-admin role; preserve source-system ownership.

## Journey index

| ID | Journey | Lead | Main participant personas |
|---|---|---|---|
| J01 | Define and cascade strategy | EX02 | EX01 SP04 PM01 DE03 |
| J02 | Develop and submit investment proposal | IN01 | PM03 IN02 SP01 DE03 |
| J03 | Evaluate and prioritise investments | PM02 | IN02 SP01 SP02 SP03 EX02 |
| J04 | Model and compare scenarios | PM01 | PM02 EX03 SP01 SP02 EX02 |
| J05 | Review, decide and authorise investments | EX04 | PM01 EX03 IN01 SP03 PM03 |
| J06 | Monitor portfolio and delivery performance | PM02 | PM03 DE01 DE02 PM01 IN01 |
| J07 | Track benefits and strategic outcomes | DE03 | EX02 SP04 IN01 DE01 |
| J08 | Rebalance portfolio | PM01 | EX01 EX02 EX03 EX04 PM02 DE03 |
| J09 | Assess capacity | SP02 | PM01 PM02 DE01 SP01 |
| J10 | Assurance and risk review | SP03 | IN01 IN02 PM02 EX04 |
| J11 | Reporting and data quality | PM03 | PM02 DE01 DE02 SP01 SP04 |

## J01 — Define and cascade strategy

**Trigger:** Planning or policy change. **Lead:** EX02. **Participants:** EX01 SP04 PM01 DE03.  
**Primary steps and handoffs:** Draft strategy > define objectives/targets > review alignment > executive endorsement > publish and assign.  
**Decision gates:** Measurement readiness; endorsement; activation.  
**Alternative/exception paths:** Unmeasurable objectives; conflicting priorities; superseding effective-dated versions.  
**User experience requirements:** Strategy map, target history, ownership, alignment.  
**Architectural alignment (provisional):** Native M01; M02 links; optional performance M11/M12.

**Done when:** An authorised effective-dated strategy is published with accountable objectives, measures, and recorded accepted gaps.

## J02 — Develop and submit investment proposal

**Trigger:** Opportunity or strategic requirement. **Lead:** IN01. **Participants:** PM03 IN02 SP01 DE03.  
**Primary steps and handoffs:** Create draft > check duplicates > enter options, costs, benefits > request specialist inputs > submit > intake check.  
**Decision gates:** Submission readiness; intake eligibility; duplicate treatment.  
**Alternative/exception paths:** Incomplete returned with actions; expedited route; merge/link; sponsor replacement.  
**User experience requirements:** Guided wizard, completeness checks, collaboration, status timeline.  
**Architectural alignment (provisional):** Native M03; M01 alignment.

**Done when:** The submitted case is accepted for assessment or receives an explicit alternative disposition and notification.

## J03 — Evaluate and prioritise investments

**Trigger:** Accepted case or reassessment. **Lead:** PM02. **Participants:** IN02 SP01 SP02 SP03 EX02.  
**Primary steps and handoffs:** Assign assessment > strategic/financial/capacity/assurance reviews > consolidate findings > compare candidates > recommend.  
**Decision gates:** Evidence quality; concerns; ranking recommendation; need for scenarios.  
**Alternative/exception paths:** Mandatory proposal; divergent scores; stale estimates; conflict of interest.  
**User experience requirements:** Criteria-based review, scoring rationale, comparison, reviewer history.  
**Architectural alignment (provisional):** Native M04; optional M07/M08/M11 inputs.

**Done when:** A versioned assessment recommendation includes criteria, rationale, conflicts, uncertainties and actions.

## J04 — Model and compare scenarios

**Trigger:** Planning, constraint or funding change. **Lead:** PM01. **Participants:** PM02 EX03 SP01 SP02 EX02.  
**Primary steps and handoffs:** Snapshot baseline > select investments > branch scenarios > quantify cost/capacity/strategy > validate > recommend.  
**Decision gates:** Baseline reliability; feasibility; preferred option.  
**Alternative/exception paths:** Hard-constraint breaches; uncertain data; concurrent scenario branches.  
**User experience requirements:** Scenario canvas, sensitivity, lineage and side-by-side comparison.  
**Architectural alignment (provisional):** Native M04 decision models; optional M07/M08/M12.

**Done when:** Decision-ready scenarios preserve baselines, constraints, alternatives, assumptions and a recommended option.

## J05 — Review, decide and authorise investments

**Trigger:** Governance submission. **Lead:** EX04. **Participants:** PM01 EX03 IN01 SP03 PM03.  
**Primary steps and handoffs:** Prepare controlled pack > readiness/authority checks > challenge > determine > record > communicate > monitor conditions > effectuate.  
**Decision gates:** Authority; quorum/recusal; determination; conditions precedent.  
**Alternative/exception paths:** Rejection; deferral; information request; escalation; pack evidence changes; conflict.  
**User experience requirements:** Agenda, decision brief, evidence snapshot, formal record, condition tracker.  
**Architectural alignment (provisional):** Native M05/M06; platform policy/audit.

**Done when:** A legally/procedurally valid determination is recorded, conveyed and governed through any conditions.

## J06 — Monitor portfolio and delivery performance

**Trigger:** Reporting cycle or material exception. **Lead:** PM02. **Participants:** PM03 DE01 DE02 PM01 IN01.  
**Primary steps and handoffs:** Ingest source data > validate > confirm exception > analyse trend > assign intervention > track.  
**Decision gates:** Tolerance breach; escalation; baseline change needed.  
**Alternative/exception paths:** Stale source; conflicting actuals; emergency exception; status unknown.  
**User experience requirements:** Portfolio cockpit, exception queue, source provenance, trend and actions.  
**Architectural alignment (provisional):** M02/M05 portfolio oversight; optional M09/M10/M12.

**Done when:** The performance position and data limitations are clear, and material deviations have owners and interventions.

## J07 — Track benefits and strategic outcomes

**Trigger:** Benefits checkpoint or post-delivery review. **Lead:** DE03. **Participants:** EX02 SP04 IN01 DE01.  
**Primary steps and handoffs:** Confirm baselines/targets > ingest observations > validate evidence > assess variance > review strategy contribution > intervene.  
**Decision gates:** Evidence credible; variance; attribution; reforecast.  
**Alternative/exception paths:** Late benefits; shared outcomes; owner changed; revised targets; uncertain causation.  
**User experience requirements:** Benefits register, trajectories, source evidence, contribution and review.  
**Architectural alignment (provisional):** M01 outcomes; optional M11 benefits and M12 analytics.

**Done when:** Results and provenance are recorded for the period and the value owner explains outcome/forecast variances.

## J08 — Rebalance portfolio

**Trigger:** Strategy/funding/outcomes change. **Lead:** PM01. **Participants:** EX01 EX02 EX03 EX04 PM02 DE03.  
**Primary steps and handoffs:** Assess baseline > generate options > evaluate exit/dependency impacts > endorse recommendation > approve > change baselines > follow up.  
**Decision gates:** Intervene? feasible? termination obligations? approval authority?.  
**Alternative/exception paths:** Ring-fenced or mandated spending; contractual lock-in; wind-down; irreversible commitments.  
**User experience requirements:** Before/after analysis, authorisation routing, change implementation.  
**Architectural alignment (provisional):** M02/M04/M05/M06; optional M07–M11.

**Done when:** Authorised portfolio changes are implemented through controlled baselines with responsible follow-up.

## J09 — Assess capacity

**Trigger:** Proposal or allocation change. **Lead:** SP02. **Participants:** PM01 PM02 DE01 SP01.  
**Primary steps and handoffs:** Collect skill-period supply/demand > detect gaps > test sequencing/sourcing > validate > monitor.  
**Decision gates:** Reliable supply? double-booking? shortage remediation?.  
**Alternative/exception paths:** Missing demand; forecast vacancy; workforce privacy; supplier constraints.  
**User experience requirements:** Time-phased capacity heatmap, assumptions and constraints.  
**Architectural alignment (provisional):** Optional M08 + M04 scenarios; HR/workforce integration.

**Done when:** Time-phased capacity findings, risks and recommended mitigations are available for decision makers.

## J10 — Assurance and risk review

**Trigger:** Governance gate or risk trigger. **Lead:** SP03. **Participants:** IN01 IN02 PM02 EX04.  
**Primary steps and handoffs:** Determine applicable controls > request evidence > review > document findings > remedy > issue opinion > verify closure.  
**Decision gates:** Assurance required? independence? accept residual risk?.  
**Alternative/exception paths:** Conflict of interest; high-severity issue; missing evidence; failed closure.  
**User experience requirements:** Assurance workspace, evidence, independence check, finding tracking.  
**Architectural alignment (provisional):** Native M06 governance controls; optional M11 risk extension.

**Done when:** Assurance opinion and outstanding findings are recorded with independent remediation verification.

## J11 — Reporting and data quality

**Trigger:** Reporting cycle or quality issue. **Lead:** PM03. **Participants:** PM02 DE01 DE02 SP01 SP04.  
**Primary steps and handoffs:** Set reporting cut-off > ingest > validate > assign discrepancies > certify > snapshot > close.  
**Decision gates:** Completeness threshold; authoritative source; restatement.  
**Alternative/exception paths:** Late updates; source conflict; missing owner; restated published period.  
**User experience requirements:** Reporting dashboard, data-quality queues, reconciliation, snapshot lineage.  
**Architectural alignment (provisional):** M02 portfolio projections; platform integration; M12 analytics.

**Done when:** A publishable reporting snapshot or documented hold is recorded with known data-quality exceptions.

## Critical handoffs

| ID | From → To | Payload | Failure avoided |
|---|---|---|---|
| H01 | Strategy Director → Portfolio Director | Objectives, target measures | Uninterpretable strategic alignment |
| H02 | Sponsor → Portfolio Analyst | Submitted case, evidence | Missing ownership/completeness |
| H03 | Portfolio Analyst → Assessment Lead | Intake determination, criteria | Wrong assessment route |
| H04 | Assessment Lead → Specialists | Scoped review tasks | Forgotten reviews |
| H05 | Specialists → Portfolio Manager | Findings, assumptions | Hidden disagreement |
| H06 | Portfolio Manager → Portfolio Director | Ranking, constraints | Weak trade-off rationale |
| H07 | Portfolio Director → Committee | Controlled recommendation and alternatives | Unready decision packs |
| H08 | Committee → Sponsor / portfolio team | Determination, authority, conditions | Ambiguous approval |
| H09 | Portfolio team → execution tools | Approved baseline and integration acknowledgement | Divergent SPM/source states |
| H10 | Delivery Lead → Portfolio Manager | Verified performance exception | Late intervention |
| H11 | Benefits Owner → strategic leadership | Outcome observations and contribution evidence | Failure to rebalance on value |

## Reusable exception patterns

| ID | Pattern | Expected behaviour |
|---|---|---|
| E01 | Incomplete submission | Specific validation and correction request |
| E02 | Conflicting evidence | Show provenance; keep source versions |
| E03 | Missing owner | Authority-scoped reassignment/escalation |
| E04 | Authority failure | Block operation, route to correct authority |
| E05 | Conflict of interest | Declaration, recusal and quorum recheck |
| E06 | Stale external data | Age/confidence warning and restriction when needed |
| E07 | Conditions outstanding | Prevent gated effectuation |
| E08 | Funding or capacity breach | Mark infeasible, retain comparison |
| E09 | Retrospective change | Version/restatement with audit |
| E10 | Governance deadline missed | Escalation/reschedule with trace |
| E11 | Rejected/withdrawn/stopped | Preserve rationale, historical links and obligations |
| E12 | Integration failure | Retry/reconcile; do not claim synchronisation |
| E13 | Restricted information | Scoped filtering in UI/API/export |
| E14 | Reorganisation | Effective-dated responsibility and history |
| E15 | External funding/policy change | Impact review and reassessment |

## Lifecycle and governance state

Indicative investment progression: **Draft → Submitted → In assessment → Ready for decision → Decision pending → Authorised (only once applicable commencement prerequisites met) → Active → Completed/closed**. On hold, withdrawn, rejected, terminated, information requested and change pending are controlled alternate dispositions, not necessarily a single linear state machine.

**Approval, conditional approval, rejection, deferral and escalation are governance determinations, not synonyms for investment state**. Record both decision timestamp and effective time; retain prior decision revisions and condition satisfaction evidence. Benefits monitoring can continue after delivery closure.

## Experience requirements traceability

**UX-001–018:** role-aware home; task inbox; linked object navigation; guided submission; decision briefs; analytical portfolio views; workflow history; scoped access; strategy/benefit alignment; scenarios; integration provenance; delegation/segregation; governance configuration; collaboration; reporting quality; accessible devices; subscriptions; personal layouts.

| ID | Requirement | Journeys |
|---|---|---|
| UX-019 | Cross-role task/handoff inbox | All |
| UX-020 | Submitted business object versions/history | J01–J05 J07 J11 |
| UX-021 | Governance decision and investment lifecycle independently modelled | J05 |
| UX-022 | Configurable transition + delegated authority validation | J02–J05 J08 |
| UX-023 | Approval condition tracking and satisfaction evidence | J05 |
| UX-024 | Conflict-of-interest and reviewer independence | J03 J05 J10 |
| UX-025 | Data freshness, quality and provenance | J04 J06 J07 J11 |
| UX-026 | Scenario branching and comparisons | J04 J08 |
| UX-027 | Effective-dated strategies and organisation responsibilities | J01 J08 |
| UX-028 | Integrated-system reconciliation and failures | J06 J09 J11 |
| UX-029 | Controlled approved baseline changes | J06 J08 |
| UX-030 | Evidence-based outcome contribution with uncertainty | J07 |
| UX-031 | Time-phased demand and resource constraints | J04 J09 |
| UX-032 | Assurance findings and closure verification | J05 J10 |
| UX-033 | Reporting snapshot and restatement history | J06 J11 |
| UX-034 | Configurable assessments and templates | J02 J03 |
| UX-035 | Scoped cross-organisation collaboration | All |
| UX-036 | Exception-led notifications | J05–J11 |

## Enterprise and public-sector policies

One interaction model; organisation-selected variants for approval limits, delegated financial authority, governance quorum and minutes, statutory duties, funding-source restrictions, multi-year appropriation, assurance stages, prescribed business-case methods, retention, sensitivity and external approvals. Examples (such as UK Five Case Model) are configurable, not universally compulsory.

## Research and design sequencing

- **P01:** J02→J03→J05, Investment Sponsor, Portfolio Manager, Committee Member. Prototype standard approval, returned case, conditional approval and rejection.
- **P02:** J01→J04→J08, Strategy Director and Portfolio Director. Prototype strategic gap, scenario comparison and reprioritisation.
- **P03:** J06→J07→J08, Benefits Owner and portfolio/strategy participants. Prototype delivery deviation and actual benefits feeding portfolio choice.
- Cross-cutting: PM03 data quality; SP01 financial validation; SP03 assurance independence.

Acceptance checks: correctly route returned submissions; show competing reviews; block unpermitted approvals; lock submitted evidence versions; create tracked approval conditions; show infeasible scenarios; trace decision to strategic intent and evidence; expose integration staleness; continue benefits after closure. Quantitative UX targets need user-research baselines.

## Architecture reconciliation required

The actual repository boundary is **M01 Strategy and Outcomes, M02 Portfolio Architecture, M03 Demand and Cases, M04 Selection, M05 Decisions and Commitments, M06 Governance** (native); **M07–M12** are optional/native-or-integrated extensions. The journey notes are capability alignment, **not amendments** to module ownership or the reconciled canonical schema. Review task/handoff records, authority/delegation, conditions, governance-vs-lifecycle states, strategy/ownership effective dating, scenario lineage, evidence provenance, assurance independence, benefits observations and integration reconciliation against the existing models before any migration or implementation.
