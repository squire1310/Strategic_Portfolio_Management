-- First executable slice of approved domain decisions D02, D04, D05, D06 and D08.
-- Forward only; prior migrations remain unchanged.

ALTER TABLE m04_selection.scenario_candidate
  ALTER COLUMN aggregate_score TYPE numeric(20,10);

CREATE FUNCTION m04_selection.normalized_score(p_tenant uuid,p_assessment uuid)
RETURNS numeric LANGUAGE plpgsql STABLE AS $$
DECLARE expected integer; actual integer; result numeric;
BEGIN
  SELECT count(*) INTO expected FROM m04_selection.criterion k
    JOIN m04_selection.assessment a ON a.tenant_id=k.tenant_id
      AND a.scoring_model_id=k.scoring_model_id
    WHERE a.tenant_id=p_tenant AND a.id=p_assessment AND a.status='completed';
  IF expected=0 THEN RAISE EXCEPTION 'completed assessment and active criteria required'; END IF;
  SELECT count(*),sum(100*k.weight*x.score/k.maximum_score)
    INTO actual,result
    FROM m04_selection.criterion_score x
    JOIN m04_selection.criterion k ON k.tenant_id=x.tenant_id AND k.id=x.criterion_id
    WHERE x.tenant_id=p_tenant AND x.assessment_id=p_assessment;
  IF actual<>expected THEN RAISE EXCEPTION 'incomplete assessment scores'; END IF;
  RETURN result;
END $$;

CREATE FUNCTION m04_selection.set_candidate_score() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.aggregate_score := m04_selection.normalized_score(NEW.tenant_id,NEW.assessment_id);
  RETURN NEW;
END $$;
CREATE TRIGGER zz_candidate_score BEFORE INSERT OR UPDATE ON m04_selection.scenario_candidate
  FOR EACH ROW EXECUTE FUNCTION m04_selection.set_candidate_score();

CREATE FUNCTION m04_selection.rank_locked_scenario() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='draft' AND NEW.status='locked' THEN
    IF EXISTS (
      SELECT 1 FROM m04_selection.scenario_candidate c
      WHERE c.tenant_id=NEW.tenant_id AND c.scenario_id=NEW.id
        AND c.aggregate_score IS DISTINCT FROM m04_selection.normalized_score(c.tenant_id,c.assessment_id)
    ) THEN RAISE EXCEPTION 'scenario candidate score is stale'; END IF;
    WITH ranking AS (
      SELECT id,dense_rank() OVER (
        ORDER BY m04_selection.normalized_score(tenant_id,assessment_id) DESC
      ) AS new_rank
      FROM m04_selection.scenario_candidate
      WHERE tenant_id=NEW.tenant_id AND scenario_id=NEW.id
    )
    UPDATE m04_selection.scenario_candidate c SET rank=r.new_rank
      FROM ranking r WHERE c.tenant_id=NEW.tenant_id AND c.id=r.id
        AND c.rank IS DISTINCT FROM r.new_rank;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER zz_scenario_rank BEFORE UPDATE ON m04_selection.scenario
  FOR EACH ROW EXECUTE FUNCTION m04_selection.rank_locked_scenario();

ALTER TABLE m06_governance.decision_body
  ADD COLUMN monetary_limit numeric(20,2),
  ADD COLUMN currency_code varchar(3),
  ADD COLUMN quorum_required integer NOT NULL DEFAULT 1,
  ADD CONSTRAINT body_monetary_pair CHECK ((monetary_limit IS NULL)=(currency_code IS NULL)),
  ADD CONSTRAINT body_monetary_positive CHECK (monetary_limit IS NULL OR monetary_limit>=0),
  ADD CONSTRAINT body_currency_code CHECK (currency_code IS NULL OR currency_code ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT body_quorum_positive CHECK (quorum_required>=1);

ALTER TABLE m05_investment.investment_decision
  ADD COLUMN approval_amount numeric(20,2),
  ADD COLUMN approval_currency varchar(3),
  ADD COLUMN authority_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT decision_monetary_pair CHECK ((approval_amount IS NULL)=(approval_currency IS NULL)),
  ADD CONSTRAINT decision_amount_positive CHECK (approval_amount IS NULL OR approval_amount>=0),
  ADD CONSTRAINT decision_currency_code CHECK (approval_currency IS NULL OR approval_currency ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT baseline_nonmonetary CHECK (subject_type<>'baseline' OR approval_amount IS NULL),
  ADD CONSTRAINT authority_snapshot_object CHECK (jsonb_typeof(authority_snapshot)='object');

CREATE FUNCTION m05_investment.enforce_decision_policy() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b m06_governance.decision_body%ROWTYPE;
        d m06_governance.delegation%ROWTYPE;
        i m05_investment.investment%ROWTYPE;
        rec m04_selection.selection_recommendation%ROWTYPE;
        assessor uuid; case_owner uuid; baseline_creator uuid; active_role text;
BEGIN
  IF NEW.decided_by IS DISTINCT FROM platform.current_actor() THEN
    RAISE EXCEPTION 'decision maker must be the authenticated actor';
  END IF;
  SELECT member_role INTO active_role FROM platform.tenant_member
    WHERE tenant_id=NEW.tenant_id AND principal_id=NEW.decided_by AND active;
  IF active_role NOT IN ('approver','administrator') OR active_role IS NULL THEN
    RAISE EXCEPTION 'decision maker lacks active approver role';
  END IF;
  SELECT * INTO b FROM m06_governance.decision_body
    WHERE tenant_id=NEW.tenant_id AND id=NEW.decision_body_id;
  IF b.quorum_required<>1 THEN
    RAISE EXCEPTION 'committee quorum requires vote evidence not yet implemented';
  END IF;
  IF NEW.decided_by<>b.chair_id THEN
    SELECT * INTO d FROM m06_governance.delegation
      WHERE tenant_id=NEW.tenant_id AND decision_body_id=NEW.decision_body_id
        AND delegate_id=NEW.decided_by AND scope_code IN (NEW.subject_type,'all')
        AND NEW.decided_at <@ effective_during
      ORDER BY lower(effective_during) DESC,id LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'decision maker lacks effective delegation'; END IF;
  END IF;
  IF NEW.approval_amount IS NOT NULL THEN
    IF NEW.decision_type<>'approve' OR b.monetary_limit IS NULL
       OR b.currency_code IS DISTINCT FROM NEW.approval_currency
       OR NEW.approval_amount>b.monetary_limit THEN
      RAISE EXCEPTION 'monetary approval exceeds body mandate';
    END IF;
    IF NEW.decided_by<>b.chair_id AND (d.amount_limit IS NULL
       OR d.currency_code IS DISTINCT FROM NEW.approval_currency
       OR NEW.approval_amount>d.amount_limit) THEN
      RAISE EXCEPTION 'monetary approval exceeds delegation';
    END IF;
  END IF;
  IF NEW.decision_type='approve' THEN
    IF NEW.subject_type='investment' THEN
      SELECT * INTO i FROM m05_investment.investment
        WHERE tenant_id=NEW.tenant_id AND id=NEW.investment_id;
      IF NEW.decided_by IN (i.sponsor_id,i.owner_id) THEN
        RAISE EXCEPTION 'investment sponsor or owner cannot approve';
      END IF;
      IF NEW.recommendation_id IS NOT NULL THEN
        SELECT * INTO rec FROM m04_selection.selection_recommendation
          WHERE tenant_id=NEW.tenant_id AND id=NEW.recommendation_id;
        assessor := (rec.basis_snapshot->'assessment'->>'assessor_id')::uuid;
        IF rec.recommendation<>'select' OR NEW.decided_by=rec.proposed_by
           OR NEW.decided_by=assessor THEN
          RAISE EXCEPTION 'approver must be independent of recommendation and assessment';
        END IF;
      END IF;
      IF i.origin_demand_id IS NOT NULL THEN
        SELECT c.owner_id INTO case_owner FROM m03_demand.business_case c
          WHERE c.tenant_id=NEW.tenant_id AND c.demand_id=i.origin_demand_id;
        IF NEW.decided_by=case_owner THEN
          RAISE EXCEPTION 'case owner cannot approve';
        END IF;
      END IF;
    ELSE
      SELECT created_by INTO baseline_creator FROM m06_governance.baseline
        WHERE tenant_id=NEW.tenant_id AND id=NEW.subject_id;
      IF baseline_creator IS NULL OR NEW.decided_by=baseline_creator THEN
        RAISE EXCEPTION 'baseline approver must be independent of creator';
      END IF;
    END IF;
  END IF;
  NEW.authority_snapshot := jsonb_build_object(
    'decision_body_id',b.id,'body_version',b.row_version,
    'body_monetary_limit',b.monetary_limit,'body_currency',b.currency_code,
    'quorum_required',b.quorum_required,
    'delegation_id',d.id,'delegation_version',d.row_version,
    'delegation_limit',d.amount_limit,'delegation_currency',d.currency_code);
  RETURN NEW;
END $$;
CREATE TRIGGER zz_decision_policy BEFORE INSERT ON m05_investment.investment_decision
  FOR EACH ROW EXECUTE FUNCTION m05_investment.enforce_decision_policy();

CREATE FUNCTION m05_investment.enforce_commitment_policy() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d m05_investment.investment_decision%ROWTYPE;
BEGIN
  IF NEW.commitment_type='funding' THEN
    SELECT * INTO d FROM m05_investment.investment_decision
      WHERE tenant_id=NEW.tenant_id AND id=NEW.approving_decision_id;
    IF NEW.unit !~ '^[A-Z]{3}$' OR d.approval_amount IS NULL
       OR d.approval_currency IS DISTINCT FROM NEW.unit
       OR NEW.numeric_limit>d.approval_amount THEN
      RAISE EXCEPTION 'funding commitment exceeds monetary approval';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER zz_commitment_policy BEFORE INSERT ON m05_investment.commitment
  FOR EACH ROW EXECUTE FUNCTION m05_investment.enforce_commitment_policy();

-- The approved snapshot must match a real, current item in the baseline portfolio.
CREATE FUNCTION m06_governance.enforce_baseline_items() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE x m06_governance.baseline_item%ROWTYPE;
        payload jsonb; current_version integer; in_scope boolean;
        on_date date := lower(NEW.valid_during)::date;
BEGIN
  IF NEW.status<>'approved' OR OLD.status='approved' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM m06_governance.baseline_item
      WHERE tenant_id=NEW.tenant_id AND baseline_id=NEW.id) THEN
    RAISE EXCEPTION 'approved baseline requires items';
  END IF;
  FOR x IN SELECT * FROM m06_governance.baseline_item
    WHERE tenant_id=NEW.tenant_id AND baseline_id=NEW.id LOOP
    payload:=NULL; current_version:=NULL; in_scope:=false;
    CASE x.item_type
      WHEN 'portfolio' THEN
        SELECT to_jsonb(p),p.row_version,p.id=NEW.portfolio_id
          INTO payload,current_version,in_scope FROM m02_portfolio.portfolio p
          WHERE p.tenant_id=NEW.tenant_id AND p.id=x.item_id;
      WHEN 'investment' THEN
        SELECT to_jsonb(i),i.row_version,EXISTS (
          SELECT 1 FROM m02_portfolio.portfolio_membership pm
          WHERE pm.tenant_id=i.tenant_id AND pm.investment_id=i.id
            AND pm.portfolio_id=NEW.portfolio_id AND on_date <@ pm.membership_during)
          INTO payload,current_version,in_scope FROM m05_investment.investment i
          WHERE i.tenant_id=NEW.tenant_id AND i.id=x.item_id;
      WHEN 'objective' THEN
        SELECT to_jsonb(o),o.row_version,EXISTS (
          SELECT 1 FROM m02_portfolio.portfolio_objective po
          WHERE po.tenant_id=o.tenant_id AND po.objective_id=o.id
            AND po.portfolio_id=NEW.portfolio_id)
          INTO payload,current_version,in_scope FROM m01_strategy.objective o
          WHERE o.tenant_id=NEW.tenant_id AND o.id=x.item_id;
      WHEN 'strategy' THEN
        SELECT to_jsonb(s),s.row_version,EXISTS (
          SELECT 1 FROM m01_strategy.objective o
          JOIN m02_portfolio.portfolio_objective po
            ON po.tenant_id=o.tenant_id AND po.objective_id=o.id
          WHERE o.tenant_id=s.tenant_id AND o.strategy_id=s.id
            AND po.portfolio_id=NEW.portfolio_id)
          INTO payload,current_version,in_scope FROM m01_strategy.strategy s
          WHERE s.tenant_id=NEW.tenant_id AND s.id=x.item_id;
      WHEN 'outcome' THEN
        SELECT to_jsonb(o),o.row_version,EXISTS (
          SELECT 1 FROM m02_portfolio.portfolio_objective po
          WHERE po.tenant_id=o.tenant_id AND po.objective_id=o.objective_id
            AND po.portfolio_id=NEW.portfolio_id)
          INTO payload,current_version,in_scope FROM m01_strategy.outcome o
          WHERE o.tenant_id=NEW.tenant_id AND o.id=x.item_id;
      WHEN 'decision' THEN
        SELECT to_jsonb(d),1,EXISTS (
          SELECT 1 FROM m02_portfolio.portfolio_membership pm
          WHERE pm.tenant_id=d.tenant_id AND pm.investment_id=d.investment_id
            AND pm.portfolio_id=NEW.portfolio_id AND on_date <@ pm.membership_during)
          INTO payload,current_version,in_scope FROM m05_investment.investment_decision d
          WHERE d.tenant_id=NEW.tenant_id AND d.id=x.item_id AND d.investment_id IS NOT NULL;
      WHEN 'commitment' THEN
        SELECT to_jsonb(c),1,EXISTS (
          SELECT 1 FROM m02_portfolio.portfolio_membership pm
          WHERE pm.tenant_id=c.tenant_id AND pm.investment_id=c.investment_id
            AND pm.portfolio_id=NEW.portfolio_id AND on_date <@ pm.membership_during)
          INTO payload,current_version,in_scope FROM m05_investment.commitment c
          WHERE c.tenant_id=NEW.tenant_id AND c.id=x.item_id;
    END CASE;
    IF payload IS NULL OR in_scope IS DISTINCT FROM true
       OR x.item_version IS DISTINCT FROM current_version
       OR x.snapshot IS DISTINCT FROM payload THEN
      RAISE EXCEPTION 'baseline item % % is stale, missing or outside portfolio',x.item_type,x.item_id;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER zz_baseline_items BEFORE UPDATE ON m06_governance.baseline
  FOR EACH ROW EXECUTE FUNCTION m06_governance.enforce_baseline_items();

REVOKE EXECUTE ON FUNCTION m04_selection.normalized_score(uuid,uuid),
  m04_selection.set_candidate_score(),m04_selection.rank_locked_scenario(),
  m05_investment.enforce_decision_policy(),m05_investment.enforce_commitment_policy(),
  m06_governance.enforce_baseline_items() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION m04_selection.normalized_score(uuid,uuid) TO spm_app;

