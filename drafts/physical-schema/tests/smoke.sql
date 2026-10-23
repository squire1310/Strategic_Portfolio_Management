\set ON_ERROR_STOP on
BEGIN;
INSERT INTO platform.tenant(tenant_code,name) VALUES ('smoke_a','Smoke tenant A'),('smoke_b','Smoke tenant B');
INSERT INTO platform.principal(subject,display_name) VALUES ('smoke:admin','Smoke admin');
INSERT INTO platform.tenant_member(tenant_id,principal_id,member_role)
SELECT t.tenant_id,p.principal_id,'administrator' FROM platform.tenant t CROSS JOIN platform.principal p
WHERE t.tenant_code IN ('smoke_a','smoke_b') AND p.subject='smoke:admin';
SELECT set_config('app.tenant_id',(SELECT tenant_id::text FROM platform.tenant WHERE tenant_code='smoke_a'),true);
SELECT set_config('app.actor_id',(SELECT principal_id::text FROM platform.principal WHERE subject='smoke:admin'),true);
SELECT set_config('app.other_tenant_id',(SELECT tenant_id::text FROM platform.tenant WHERE tenant_code='smoke_b'),true);
SELECT platform.seed_tenant_references(platform.current_tenant());
DO $$ DECLARE owner_id uuid; strategy_id uuid; portfolio_id uuid; decision_body_id uuid; baseline_id uuid; successor_id uuid;
BEGIN
  SELECT principal_id INTO owner_id FROM platform.principal WHERE subject='smoke:admin';
  INSERT INTO m01_strategy.strategy(tenant_id,code,name,horizon,owner_id)
  VALUES (platform.current_tenant(),'s1','Strategy',daterange('2026-01-01','2028-01-01','[)'),owner_id)
  RETURNING id INTO strategy_id;
  UPDATE m01_strategy.strategy SET name='Strategy revised' WHERE tenant_id=platform.current_tenant() AND id=strategy_id;
  IF (SELECT count(*) FROM platform.entity_revision WHERE tenant_id=platform.current_tenant()
      AND schema_name='m01_strategy' AND table_name='strategy' AND entity_id=strategy_id) <> 2 THEN
    RAISE EXCEPTION 'revision count incorrect';
  END IF;
  IF (SELECT count(*) FROM platform.outbox_event WHERE tenant_id=platform.current_tenant()
      AND aggregate_type='strategy' AND aggregate_id=strategy_id) <> 2 THEN
    RAISE EXCEPTION 'outbox count incorrect';
  END IF;
  INSERT INTO m03_portfolio.portfolio(tenant_id,code,name,owner_id)
  VALUES (platform.current_tenant(),'p1','Portfolio',owner_id) RETURNING id INTO portfolio_id;
  INSERT INTO m06_governance.decision_body(tenant_id,code,name,chair_id,remit)
  VALUES (platform.current_tenant(),'board','Board',owner_id,'Investment decisions') RETURNING id INTO decision_body_id;
  INSERT INTO m06_governance.baseline(tenant_id,portfolio_id,baseline_type,label,created_by,valid_during)
  VALUES (platform.current_tenant(),portfolio_id,'portfolio','FY26',owner_id,
          tstzrange('2026-01-01','2027-01-01','[)')) RETURNING id INTO baseline_id;
  INSERT INTO m06_governance.decision(tenant_id,decision_body_id,subject_type,subject_id,
    decision_type,rationale,decided_at,effective_on,recorded_by)
  VALUES (platform.current_tenant(),decision_body_id,'baseline',baseline_id,
    'approve','Approved for test',transaction_timestamp(),'2026-01-01',owner_id);
  UPDATE m06_governance.baseline SET status='approved',
    approved_decision_id=(SELECT id FROM m06_governance.decision WHERE tenant_id=platform.current_tenant() AND subject_id=baseline_id),
    approved_at=clock_timestamp()
  WHERE tenant_id=platform.current_tenant() AND id=baseline_id;
  IF NOT EXISTS (SELECT 1 FROM m06_governance.baseline WHERE tenant_id=platform.current_tenant()
    AND id=baseline_id AND status='approved') THEN RAISE EXCEPTION 'baseline approval failed'; END IF;
  INSERT INTO m06_governance.baseline(tenant_id,portfolio_id,baseline_type,label,created_by,valid_during)
  VALUES (platform.current_tenant(),portfolio_id,'portfolio','FY26 revised',owner_id,
          tstzrange('2026-01-01','2027-01-01','[)')) RETURNING id INTO successor_id;
  INSERT INTO m06_governance.decision(tenant_id,decision_body_id,subject_type,subject_id,
    decision_type,rationale,decided_at,effective_on,recorded_by)
  VALUES (platform.current_tenant(),decision_body_id,'baseline',successor_id,
    'approve','Revised approval',transaction_timestamp(),'2026-01-01',owner_id);
  UPDATE m06_governance.baseline SET status='approved',
    approved_decision_id=(SELECT id FROM m06_governance.decision WHERE tenant_id=platform.current_tenant() AND subject_id=successor_id),
    approved_at=clock_timestamp()
  WHERE tenant_id=platform.current_tenant() AND id=successor_id;
  IF NOT EXISTS (SELECT 1 FROM m06_governance.baseline WHERE tenant_id=platform.current_tenant()
    AND id=baseline_id AND status='superseded' AND NOT upper_inf(recorded_during)) THEN
    RAISE EXCEPTION 'baseline supersession failed';
  END IF;
END $$;
SET ROLE spm_app;
DO $$ DECLARE visible_tenants integer;
BEGIN
  SELECT count(*) INTO visible_tenants FROM platform.tenant;
  IF visible_tenants <> 1 THEN RAISE EXCEPTION 'tenant RLS expected one row, saw %',visible_tenants; END IF;
  IF EXISTS (SELECT 1 FROM m01_strategy.strategy s JOIN platform.tenant t ON t.tenant_id=s.tenant_id
    WHERE t.tenant_code='smoke_b') THEN RAISE EXCEPTION 'cross-tenant strategy visible'; END IF;
  BEGIN
    INSERT INTO m01_strategy.strategy(tenant_id,code,name,horizon,owner_id)
      VALUES (current_setting('app.other_tenant_id')::uuid,'cross','Must fail',
        daterange('2026-01-01','2027-01-01','[)'),platform.current_actor());
    RAISE EXCEPTION 'cross-tenant insert unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
-- Verify table policies exist for every tenant-owned table.
DO $$ DECLARE missing_count integer;
BEGIN
  SELECT count(*) INTO missing_count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname='tenant_id' AND NOT a.attisdropped
  WHERE c.relkind='r' AND n.nspname IN
    ('platform','m01_strategy','m02_intake','m03_portfolio','m04_finance','m05_capacity','m06_governance')
    AND NOT c.relrowsecurity;
  IF missing_count <> 0 THEN RAISE EXCEPTION '% tenant tables lack RLS',missing_count; END IF;
END $$;
ROLLBACK;

