-- Preserve the exact authority used for each new verification event.
-- Historical events predate this link and retain NULL rather than inventing provenance.
ALTER TABLE m05_investment.condition_verification
  ADD COLUMN mandate_id uuid,
  ADD CONSTRAINT condition_verification_mandate_fk
    FOREIGN KEY (tenant_id,mandate_id)
    REFERENCES m05_investment.condition_verifier_mandate(tenant_id,id);

CREATE OR REPLACE FUNCTION m05_investment.guard_condition_verification() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  parties record;
  selected_mandate_id uuid;
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM platform.current_tenant()
     OR NEW.verified_by IS DISTINCT FROM platform.current_actor()
     OR NOT platform.application_context() THEN
    RAISE EXCEPTION 'Verification actor and tenant context required';
  END IF;

  SELECT d.decided_by, i.owner_id, i.sponsor_id INTO parties
  FROM m05_investment.decision_condition c
  JOIN m05_investment.investment_decision d
    ON d.tenant_id=c.tenant_id AND d.id=c.decision_id
  LEFT JOIN m05_investment.investment i
    ON i.tenant_id=d.tenant_id AND i.id=d.investment_id
  WHERE c.tenant_id=NEW.tenant_id AND c.id=NEW.condition_id;

  IF NOT FOUND OR NEW.verified_by IN (parties.decided_by, parties.owner_id, parties.sponsor_id) THEN
    RAISE EXCEPTION 'Independent verifier required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM platform.tenant_member m
    WHERE m.tenant_id=NEW.tenant_id AND m.principal_id=NEW.verified_by
      AND m.active AND m.member_role IN ('contributor','administrator')
  ) THEN
    RAISE EXCEPTION 'Active verifier membership required';
  END IF;

  SELECT v.id INTO selected_mandate_id
  FROM m05_investment.condition_verifier_mandate v
  WHERE v.tenant_id=NEW.tenant_id AND v.principal_id=NEW.verified_by
    AND v.effective_during @> statement_timestamp()
    AND (v.revoked_at IS NULL OR v.revoked_at>statement_timestamp())
  ORDER BY lower(v.effective_during) DESC NULLS LAST, v.created_at DESC, v.id DESC
  LIMIT 1;
  IF selected_mandate_id IS NULL THEN
    RAISE EXCEPTION 'Effective verifier mandate required';
  END IF;

  NEW.mandate_id := selected_mandate_id;
  RETURN NEW;
END $$;
