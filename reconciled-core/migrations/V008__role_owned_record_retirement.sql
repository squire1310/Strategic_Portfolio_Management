-- Prototype removal semantics retain history and audit evidence.
-- These fields support Policy retirement/void actions without hard-deleting records.
ALTER TABLE m01_strategy.measure
  ADD COLUMN status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'retired'));

ALTER TABLE m01_strategy.measure_observation
  ADD COLUMN voided boolean NOT NULL DEFAULT false,
  ADD COLUMN void_reason text,
  ADD CONSTRAINT observation_void_reason_required
    CHECK ((NOT voided AND void_reason IS NULL) OR (voided AND nullif(btrim(void_reason), '') IS NOT NULL));
