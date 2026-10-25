-- B010 atomic finalisation: all session evidence is inserted in one transaction.
CREATE TABLE m06_governance.committee_finalisation (
 tenant_id uuid NOT NULL,
 session_id uuid NOT NULL,
 finalised_by uuid NOT NULL,
 finalised_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 quorum_met boolean NOT NULL,
 evidence_snapshot jsonb NOT NULL CHECK(jsonb_typeof(evidence_snapshot)='object'),
 PRIMARY KEY(tenant_id,session_id),
 FOREIGN KEY(tenant_id,session_id) REFERENCES m06_governance.committee_session(tenant_id,id),
 FOREIGN KEY(tenant_id,finalised_by) REFERENCES platform.tenant_member(tenant_id,principal_id),
 CHECK(quorum_met)
);
CREATE TRIGGER committee_finalisation_immutable BEFORE UPDATE OR DELETE ON m06_governance.committee_finalisation
 FOR EACH ROW EXECUTE FUNCTION m06_governance.reject_committee_evidence_mutation();
ALTER TABLE m06_governance.committee_finalisation ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON m06_governance.committee_finalisation
 USING(tenant_id=platform.current_tenant() AND platform.application_context())
 WITH CHECK(tenant_id=platform.current_tenant() AND platform.application_context());
GRANT SELECT,INSERT ON m06_governance.committee_session,m06_governance.committee_participant,m06_governance.committee_finalisation TO spm_app;
-- The application must enforce chair identity and delegations before inserting evidence.
-- Finalisation is evidence only: it cannot modify any M05 investment decision.
