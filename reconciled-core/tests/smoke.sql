\set ON_ERROR_STOP on
BEGIN;
INSERT INTO platform.tenant(tenant_code,name) VALUES ('smoke_a','Smoke A'),('smoke_b','Smoke B');
INSERT INTO platform.principal(subject,display_name) VALUES ('schema-smoke:admin','Smoke administrator');
INSERT INTO platform.tenant_member(tenant_id,principal_id,member_role)
SELECT t.tenant_id,p.principal_id,'administrator' FROM platform.tenant t CROSS JOIN platform.principal p
WHERE t.tenant_code IN ('smoke_a','smoke_b') AND p.subject='schema-smoke:admin';
SELECT set_config('app.tenant_id',(SELECT tenant_id::text FROM platform.tenant WHERE tenant_code='smoke_a'),true);
SELECT set_config('app.other_tenant_id',(SELECT tenant_id::text FROM platform.tenant WHERE tenant_code='smoke_b'),true);
SELECT set_config('app.actor_id',(SELECT principal_id::text FROM platform.principal WHERE subject='schema-smoke:admin'),true);
SELECT platform.seed_tenant_references(platform.current_tenant());

DO $$
DECLARE actor_id uuid; strategy_id uuid; objective_id uuid; portfolio_id uuid; category_id uuid;
        demand_id uuid; case_id uuid; model_id uuid; criterion_id uuid; assessment_id uuid;
        scenario_id uuid; recommendation_id uuid; body_id uuid; investment_id uuid;
        decision_id uuid; baseline_id uuid; successor_id uuid;
BEGIN
  actor_id := platform.current_actor();
  INSERT INTO m01_strategy.strategy(tenant_id,code,name,horizon,owner_id)
    VALUES(platform.current_tenant(),'strategy','Strategy',daterange('2026-01-01','2029-01-01','[)'),actor_id)
    RETURNING id INTO strategy_id;
  UPDATE m01_strategy.strategy SET name='Strategy revised'
    WHERE tenant_id=platform.current_tenant() AND id=strategy_id;
  IF (SELECT count(*) FROM platform.entity_revision WHERE tenant_id=platform.current_tenant()
      AND schema_name='m01_strategy' AND table_name='strategy' AND entity_id=strategy_id) <> 2 THEN
    RAISE EXCEPTION 'version history failed';
  END IF;
  INSERT INTO m01_strategy.objective(tenant_id,strategy_id,code,title,owner_id)
    VALUES(platform.current_tenant(),strategy_id,'objective','Objective',actor_id) RETURNING id INTO objective_id;
  INSERT INTO m02_portfolio.portfolio(tenant_id,code,name,owner_id)
    VALUES(platform.current_tenant(),'portfolio','Portfolio',actor_id) RETURNING id INTO portfolio_id;
  INSERT INTO m02_portfolio.investment_category(tenant_id,code,label)
    VALUES(platform.current_tenant(),'change','Change') RETURNING id INTO category_id;
  INSERT INTO m02_portfolio.portfolio_objective(tenant_id,portfolio_id,objective_id,contribution)
    VALUES(platform.current_tenant(),portfolio_id,objective_id,'Aligned');
  INSERT INTO m03_demand.demand(tenant_id,code,title,sponsor_id,submitted_by,status,submitted_at)
    VALUES(platform.current_tenant(),'demand','Demand',actor_id,actor_id,'submitted',clock_timestamp())
    RETURNING id INTO demand_id;
  INSERT INTO m03_demand.business_case(tenant_id,demand_id,owner_id,title)
    VALUES(platform.current_tenant(),demand_id,actor_id,'Case') RETURNING id INTO case_id;
  INSERT INTO m03_demand.case_revision(tenant_id,business_case_id,revision_no,summary,options,assumptions,prepared_by)
    VALUES(platform.current_tenant(),case_id,1,'First case','[]'::jsonb,'[]'::jsonb,actor_id);
  INSERT INTO m04_selection.scoring_model(tenant_id,code,name,owner_id,effective_during)
    VALUES(platform.current_tenant(),'model','Model',actor_id,daterange('2026-01-01',NULL,'[)'))
    RETURNING id INTO model_id;
  INSERT INTO m04_selection.criterion(tenant_id,scoring_model_id,code,name,weight,maximum_score,direction)
    VALUES(platform.current_tenant(),model_id,'value','Value',1,5,'higher') RETURNING id INTO criterion_id;
  INSERT INTO m04_selection.assessment(tenant_id,demand_id,scoring_model_id,assessor_id,status,completed_at)
    VALUES(platform.current_tenant(),demand_id,model_id,actor_id,'completed',clock_timestamp())
    RETURNING id INTO assessment_id;
  INSERT INTO m04_selection.criterion_score(tenant_id,assessment_id,scoring_model_id,criterion_id,score,evidence)
    VALUES(platform.current_tenant(),assessment_id,model_id,criterion_id,4,'Evidence');
  INSERT INTO m04_selection.scenario(tenant_id,code,name,scoring_model_id,owner_id)
    VALUES(platform.current_tenant(),'scenario','Scenario',model_id,actor_id) RETURNING id INTO scenario_id;
  INSERT INTO m04_selection.selection_recommendation
    (tenant_id,scenario_id,demand_id,recommendation,rationale,proposed_by)
    VALUES(platform.current_tenant(),scenario_id,demand_id,'select','Recommended',actor_id)
    RETURNING id INTO recommendation_id;
  INSERT INTO m06_governance.decision_body(tenant_id,code,name,remit,chair_id)
    VALUES(platform.current_tenant(),'board','Board','Investment decisions',actor_id) RETURNING id INTO body_id;
  INSERT INTO m05_investment.investment
    (tenant_id,origin_demand_id,category_id,code,title,sponsor_id,owner_id)
    VALUES(platform.current_tenant(),demand_id,category_id,'investment','Investment',actor_id,actor_id)
    RETURNING id INTO investment_id;
  INSERT INTO m02_portfolio.portfolio_membership
    (tenant_id,portfolio_id,investment_id,membership_during)
    VALUES(platform.current_tenant(),portfolio_id,investment_id,daterange('2026-01-01',NULL,'[)'));
  INSERT INTO m05_investment.investment_decision
    (tenant_id,decision_body_id,decided_by,investment_id,recommendation_id,subject_type,
     subject_id,decision_type,rationale,decided_at,effective_on)
    VALUES(platform.current_tenant(),body_id,actor_id,investment_id,recommendation_id,'investment',
      investment_id,'approve','Approved',clock_timestamp(),'2026-01-01') RETURNING id INTO decision_id;
  INSERT INTO m05_investment.commitment
    (tenant_id,investment_id,approving_decision_id,commitment_type,numeric_limit,unit,effective_during)
    VALUES(platform.current_tenant(),investment_id,decision_id,'funding',100000,'GBP',
      daterange('2026-01-01','2027-01-01','[)'));
  INSERT INTO m06_governance.baseline(tenant_id,portfolio_id,baseline_type,label,created_by,valid_during)
    VALUES(platform.current_tenant(),portfolio_id,'portfolio','FY26',actor_id,
      tstzrange('2026-01-01','2027-01-01','[)')) RETURNING id INTO baseline_id;
  INSERT INTO m06_governance.baseline_item(tenant_id,baseline_id,item_type,item_id,item_version,snapshot)
    VALUES(platform.current_tenant(),baseline_id,'investment',investment_id,1,'{}'::jsonb);
  INSERT INTO m05_investment.investment_decision
    (tenant_id,decision_body_id,decided_by,subject_type,subject_id,decision_type,rationale,decided_at,effective_on)
    VALUES(platform.current_tenant(),body_id,actor_id,'baseline',baseline_id,'approve','Baseline approved',
      transaction_timestamp(),'2026-01-01') RETURNING id INTO decision_id;
  UPDATE m06_governance.baseline SET status='approved',approved_decision_id=decision_id,
    approved_at=clock_timestamp() WHERE tenant_id=platform.current_tenant() AND id=baseline_id;
  INSERT INTO m06_governance.baseline(tenant_id,portfolio_id,baseline_type,label,created_by,valid_during)
    VALUES(platform.current_tenant(),portfolio_id,'portfolio','FY26 revised',actor_id,
      tstzrange('2026-01-01','2027-01-01','[)')) RETURNING id INTO successor_id;
  INSERT INTO m05_investment.investment_decision
    (tenant_id,decision_body_id,decided_by,subject_type,subject_id,decision_type,rationale,decided_at,effective_on)
    VALUES(platform.current_tenant(),body_id,actor_id,'baseline',successor_id,'approve','Successor approved',
      transaction_timestamp(),'2026-01-01') RETURNING id INTO decision_id;
  UPDATE m06_governance.baseline SET status='approved',approved_decision_id=decision_id,
    approved_at=clock_timestamp() WHERE tenant_id=platform.current_tenant() AND id=successor_id;
  IF NOT EXISTS (SELECT 1 FROM m06_governance.baseline WHERE tenant_id=platform.current_tenant()
      AND id=baseline_id AND status='superseded' AND NOT upper_inf(recorded_during)) THEN
    RAISE EXCEPTION 'baseline supersession failed';
  END IF;
END $$;

SET ROLE spm_app;
DO $$ DECLARE visible_tenants integer;
BEGIN
  SELECT count(*) INTO visible_tenants FROM platform.tenant;
  IF visible_tenants <> 1 THEN RAISE EXCEPTION 'RLS expected one tenant, saw %',visible_tenants; END IF;
  BEGIN
    INSERT INTO m02_portfolio.portfolio(tenant_id,code,name,owner_id)
      VALUES(current_setting('app.other_tenant_id')::uuid,'cross','Should fail',platform.current_actor());
    RAISE EXCEPTION 'cross-tenant write unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

DO $$ DECLARE missing_count integer;
BEGIN
  SELECT count(*) INTO missing_count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname='tenant_id' AND NOT a.attisdropped
  WHERE c.relkind='r' AND n.nspname IN
    ('platform','m01_strategy','m02_portfolio','m03_demand','m04_selection','m05_investment','m06_governance')
    AND NOT c.relrowsecurity;
  IF missing_count <> 0 THEN RAISE EXCEPTION '% tenant tables lack RLS',missing_count; END IF;
END $$;
ROLLBACK;

