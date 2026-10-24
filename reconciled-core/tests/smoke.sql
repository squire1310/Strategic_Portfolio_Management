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
        demand_id uuid; case_id uuid; case_revision_id uuid; model_id uuid; criterion_id uuid; v_assessment_id uuid;
        scenario_id uuid; investment_scenario_id uuid; recommendation_id uuid;
        investment_recommendation_id uuid; body_id uuid; investment_id uuid;
        v_investment_assessment_id uuid;
        decision_id uuid; reject_decision_id uuid; v_baseline_id uuid; successor_id uuid;
        partial_id uuid; partial_decision_id uuid; other_actor uuid; approver_id uuid;
        delegate_id uuid; delegated_decision_id uuid; self_body_id uuid;
        blocked boolean;
BEGIN
  actor_id := platform.current_actor();
  INSERT INTO platform.principal(subject,display_name)
    VALUES('schema-smoke:approver','Independent approver') RETURNING principal_id INTO approver_id;
  INSERT INTO platform.tenant_member(tenant_id,principal_id,member_role)
    VALUES(platform.current_tenant(),approver_id,'approver');
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
    VALUES(platform.current_tenant(),case_id,1,'First case','[]'::jsonb,'[]'::jsonb,actor_id)
    RETURNING id INTO case_revision_id;
  INSERT INTO m04_selection.scoring_model(tenant_id,code,name,owner_id,effective_during)
    VALUES(platform.current_tenant(),'model','Model',actor_id,daterange('2026-01-01',NULL,'[)'))
    RETURNING id INTO model_id;
  INSERT INTO m04_selection.criterion(tenant_id,scoring_model_id,code,name,weight,maximum_score,direction)
    VALUES(platform.current_tenant(),model_id,'value','Value',1,5,'higher') RETURNING id INTO criterion_id;
  UPDATE m04_selection.scoring_model SET status='active'
    WHERE tenant_id=platform.current_tenant() AND id=model_id;
  INSERT INTO m04_selection.assessment(tenant_id,demand_id,scoring_model_id,assessor_id,case_revision_id)
    VALUES(platform.current_tenant(),demand_id,model_id,actor_id,case_revision_id)
    RETURNING id INTO v_assessment_id;
  INSERT INTO m04_selection.criterion_score(tenant_id,assessment_id,scoring_model_id,criterion_id,score,evidence)
    VALUES(platform.current_tenant(),v_assessment_id,model_id,criterion_id,4,'Evidence');
  UPDATE m04_selection.assessment SET status='completed',completed_at=clock_timestamp()
    WHERE tenant_id=platform.current_tenant() AND id=v_assessment_id;
  INSERT INTO m04_selection.scenario(tenant_id,code,name,scoring_model_id,owner_id)
    VALUES(platform.current_tenant(),'scenario','Scenario',model_id,actor_id) RETURNING id INTO scenario_id;
  INSERT INTO m04_selection.scenario_candidate
    (tenant_id,scenario_id,demand_id,assessment_id,rank,aggregate_score,inclusion)
    VALUES(platform.current_tenant(),scenario_id,demand_id,v_assessment_id,1,4,'selected');
  IF (SELECT c.aggregate_score FROM m04_selection.scenario_candidate c
      WHERE c.tenant_id=platform.current_tenant() AND c.assessment_id=v_assessment_id) <> 80 THEN
    RAISE EXCEPTION 'normalized score should be 80';
  END IF;
  UPDATE m04_selection.scenario SET status='locked'
    WHERE tenant_id=platform.current_tenant() AND id=scenario_id;
  INSERT INTO m04_selection.selection_recommendation
    (tenant_id,scenario_id,demand_id,recommendation,rationale,proposed_by)
    VALUES(platform.current_tenant(),scenario_id,demand_id,'select','Recommended',actor_id)
    RETURNING id INTO recommendation_id;
  IF NOT EXISTS (SELECT 1 FROM m04_selection.selection_recommendation
    WHERE tenant_id=platform.current_tenant() AND id=recommendation_id
      AND basis_snapshot ? 'case_revision' AND basis_snapshot ? 'scores') THEN
    RAISE EXCEPTION 'recommendation basis was not frozen';
  END IF;
  INSERT INTO m06_governance.decision_body(tenant_id,code,name,remit,chair_id)
    VALUES(platform.current_tenant(),'board','Board','Investment decisions',approver_id) RETURNING id INTO body_id;
  UPDATE m06_governance.decision_body SET monetary_limit=100000,currency_code='GBP'
    WHERE tenant_id=platform.current_tenant() AND id=body_id;
  INSERT INTO platform.principal(subject,display_name)
    VALUES('schema-smoke:delegate','Delegated approver') RETURNING principal_id INTO delegate_id;
  INSERT INTO platform.tenant_member(tenant_id,principal_id,member_role)
    VALUES(platform.current_tenant(),delegate_id,'approver');
  INSERT INTO m06_governance.delegation
    (tenant_id,decision_body_id,delegate_id,scope_code,amount_limit,currency_code,effective_during)
    VALUES(platform.current_tenant(),body_id,delegate_id,'investment',50000,'GBP',
      tstzrange('2026-01-01',NULL,'[)'));
  INSERT INTO m05_investment.investment
    (tenant_id,origin_demand_id,category_id,code,title,sponsor_id,owner_id)
    VALUES(platform.current_tenant(),demand_id,category_id,'investment','Investment',actor_id,actor_id)
    RETURNING id INTO investment_id;
  INSERT INTO m04_selection.assessment
    (tenant_id,investment_id,investment_version_no,scoring_model_id,assessor_id)
    VALUES(platform.current_tenant(),investment_id,1,model_id,actor_id)
    RETURNING id INTO v_investment_assessment_id;
  blocked := false;
  BEGIN
    INSERT INTO m04_selection.criterion_score
      (tenant_id,assessment_id,scoring_model_id,criterion_id,score,evidence)
      VALUES(platform.current_tenant(),v_investment_assessment_id,model_id,criterion_id,6,'Too high');
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'score above criterion maximum was accepted'; END IF;
  INSERT INTO m04_selection.criterion_score
    (tenant_id,assessment_id,scoring_model_id,criterion_id,score,evidence)
    VALUES(platform.current_tenant(),v_investment_assessment_id,model_id,criterion_id,4,'Current performance');
  UPDATE m04_selection.assessment SET status='completed',completed_at=clock_timestamp()
    WHERE tenant_id=platform.current_tenant() AND id=v_investment_assessment_id;
  INSERT INTO m04_selection.scenario(tenant_id,code,name,scoring_model_id,owner_id)
    VALUES(platform.current_tenant(),'investment_scenario','Investment scenario',model_id,actor_id)
    RETURNING id INTO investment_scenario_id;
  INSERT INTO m04_selection.scenario_candidate
    (tenant_id,scenario_id,investment_id,assessment_id,rank,aggregate_score,inclusion)
    VALUES(platform.current_tenant(),investment_scenario_id,investment_id,v_investment_assessment_id,1,4,'selected');
  INSERT INTO m04_selection.scenario_candidate
    (tenant_id,scenario_id,demand_id,assessment_id,rank,aggregate_score,inclusion)
    VALUES(platform.current_tenant(),investment_scenario_id,demand_id,v_assessment_id,2,4,'considered');
  UPDATE m04_selection.scenario SET status='locked'
    WHERE tenant_id=platform.current_tenant() AND id=investment_scenario_id;
  IF (SELECT count(*) FROM m04_selection.scenario_candidate c
      WHERE c.tenant_id=platform.current_tenant() AND c.scenario_id=investment_scenario_id
        AND c.rank=1)<>2 THEN RAISE EXCEPTION 'tied candidates did not share rank'; END IF;
  INSERT INTO m04_selection.selection_recommendation
    (tenant_id,scenario_id,investment_id,recommendation,rationale,proposed_by)
    VALUES(platform.current_tenant(),investment_scenario_id,investment_id,'select','Renew investment',actor_id)
    RETURNING id INTO investment_recommendation_id;
  IF NOT EXISTS (SELECT 1 FROM m04_selection.selection_recommendation
    WHERE tenant_id=platform.current_tenant() AND id=investment_recommendation_id
      AND basis_snapshot->'investment_revision' IS NOT NULL) THEN
    RAISE EXCEPTION 'investment recommendation basis was not frozen';
  END IF;
  UPDATE m05_investment.investment SET title='Investment updated later'
    WHERE tenant_id=platform.current_tenant() AND id=investment_id;
  IF NOT EXISTS (SELECT 1 FROM m04_selection.selection_recommendation
    WHERE tenant_id=platform.current_tenant() AND id=investment_recommendation_id
      AND basis_snapshot->'investment_revision'->>'title'='Investment') THEN
    RAISE EXCEPTION 'recommendation basis changed with investment';
  END IF;
  INSERT INTO m02_portfolio.portfolio_membership
    (tenant_id,portfolio_id,investment_id,membership_during)
    VALUES(platform.current_tenant(),portfolio_id,investment_id,daterange('2026-01-01',NULL,'[)'));
  INSERT INTO m06_governance.decision_body
    (tenant_id,code,name,remit,chair_id,monetary_limit,currency_code)
    VALUES(platform.current_tenant(),'self_board','Self approval test',
      'Negative test',actor_id,100000,'GBP') RETURNING id INTO self_body_id;
  blocked := false;
  BEGIN
    INSERT INTO m05_investment.investment_decision
      (tenant_id,decision_body_id,decided_by,investment_id,recommendation_id,subject_type,
       subject_id,decision_type,rationale,decided_at,effective_on,approval_amount,approval_currency)
      VALUES(platform.current_tenant(),self_body_id,actor_id,investment_id,recommendation_id,
        'investment',investment_id,'approve','Self approval',clock_timestamp(),
        '2026-01-01',100000,'GBP');
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'sponsor self approval was accepted'; END IF;
  PERFORM set_config('app.actor_id',delegate_id::text,true);
  blocked := false;
  BEGIN
    INSERT INTO m05_investment.investment_decision
      (tenant_id,decision_body_id,decided_by,investment_id,recommendation_id,subject_type,
       subject_id,decision_type,rationale,decided_at,effective_on,approval_amount,approval_currency)
      VALUES(platform.current_tenant(),body_id,delegate_id,investment_id,recommendation_id,
        'investment',investment_id,'approve','Over delegated limit',clock_timestamp(),
        '2026-01-01',60000,'GBP');
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'delegated amount limit was bypassed'; END IF;
  PERFORM set_config('app.actor_id',approver_id::text,true);
  blocked := false;
  BEGIN
    INSERT INTO m05_investment.investment_decision
      (tenant_id,decision_body_id,decided_by,investment_id,subject_type,
       subject_id,decision_type,rationale,decided_at,effective_on)
      VALUES(platform.current_tenant(),body_id,approver_id,investment_id,'investment',
        investment_id,'approve','Missing recommendation',clock_timestamp(),'2026-01-01');
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'first approval without recommendation was accepted'; END IF;
  INSERT INTO m05_investment.investment_decision
    (tenant_id,decision_body_id,decided_by,investment_id,recommendation_id,subject_type,
     subject_id,decision_type,rationale,decided_at,effective_on,approval_amount,approval_currency)
    VALUES(platform.current_tenant(),body_id,approver_id,investment_id,recommendation_id,'investment',
      investment_id,'approve','Approved',clock_timestamp(),'2026-01-01',100000,'GBP') RETURNING id INTO decision_id;
  PERFORM set_config('app.actor_id',delegate_id::text,true);
  INSERT INTO m05_investment.investment_decision
    (tenant_id,decision_body_id,decided_by,investment_id,subject_type,
     subject_id,decision_type,rationale,decided_at,effective_on,approval_amount,approval_currency)
    VALUES(platform.current_tenant(),body_id,delegate_id,investment_id,'investment',
      investment_id,'approve','Delegated within limit',clock_timestamp(),
      '2026-01-01',50000,'GBP') RETURNING id INTO delegated_decision_id;
  IF NOT EXISTS (SELECT 1 FROM m05_investment.investment_decision
      WHERE tenant_id=platform.current_tenant() AND id=delegated_decision_id
        AND (authority_snapshot->>'delegation_limit')::numeric=50000) THEN
    RAISE EXCEPTION 'delegation evidence was not frozen';
  END IF;
  PERFORM set_config('app.actor_id',approver_id::text,true);
  blocked := false;
  BEGIN
    INSERT INTO m05_investment.commitment
      (tenant_id,investment_id,approving_decision_id,commitment_type,numeric_limit,unit,effective_during)
      VALUES(platform.current_tenant(),investment_id,decision_id,'funding',100001,'GBP',
        daterange('2026-01-01','2027-01-01','[)'));
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'funding over approval was accepted'; END IF;
  INSERT INTO m05_investment.investment_decision
    (tenant_id,decision_body_id,decided_by,investment_id,recommendation_id,subject_type,
     subject_id,decision_type,rationale,decided_at,effective_on)
    VALUES(platform.current_tenant(),body_id,approver_id,investment_id,investment_recommendation_id,
      'investment',investment_id,'condition','Review later',clock_timestamp(),'2026-01-01');
  INSERT INTO m05_investment.commitment
    (tenant_id,investment_id,approving_decision_id,commitment_type,numeric_limit,unit,effective_during)
    VALUES(platform.current_tenant(),investment_id,decision_id,'funding',100000,'GBP',
      daterange('2026-01-01','2027-01-01','[)'));
  PERFORM set_config('app.actor_id',actor_id::text,true);
  INSERT INTO m06_governance.baseline(tenant_id,portfolio_id,baseline_type,label,created_by,valid_during)
    VALUES(platform.current_tenant(),portfolio_id,'portfolio','FY26',actor_id,
      tstzrange('2026-01-01','2027-01-01','[)')) RETURNING id INTO v_baseline_id;
  INSERT INTO m06_governance.baseline_item(tenant_id,baseline_id,item_type,item_id,item_version,snapshot)
    SELECT platform.current_tenant(),v_baseline_id,'investment',investment_id,
      i.row_version,to_jsonb(i) FROM m05_investment.investment i
      WHERE i.tenant_id=platform.current_tenant() AND i.id=investment_id;
  PERFORM set_config('app.actor_id',approver_id::text,true);
  INSERT INTO m05_investment.investment_decision
    (tenant_id,decision_body_id,decided_by,subject_type,subject_id,decision_type,rationale,decided_at,effective_on)
    VALUES(platform.current_tenant(),body_id,approver_id,'baseline',v_baseline_id,'approve','Baseline approved',
      transaction_timestamp(),'2026-01-01') RETURNING id INTO decision_id;
  UPDATE m06_governance.baseline_item SET snapshot='{}'::jsonb
    WHERE tenant_id=platform.current_tenant() AND baseline_id=v_baseline_id;
  blocked := false;
  BEGIN
    UPDATE m06_governance.baseline SET status='approved',approved_decision_id=decision_id,
      approved_at=clock_timestamp() WHERE tenant_id=platform.current_tenant() AND id=v_baseline_id;
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'stale baseline snapshot was approved'; END IF;
  UPDATE m06_governance.baseline_item AS bi SET snapshot=to_jsonb(i)
    FROM m05_investment.investment i
    WHERE bi.tenant_id=platform.current_tenant()
      AND bi.baseline_id=v_baseline_id
      AND i.tenant_id=bi.tenant_id AND i.id=bi.item_id;
  UPDATE m06_governance.baseline SET status='approved',approved_decision_id=decision_id,
    approved_at=clock_timestamp() WHERE tenant_id=platform.current_tenant() AND id=v_baseline_id;
  PERFORM set_config('app.actor_id',actor_id::text,true);
  INSERT INTO m06_governance.baseline(tenant_id,portfolio_id,baseline_type,label,created_by,valid_during)
    VALUES(platform.current_tenant(),portfolio_id,'portfolio','FY26 revised',actor_id,
      tstzrange('2026-01-01','2027-01-01','[)')) RETURNING id INTO successor_id;
  INSERT INTO m06_governance.baseline_item(tenant_id,baseline_id,item_type,item_id,item_version,snapshot)
    SELECT platform.current_tenant(),successor_id,'investment',investment_id,
      i.row_version,to_jsonb(i) FROM m05_investment.investment i
      WHERE i.tenant_id=platform.current_tenant() AND i.id=investment_id;
  PERFORM set_config('app.actor_id',approver_id::text,true);
  INSERT INTO m05_investment.investment_decision
    (tenant_id,decision_body_id,decided_by,subject_type,subject_id,decision_type,rationale,decided_at,effective_on)
    VALUES(platform.current_tenant(),body_id,approver_id,'baseline',successor_id,'approve','Successor approved',
      transaction_timestamp(),'2026-01-01') RETURNING id INTO decision_id;
  UPDATE m06_governance.baseline SET status='approved',approved_decision_id=decision_id,
    approved_at=clock_timestamp() WHERE tenant_id=platform.current_tenant() AND id=successor_id;
  IF NOT EXISTS (SELECT 1 FROM m06_governance.baseline WHERE tenant_id=platform.current_tenant()
      AND id=v_baseline_id AND status='superseded' AND NOT upper_inf(recorded_during)) THEN
    RAISE EXCEPTION 'baseline supersession failed';
  END IF;
  PERFORM set_config('app.actor_id',actor_id::text,true);
  INSERT INTO m06_governance.baseline(tenant_id,portfolio_id,baseline_type,label,created_by,valid_during)
    VALUES(platform.current_tenant(),portfolio_id,'portfolio','Partial overlap',actor_id,
      tstzrange('2026-06-01','2027-01-01','[)')) RETURNING id INTO partial_id;
  PERFORM set_config('app.actor_id',approver_id::text,true);
  INSERT INTO m05_investment.investment_decision
    (tenant_id,decision_body_id,decided_by,subject_type,subject_id,decision_type,rationale,decided_at,effective_on)
    VALUES(platform.current_tenant(),body_id,approver_id,'baseline',partial_id,'approve',
      'Attempt partial successor',transaction_timestamp(),'2026-06-01') RETURNING id INTO partial_decision_id;
  blocked := false;
  BEGIN
    UPDATE m06_governance.baseline SET status='approved',approved_decision_id=partial_decision_id,
      approved_at=clock_timestamp() WHERE tenant_id=platform.current_tenant() AND id=partial_id;
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'partially overlapping successor was approved'; END IF;
  blocked := false;
  BEGIN
    UPDATE m06_governance.baseline_item SET snapshot='{"changed":true}'::jsonb
      WHERE tenant_id=platform.current_tenant() AND baseline_id=v_baseline_id;
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'approved baseline item was mutable'; END IF;
  blocked := false;
  BEGIN
    UPDATE m04_selection.criterion SET weight=0.5
      WHERE tenant_id=platform.current_tenant() AND id=criterion_id;
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'activated scoring criterion was mutable'; END IF;
  blocked := false;
  BEGIN
    UPDATE m04_selection.criterion_score SET score=3
      WHERE tenant_id=platform.current_tenant() AND assessment_id=v_assessment_id;
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'completed assessment score was mutable'; END IF;
  blocked := false;
  BEGIN
    UPDATE m05_investment.investment_decision SET rationale='Changed'
      WHERE tenant_id=platform.current_tenant() AND id=decision_id;
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'investment decision was mutable'; END IF;
  INSERT INTO m05_investment.investment_decision
    (tenant_id,decision_body_id,decided_by,investment_id,subject_type,subject_id,
     decision_type,rationale,decided_at,effective_on)
    VALUES(platform.current_tenant(),body_id,approver_id,investment_id,'investment',investment_id,
      'reject','No further funding',clock_timestamp(),'2026-01-01') RETURNING id INTO reject_decision_id;
  blocked := false;
  BEGIN
    INSERT INTO m05_investment.commitment
      (tenant_id,investment_id,approving_decision_id,commitment_type,numeric_limit,unit,effective_during)
      VALUES(platform.current_tenant(),investment_id,reject_decision_id,'capacity',1,'FTE',
        daterange('2026-01-01','2027-01-01','[)'));
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'rejected decision authorised commitment'; END IF;
  INSERT INTO platform.principal(subject,display_name)
    VALUES('schema-smoke:unapproved','Unapproved decider') RETURNING principal_id INTO other_actor;
  INSERT INTO platform.tenant_member(tenant_id,principal_id,member_role)
    VALUES(platform.current_tenant(),other_actor,'contributor');
  PERFORM set_config('app.actor_id',other_actor::text,true);
  blocked := false;
  BEGIN
    INSERT INTO m05_investment.investment_decision
      (tenant_id,decision_body_id,decided_by,investment_id,subject_type,subject_id,
       decision_type,rationale,decided_at,effective_on)
      VALUES(platform.current_tenant(),body_id,other_actor,investment_id,'investment',investment_id,
        'approve','Must fail',clock_timestamp(),'2026-01-01');
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'unauthorised decision was accepted'; END IF;
  PERFORM set_config('app.actor_id',actor_id::text,true);
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

