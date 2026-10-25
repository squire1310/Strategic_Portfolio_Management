-- B005: tenant-scoped business work items (not IAM catalogue requests).
CREATE TABLE platform.work_item (
 tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id),
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 object_type text NOT NULL CHECK (object_type IN ('strategy','portfolio')),
 object_id uuid NOT NULL,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 200),
 assignee_id uuid NOT NULL,
 created_by uuid NOT NULL,
 state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','completed','cancelled')),
 due_on date,
 completed_at timestamptz,
 completion_note text,
 row_version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,assignee_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
 FOREIGN KEY(tenant_id,created_by) REFERENCES platform.tenant_member(tenant_id,principal_id),
 CHECK((state='completed')=(completed_at IS NOT NULL))
);
CREATE FUNCTION platform.validate_work_item() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.object_type='strategy' AND NOT EXISTS
   (SELECT 1 FROM m01_strategy.strategy WHERE tenant_id=NEW.tenant_id AND id=NEW.object_id)
 THEN RAISE EXCEPTION 'Missing strategy target'; END IF;
 IF NEW.object_type='portfolio' AND NOT EXISTS
   (SELECT 1 FROM m02_portfolio.portfolio WHERE tenant_id=NEW.tenant_id AND id=NEW.object_id)
 THEN RAISE EXCEPTION 'Missing portfolio target'; END IF;
 IF NOT EXISTS (SELECT 1 FROM platform.tenant_member WHERE tenant_id=NEW.tenant_id
     AND principal_id=NEW.assignee_id AND active) THEN
   RAISE EXCEPTION 'Assignee must be active in tenant'; END IF;
 IF TG_OP='UPDATE' THEN
   IF OLD.state <> 'open' THEN RAISE EXCEPTION 'Closed work item is immutable'; END IF;
   IF NEW.object_id <> OLD.object_id OR NEW.object_type <> OLD.object_type
     OR NEW.created_by <> OLD.created_by THEN RAISE EXCEPTION 'Work item origin immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER work_item_validate BEFORE INSERT OR UPDATE ON platform.work_item
 FOR EACH ROW EXECUTE FUNCTION platform.validate_work_item();
CREATE TRIGGER work_item_version BEFORE INSERT OR UPDATE ON platform.work_item
 FOR EACH ROW EXECUTE FUNCTION platform.stamp_version();
CREATE TRIGGER work_item_capture AFTER INSERT OR UPDATE ON platform.work_item
 FOR EACH ROW EXECUTE FUNCTION platform.capture_change();
CREATE INDEX work_item_inbox ON platform.work_item(tenant_id,assignee_id,state,due_on);
ALTER TABLE platform.work_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON platform.work_item USING
 (tenant_id=platform.current_tenant() AND platform.application_context())
 WITH CHECK(tenant_id=platform.current_tenant() AND platform.application_context());
GRANT SELECT,INSERT,UPDATE ON platform.work_item TO spm_app;
