-- B012: decision-maker-owned obligations and a database-level precedent gate.
ALTER TABLE m05_investment.decision_condition ADD COLUMN recorded_by uuid;
ALTER TABLE m05_investment.decision_condition
 ADD CONSTRAINT decision_condition_recorder_fk
 FOREIGN KEY(tenant_id,recorded_by) REFERENCES platform.tenant_member(tenant_id,principal_id);

CREATE FUNCTION m05_investment.guard_condition_creation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE decision_row record;
BEGIN
 IF NEW.tenant_id IS DISTINCT FROM platform.current_tenant()
    OR NOT platform.application_context() THEN
   RAISE EXCEPTION 'Condition tenant and actor context required';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text || ':' || NEW.decision_id::text,0));
 SELECT d.decided_by,d.decision_type,d.subject_type INTO decision_row
 FROM m05_investment.investment_decision d
 WHERE d.tenant_id=NEW.tenant_id AND d.id=NEW.decision_id;
 IF NOT FOUND OR decision_row.subject_type<>'investment'
    OR decision_row.decision_type NOT IN ('approve','condition') THEN
   RAISE EXCEPTION 'Only approving or conditional investment decisions may carry conditions';
 END IF;
 IF decision_row.decided_by IS DISTINCT FROM platform.current_actor()
    OR NOT EXISTS (SELECT 1 FROM platform.tenant_member m
      WHERE m.tenant_id=NEW.tenant_id AND m.principal_id=platform.current_actor()
        AND m.active AND m.member_role IN ('approver','administrator')) THEN
   RAISE EXCEPTION 'Decision maker must record conditions';
 END IF;
 IF EXISTS (SELECT 1 FROM m05_investment.commitment x
   WHERE x.tenant_id=NEW.tenant_id AND x.approving_decision_id=NEW.decision_id)
   OR EXISTS (SELECT 1 FROM m05_investment.commitment_amendment x
   WHERE x.tenant_id=NEW.tenant_id AND x.approving_decision_id=NEW.decision_id) THEN
   RAISE EXCEPTION 'Conditions cannot be added after commitment effectuation';
 END IF;
 NEW.recorded_by := platform.current_actor();
 RETURN NEW;
END $$;
CREATE TRIGGER condition_creation_guard BEFORE INSERT ON m05_investment.decision_condition
 FOR EACH ROW EXECUTE FUNCTION m05_investment.guard_condition_creation();
GRANT INSERT ON m05_investment.decision_condition TO spm_app;

CREATE FUNCTION m05_investment.require_precedent_clearance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text || ':' || NEW.approving_decision_id::text,0));
 IF EXISTS (
   SELECT 1 FROM m05_investment.decision_condition c
   LEFT JOIN LATERAL (
     SELECT id FROM m05_investment.condition_evidence_submission s
     WHERE s.tenant_id=c.tenant_id AND s.condition_id=c.id
     ORDER BY s.submitted_at DESC,s.id DESC LIMIT 1
   ) s ON true
   LEFT JOIN LATERAL (
     SELECT v.result FROM m05_investment.condition_verification v
     WHERE v.tenant_id=c.tenant_id AND v.condition_id=c.id
       AND ((s.id IS NULL AND v.submission_id IS NULL) OR v.submission_id=s.id)
     ORDER BY v.verified_at DESC,v.id DESC LIMIT 1
   ) v ON true
   WHERE c.tenant_id=NEW.tenant_id AND c.decision_id=NEW.approving_decision_id
     AND c.condition_type='precedent' AND v.result IS DISTINCT FROM 'satisfied'
 ) THEN
   RAISE EXCEPTION 'Uncleared precedent blocks commitment release';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER commitment_precedent_guard BEFORE INSERT ON m05_investment.commitment
 FOR EACH ROW EXECUTE FUNCTION m05_investment.require_precedent_clearance();
CREATE TRIGGER amendment_precedent_guard BEFORE INSERT ON m05_investment.commitment_amendment
 FOR EACH ROW EXECUTE FUNCTION m05_investment.require_precedent_clearance();
