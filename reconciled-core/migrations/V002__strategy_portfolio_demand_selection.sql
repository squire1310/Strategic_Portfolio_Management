-- Canonical model v0.4 draft: M01-M04. Run after V001 in one transaction.

CREATE TABLE m01_strategy.strategy (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id), id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL, name text NOT NULL, description text,
  horizon daterange NOT NULL CHECK (NOT isempty(horizon)),
  owner_id uuid NOT NULL, status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','retired')),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,code),
  FOREIGN KEY (tenant_id,owner_id) REFERENCES platform.tenant_member(tenant_id,principal_id)
);
CREATE TABLE m01_strategy.objective (
  tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), strategy_id uuid NOT NULL,
  parent_objective_id uuid, code text NOT NULL, title text NOT NULL, description text,
  priority integer NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5), owner_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,strategy_id,code), UNIQUE (tenant_id,strategy_id,id),
  FOREIGN KEY (tenant_id,strategy_id) REFERENCES m01_strategy.strategy(tenant_id,id),
  FOREIGN KEY (tenant_id,strategy_id,parent_objective_id)
    REFERENCES m01_strategy.objective(tenant_id,strategy_id,id) DEFERRABLE INITIALLY IMMEDIATE,
  FOREIGN KEY (tenant_id,owner_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
  CHECK (parent_objective_id IS DISTINCT FROM id)
);
CREATE TABLE m01_strategy.outcome (
  tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), objective_id uuid NOT NULL,
  code text NOT NULL, statement text NOT NULL, target_date date, owner_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,objective_id,code),
  FOREIGN KEY (tenant_id,objective_id) REFERENCES m01_strategy.objective(tenant_id,id),
  FOREIGN KEY (tenant_id,owner_id) REFERENCES platform.tenant_member(tenant_id,principal_id)
);
CREATE TABLE m01_strategy.measure (
  tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), outcome_id uuid NOT NULL,
  code text NOT NULL, name text NOT NULL, unit text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('increase','decrease','maintain')),
  baseline_value numeric(20,4), target_value numeric(20,4), owner_id uuid NOT NULL,
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,outcome_id,code),
  FOREIGN KEY (tenant_id,outcome_id) REFERENCES m01_strategy.outcome(tenant_id,id),
  FOREIGN KEY (tenant_id,owner_id) REFERENCES platform.tenant_member(tenant_id,principal_id)
);
CREATE TABLE m01_strategy.measure_observation (
  tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), measure_id uuid NOT NULL,
  observed_on date NOT NULL, value numeric(20,4) NOT NULL, source_system_id uuid, evidence_uri text,
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,measure_id,observed_on),
  FOREIGN KEY (tenant_id,measure_id) REFERENCES m01_strategy.measure(tenant_id,id),
  FOREIGN KEY (tenant_id,source_system_id) REFERENCES platform.source_system(tenant_id,source_system_id)
);

CREATE TABLE m02_portfolio.portfolio (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id), id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_portfolio_id uuid, code text NOT NULL, name text NOT NULL, owner_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,code),
  FOREIGN KEY (tenant_id,parent_portfolio_id) REFERENCES m02_portfolio.portfolio(tenant_id,id),
  FOREIGN KEY (tenant_id,owner_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
  CHECK (parent_portfolio_id IS DISTINCT FROM id)
);
CREATE TABLE m02_portfolio.investment_category (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id), id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL, label text NOT NULL, active boolean NOT NULL DEFAULT true,
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,code)
);
CREATE TABLE m02_portfolio.portfolio_objective (
  tenant_id uuid NOT NULL, portfolio_id uuid NOT NULL, objective_id uuid NOT NULL,
  contribution text NOT NULL,
  PRIMARY KEY (tenant_id,portfolio_id,objective_id),
  FOREIGN KEY (tenant_id,portfolio_id) REFERENCES m02_portfolio.portfolio(tenant_id,id),
  FOREIGN KEY (tenant_id,objective_id) REFERENCES m01_strategy.objective(tenant_id,id)
);

CREATE TABLE m03_demand.demand (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id), id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL, title text NOT NULL, description text,
  sponsor_id uuid NOT NULL, submitted_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','triage','assessed','accepted','rejected','withdrawn')),
  requested_dates daterange, submitted_at timestamptz,
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,code),
  FOREIGN KEY (tenant_id,sponsor_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
  FOREIGN KEY (tenant_id,submitted_by) REFERENCES platform.tenant_member(tenant_id,principal_id),
  CHECK (requested_dates IS NULL OR NOT isempty(requested_dates)),
  CHECK (status = 'draft' OR submitted_at IS NOT NULL)
);
CREATE TABLE m03_demand.demand_objective (
  tenant_id uuid NOT NULL, demand_id uuid NOT NULL, objective_id uuid NOT NULL, rationale text,
  PRIMARY KEY (tenant_id,demand_id,objective_id),
  FOREIGN KEY (tenant_id,demand_id) REFERENCES m03_demand.demand(tenant_id,id),
  FOREIGN KEY (tenant_id,objective_id) REFERENCES m01_strategy.objective(tenant_id,id)
);
CREATE TABLE m03_demand.business_case (
  tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), demand_id uuid NOT NULL,
  owner_id uuid NOT NULL, title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','retired')),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,demand_id),
  FOREIGN KEY (tenant_id,demand_id) REFERENCES m03_demand.demand(tenant_id,id),
  FOREIGN KEY (tenant_id,owner_id) REFERENCES platform.tenant_member(tenant_id,principal_id)
);
CREATE TABLE m03_demand.case_revision (
  tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), business_case_id uuid NOT NULL,
  revision_no integer NOT NULL CHECK (revision_no > 0),
  summary text NOT NULL, options jsonb NOT NULL CHECK (jsonb_typeof(options) = 'array'),
  assumptions jsonb NOT NULL CHECK (jsonb_typeof(assumptions) = 'array'),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence) = 'array'),
  prepared_by uuid NOT NULL, submitted_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,business_case_id,revision_no),
  FOREIGN KEY (tenant_id,business_case_id) REFERENCES m03_demand.business_case(tenant_id,id),
  FOREIGN KEY (tenant_id,prepared_by) REFERENCES platform.tenant_member(tenant_id,principal_id)
);
CREATE TRIGGER case_revision_immutable BEFORE UPDATE OR DELETE ON m03_demand.case_revision
  FOR EACH ROW EXECUTE FUNCTION platform.guard_immutable();
CREATE TRIGGER case_revision_capture AFTER INSERT ON m03_demand.case_revision
  FOR EACH ROW EXECUTE FUNCTION platform.capture_record('id');

CREATE TABLE m04_selection.scoring_model (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id), id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL, name text NOT NULL, owner_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  effective_during daterange NOT NULL CHECK (NOT isempty(effective_during)),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,code),
  FOREIGN KEY (tenant_id,owner_id) REFERENCES platform.tenant_member(tenant_id,principal_id)
);
CREATE TABLE m04_selection.criterion (
  tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), scoring_model_id uuid NOT NULL,
  code text NOT NULL, name text NOT NULL,
  weight numeric(7,6) NOT NULL CHECK (weight > 0 AND weight <= 1),
  maximum_score numeric(10,4) NOT NULL CHECK (maximum_score > 0),
  direction text NOT NULL CHECK (direction IN ('higher','lower')),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,scoring_model_id,code),
  UNIQUE (tenant_id,scoring_model_id,id),
  FOREIGN KEY (tenant_id,scoring_model_id) REFERENCES m04_selection.scoring_model(tenant_id,id)
);
CREATE TABLE m04_selection.assessment (
  tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), demand_id uuid NOT NULL,
  scoring_model_id uuid NOT NULL, assessor_id uuid NOT NULL,
  rationale text, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','completed','void')),
  completed_at timestamptz,
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,id,scoring_model_id),
  UNIQUE (tenant_id,id,demand_id),
  FOREIGN KEY (tenant_id,demand_id) REFERENCES m03_demand.demand(tenant_id,id),
  FOREIGN KEY (tenant_id,scoring_model_id) REFERENCES m04_selection.scoring_model(tenant_id,id),
  FOREIGN KEY (tenant_id,assessor_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
  CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);
CREATE TABLE m04_selection.criterion_score (
  tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL, scoring_model_id uuid NOT NULL,
  criterion_id uuid NOT NULL, score numeric(10,4) NOT NULL CHECK (score >= 0),
  evidence text NOT NULL,
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,assessment_id,criterion_id),
  FOREIGN KEY (tenant_id,assessment_id,scoring_model_id)
    REFERENCES m04_selection.assessment(tenant_id,id,scoring_model_id),
  FOREIGN KEY (tenant_id,scoring_model_id,criterion_id)
    REFERENCES m04_selection.criterion(tenant_id,scoring_model_id,id)
);
CREATE TABLE m04_selection.scenario (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id), id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL, name text NOT NULL, scoring_model_id uuid NOT NULL, owner_id uuid NOT NULL,
  constraint_set jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(constraint_set)='object'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','locked','archived')),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,code),
  FOREIGN KEY (tenant_id,scoring_model_id) REFERENCES m04_selection.scoring_model(tenant_id,id),
  FOREIGN KEY (tenant_id,owner_id) REFERENCES platform.tenant_member(tenant_id,principal_id)
);
CREATE TABLE m04_selection.scenario_candidate (
  tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), scenario_id uuid NOT NULL,
  demand_id uuid NOT NULL, assessment_id uuid, rank integer CHECK (rank > 0),
  aggregate_score numeric(12,4),
  inclusion text NOT NULL DEFAULT 'considered' CHECK (inclusion IN ('considered','selected','excluded')),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,scenario_id,demand_id),
  FOREIGN KEY (tenant_id,scenario_id) REFERENCES m04_selection.scenario(tenant_id,id),
  FOREIGN KEY (tenant_id,demand_id) REFERENCES m03_demand.demand(tenant_id,id),
  FOREIGN KEY (tenant_id,assessment_id,demand_id)
    REFERENCES m04_selection.assessment(tenant_id,id,demand_id)
);
CREATE TABLE m04_selection.selection_recommendation (
  tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), scenario_id uuid NOT NULL,
  demand_id uuid NOT NULL,
  recommendation text NOT NULL CHECK (recommendation IN ('select','defer','reject')),
  rationale text NOT NULL, proposed_by uuid NOT NULL,
  proposed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,scenario_id) REFERENCES m04_selection.scenario(tenant_id,id),
  FOREIGN KEY (tenant_id,demand_id) REFERENCES m03_demand.demand(tenant_id,id),
  FOREIGN KEY (tenant_id,proposed_by) REFERENCES platform.tenant_member(tenant_id,principal_id)
);
CREATE INDEX recommendation_demand_idx ON m04_selection.selection_recommendation(tenant_id,demand_id,proposed_at DESC);
CREATE TRIGGER recommendation_immutable BEFORE UPDATE OR DELETE ON m04_selection.selection_recommendation
  FOR EACH ROW EXECUTE FUNCTION platform.guard_immutable();
CREATE TRIGGER recommendation_capture AFTER INSERT ON m04_selection.selection_recommendation
  FOR EACH ROW EXECUTE FUNCTION platform.capture_record('id');

DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('m01_strategy','strategy'),('m01_strategy','objective'),('m01_strategy','outcome'),
    ('m01_strategy','measure'),('m01_strategy','measure_observation'),
    ('m02_portfolio','portfolio'),('m02_portfolio','investment_category'),
    ('m03_demand','demand'),('m03_demand','business_case'),
    ('m04_selection','scoring_model'),('m04_selection','criterion'),
    ('m04_selection','assessment'),('m04_selection','criterion_score'),
    ('m04_selection','scenario'),('m04_selection','scenario_candidate')
  ) AS v(schema_name,table_name) LOOP
    EXECUTE format('CREATE TRIGGER stamp_version BEFORE INSERT OR UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION platform.stamp_version()',r.schema_name,r.table_name);
    EXECUTE format('CREATE TRIGGER capture_change AFTER INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION platform.capture_change()',r.schema_name,r.table_name);
  END LOOP;
END $$;

