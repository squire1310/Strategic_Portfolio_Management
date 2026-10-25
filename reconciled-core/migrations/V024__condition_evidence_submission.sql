-- B012: submission and verification are separate append-only acts.
CREATE TABLE m05_investment.condition_evidence_submission (
 tenant_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 condition_id uuid NOT NULL,
 submitted_by uuid NOT NULL,
 evidence_reference text NOT NULL CHECK(length(btrim(evidence_reference))>0),
 submitted_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 PRIMARY KEY(tenant_id,id),
 UNIQUE(tenant_id,condition_id,id),
 FOREIGN KEY(tenant_id,condition_id) REFERENCES m05_investment.decision_condition(tenant_id,id),
 FOREIGN KEY(tenant_id,submitted_by) REFERENCES platform.tenant_member(tenant_id,principal_id)
);
CREATE TRIGGER condition_submission_immutable BEFORE UPDATE OR DELETE
 ON m05_investment.condition_evidence_submission
 FOR EACH ROW EXECUTE FUNCTION m05_investment.reject_condition_mutation();
ALTER TABLE m05_investment.condition_evidence_submission ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON m05_investment.condition_evidence_submission
 USING(tenant_id=platform.current_tenant() AND platform.application_context())
 WITH CHECK(tenant_id=platform.current_tenant() AND platform.application_context());
GRANT SELECT,INSERT ON m05_investment.condition_evidence_submission TO spm_app;

CREATE FUNCTION m05_investment.guard_condition_submission() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parties record;
BEGIN
 IF NEW.tenant_id IS DISTINCT FROM platform.current_tenant()
    OR NEW.submitted_by IS DISTINCT FROM platform.current_actor()
    OR NOT platform.application_context() THEN
   RAISE EXCEPTION 'Submission actor and tenant context required';
 END IF;
 SELECT i.owner_id,i.sponsor_id INTO parties
 FROM m05_investment.decision_condition c
 JOIN m05_investment.investment_decision d
   ON d.tenant_id=c.tenant_id AND d.id=c.decision_id
 LEFT JOIN m05_investment.investment i
   ON i.tenant_id=d.tenant_id AND i.id=d.investment_id
 WHERE c.tenant_id=NEW.tenant_id AND c.id=NEW.condition_id;
 IF NOT FOUND OR (NEW.submitted_by IS DISTINCT FROM parties.owner_id
                  AND NEW.submitted_by IS DISTINCT FROM parties.sponsor_id) THEN
   RAISE EXCEPTION 'Investment owner or sponsor must submit condition evidence';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM platform.tenant_member m
   WHERE m.tenant_id=NEW.tenant_id AND m.principal_id=NEW.submitted_by
     AND m.active AND m.member_role IN ('contributor','administrator')) THEN
   RAISE EXCEPTION 'Active contributor membership required';
 END IF;
 NEW.submitted_at := statement_timestamp();
 RETURN NEW;
END $$;
CREATE TRIGGER condition_submission_guard BEFORE INSERT ON m05_investment.condition_evidence_submission
 FOR EACH ROW EXECUTE FUNCTION m05_investment.guard_condition_submission();

ALTER TABLE m05_investment.condition_verification
 ADD COLUMN submission_id uuid,
 ADD CONSTRAINT condition_verification_submission_fk
   FOREIGN KEY(tenant_id,condition_id,submission_id)
   REFERENCES m05_investment.condition_evidence_submission(tenant_id,condition_id,id);

CREATE FUNCTION m05_investment.bind_verification_submission() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE evidence record;
BEGIN
 SELECT submitted_by,evidence_reference INTO evidence
 FROM m05_investment.condition_evidence_submission
 WHERE tenant_id=NEW.tenant_id AND condition_id=NEW.condition_id AND id=NEW.submission_id;
 IF NOT FOUND OR evidence.submitted_by=NEW.verified_by THEN
   RAISE EXCEPTION 'Independent condition evidence submission required';
 END IF;
 NEW.evidence_reference := evidence.evidence_reference;
 RETURN NEW;
END $$;
CREATE TRIGGER verification_submission_guard BEFORE INSERT ON m05_investment.condition_verification
 FOR EACH ROW EXECUTE FUNCTION m05_investment.bind_verification_submission();
