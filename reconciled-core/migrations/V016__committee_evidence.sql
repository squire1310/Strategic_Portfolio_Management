-- B010: immutable, tenant-isolated committee evidence foundation.
-- No investment approval or ordinary user write capability.
CREATE TABLE m06_governance.committee_session (
 tenant_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 decision_body_id uuid NOT NULL,
 investment_id uuid NOT NULL,
 held_at timestamptz NOT NULL,
 quorum_required integer NOT NULL CHECK (quorum_required BETWEEN 1 AND 100),
 recorded_by uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 PRIMARY KEY (tenant_id,id),
 FOREIGN KEY (tenant_id,decision_body_id) REFERENCES m06_governance.decision_body(tenant_id,id),
 FOREIGN KEY (tenant_id,investment_id) REFERENCES m05_investment.investment(tenant_id,id),
 FOREIGN KEY (tenant_id,recorded_by) REFERENCES platform.tenant_member(tenant_id,principal_id)
);
CREATE TABLE m06_governance.committee_participant (
 tenant_id uuid NOT NULL,
 session_id uuid NOT NULL,
 principal_id uuid NOT NULL,
 attended boolean NOT NULL,
 conflict_declared boolean NOT NULL DEFAULT false,
 recused boolean NOT NULL DEFAULT false,
 vote text CHECK (vote IN ('for','against','abstain')),
 evidence_note text,
 PRIMARY KEY(tenant_id,session_id,principal_id),
 FOREIGN KEY(tenant_id,session_id) REFERENCES m06_governance.committee_session(tenant_id,id),
 FOREIGN KEY(tenant_id,principal_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
 CHECK (NOT conflict_declared OR recused),
 CHECK (NOT recused OR vote IS NULL),
 CHECK (vote IS NULL OR (attended AND NOT recused)),
 CHECK (NOT conflict_declared OR length(btrim(evidence_note))>0)
);
CREATE FUNCTION m06_governance.reject_committee_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Committee evidence is append-only';
END $$;
CREATE TRIGGER committee_session_immutable BEFORE UPDATE OR DELETE ON m06_governance.committee_session
 FOR EACH ROW EXECUTE FUNCTION m06_governance.reject_committee_evidence_mutation();
CREATE TRIGGER committee_participant_immutable BEFORE UPDATE OR DELETE ON m06_governance.committee_participant
 FOR EACH ROW EXECUTE FUNCTION m06_governance.reject_committee_evidence_mutation();
CREATE TRIGGER committee_session_capture AFTER INSERT ON m06_governance.committee_session
 FOR EACH ROW EXECUTE FUNCTION platform.capture_record('id');
ALTER TABLE m06_governance.committee_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE m06_governance.committee_participant ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON m06_governance.committee_session
 USING (tenant_id=platform.current_tenant() AND platform.application_context())
 WITH CHECK (tenant_id=platform.current_tenant() AND platform.application_context());
CREATE POLICY tenant_isolation ON m06_governance.committee_participant
 USING (tenant_id=platform.current_tenant() AND platform.application_context())
 WITH CHECK (tenant_id=platform.current_tenant() AND platform.application_context());
GRANT SELECT ON m06_governance.committee_session,m06_governance.committee_participant TO spm_app;
