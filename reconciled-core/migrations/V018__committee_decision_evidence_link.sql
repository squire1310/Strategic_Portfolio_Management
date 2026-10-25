-- B011: trace a non-effectuating decision to one immutable committee session.
CREATE TABLE m05_investment.committee_decision_evidence (
 tenant_id uuid NOT NULL,
 session_id uuid NOT NULL,
 decision_id uuid NOT NULL,
 linked_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 PRIMARY KEY (tenant_id,session_id),
 UNIQUE (tenant_id,decision_id),
 FOREIGN KEY (tenant_id,session_id) REFERENCES m06_governance.committee_finalisation(tenant_id,session_id),
 FOREIGN KEY (tenant_id,decision_id) REFERENCES m05_investment.investment_decision(tenant_id,id)
);
CREATE TRIGGER committee_decision_link_immutable BEFORE UPDATE OR DELETE ON m05_investment.committee_decision_evidence
 FOR EACH ROW EXECUTE FUNCTION platform.guard_immutable();
ALTER TABLE m05_investment.committee_decision_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON m05_investment.committee_decision_evidence
 USING(tenant_id=platform.current_tenant() AND platform.application_context())
 WITH CHECK(tenant_id=platform.current_tenant() AND platform.application_context());
GRANT SELECT,INSERT ON m05_investment.committee_decision_evidence TO spm_app;
