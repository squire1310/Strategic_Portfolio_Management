-- Canonical model v0.4 draft: M05-M06 and deferred M02 membership.

CREATE TABLE m06_governance.decision_body (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id), id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL, name text NOT NULL, remit text NOT NULL, chair_id uuid NOT NULL,
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,code),
  FOREIGN KEY (tenant_id,chair_id) REFERENCES platform.tenant_member(tenant_id,principal_id)
);
CREATE TABLE m06_governance.gate (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id), id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL, name text NOT NULL, lifecycle_stage text NOT NULL,
  decision_body_id uuid NOT NULL, active boolean NOT NULL DEFAULT true,
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,code),
  FOREIGN KEY (tenant_id,decision_body_id) REFERENCES m06_governance.decision_body(tenant_id,id)
);
CREATE TABLE m06_governance.delegation (
  tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), decision_body_id uuid NOT NULL,
  delegate_id uuid NOT NULL, scope_code text NOT NULL,
  amount_limit numeric(20,2), currency_code varchar(3),
  effective_during tstzrange NOT NULL CHECK (NOT isempty(effective_during)),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,decision_body_id) REFERENCES m06_governance.decision_body(tenant_id,id),
  FOREIGN KEY (tenant_id,delegate_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
  CHECK (amount_limit IS NULL OR amount_limit >= 0),
  CHECK ((amount_limit IS NULL) = (currency_code IS NULL)),
  CHECK (currency_code IS NULL OR currency_code ~ '^[A-Z]{3}$')
);
CREATE INDEX delegation_lookup_idx ON m06_governance.delegation(tenant_id,decision_body_id,delegate_id);

CREATE TABLE m05_investment.investment (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id), id uuid NOT NULL DEFAULT gen_random_uuid(),
  origin_demand_id uuid, category_id uuid NOT NULL, code text NOT NULL, title text NOT NULL,
  sponsor_id uuid NOT NULL, owner_id uuid NOT NULL,
  execution_mode text NOT NULL DEFAULT 'external' CHECK (execution_mode IN ('native','external','mixed')),
  lifecycle text NOT NULL DEFAULT 'candidate'
    CHECK (lifecycle IN ('candidate','approved','active','paused','closed','cancelled')),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,code), UNIQUE (tenant_id,origin_demand_id),
  FOREIGN KEY (tenant_id,origin_demand_id) REFERENCES m03_demand.demand(tenant_id,id),
  FOREIGN KEY (tenant_id,category_id) REFERENCES m02_portfolio.investment_category(tenant_id,id),
  FOREIGN KEY (tenant_id,sponsor_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
  FOREIGN KEY (tenant_id,owner_id) REFERENCES platform.tenant_member(tenant_id,principal_id)
);
CREATE TABLE m02_portfolio.portfolio_membership (
  tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL, investment_id uuid NOT NULL,
  membership_during daterange NOT NULL CHECK (NOT isempty(membership_during)),
  allocation_weight numeric(7,6) NOT NULL DEFAULT 1 CHECK (allocation_weight > 0 AND allocation_weight <= 1),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,portfolio_id) REFERENCES m02_portfolio.portfolio(tenant_id,id),
  FOREIGN KEY (tenant_id,investment_id) REFERENCES m05_investment.investment(tenant_id,id),
  EXCLUDE USING gist (tenant_id WITH =,portfolio_id WITH =,investment_id WITH =,
                      membership_during WITH &&)
);
CREATE INDEX membership_investment_idx ON m02_portfolio.portfolio_membership(tenant_id,investment_id);

CREATE TABLE m05_investment.investment_decision (
  tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(),
  decision_body_id uuid NOT NULL, decided_by uuid NOT NULL,
  investment_id uuid, recommendation_id uuid,
  subject_type text NOT NULL CHECK (subject_type IN ('investment','baseline')),
  subject_id uuid NOT NULL,
  decision_type text NOT NULL CHECK (decision_type IN ('approve','reject','defer','condition','revoke')),
  rationale text NOT NULL, conditions text,
  decided_at timestamptz NOT NULL, effective_on date NOT NULL,
  supersedes_decision_id uuid,
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,id,investment_id),
  FOREIGN KEY (tenant_id,decision_body_id) REFERENCES m06_governance.decision_body(tenant_id,id),
  FOREIGN KEY (tenant_id,decided_by) REFERENCES platform.tenant_member(tenant_id,principal_id),
  FOREIGN KEY (tenant_id,investment_id) REFERENCES m05_investment.investment(tenant_id,id),
  FOREIGN KEY (tenant_id,recommendation_id) REFERENCES m04_selection.selection_recommendation(tenant_id,id),
  FOREIGN KEY (tenant_id,supersedes_decision_id) REFERENCES m05_investment.investment_decision(tenant_id,id),
  CHECK ((subject_type='investment' AND investment_id IS NOT NULL AND subject_id=investment_id)
      OR (subject_type='baseline' AND investment_id IS NULL)),
  CHECK (supersedes_decision_id IS DISTINCT FROM id)
);
CREATE INDEX decision_subject_idx ON m05_investment.investment_decision(tenant_id,subject_type,subject_id,decided_at DESC);
CREATE FUNCTION m05_investment.guard_decision() RETURNS trigger LANGUAGE plpgsql AS $$
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
    JOIN m05_investment.investment i ON i.tenant_id=r.tenant_id
      AND i.origin_demand_id=r.demand_id
    WHERE r.tenant_id=NEW.tenant_id AND r.id=NEW.recommendation_id AND i.id=NEW.investment_id
  ) THEN RAISE EXCEPTION 'recommendation does not match investment origin demand'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER investment_decision_guard BEFORE INSERT ON m05_investment.investment_decision
  FOR EACH ROW EXECUTE FUNCTION m05_investment.guard_decision();
CREATE TRIGGER investment_decision_immutable BEFORE UPDATE OR DELETE ON m05_investment.investment_decision
  FOR EACH ROW EXECUTE FUNCTION platform.guard_immutable();
CREATE TRIGGER investment_decision_capture AFTER INSERT ON m05_investment.investment_decision
  FOR EACH ROW EXECUTE FUNCTION platform.capture_record('id');

CREATE TABLE m05_investment.commitment (
  tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), investment_id uuid NOT NULL,
  approving_decision_id uuid NOT NULL,
  commitment_type text NOT NULL CHECK (commitment_type IN ('funding','capacity','scope','schedule')),
  numeric_limit numeric(20,2), unit text,
  envelope jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(envelope)='object'),
  effective_during daterange NOT NULL CHECK (NOT isempty(effective_during)),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,approving_decision_id,commitment_type),
  UNIQUE (tenant_id,id,investment_id),
  FOREIGN KEY (tenant_id,investment_id) REFERENCES m05_investment.investment(tenant_id,id),
  FOREIGN KEY (tenant_id,approving_decision_id,investment_id)
    REFERENCES m05_investment.investment_decision(tenant_id,id,investment_id),
  CHECK (numeric_limit IS NULL OR numeric_limit >= 0),
  CHECK ((commitment_type IN ('funding','capacity') AND numeric_limit IS NOT NULL AND unit IS NOT NULL)
      OR (commitment_type IN ('scope','schedule') AND numeric_limit IS NULL AND unit IS NULL))
);
CREATE TABLE m05_investment.commitment_amendment (
  tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(),
  commitment_id uuid NOT NULL, investment_id uuid NOT NULL, approving_decision_id uuid NOT NULL,
  amendment_kind text NOT NULL CHECK (amendment_kind IN ('increase','decrease','replace')),
  numeric_change numeric(20,2), replacement_envelope jsonb,
  rationale text NOT NULL, effective_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,approving_decision_id,commitment_id),
  FOREIGN KEY (tenant_id,commitment_id,investment_id)
    REFERENCES m05_investment.commitment(tenant_id,id,investment_id),
  FOREIGN KEY (tenant_id,approving_decision_id,investment_id)
    REFERENCES m05_investment.investment_decision(tenant_id,id,investment_id),
  CHECK (numeric_change IS NOT NULL OR replacement_envelope IS NOT NULL),
  CHECK (replacement_envelope IS NULL OR jsonb_typeof(replacement_envelope)='object')
);
CREATE FUNCTION m05_investment.require_approval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d m05_investment.investment_decision%ROWTYPE;
BEGIN
  SELECT * INTO d FROM m05_investment.investment_decision
    WHERE tenant_id=NEW.tenant_id AND id=NEW.approving_decision_id;
  IF NOT FOUND OR d.decision_type <> 'approve' OR d.subject_type <> 'investment'
    OR d.investment_id <> NEW.investment_id THEN
    RAISE EXCEPTION 'commitment or amendment requires an approving investment decision';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER commitment_approval BEFORE INSERT ON m05_investment.commitment
  FOR EACH ROW EXECUTE FUNCTION m05_investment.require_approval();
CREATE TRIGGER amendment_approval BEFORE INSERT ON m05_investment.commitment_amendment
  FOR EACH ROW EXECUTE FUNCTION m05_investment.require_approval();
CREATE TRIGGER commitment_immutable BEFORE UPDATE OR DELETE ON m05_investment.commitment
  FOR EACH ROW EXECUTE FUNCTION platform.guard_immutable();
CREATE TRIGGER amendment_immutable BEFORE UPDATE OR DELETE ON m05_investment.commitment_amendment
  FOR EACH ROW EXECUTE FUNCTION platform.guard_immutable();
CREATE TRIGGER commitment_capture AFTER INSERT ON m05_investment.commitment
  FOR EACH ROW EXECUTE FUNCTION platform.capture_record('id');
CREATE TRIGGER amendment_capture AFTER INSERT ON m05_investment.commitment_amendment
  FOR EACH ROW EXECUTE FUNCTION platform.capture_record('id');
CREATE FUNCTION m05_investment.require_lifecycle_approval() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lifecycle IN ('approved','active','paused','closed') AND NOT EXISTS (
    SELECT 1 FROM m05_investment.investment_decision d
    WHERE d.tenant_id=NEW.tenant_id AND d.investment_id=NEW.id
      AND d.subject_type='investment' AND d.decision_type='approve'
  ) THEN RAISE EXCEPTION 'investment lifecycle requires an approving decision'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER investment_authority AFTER INSERT OR UPDATE
  ON m05_investment.investment DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION m05_investment.require_lifecycle_approval();

CREATE TABLE m06_governance.assurance_finding (
  tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), investment_id uuid NOT NULL,
  gate_id uuid, severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  finding text NOT NULL, owner_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','mitigating','closed')),
  closure_evidence_uri text,
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,id,investment_id),
  FOREIGN KEY (tenant_id,investment_id) REFERENCES m05_investment.investment(tenant_id,id),
  FOREIGN KEY (tenant_id,gate_id) REFERENCES m06_governance.gate(tenant_id,id),
  FOREIGN KEY (tenant_id,owner_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
  CHECK (status <> 'closed' OR closure_evidence_uri IS NOT NULL)
);
CREATE TABLE m06_governance.governance_exception (
  tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), investment_id uuid NOT NULL,
  finding_id uuid, reason text NOT NULL, owner_id uuid NOT NULL, expires_on date,
  disposition text NOT NULL DEFAULT 'open' CHECK (disposition IN ('open','approved','rejected','closed')),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,investment_id) REFERENCES m05_investment.investment(tenant_id,id),
  FOREIGN KEY (tenant_id,finding_id,investment_id)
    REFERENCES m06_governance.assurance_finding(tenant_id,id,investment_id),
  FOREIGN KEY (tenant_id,owner_id) REFERENCES platform.tenant_member(tenant_id,principal_id)
);
CREATE TABLE m06_governance.governance_action (
  tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(),
  finding_id uuid, exception_id uuid, title text NOT NULL, owner_id uuid NOT NULL,
  due_on date NOT NULL, status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','doing','done','cancelled')),
  valid_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  row_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,finding_id) REFERENCES m06_governance.assurance_finding(tenant_id,id),
  FOREIGN KEY (tenant_id,exception_id) REFERENCES m06_governance.governance_exception(tenant_id,id),
  FOREIGN KEY (tenant_id,owner_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
  CHECK ((finding_id IS NOT NULL) <> (exception_id IS NOT NULL))
);

CREATE TABLE m06_governance.baseline (
  tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), portfolio_id uuid NOT NULL,
  baseline_type text NOT NULL CHECK (baseline_type IN ('portfolio','investment','strategy')),
  label text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','superseded')),
  approved_decision_id uuid, approved_at timestamptz, created_by uuid NOT NULL,
  valid_during tstzrange NOT NULL, recorded_during tstzrange NOT NULL DEFAULT tstzrange(transaction_timestamp(),NULL,'[)'),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,portfolio_id) REFERENCES m02_portfolio.portfolio(tenant_id,id),
  FOREIGN KEY (tenant_id,approved_decision_id) REFERENCES m05_investment.investment_decision(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES platform.tenant_member(tenant_id,principal_id),
  CHECK (NOT isempty(valid_during) AND NOT isempty(recorded_during)),
  CHECK ((status IN ('approved','superseded')) = (approved_decision_id IS NOT NULL AND approved_at IS NOT NULL)),
  EXCLUDE USING gist (tenant_id WITH =,portfolio_id WITH =,baseline_type WITH =,
                      valid_during WITH &&,recorded_during WITH &&)
    WHERE (status IN ('approved','superseded'))
);
CREATE UNIQUE INDEX baseline_approval_unique ON m06_governance.baseline(tenant_id,approved_decision_id)
  WHERE approved_decision_id IS NOT NULL;
CREATE INDEX baseline_portfolio_idx ON m06_governance.baseline(tenant_id,portfolio_id,baseline_type,status);
CREATE TABLE m06_governance.baseline_item (
  tenant_id uuid NOT NULL, baseline_id uuid NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('strategy','objective','outcome','portfolio','investment','decision','commitment')),
  item_id uuid NOT NULL, item_version integer NOT NULL CHECK (item_version > 0),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
  PRIMARY KEY (tenant_id,baseline_id,item_type,item_id),
  FOREIGN KEY (tenant_id,baseline_id) REFERENCES m06_governance.baseline(tenant_id,id)
);

CREATE FUNCTION m06_governance.guard_baseline() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, m06_governance AS $$
DECLARE d m05_investment.investment_decision%ROWTYPE; approval_time timestamptz;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'baseline is immutable; approve a successor'; END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.status IN ('approved','superseded') THEN
      IF pg_trigger_depth() <= 1 OR OLD.status <> 'approved' OR NEW.status <> 'superseded'
         OR NEW.recorded_during IS NOT DISTINCT FROM OLD.recorded_during
         OR (to_jsonb(NEW)-'status'-'recorded_during') IS DISTINCT FROM
            (to_jsonb(OLD)-'status'-'recorded_during') THEN
        RAISE EXCEPTION 'approved baseline is immutable';
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.tenant_id<>OLD.tenant_id OR NEW.id<>OLD.id OR NEW.portfolio_id<>OLD.portfolio_id THEN
      RAISE EXCEPTION 'baseline identity and portfolio are immutable';
    END IF;
  END IF;
  IF NEW.status='approved' THEN
    SELECT * INTO d FROM m05_investment.investment_decision
      WHERE tenant_id=NEW.tenant_id AND id=NEW.approved_decision_id;
    IF NOT FOUND OR d.decision_type<>'approve' OR d.subject_type<>'baseline'
       OR d.subject_id<>NEW.id OR NEW.approved_at<d.decided_at THEN
      RAISE EXCEPTION 'baseline requires its own approving investment decision';
    END IF;
    approval_time := clock_timestamp();
    NEW.recorded_during := tstzrange(approval_time,NULL,'[)');
    UPDATE m06_governance.baseline b
      SET status='superseded', recorded_during=tstzrange(lower(b.recorded_during),approval_time,'[)')
      WHERE b.tenant_id=NEW.tenant_id AND b.portfolio_id=NEW.portfolio_id
        AND b.baseline_type=NEW.baseline_type AND b.status='approved'
        AND b.valid_during && NEW.valid_during AND b.id<>NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER baseline_guard BEFORE INSERT OR UPDATE OR DELETE ON m06_governance.baseline
  FOR EACH ROW EXECUTE FUNCTION m06_governance.guard_baseline();
CREATE FUNCTION m06_governance.guard_baseline_item() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_status text;
BEGIN
  IF TG_OP='DELETE' THEN
    SELECT status INTO parent_status FROM m06_governance.baseline WHERE tenant_id=OLD.tenant_id AND id=OLD.baseline_id;
  ELSE
    SELECT status INTO parent_status FROM m06_governance.baseline WHERE tenant_id=NEW.tenant_id AND id=NEW.baseline_id;
  END IF;
  IF parent_status IN ('approved','superseded') THEN RAISE EXCEPTION 'approved baseline items are immutable'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER baseline_item_guard BEFORE INSERT OR UPDATE OR DELETE ON m06_governance.baseline_item
  FOR EACH ROW EXECUTE FUNCTION m06_governance.guard_baseline_item();
CREATE TRIGGER baseline_capture AFTER INSERT OR UPDATE ON m06_governance.baseline
  FOR EACH ROW EXECUTE FUNCTION platform.capture_record('id');

DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('m02_portfolio','portfolio_membership'),('m05_investment','investment'),
    ('m06_governance','decision_body'),('m06_governance','gate'),('m06_governance','delegation'),
    ('m06_governance','assurance_finding'),('m06_governance','governance_exception'),
    ('m06_governance','governance_action')
  ) AS v(schema_name,table_name) LOOP
    EXECUTE format('CREATE TRIGGER stamp_version BEFORE INSERT OR UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION platform.stamp_version()',r.schema_name,r.table_name);
    EXECUTE format('CREATE TRIGGER capture_change AFTER INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION platform.capture_change()',r.schema_name,r.table_name);
  END LOOP;
END $$;

