-- M01 owns strategy and outcomes. Every mutable root uses the common version/audit triggers.
CREATE TABLE m01_strategy.strategy (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  horizon daterange NOT NULL,
  owner_id uuid NOT NULL,
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,code),
  FOREIGN KEY (tenant_id,owner_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
  CHECK (NOT isempty(horizon))
);
CREATE TABLE m01_strategy.objective (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  strategy_id uuid NOT NULL,
  parent_objective_id uuid,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  owner_id uuid NOT NULL,
  priority integer NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,strategy_id,code),
  UNIQUE (tenant_id,strategy_id,id),
  FOREIGN KEY (tenant_id,strategy_id) REFERENCES m01_strategy.strategy(tenant_id,id),
  FOREIGN KEY (tenant_id,strategy_id,parent_objective_id)
    REFERENCES m01_strategy.objective(tenant_id,strategy_id,id) DEFERRABLE INITIALLY IMMEDIATE,
  FOREIGN KEY (tenant_id,owner_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
  CHECK (parent_objective_id IS DISTINCT FROM id)
);
CREATE TABLE m01_strategy.measure (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  objective_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  unit text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('increase','decrease','maintain')),
  target_value numeric(20,4),
  baseline_value numeric(20,4),
  target_date date,
  owner_id uuid NOT NULL,
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,objective_id,code),
  FOREIGN KEY (tenant_id,objective_id) REFERENCES m01_strategy.objective(tenant_id,id),
  FOREIGN KEY (tenant_id,owner_id) REFERENCES platform.tenant_member(tenant_id,principal_id)
);
CREATE TABLE m01_strategy.measure_observation (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  measure_id uuid NOT NULL,
  observed_on date NOT NULL,
  value numeric(20,4) NOT NULL,
  source_system_id uuid,
  note text,
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,measure_id,observed_on),
  FOREIGN KEY (tenant_id,measure_id) REFERENCES m01_strategy.measure(tenant_id,id),
  FOREIGN KEY (tenant_id,source_system_id) REFERENCES platform.source_system(tenant_id,source_system_id)
);

-- M02 owns requests and evaluations; approval and investment are owned downstream.
CREATE TABLE m02_intake.demand (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  title text NOT NULL,
  description text,
  sponsor_id uuid NOT NULL,
  submitted_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','triage','assessed','accepted','rejected','withdrawn')),
  requested_start date,
  requested_end date,
  submitted_at timestamptz,
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,code),
  FOREIGN KEY (tenant_id,sponsor_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
  FOREIGN KEY (tenant_id,submitted_by) REFERENCES platform.tenant_member(tenant_id,principal_id),
  CHECK (requested_end IS NULL OR requested_start IS NULL OR requested_end >= requested_start),
  CHECK (status = 'draft' OR submitted_at IS NOT NULL)
);
CREATE TABLE m02_intake.demand_objective (
  tenant_id uuid NOT NULL,
  demand_id uuid NOT NULL,
  objective_id uuid NOT NULL,
  rationale text,
  PRIMARY KEY (tenant_id,demand_id,objective_id),
  FOREIGN KEY (tenant_id,demand_id) REFERENCES m02_intake.demand(tenant_id,id),
  FOREIGN KEY (tenant_id,objective_id) REFERENCES m01_strategy.objective(tenant_id,id)
);
CREATE TABLE m02_intake.assessment (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  demand_id uuid NOT NULL,
  assessor_id uuid NOT NULL,
  method_code text NOT NULL,
  score numeric(10,4),
  recommendation text NOT NULL CHECK (recommendation IN ('investigate','accept','defer','reject')),
  rationale text NOT NULL,
  assessed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,demand_id) REFERENCES m02_intake.demand(tenant_id,id),
  FOREIGN KEY (tenant_id,assessor_id) REFERENCES platform.tenant_member(tenant_id,principal_id)
);
CREATE INDEX assessment_demand_idx ON m02_intake.assessment(tenant_id,demand_id,assessed_at DESC);

-- M03 owns portfolio structure, investment identity, and strategic alignment.
CREATE TABLE m03_portfolio.portfolio (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_portfolio_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  owner_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,code),
  FOREIGN KEY (tenant_id,parent_portfolio_id) REFERENCES m03_portfolio.portfolio(tenant_id,id),
  FOREIGN KEY (tenant_id,owner_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
  CHECK (parent_portfolio_id IS DISTINCT FROM id)
);
CREATE TABLE m03_portfolio.initiative (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  origin_demand_id uuid,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  sponsor_id uuid NOT NULL,
  accountable_owner_id uuid NOT NULL,
  lifecycle text NOT NULL DEFAULT 'candidate' CHECK (lifecycle IN ('candidate','approved','active','paused','closed','cancelled')),
  planned_dates daterange,
  execution_mode text NOT NULL DEFAULT 'external' CHECK (execution_mode IN ('native','external','mixed')),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,code),
  UNIQUE (tenant_id,origin_demand_id),
  FOREIGN KEY (tenant_id,origin_demand_id) REFERENCES m02_intake.demand(tenant_id,id),
  FOREIGN KEY (tenant_id,sponsor_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
  FOREIGN KEY (tenant_id,accountable_owner_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
  CHECK (planned_dates IS NULL OR NOT isempty(planned_dates))
);
CREATE TABLE m03_portfolio.portfolio_membership (
  tenant_id uuid NOT NULL,
  portfolio_id uuid NOT NULL,
  initiative_id uuid NOT NULL,
  membership_during daterange NOT NULL,
  allocation_weight numeric(7,4) NOT NULL DEFAULT 1 CHECK (allocation_weight > 0 AND allocation_weight <= 1),
  PRIMARY KEY (tenant_id,portfolio_id,initiative_id,membership_during),
  FOREIGN KEY (tenant_id,portfolio_id) REFERENCES m03_portfolio.portfolio(tenant_id,id),
  FOREIGN KEY (tenant_id,initiative_id) REFERENCES m03_portfolio.initiative(tenant_id,id),
  CHECK (NOT isempty(membership_during)),
  EXCLUDE USING gist (tenant_id WITH =,portfolio_id WITH =,initiative_id WITH =,membership_during WITH &&)
);
CREATE INDEX portfolio_membership_initiative_idx ON m03_portfolio.portfolio_membership(tenant_id,initiative_id);
CREATE TABLE m03_portfolio.initiative_objective (
  tenant_id uuid NOT NULL,
  initiative_id uuid NOT NULL,
  objective_id uuid NOT NULL,
  contribution text NOT NULL,
  PRIMARY KEY (tenant_id,initiative_id,objective_id),
  FOREIGN KEY (tenant_id,initiative_id) REFERENCES m03_portfolio.initiative(tenant_id,id),
  FOREIGN KEY (tenant_id,objective_id) REFERENCES m01_strategy.objective(tenant_id,id)
);
CREATE TABLE m03_portfolio.initiative_dependency (
  tenant_id uuid NOT NULL,
  predecessor_id uuid NOT NULL,
  successor_id uuid NOT NULL,
  dependency_type text NOT NULL CHECK (dependency_type IN ('finish_start','start_start','other')),
  rationale text,
  PRIMARY KEY (tenant_id,predecessor_id,successor_id),
  FOREIGN KEY (tenant_id,predecessor_id) REFERENCES m03_portfolio.initiative(tenant_id,id),
  FOREIGN KEY (tenant_id,successor_id) REFERENCES m03_portfolio.initiative(tenant_id,id),
  CHECK (predecessor_id <> successor_id)
);
CREATE INDEX initiative_dependency_successor_idx ON m03_portfolio.initiative_dependency(tenant_id,successor_id);

-- Attach common history, audit and outbox capture to versioned roots.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('m01_strategy','strategy'),('m01_strategy','objective'),('m01_strategy','measure'),
    ('m01_strategy','measure_observation'),('m02_intake','demand'),('m02_intake','assessment'),
    ('m03_portfolio','portfolio'),('m03_portfolio','initiative')
  ) AS v(schema_name,table_name) LOOP
    EXECUTE format('CREATE TRIGGER stamp_version BEFORE INSERT OR UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION platform.stamp_version()',r.schema_name,r.table_name);
    EXECUTE format('CREATE TRIGGER capture_change AFTER INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION platform.capture_change()',r.schema_name,r.table_name);
  END LOOP;
END $$;

