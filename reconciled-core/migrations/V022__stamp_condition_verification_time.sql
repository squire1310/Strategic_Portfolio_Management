-- A caller with INSERT permission cannot choose evidence ordering by forging verified_at.
CREATE FUNCTION m05_investment.stamp_condition_verification_time() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.verified_at := statement_timestamp();
  RETURN NEW;
END $$;

CREATE TRIGGER verification_time_guard
BEFORE INSERT ON m05_investment.condition_verification
FOR EACH ROW EXECUTE FUNCTION m05_investment.stamp_condition_verification_time();
