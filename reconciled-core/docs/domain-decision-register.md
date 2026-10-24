# Domain decision register

The v0.3 model text was unavailable, so v0.4 is a newly authored proposal. The approved solution overview establishes the M01–M06 boundaries; it does not approve every entity, attribute, formula, or governance rule below. Domain owners should record a decision, owner, and effective date for each item before production use.

| ID | Decision needed | Current draft assumption | Acceptance evidence |
| --- | --- | --- | --- |
| D01 | Confirm canonical entity names, ownership, and identifiers across M01–M06 | The v0.4 entity catalogue and tenant-local codes are proposed | Signed model and interface review by module owners |
| D02 | Define scoring normalization, aggregate calculation, rank and tie rules | Criteria weights total 1 and scores are bounded; aggregate scores are supplied by the selection service | Versioned formula, worked examples, and independent recalculation test |
| D03 | Set portfolio selection constraints | Scenarios capture candidates and their scores, but capacity, funding, dependencies and strategic minimums are service rules | Approved constraint catalogue and scenario acceptance cases |
| D04 | Define decision authority, quorum and separation of duties | SQL checks chair or active scope delegation; optional monetary limit is stored but not enforced | Delegation matrix with thresholds, quorum and conflict rules; negative tests |
| D05 | Define financial and capacity commitment semantics | M05 stores approved envelopes; M07 and M08 own actuals and detailed resource supply | Envelope dimensions, currencies/units, amendment arithmetic and reconciliation examples |
| D06 | Define baseline valid-time succession | A successor may replace exactly the same business-valid interval; partial overlaps are rejected to preserve historical meaning | Policy for interval splitting/correction and as-of query examples |
| D07 | Define evidence contracts | Case revision options/assumptions and recommendation basis are JSON snapshots | Versioned JSON schemas, required fields, size limits and retention policy |
| D08 | Define polymorphic target validation | Source identity and baseline item references record type/id/version, with service validation | Allowed target registry and approval-time verification tests |
| D09 | Define lifecycle and exceptions | Core states and some immutable transitions are enforced; end-to-end workflow remains in command services | Transition matrix, exception handling, reopening and compensation rules |
| D10 | Define operating controls | Tenant context is transaction-local; audit and outbox are retained without a final operating policy | Security, access review, retention, partitioning, recovery and integration runbooks |

Until these decisions are accepted, use the schema as a tested implementation candidate and keep integrations behind versioned contracts. Changes to approved facts should create new revisions, decisions, amendments or successor baselines rather than rewriting evidence.

