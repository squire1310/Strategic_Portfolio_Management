-- B009 explicit bounded override mandate, separate from Entra role and M05 approval authority.
CREATE TABLE m04_selection.override_mandate (
 tenant_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 principal_id uuid NOT NULL,
 effective_during tstzrange NOT NULL CHECK (NOT isempty(effective_during)),
 granted_by uuid NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason))>=20),
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,principal_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
 FOREIGN KEY(tenant_id,granted_by) REFERENCES platform.tenant_member(tenant_id,principal_id),
 CHECK(principal_id<>granted_by),
 CHECK(revoked_at IS NULL OR revoked_at>=created_at)
);
CREATE INDEX override_mandate_lookup ON m04_selection.override_mandate(tenant_id,principal_id);
CREATE FUNCTION m04_selection.guard_override_mandate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR
 (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at'))
 THEN RAISE EXCEPTION 'Mandate changes require revocation and new grant'; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Mandate cannot be deleted'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER mandate_guard BEFORE UPDATE OR DELETE ON m04_selection.override_mandate
 FOR EACH ROW EXECUTE FUNCTION m04_selection.guard_override_mandate();
CREATE TRIGGER mandate_capture AFTER INSERT OR UPDATE ON m04_selection.override_mandate
 FOR EACH ROW EXECUTE FUNCTION platform.capture_record('id');
ALTER TABLE m04_selection.override_mandate ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON m04_selection.override_mandate
 USING (tenant_id=platform.current_tenant() AND platform.application_context())
 WITH CHECK (tenant_id=platform.current_tenant() AND platform.application_context());
GRANT SELECT ON m04_selection.override_mandate TO spm_app;
-- Grants/revocations require separately controlled provisioning; no normal API writer.
