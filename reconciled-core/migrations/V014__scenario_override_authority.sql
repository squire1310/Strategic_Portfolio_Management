-- B009 separate override decision, not an M05 investment approval.
CREATE TABLE m04_selection.scenario_override (
 tenant_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 scenario_id uuid NOT NULL,
 assessment_id uuid NOT NULL,
 requested_by uuid NOT NULL,
 justification text NOT NULL CHECK(length(btrim(justification))>=20),
 decided_by uuid,
 decision text NOT NULL DEFAULT 'pending' CHECK(decision IN ('pending','approved','rejected')),
 decision_reason text,
 decided_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 PRIMARY KEY(tenant_id,id),
 UNIQUE(tenant_id,scenario_id,assessment_id),
 FOREIGN KEY(tenant_id,scenario_id) REFERENCES m04_selection.scenario(tenant_id,id),
 FOREIGN KEY(tenant_id,assessment_id) REFERENCES m04_selection.assessment(tenant_id,id),
 FOREIGN KEY(tenant_id,requested_by) REFERENCES platform.tenant_member(tenant_id,principal_id),
 FOREIGN KEY(tenant_id,decided_by) REFERENCES platform.tenant_member(tenant_id,principal_id),
 CHECK ((decision='pending' AND decided_by IS NULL AND decided_at IS NULL AND decision_reason IS NULL)
 OR (decision<>'pending' AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND length(btrim(decision_reason))>=20)),
 CHECK (decided_by IS DISTINCT FROM requested_by)
);
CREATE FUNCTION m04_selection.guard_override() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (OLD.decision<>'pending' OR NEW.decision='pending'
 OR (to_jsonb(NEW)-'decision'-'decision_reason'-'decided_by'-'decided_at')
 IS DISTINCT FROM (to_jsonb(OLD)-'decision'-'decision_reason'-'decided_by'-'decided_at'))
 THEN RAISE EXCEPTION 'Override is immutable except initial decision'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER override_guard BEFORE UPDATE OR DELETE ON m04_selection.scenario_override
 FOR EACH ROW EXECUTE FUNCTION m04_selection.guard_override();
CREATE TRIGGER override_capture AFTER INSERT OR UPDATE ON m04_selection.scenario_override
 FOR EACH ROW EXECUTE FUNCTION platform.capture_record('id');
ALTER TABLE m04_selection.scenario_override ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON m04_selection.scenario_override
 USING(tenant_id=platform.current_tenant() AND platform.application_context())
 WITH CHECK(tenant_id=platform.current_tenant() AND platform.application_context());
GRANT SELECT,INSERT,UPDATE ON m04_selection.scenario_override TO spm_app;
