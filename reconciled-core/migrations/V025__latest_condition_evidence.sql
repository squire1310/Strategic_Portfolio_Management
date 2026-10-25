-- A new submission supersedes earlier evidence for clearance purposes.
CREATE INDEX condition_submission_latest_idx
 ON m05_investment.condition_evidence_submission
 (tenant_id,condition_id,submitted_at DESC,id DESC);
CREATE INDEX condition_verification_latest_idx
 ON m05_investment.condition_verification
 (tenant_id,condition_id,submission_id,verified_at DESC,id DESC);

CREATE FUNCTION m05_investment.require_latest_condition_submission() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE latest_id uuid;
BEGIN
 SELECT id INTO latest_id FROM m05_investment.condition_evidence_submission
 WHERE tenant_id=NEW.tenant_id AND condition_id=NEW.condition_id
 ORDER BY submitted_at DESC,id DESC LIMIT 1;
 IF NEW.submission_id IS DISTINCT FROM latest_id THEN
   RAISE EXCEPTION 'Newer condition evidence requires verification';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER verification_latest_submission_guard
 BEFORE INSERT ON m05_investment.condition_verification
 FOR EACH ROW EXECUTE FUNCTION m05_investment.require_latest_condition_submission();
