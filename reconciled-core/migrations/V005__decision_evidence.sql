-- Forward-only hardening of the v0.4 draft's decision evidence.

ALTER TABLE m04_selection.assessment
  ALTER COLUMN demand_id DROP NOT NULL,
  ADD COLUMN investment_id uuid,
  ADD COLUMN investment_version_no integer,
  ADD COLUMN case_revision_id uuid,
  ADD CONSTRAINT assessment_investment_fk
    FOREIGN KEY (tenant_id,investment_id) REFERENCES m05_investment.investment(tenant_id,id),
  ADD CONSTRAINT assessment_case_revision_fk
    FOREIGN KEY (tenant_id,case_revision_id) REFERENCES m03_demand.case_revision(tenant_id,id),
  ADD CONSTRAINT assessment_one_subject
    CHECK ((demand_id IS NOT NULL) <> (investment_id IS NOT NULL)),
  ADD CONSTRAINT assessment_basis_matches_subject
    CHECK ((demand_id IS NOT NULL AND investment_version_no IS NULL)
        OR (investment_id IS NOT NULL AND case_revision_id IS NULL)),
  ADD CONSTRAINT completed_assessment_has_basis
    CHECK (status <> 'completed' OR
      (demand_id IS NOT NULL AND case_revision_id IS NOT NULL) OR
      (investment_id IS NOT NULL AND investment_version_no IS NOT NULL)),
  ADD CONSTRAINT assessment_investment_unique UNIQUE (tenant_id,id,investment_id);

ALTER TABLE m04_selection.scenario_candidate
  ALTER COLUMN demand_id DROP NOT NULL,
  ADD COLUMN investment_id uuid,
  ADD CONSTRAINT scenario_candidate_investment_fk
    FOREIGN KEY (tenant_id,investment_id) REFERENCES m05_investment.investment(tenant_id,id),
  ADD CONSTRAINT scenario_candidate_assessment_investment_fk
    FOREIGN KEY (tenant_id,assessment_id,investment_id)
      REFERENCES m04_selection.assessment(tenant_id,id,investment_id),
  ADD CONSTRAINT scenario_candidate_one_subject
    CHECK ((demand_id IS NOT NULL) <> (investment_id IS NOT NULL));
CREATE UNIQUE INDEX scenario_candidate_investment_unique
  ON m04_selection.scenario_candidate(tenant_id,scenario_id,investment_id)
  WHERE investment_id IS NOT NULL;

ALTER TABLE m04_selection.selection_recommendation
  ALTER COLUMN demand_id DROP NOT NULL,
  ADD COLUMN investment_id uuid,
  ADD CONSTRAINT recommendation_investment_fk
    FOREIGN KEY (tenant_id,investment_id) REFERENCES m05_investment.investment(tenant_id,id),
  ADD CONSTRAINT recommendation_one_subject
    CHECK ((demand_id IS NOT NULL) <> (investment_id IS NOT NULL));

ALTER TABLE m04_selection.selection_recommendation
  ADD COLUMN basis_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT recommendation_basis_is_object CHECK (jsonb_typeof(basis_snapshot)='object');

CREATE FUNCTION m04_selection.guard_scoring_model() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE criterion_count integer; total_weight numeric;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'draft' THEN RAISE EXCEPTION 'new scoring model must start as draft'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' THEN
    IF OLD.status<>'draft' THEN RAISE EXCEPTION 'activated scoring model is immutable'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status IN ('active','retired') THEN
    IF OLD.status='active' AND NEW.status='retired'
       AND (to_jsonb(NEW)-'status'-'row_version'-'updated_at') =
           (to_jsonb(OLD)-'status'-'row_version'-'updated_at') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'activated scoring model is immutable; create a successor model';
  END IF;
  IF NEW.status='active' THEN
    SELECT count(*),coalesce(sum(weight),0) INTO criterion_count,total_weight
      FROM m04_selection.criterion
      WHERE tenant_id=NEW.tenant_id AND scoring_model_id=NEW.id;
    IF criterion_count=0 OR total_weight<>1 THEN
      RAISE EXCEPTION 'active scoring model requires criteria whose weights total 1';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER scoring_model_guard BEFORE INSERT OR UPDATE OR DELETE ON m04_selection.scoring_model
  FOR EACH ROW EXECUTE FUNCTION m04_selection.guard_scoring_model();

CREATE FUNCTION m04_selection.guard_criterion() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE model_status text; r record;
BEGIN
  IF TG_OP='DELETE' THEN r:=OLD; ELSE r:=NEW; END IF;
  SELECT status INTO model_status FROM m04_selection.scoring_model
    WHERE tenant_id=r.tenant_id AND id=r.scoring_model_id;
  IF model_status<>'draft' THEN
    RAISE EXCEPTION 'criteria are immutable after model activation';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER criterion_guard BEFORE INSERT OR UPDATE OR DELETE ON m04_selection.criterion
  FOR EACH ROW EXECUTE FUNCTION m04_selection.guard_criterion();

CREATE FUNCTION m04_selection.guard_criterion_score() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record; assessment_status text; score_max numeric;
BEGIN
  IF TG_OP='DELETE' THEN r:=OLD; ELSE r:=NEW; END IF;
  SELECT status INTO assessment_status FROM m04_selection.assessment
    WHERE tenant_id=r.tenant_id AND id=r.assessment_id;
  IF assessment_status='completed' THEN
    RAISE EXCEPTION 'completed assessment scores are immutable';
  END IF;
  IF TG_OP<>'DELETE' THEN
    SELECT maximum_score INTO score_max FROM m04_selection.criterion
      WHERE tenant_id=NEW.tenant_id AND id=NEW.criterion_id;
    IF NEW.score>score_max THEN RAISE EXCEPTION 'criterion score exceeds maximum'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER criterion_score_guard BEFORE INSERT OR UPDATE OR DELETE ON m04_selection.criterion_score
  FOR EACH ROW EXECUTE FUNCTION m04_selection.guard_criterion_score();

CREATE FUNCTION m04_selection.guard_assessment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE case_demand uuid; current_investment_version integer;
        model_status text; expected_count integer; actual_count integer;
BEGIN
  IF TG_OP='UPDATE' AND OLD.status='completed' THEN
    RAISE EXCEPTION 'completed assessment is immutable; create a new assessment';
  END IF;
  IF NEW.status='completed' THEN
    IF NEW.demand_id IS NOT NULL THEN
      SELECT b.demand_id INTO case_demand
        FROM m03_demand.case_revision r JOIN m03_demand.business_case b
          ON b.tenant_id=r.tenant_id AND b.id=r.business_case_id
        WHERE r.tenant_id=NEW.tenant_id AND r.id=NEW.case_revision_id;
      IF case_demand IS DISTINCT FROM NEW.demand_id THEN
        RAISE EXCEPTION 'assessment case revision does not belong to demand';
      END IF;
    ELSE
      SELECT row_version INTO current_investment_version FROM m05_investment.investment
        WHERE tenant_id=NEW.tenant_id AND id=NEW.investment_id;
      IF NEW.investment_version_no IS DISTINCT FROM current_investment_version THEN
        RAISE EXCEPTION 'assessment must cite the current investment version';
      END IF;
    END IF;
    SELECT status INTO model_status FROM m04_selection.scoring_model
      WHERE tenant_id=NEW.tenant_id AND id=NEW.scoring_model_id;
    IF model_status<>'active' THEN RAISE EXCEPTION 'assessment requires active scoring model'; END IF;
    SELECT count(*) INTO expected_count FROM m04_selection.criterion
      WHERE tenant_id=NEW.tenant_id AND scoring_model_id=NEW.scoring_model_id;
    SELECT count(*) INTO actual_count FROM m04_selection.criterion_score
      WHERE tenant_id=NEW.tenant_id AND assessment_id=NEW.id;
    IF actual_count<>expected_count THEN
      RAISE EXCEPTION 'assessment requires exactly one score per criterion';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER assessment_guard BEFORE INSERT OR UPDATE ON m04_selection.assessment
  FOR EACH ROW EXECUTE FUNCTION m04_selection.guard_assessment();

CREATE FUNCTION m04_selection.guard_scenario() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE model_status text;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'draft' THEN RAISE EXCEPTION 'new scenario must start as draft'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' THEN
    IF OLD.status<>'draft' THEN RAISE EXCEPTION 'locked scenario is immutable'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status IN ('locked','archived') THEN
    IF OLD.status='locked' AND NEW.status='archived'
       AND (to_jsonb(NEW)-'status'-'row_version'-'updated_at') =
           (to_jsonb(OLD)-'status'-'row_version'-'updated_at') THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'locked scenario is immutable; create a successor scenario';
  END IF;
  IF NEW.status='locked' THEN
    SELECT status INTO model_status FROM m04_selection.scoring_model
      WHERE tenant_id=NEW.tenant_id AND id=NEW.scoring_model_id;
    IF model_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'locked scenario requires active scoring model';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM m04_selection.scenario_candidate
        WHERE tenant_id=NEW.tenant_id AND scenario_id=NEW.id
    ) THEN RAISE EXCEPTION 'locked scenario requires candidates'; END IF;
    IF EXISTS (
      SELECT 1 FROM m04_selection.scenario_candidate c
      LEFT JOIN m04_selection.assessment a ON a.tenant_id=c.tenant_id AND a.id=c.assessment_id
      WHERE c.tenant_id=NEW.tenant_id AND c.scenario_id=NEW.id
        AND (c.aggregate_score IS NULL OR a.status IS DISTINCT FROM 'completed'
             OR a.scoring_model_id IS DISTINCT FROM NEW.scoring_model_id)
    ) THEN RAISE EXCEPTION 'locked scenario has incomplete candidates'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER scenario_guard BEFORE INSERT OR UPDATE OR DELETE ON m04_selection.scenario
  FOR EACH ROW EXECUTE FUNCTION m04_selection.guard_scenario();

CREATE FUNCTION m04_selection.guard_scenario_candidate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record; scenario_status text; assessment_status text;
BEGIN
  IF TG_OP='DELETE' THEN r:=OLD; ELSE r:=NEW; END IF;
  SELECT status INTO scenario_status FROM m04_selection.scenario
    WHERE tenant_id=r.tenant_id AND id=r.scenario_id;
  IF scenario_status<>'draft' THEN RAISE EXCEPTION 'locked scenario candidates are immutable'; END IF;
  IF TG_OP<>'DELETE' THEN
    SELECT status INTO assessment_status FROM m04_selection.assessment
      WHERE tenant_id=NEW.tenant_id AND id=NEW.assessment_id;
    IF NEW.aggregate_score IS NULL OR assessment_status IS DISTINCT FROM 'completed' THEN
      RAISE EXCEPTION 'scenario candidate requires score and completed assessment';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER scenario_candidate_guard BEFORE INSERT OR UPDATE OR DELETE ON m04_selection.scenario_candidate
  FOR EACH ROW EXECUTE FUNCTION m04_selection.guard_scenario_candidate();

CREATE FUNCTION m04_selection.freeze_recommendation_basis() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s m04_selection.scenario%ROWTYPE;
        c m04_selection.scenario_candidate%ROWTYPE;
        a m04_selection.assessment%ROWTYPE;
        m m04_selection.scoring_model%ROWTYPE;
        r m03_demand.case_revision%ROWTYPE;
        case_basis jsonb;
        investment_basis jsonb;
BEGIN
  SELECT * INTO s FROM m04_selection.scenario
    WHERE tenant_id=NEW.tenant_id AND id=NEW.scenario_id;
  SELECT * INTO c FROM m04_selection.scenario_candidate
    WHERE tenant_id=NEW.tenant_id AND scenario_id=NEW.scenario_id
      AND ((NEW.demand_id IS NOT NULL AND demand_id=NEW.demand_id)
        OR (NEW.investment_id IS NOT NULL AND investment_id=NEW.investment_id));
  IF s.status IS DISTINCT FROM 'locked' OR c.id IS NULL
     OR (NEW.recommendation='select' AND c.inclusion<>'selected')
     OR (NEW.recommendation='defer' AND c.inclusion<>'considered')
     OR (NEW.recommendation='reject' AND c.inclusion<>'excluded') THEN
    RAISE EXCEPTION 'recommendation requires matching candidate in locked scenario';
  END IF;
  SELECT * INTO a FROM m04_selection.assessment
    WHERE tenant_id=NEW.tenant_id AND id=c.assessment_id;
  IF a.id IS NULL OR a.scoring_model_id IS DISTINCT FROM s.scoring_model_id THEN
    RAISE EXCEPTION 'candidate assessment does not match scenario model';
  END IF;
  SELECT * INTO m FROM m04_selection.scoring_model
    WHERE tenant_id=NEW.tenant_id AND id=s.scoring_model_id;
  IF NEW.demand_id IS NOT NULL THEN
    SELECT * INTO r FROM m03_demand.case_revision
      WHERE tenant_id=NEW.tenant_id AND id=a.case_revision_id;
    case_basis := to_jsonb(r);
  ELSE
    SELECT payload INTO investment_basis FROM platform.entity_revision
      WHERE tenant_id=NEW.tenant_id AND schema_name='m05_investment'
        AND table_name='investment' AND entity_id=NEW.investment_id
        AND version_no=a.investment_version_no;
    IF investment_basis IS NULL THEN
      RAISE EXCEPTION 'investment assessment revision was not found';
    END IF;
  END IF;
  NEW.basis_snapshot := jsonb_build_object(
    'scenario',to_jsonb(s),'candidate',to_jsonb(c),'assessment',to_jsonb(a),
    'scoring_model',to_jsonb(m),
    'case_revision',case_basis,
    'investment_revision',investment_basis,
    'criteria',(SELECT coalesce(jsonb_agg(to_jsonb(k) ORDER BY k.code),'[]'::jsonb)
      FROM m04_selection.criterion k WHERE k.tenant_id=NEW.tenant_id AND k.scoring_model_id=m.id),
    'scores',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.criterion_id),'[]'::jsonb)
      FROM m04_selection.criterion_score x WHERE x.tenant_id=NEW.tenant_id AND x.assessment_id=a.id));
  RETURN NEW;
END $$;
CREATE TRIGGER recommendation_basis BEFORE INSERT ON m04_selection.selection_recommendation
  FOR EACH ROW EXECUTE FUNCTION m04_selection.freeze_recommendation_basis();

CREATE OR REPLACE FUNCTION m05_investment.guard_decision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE chair uuid; permitted boolean;
BEGIN
  SELECT chair_id INTO chair FROM m06_governance.decision_body
    WHERE tenant_id=NEW.tenant_id AND id=NEW.decision_body_id;
  SELECT (NEW.decided_by=chair OR EXISTS (
    SELECT 1 FROM m06_governance.delegation d
    WHERE d.tenant_id=NEW.tenant_id AND d.decision_body_id=NEW.decision_body_id
      AND d.delegate_id=NEW.decided_by
      AND d.scope_code IN (NEW.subject_type,'all') AND NEW.decided_at <@ d.effective_during
  )) INTO permitted;
  IF NOT coalesce(permitted,false) THEN RAISE EXCEPTION 'decision maker lacks authority'; END IF;
  IF NEW.recommendation_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM m04_selection.selection_recommendation r
    JOIN m05_investment.investment i ON i.tenant_id=r.tenant_id AND i.id=NEW.investment_id
    WHERE r.tenant_id=NEW.tenant_id AND r.id=NEW.recommendation_id
      AND (r.investment_id=i.id OR r.demand_id=i.origin_demand_id)
  ) THEN RAISE EXCEPTION 'recommendation does not match investment or its origin demand'; END IF;
  RETURN NEW;
END $$;

-- Link and platform governance changes should leave an audit and outbox trail too.
ALTER TABLE m02_portfolio.portfolio_objective ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE m02_portfolio.portfolio_objective ADD CONSTRAINT portfolio_objective_id_unique UNIQUE (tenant_id,id);
ALTER TABLE m03_demand.demand_objective ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE m03_demand.demand_objective ADD CONSTRAINT demand_objective_id_unique UNIQUE (tenant_id,id);
ALTER TABLE m06_governance.baseline_item ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE m06_governance.baseline_item ADD CONSTRAINT baseline_item_id_unique UNIQUE (tenant_id,id);

CREATE FUNCTION platform.guard_link_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE col text;
BEGIN
  FOREACH col IN ARRAY TG_ARGV LOOP
    IF (to_jsonb(NEW)->>col) IS DISTINCT FROM (to_jsonb(OLD)->>col) THEN
      RAISE EXCEPTION 'link identity column % is immutable',col;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER portfolio_objective_identity BEFORE UPDATE ON m02_portfolio.portfolio_objective
  FOR EACH ROW EXECUTE FUNCTION platform.guard_link_identity('tenant_id','id','portfolio_id','objective_id');
CREATE TRIGGER demand_objective_identity BEFORE UPDATE ON m03_demand.demand_objective
  FOR EACH ROW EXECUTE FUNCTION platform.guard_link_identity('tenant_id','id','demand_id','objective_id');
CREATE TRIGGER baseline_item_identity BEFORE UPDATE ON m06_governance.baseline_item
  FOR EACH ROW EXECUTE FUNCTION platform.guard_link_identity('tenant_id','id','baseline_id','item_type','item_id');

CREATE TRIGGER portfolio_objective_capture AFTER INSERT OR UPDATE OR DELETE ON m02_portfolio.portfolio_objective
  FOR EACH ROW EXECUTE FUNCTION platform.capture_record('id');
CREATE TRIGGER demand_objective_capture AFTER INSERT OR UPDATE OR DELETE ON m03_demand.demand_objective
  FOR EACH ROW EXECUTE FUNCTION platform.capture_record('id');
CREATE TRIGGER baseline_item_capture AFTER INSERT OR UPDATE OR DELETE ON m06_governance.baseline_item
  FOR EACH ROW EXECUTE FUNCTION platform.capture_record('id');
CREATE TRIGGER tenant_member_capture AFTER INSERT OR UPDATE OR DELETE ON platform.tenant_member
  FOR EACH ROW EXECUTE FUNCTION platform.capture_record('principal_id');
CREATE TRIGGER source_system_capture AFTER INSERT OR UPDATE OR DELETE ON platform.source_system
  FOR EACH ROW EXECUTE FUNCTION platform.capture_record('source_system_id');

REVOKE EXECUTE ON FUNCTION m04_selection.guard_scoring_model(),m04_selection.guard_criterion(),
  m04_selection.guard_criterion_score(),m04_selection.guard_assessment(),
  m04_selection.guard_scenario(),m04_selection.guard_scenario_candidate(),
  m04_selection.freeze_recommendation_basis(),platform.guard_link_identity() FROM PUBLIC;

