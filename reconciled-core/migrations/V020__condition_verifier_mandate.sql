-- B012 dedicated, effective-dated verifier mandate. Ordinary users cannot grant it.
CREATE TABLE m05_investment.condition_verifier_mandate (
 tenant_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 principal_id uuid NOT NULL,
 granted_by uuid NOT NULL,
 effective_during tstzrange NOT NULL CHECK(NOT isempty(effective_during)),
 revoked_at timestamptz,
 reason text NOT NULL CHECK(length(btrim(reason))>=20),
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,principal_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
 FOREIGN KEY(tenant_id,granted_by) REFERENCES platform.tenant_member(tenant_id,principal_id),
 CHECK(principal_id<>granted_by),
 CHECK(revoked_at IS NULL OR revoked_at>=created_at)
);
CREATE FUNCTION m05_investment.guard_verifier_mandate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Verifier mandate cannot be deleted'; END IF;
 IF TG_OP='UPDATE' AND (OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR
   (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at'))
 THEN RAISE EXCEPTION 'Only mandate revocation is allowed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER verifier_mandate_guard BEFORE UPDATE OR DELETE ON m05_investment.condition_verifier_mandate
 FOR EACH ROW EXECUTE FUNCTION m05_investment.guard_verifier_mandate();
ALTER TABLE m05_investment.condition_verifier_mandate ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON m05_investment.condition_verifier_mandate
 USING(tenant_id=platform.current_tenant() AND platform.application_context())
 WITH CHECK(tenant_id=platform.current_tenant() AND platform.application_context());
GRANT SELECT ON m05_investment.condition_verifier_mandate TO spm_app;
GRANT INSERT ON m05_investment.condition_verification TO spm_app;
