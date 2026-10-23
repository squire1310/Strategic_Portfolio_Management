CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE SCHEMA platform;
CREATE SCHEMA m01_strategy;
CREATE SCHEMA m02_intake;
CREATE SCHEMA m03_portfolio;
CREATE SCHEMA m04_finance;
CREATE SCHEMA m05_capacity;
CREATE SCHEMA m06_governance;

CREATE TABLE platform.tenant (
  tenant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code text NOT NULL UNIQUE CHECK (tenant_code ~ '^[a-z][a-z0-9_]{2,62}$'),
  name text NOT NULL CHECK (btrim(name) <> ''),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE TABLE platform.principal (
  principal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL UNIQUE,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE TABLE platform.tenant_member (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id),
  principal_id uuid NOT NULL REFERENCES platform.principal(principal_id),
  member_role text NOT NULL CHECK (member_role IN ('viewer','contributor','approver','administrator','integration')),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id, principal_id)
);
CREATE INDEX tenant_member_principal_idx ON platform.tenant_member(principal_id, tenant_id) WHERE active;

CREATE FUNCTION platform.current_tenant() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '')::uuid
$$;
CREATE FUNCTION platform.current_actor() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.actor_id', true), '')::uuid
$$;
CREATE FUNCTION platform.application_context() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, platform AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform.tenant_member m
    JOIN platform.tenant t ON t.tenant_id = m.tenant_id
    WHERE m.tenant_id = platform.current_tenant()
      AND m.principal_id = platform.current_actor()
      AND m.active AND t.status = 'active'
  )
$$;

CREATE TABLE platform.code_set (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id),
  code_set text NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id, code_set, code),
  CHECK (code_set ~ '^[a-z][a-z0-9_]*$'),
  CHECK (code ~ '^[a-z][a-z0-9_]*$')
);

CREATE TABLE platform.source_system (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id),
  source_system_id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  authority text NOT NULL CHECK (authority IN ('reference','execution','financial','workforce')),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id, source_system_id),
  UNIQUE (tenant_id, code)
);
CREATE TABLE platform.source_identity (
  tenant_id uuid NOT NULL,
  source_identity_id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_system_id uuid NOT NULL,
  object_type text NOT NULL,
  external_key text NOT NULL,
  canonical_module text NOT NULL CHECK (canonical_module IN ('m01','m02','m03','m04','m05','m06')),
  canonical_id uuid NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (tenant_id, source_identity_id),
  UNIQUE (tenant_id, source_system_id, object_type, external_key),
  FOREIGN KEY (tenant_id, source_system_id) REFERENCES platform.source_system(tenant_id, source_system_id)
);
CREATE INDEX source_identity_canonical_idx ON platform.source_identity(tenant_id, canonical_module, canonical_id);

CREATE TABLE platform.audit_event (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id),
  audit_id bigint GENERATED ALWAYS AS IDENTITY,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_id uuid,
  schema_name text NOT NULL,
  table_name text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  entity_id uuid NOT NULL,
  old_row jsonb,
  new_row jsonb,
  request_id text,
  PRIMARY KEY (tenant_id, audit_id)
);
CREATE INDEX audit_entity_idx ON platform.audit_event(tenant_id, schema_name, table_name, entity_id, occurred_at DESC);

CREATE TABLE platform.entity_revision (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id),
  schema_name text NOT NULL,
  table_name text NOT NULL,
  entity_id uuid NOT NULL,
  version_no integer NOT NULL CHECK (version_no > 0),
  recorded_during tstzrange NOT NULL,
  valid_during tstzrange NOT NULL,
  payload jsonb NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  actor_id uuid,
  PRIMARY KEY (tenant_id, schema_name, table_name, entity_id, version_no),
  CHECK (NOT isempty(recorded_during) AND NOT isempty(valid_during)),
  EXCLUDE USING gist (tenant_id WITH =, schema_name WITH =, table_name WITH =,
                      entity_id WITH =, recorded_during WITH &&)
);
CREATE INDEX entity_revision_valid_idx ON platform.entity_revision USING gist(tenant_id, valid_during);

CREATE TABLE platform.outbox_event (
  tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id),
  event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  aggregate_module text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version integer NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  published_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  PRIMARY KEY (tenant_id, event_id),
  UNIQUE (tenant_id, aggregate_module, aggregate_type, aggregate_id, aggregate_version, event_type)
);
CREATE INDEX outbox_pending_idx ON platform.outbox_event(occurred_at, tenant_id) WHERE published_at IS NULL;
CREATE TABLE platform.inbox_message (
  tenant_id uuid NOT NULL,
  source_system_id uuid NOT NULL,
  message_key text NOT NULL,
  payload_hash text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','rejected')),
  error_text text,
  PRIMARY KEY (tenant_id, source_system_id, message_key),
  FOREIGN KEY (tenant_id, source_system_id) REFERENCES platform.source_system(tenant_id, source_system_id)
);
CREATE INDEX inbox_unprocessed_idx ON platform.inbox_message(tenant_id, received_at) WHERE status = 'received';

CREATE FUNCTION platform.stamp_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.row_version := 1;
    NEW.created_at := transaction_timestamp();
  ELSE
    IF NEW.tenant_id <> OLD.tenant_id OR NEW.id <> OLD.id THEN
      RAISE EXCEPTION 'tenant_id and id are immutable';
    END IF;
    NEW.row_version := OLD.row_version + 1;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := transaction_timestamp();
  IF isempty(NEW.valid_during) OR lower(NEW.valid_during) IS NULL THEN
    RAISE EXCEPTION 'valid_during requires a nonempty lower bound';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION platform.capture_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, platform AS $$
DECLARE
  r record;
  prior_version integer;
  current_version integer;
  change_time timestamptz := clock_timestamp();
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  current_version := CASE WHEN TG_OP = 'DELETE' THEN OLD.row_version + 1 ELSE NEW.row_version END;
  IF TG_OP <> 'INSERT' THEN
    UPDATE platform.entity_revision
       SET recorded_during = tstzrange(lower(recorded_during), change_time, '[)')
     WHERE tenant_id = r.tenant_id AND schema_name = TG_TABLE_SCHEMA
       AND table_name = TG_TABLE_NAME AND entity_id = r.id
       AND upper_inf(recorded_during);
  END IF;
  INSERT INTO platform.entity_revision
    (tenant_id, schema_name, table_name, entity_id, version_no, recorded_during,
     valid_during, payload, operation, actor_id)
  VALUES (r.tenant_id, TG_TABLE_SCHEMA, TG_TABLE_NAME, r.id, current_version,
          tstzrange(change_time, NULL, '[)'), r.valid_during,
          CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END,
          TG_OP, platform.current_actor());
  INSERT INTO platform.audit_event
    (tenant_id, actor_id, schema_name, table_name, operation, entity_id, old_row, new_row, request_id)
  VALUES (r.tenant_id, platform.current_actor(), TG_TABLE_SCHEMA, TG_TABLE_NAME,
          TG_OP, r.id,
          CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
          current_setting('app.request_id', true));
  INSERT INTO platform.outbox_event
    (tenant_id, aggregate_module, aggregate_type, aggregate_id, aggregate_version, event_type, payload)
  VALUES (r.tenant_id, left(TG_TABLE_SCHEMA, 3), TG_TABLE_NAME, r.id,
          current_version, lower(TG_OP),
          jsonb_build_object('id', r.id, 'version', current_version, 'operation', TG_OP));
  RETURN NULL;
END $$;

CREATE FUNCTION platform.guard_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON platform.audit_event
  FOR EACH ROW EXECUTE FUNCTION platform.guard_immutable();

CREATE FUNCTION platform.capture_record() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, platform AS $$
DECLARE r record; object_id uuid; next_version integer;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  object_id := (to_jsonb(r)->>TG_ARGV[0])::uuid;
  INSERT INTO platform.audit_event
    (tenant_id,actor_id,schema_name,table_name,operation,entity_id,old_row,new_row,request_id)
  VALUES (r.tenant_id,platform.current_actor(),TG_TABLE_SCHEMA,TG_TABLE_NAME,TG_OP,object_id,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
    current_setting('app.request_id',true));
  SELECT coalesce(max(aggregate_version),0)+1 INTO next_version FROM platform.outbox_event
    WHERE tenant_id=r.tenant_id AND aggregate_module=left(TG_TABLE_SCHEMA,3)
      AND aggregate_type=TG_TABLE_NAME AND aggregate_id=object_id;
  INSERT INTO platform.outbox_event
    (tenant_id,aggregate_module,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
  VALUES (r.tenant_id,left(TG_TABLE_SCHEMA,3),TG_TABLE_NAME,object_id,next_version,
    lower(TG_OP),jsonb_build_object('id',object_id,'operation',TG_OP,'version',next_version));
  RETURN NULL;
END $$;
CREATE TRIGGER source_identity_capture AFTER INSERT OR UPDATE OR DELETE ON platform.source_identity
  FOR EACH ROW EXECUTE FUNCTION platform.capture_record('source_identity_id');

