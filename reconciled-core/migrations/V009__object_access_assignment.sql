-- M1 tenant-scoped, effective-dated assignment foundation. No approval rights conferred.
CREATE TABLE platform.object_access_assignment (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  principal_id uuid NOT NULL,
  object_type text NOT NULL CHECK (object_type IN ('strategy','portfolio')),
  object_id uuid NOT NULL,
  effective_during tstzrange NOT NULL CHECK (NOT isempty(effective_during)),
  revoked_at timestamptz,
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  assigned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  row_version integer NOT NULL DEFAULT 1,
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,principal_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
  FOREIGN KEY (tenant_id,assigned_by) REFERENCES platform.tenant_member(tenant_id,principal_id),
  CONSTRAINT assignment_revoked_after_created CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
CREATE INDEX assignment_effective_lookup ON platform.object_access_assignment
  USING gist (tenant_id,principal_id,object_type,effective_during);
CREATE FUNCTION platform.validate_object_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.object_type='strategy' THEN
    IF NOT EXISTS(SELECT 1 FROM m01_strategy.strategy WHERE tenant_id=NEW.tenant_id AND id=NEW.object_id) THEN
      RAISE EXCEPTION 'Strategy assignment target unavailable';
    END IF;
  ELSIF NEW.object_type='portfolio' THEN
    IF NOT EXISTS(SELECT 1 FROM m02_portfolio.portfolio WHERE tenant_id=NEW.tenant_id AND id=NEW.object_id) THEN
      RAISE EXCEPTION 'Portfolio assignment target unavailable';
    END IF;
  END IF;
  IF TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-'revoked_at'-'row_version'-'updated_at')
       IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at'-'row_version'-'updated_at')
      OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL THEN
      RAISE EXCEPTION 'Assignment updates only permit one-time revocation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER assignment_validate BEFORE INSERT OR UPDATE ON platform.object_access_assignment
  FOR EACH ROW EXECUTE FUNCTION platform.validate_object_assignment();
CREATE TRIGGER assignment_version BEFORE INSERT OR UPDATE ON platform.object_access_assignment
  FOR EACH ROW EXECUTE FUNCTION platform.stamp_version();
CREATE TRIGGER assignment_capture AFTER INSERT OR UPDATE ON platform.object_access_assignment
  FOR EACH ROW EXECUTE FUNCTION platform.capture_change();
ALTER TABLE platform.object_access_assignment ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON platform.object_access_assignment
  USING (tenant_id=platform.current_tenant() AND platform.application_context())
  WITH CHECK (tenant_id=platform.current_tenant() AND platform.application_context());
GRANT SELECT ON platform.object_access_assignment TO spm_app;
-- Deliberately no INSERT/UPDATE/DELETE to spm_app: administrator provisioning requires a separate reviewed command.
