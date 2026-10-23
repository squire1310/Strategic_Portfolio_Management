-- M04: financial planning and actuals; actuals can be sourced from ERP.
CREATE TABLE m04_finance.funding_source (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  currency_code varchar(3) NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  owner_id uuid NOT NULL,
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,code),
  FOREIGN KEY (tenant_id,owner_id) REFERENCES platform.tenant_member(tenant_id,principal_id)
);
CREATE TABLE m04_finance.financial_plan (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  initiative_id uuid NOT NULL,
  funding_source_id uuid NOT NULL,
  scenario text NOT NULL DEFAULT 'working',
  currency_code varchar(3) NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','proposed','approved','superseded')),
  owner_id uuid NOT NULL,
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,initiative_id) REFERENCES m03_portfolio.initiative(tenant_id,id),
  FOREIGN KEY (tenant_id,funding_source_id) REFERENCES m04_finance.funding_source(tenant_id,id),
  FOREIGN KEY (tenant_id,owner_id) REFERENCES platform.tenant_member(tenant_id,principal_id)
);
CREATE INDEX financial_plan_initiative_idx ON m04_finance.financial_plan(tenant_id,initiative_id,status);
CREATE TABLE m04_finance.plan_line (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  financial_plan_id uuid NOT NULL,
  period_start date NOT NULL,
  cost_type text NOT NULL CHECK (cost_type IN ('capex','opex','benefit')),
  amount numeric(20,2) NOT NULL CHECK (amount >= 0),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,financial_plan_id,period_start,cost_type),
  FOREIGN KEY (tenant_id,financial_plan_id) REFERENCES m04_finance.financial_plan(tenant_id,id),
  CHECK (EXTRACT(DAY FROM period_start) = 1)
);
CREATE TABLE m04_finance.actual (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  initiative_id uuid NOT NULL,
  source_system_id uuid NOT NULL,
  external_transaction_key text NOT NULL,
  accounting_date date NOT NULL,
  cost_type text NOT NULL CHECK (cost_type IN ('capex','opex','benefit')),
  amount numeric(20,2) NOT NULL,
  currency_code varchar(3) NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,source_system_id,external_transaction_key),
  FOREIGN KEY (tenant_id,initiative_id) REFERENCES m03_portfolio.initiative(tenant_id,id),
  FOREIGN KEY (tenant_id,source_system_id) REFERENCES platform.source_system(tenant_id,source_system_id)
);
CREATE INDEX actual_initiative_date_idx ON m04_finance.actual(tenant_id,initiative_id,accounting_date);

-- M05: capacity supply and demand; individual HR records are outside this boundary.
CREATE TABLE m05_capacity.resource_pool (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'fte' CHECK (unit IN ('fte','hours')),
  owner_id uuid NOT NULL,
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,code),
  FOREIGN KEY (tenant_id,owner_id) REFERENCES platform.tenant_member(tenant_id,principal_id)
);
CREATE TABLE m05_capacity.capacity_period (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  resource_pool_id uuid NOT NULL,
  period_start date NOT NULL,
  available_quantity numeric(16,4) NOT NULL CHECK (available_quantity >= 0),
  source_system_id uuid,
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,resource_pool_id,period_start),
  FOREIGN KEY (tenant_id,resource_pool_id) REFERENCES m05_capacity.resource_pool(tenant_id,id),
  FOREIGN KEY (tenant_id,source_system_id) REFERENCES platform.source_system(tenant_id,source_system_id),
  CHECK (EXTRACT(DAY FROM period_start) = 1)
);
CREATE TABLE m05_capacity.allocation (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  initiative_id uuid NOT NULL,
  resource_pool_id uuid NOT NULL,
  period_start date NOT NULL,
  requested_quantity numeric(16,4) NOT NULL CHECK (requested_quantity >= 0),
  committed_quantity numeric(16,4) NOT NULL DEFAULT 0 CHECK (committed_quantity >= 0),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','committed','cancelled')),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,initiative_id,resource_pool_id,period_start),
  FOREIGN KEY (tenant_id,initiative_id) REFERENCES m03_portfolio.initiative(tenant_id,id),
  FOREIGN KEY (tenant_id,resource_pool_id) REFERENCES m05_capacity.resource_pool(tenant_id,id),
  CHECK (EXTRACT(DAY FROM period_start) = 1),
  CHECK (committed_quantity <= requested_quantity)
);
CREATE INDEX allocation_pool_period_idx ON m05_capacity.allocation(tenant_id,resource_pool_id,period_start);

-- M06: decision authority, immutable decision record, and approved bitemporal baselines.
CREATE TABLE m06_governance.decision_body (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  chair_id uuid NOT NULL,
  remit text NOT NULL,
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,code),
  FOREIGN KEY (tenant_id,chair_id) REFERENCES platform.tenant_member(tenant_id,principal_id)
);
CREATE TABLE m06_governance.decision (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  decision_body_id uuid NOT NULL,
  subject_type text NOT NULL CHECK (subject_type IN ('demand','initiative','portfolio','financial_plan','baseline')),
  subject_id uuid NOT NULL,
  decision_type text NOT NULL CHECK (decision_type IN ('approve','reject','defer','condition','revoke')),
  rationale text NOT NULL,
  conditions text,
  decided_at timestamptz NOT NULL,
  effective_on date NOT NULL,
  recorded_by uuid NOT NULL,
  supersedes_decision_id uuid,
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,decision_body_id) REFERENCES m06_governance.decision_body(tenant_id,id),
  FOREIGN KEY (tenant_id,recorded_by) REFERENCES platform.tenant_member(tenant_id,principal_id),
  FOREIGN KEY (tenant_id,supersedes_decision_id) REFERENCES m06_governance.decision(tenant_id,id),
  CHECK (supersedes_decision_id IS DISTINCT FROM id)
);
CREATE INDEX decision_subject_idx ON m06_governance.decision(tenant_id,subject_type,subject_id,decided_at DESC);

CREATE TABLE m06_governance.baseline (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL,
  baseline_type text NOT NULL CHECK (baseline_type IN ('portfolio','financial','capacity','strategy')),
  label text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','superseded')),
  approved_decision_id uuid,
  approved_at timestamptz,
  created_by uuid NOT NULL,
  valid_during tstzrange NOT NULL,
  recorded_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,portfolio_id) REFERENCES m03_portfolio.portfolio(tenant_id,id),
  FOREIGN KEY (tenant_id,approved_decision_id) REFERENCES m06_governance.decision(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES platform.tenant_member(tenant_id,principal_id),
  CHECK (NOT isempty(valid_during) AND NOT isempty(recorded_during)),
  CHECK ((status IN ('approved','superseded')) = (approved_decision_id IS NOT NULL AND approved_at IS NOT NULL)),
  EXCLUDE USING gist (tenant_id WITH =, portfolio_id WITH =, baseline_type WITH =,
                      valid_during WITH &&, recorded_during WITH &&)
    WHERE (status IN ('approved','superseded'))
);
CREATE UNIQUE INDEX baseline_one_approval_per_decision ON m06_governance.baseline(tenant_id,approved_decision_id)
  WHERE approved_decision_id IS NOT NULL;
CREATE INDEX baseline_portfolio_idx ON m06_governance.baseline(tenant_id,portfolio_id,baseline_type,status);
CREATE TABLE m06_governance.baseline_item (
  tenant_id uuid NOT NULL,
  baseline_id uuid NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('initiative','objective','financial_plan','plan_line','allocation')),
  item_id uuid NOT NULL,
  item_version integer NOT NULL CHECK (item_version > 0),
  snapshot jsonb NOT NULL,
  PRIMARY KEY (tenant_id,baseline_id,item_type,item_id),
  FOREIGN KEY (tenant_id,baseline_id) REFERENCES m06_governance.baseline(tenant_id,id)
);
CREATE INDEX baseline_item_lookup_idx ON m06_governance.baseline_item(tenant_id,item_type,item_id);

CREATE FUNCTION m06_governance.guard_baseline() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, m06_governance AS $$
DECLARE d m06_governance.decision%ROWTYPE;
        approval_time timestamptz;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'baseline is immutable; supersede it'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'approved' OR OLD.status = 'superseded' THEN
      IF pg_trigger_depth() <= 1 OR OLD.status <> 'approved' OR NEW.status <> 'superseded'
        OR NEW.recorded_during IS NOT DISTINCT FROM OLD.recorded_during
        OR (to_jsonb(NEW) - 'status' - 'recorded_during') IS DISTINCT FROM
           (to_jsonb(OLD) - 'status' - 'recorded_during') THEN
        RAISE EXCEPTION 'approved baseline is immutable; create a successor';
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.tenant_id <> OLD.tenant_id OR NEW.id <> OLD.id OR NEW.portfolio_id <> OLD.portfolio_id THEN
      RAISE EXCEPTION 'baseline identity and portfolio are immutable';
    END IF;
  END IF;
  IF NEW.status = 'approved' THEN
    SELECT * INTO d FROM m06_governance.decision
      WHERE tenant_id = NEW.tenant_id AND id = NEW.approved_decision_id;
    IF NOT FOUND OR d.decision_type <> 'approve' OR d.subject_type <> 'baseline'
      OR d.subject_id <> NEW.id OR NEW.approved_at < d.decided_at THEN
      RAISE EXCEPTION 'baseline approval requires its own approving decision';
    END IF;
    IF TG_OP = 'INSERT' THEN
      approval_time := clock_timestamp();
    ELSIF OLD.status <> 'approved' THEN
      approval_time := clock_timestamp();
    END IF;
    IF approval_time IS NOT NULL THEN
      NEW.recorded_during := tstzrange(approval_time,NULL,'[)');
      UPDATE m06_governance.baseline b
        SET status = 'superseded',
            recorded_during = tstzrange(lower(b.recorded_during),approval_time,'[)')
        WHERE b.tenant_id = NEW.tenant_id AND b.portfolio_id = NEW.portfolio_id
          AND b.baseline_type = NEW.baseline_type AND b.status = 'approved'
          AND b.valid_during && NEW.valid_during AND b.id <> NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER baseline_guard BEFORE INSERT OR UPDATE OR DELETE ON m06_governance.baseline
  FOR EACH ROW EXECUTE FUNCTION m06_governance.guard_baseline();
CREATE FUNCTION m06_governance.guard_baseline_item() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT status INTO current_status FROM m06_governance.baseline WHERE tenant_id=OLD.tenant_id AND id=OLD.baseline_id;
  ELSE
    SELECT status INTO current_status FROM m06_governance.baseline WHERE tenant_id=NEW.tenant_id AND id=NEW.baseline_id;
  END IF;
  IF current_status IN ('approved','superseded') THEN RAISE EXCEPTION 'approved baseline items are immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER baseline_item_guard BEFORE INSERT OR UPDATE OR DELETE ON m06_governance.baseline_item
  FOR EACH ROW EXECUTE FUNCTION m06_governance.guard_baseline_item();
CREATE TRIGGER decision_immutable BEFORE UPDATE OR DELETE ON m06_governance.decision
  FOR EACH ROW EXECUTE FUNCTION platform.guard_immutable();
CREATE TRIGGER decision_capture AFTER INSERT ON m06_governance.decision
  FOR EACH ROW EXECUTE FUNCTION platform.capture_record('id');
CREATE TRIGGER baseline_capture AFTER INSERT OR UPDATE ON m06_governance.baseline
  FOR EACH ROW EXECUTE FUNCTION platform.capture_record('id');

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('m04_finance','funding_source'),('m04_finance','financial_plan'),('m04_finance','plan_line'),
    ('m04_finance','actual'),('m05_capacity','resource_pool'),('m05_capacity','capacity_period'),
    ('m05_capacity','allocation'),('m06_governance','decision_body')
  ) AS v(schema_name,table_name) LOOP
    EXECUTE format('CREATE TRIGGER stamp_version BEFORE INSERT OR UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION platform.stamp_version()',r.schema_name,r.table_name);
    EXECUTE format('CREATE TRIGGER capture_change AFTER INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION platform.capture_change()',r.schema_name,r.table_name);
  END LOOP;
END $$;

