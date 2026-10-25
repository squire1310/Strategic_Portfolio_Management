-- B012 condition obligations: evidence only, no commitment release.
CREATE TABLE m05_investment.decision_condition (
 tenant_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 decision_id uuid NOT NULL,
 condition_type text NOT NULL CHECK(condition_type IN ('precedent','subsequent')),
 description text NOT NULL CHECK(length(btrim(description))>0),
 due_on date,
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,decision_id) REFERENCES m05_investment.investment_decision(tenant_id,id)
);
CREATE TABLE m05_investment.condition_verification (
 tenant_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 condition_id uuid NOT NULL,
 verified_by uuid NOT NULL,
 result text NOT NULL CHECK(result IN ('satisfied','not_satisfied')),
 evidence_reference text NOT NULL CHECK(length(btrim(evidence_reference))>0),
 verified_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,condition_id) REFERENCES m05_investment.decision_condition(tenant_id,id),
 FOREIGN KEY(tenant_id,verified_by) REFERENCES platform.tenant_member(tenant_id,principal_id)
);
CREATE FUNCTION m05_investment.reject_condition_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Decision condition evidence is immutable'; END $$;
CREATE TRIGGER condition_immutable BEFORE UPDATE OR DELETE ON m05_investment.decision_condition
 FOR EACH ROW EXECUTE FUNCTION m05_investment.reject_condition_mutation();
CREATE TRIGGER verification_immutable BEFORE UPDATE OR DELETE ON m05_investment.condition_verification
 FOR EACH ROW EXECUTE FUNCTION m05_investment.reject_condition_mutation();
ALTER TABLE m05_investment.decision_condition ENABLE ROW LEVEL SECURITY;
ALTER TABLE m05_investment.condition_verification ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON m05_investment.decision_condition
 USING(tenant_id=platform.current_tenant() AND platform.application_context())
 WITH CHECK(tenant_id=platform.current_tenant() AND platform.application_context());
CREATE POLICY tenant_isolation ON m05_investment.condition_verification
 USING(tenant_id=platform.current_tenant() AND platform.application_context())
 WITH CHECK(tenant_id=platform.current_tenant() AND platform.application_context());
GRANT SELECT ON m05_investment.decision_condition,m05_investment.condition_verification TO spm_app;
-- No user-write grants until separate condition ownership, verification independence,
-- decision-type eligibility, and effectuation gating are implemented and tested.
