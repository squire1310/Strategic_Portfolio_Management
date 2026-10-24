-- Increment 1: retain the causal explanation for an intended outcome (FR-003).
-- Existing records, if any, require a backfill before an application marks them active.
ALTER TABLE m01_strategy.outcome
  ADD COLUMN contribution_rationale text;

