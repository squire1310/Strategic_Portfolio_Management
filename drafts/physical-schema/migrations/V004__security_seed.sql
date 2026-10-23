-- Seed templates are copied when a tenant is provisioned; no demo tenant is created.
CREATE TABLE platform.reference_template (
  code_set text NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL,
  PRIMARY KEY (code_set,code)
);
INSERT INTO platform.reference_template(code_set,code,label,sort_order) VALUES
 ('priority','critical','Critical',10),('priority','high','High',20),
 ('priority','normal','Normal',30),('priority','low','Low',40),
 ('risk','low','Low',10),('risk','medium','Medium',20),('risk','high','High',30),
 ('health','green','On track',10),('health','amber','At risk',20),('health','red','Off track',30),
 ('decision_type','approve','Approve',10),('decision_type','reject','Reject',20),
 ('decision_type','defer','Defer',30),('decision_type','condition','Conditional',40),
 ('decision_type','revoke','Revoke',50);
CREATE FUNCTION platform.seed_tenant_references(p_tenant uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, platform AS $$
  INSERT INTO platform.code_set(tenant_id,code_set,code,label,sort_order)
  SELECT p_tenant,code_set,code,label,sort_order FROM platform.reference_template
  ON CONFLICT (tenant_id,code_set,code) DO NOTHING
$$;
REVOKE ALL ON FUNCTION platform.seed_tenant_references(uuid) FROM PUBLIC;

-- Provisioned roles are NOLOGIN; deployment maps login roles to these grants.
CREATE ROLE spm_app NOLOGIN;
CREATE ROLE spm_worker NOLOGIN;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA platform,m01_strategy,m02_intake,m03_portfolio,m04_finance,m05_capacity,m06_governance FROM PUBLIC;
GRANT USAGE ON SCHEMA platform,m01_strategy,m02_intake,m03_portfolio,m04_finance,m05_capacity,m06_governance TO spm_app,spm_worker;
GRANT SELECT ON platform.tenant,platform.tenant_member,platform.code_set,
  platform.source_system,platform.source_identity,platform.audit_event,
  platform.entity_revision,platform.reference_template TO spm_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA
  m01_strategy,m02_intake,m03_portfolio,m04_finance,m05_capacity,m06_governance TO spm_app;
REVOKE UPDATE,DELETE ON m06_governance.decision FROM spm_app;
GRANT SELECT,INSERT,UPDATE ON platform.source_identity,platform.inbox_message TO spm_worker;
GRANT SELECT,UPDATE (published_at,attempts) ON platform.outbox_event TO spm_worker;
GRANT SELECT ON platform.source_system,platform.tenant,platform.tenant_member TO spm_worker;
GRANT SELECT ON ALL TABLES IN SCHEMA
  m01_strategy,m02_intake,m03_portfolio,m04_finance,m05_capacity,m06_governance TO spm_worker;
GRANT INSERT,UPDATE ON m01_strategy.measure_observation,m04_finance.actual,
  m05_capacity.capacity_period TO spm_worker;

-- For every tenant-owned table, deny access unless both tenant and active actor match.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname='tenant_id' AND NOT a.attisdropped
    WHERE c.relkind='r' AND n.nspname IN
      ('platform','m01_strategy','m02_intake','m03_portfolio','m04_finance','m05_capacity','m06_governance')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',r.schema_name,r.table_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I.%I USING (tenant_id = platform.current_tenant() AND platform.application_context()) WITH CHECK (tenant_id = platform.current_tenant() AND platform.application_context())',r.schema_name,r.table_name);
  END LOOP;
END $$;

-- Trigger history and outbox writes run as the schema owner; app roles cannot change them.
REVOKE ALL ON platform.audit_event,platform.entity_revision,platform.outbox_event,platform.inbox_message FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION platform.capture_change(),platform.capture_record(),platform.stamp_version(),platform.guard_immutable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION m06_governance.guard_baseline(),m06_governance.guard_baseline_item() FROM PUBLIC;

