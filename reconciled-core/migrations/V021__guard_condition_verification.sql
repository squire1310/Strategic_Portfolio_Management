-- B012: enforce independent, effective mandate at the database write boundary too.
-- The application role can append evidence, but cannot bypass these checks with SQL.
CREATE FUNCTION m05_investment.guard_condition_verification() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  parties record;
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
  ) OR NOT EXISTS (
    SELECT 1 FROM m05_investment.condition_verifier_mandate v
    WHERE v.tenant_id=NEW.tenant_id AND v.principal_id=NEW.verified_by
      AND v.effective_during @> transaction_timestamp()
      AND (v.revoked_at IS NULL OR v.revoked_at>transaction_timestamp())
  ) THEN
    RAISE EXCEPTION 'Effective verifier mandate required';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER verification_authority_guard
BEFORE INSERT ON m05_investment.condition_verification
FOR EACH ROW EXECUTE FUNCTION m05_investment.guard_condition_verification();
