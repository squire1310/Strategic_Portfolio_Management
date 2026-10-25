-- B006 reviewer return evidence independent of immutable case revisions.
CREATE TABLE m03_demand.intake_review (
 tenant_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 demand_id uuid NOT NULL,
 case_revision_id uuid NOT NULL,
 reviewer_id uuid NOT NULL,
 outcome text NOT NULL CHECK(outcome IN ('return_for_correction','accept_for_assessment')),
 feedback text NOT NULL CHECK(length(btrim(feedback))>0),
 reviewed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,demand_id) REFERENCES m03_demand.demand(tenant_id,id),
 FOREIGN KEY(tenant_id,case_revision_id) REFERENCES m03_demand.case_revision(tenant_id,id),
 FOREIGN KEY(tenant_id,reviewer_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
 UNIQUE(tenant_id,case_revision_id)
);
CREATE TRIGGER intake_review_immutable BEFORE UPDATE OR DELETE ON m03_demand.intake_review
 FOR EACH ROW EXECUTE FUNCTION platform.guard_immutable();
CREATE TRIGGER intake_review_capture AFTER INSERT ON m03_demand.intake_review
 FOR EACH ROW EXECUTE FUNCTION platform.capture_record('id');
ALTER TABLE m03_demand.intake_review ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON m03_demand.intake_review
 USING(tenant_id=platform.current_tenant() AND platform.application_context())
 WITH CHECK(tenant_id=platform.current_tenant() AND platform.application_context());
GRANT SELECT,INSERT ON m03_demand.intake_review TO spm_app;
