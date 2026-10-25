-- Access fulfilment ledger: records ServiceNow/IAM correlation without creating a self-service access portal.
-- Provisioning execution remains external and MUST use an independently authenticated IAM service.
CREATE TABLE platform.access_fulfilment_event (
 tenant_id uuid NOT NULL REFERENCES platform.tenant(tenant_id),
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 source_system text NOT NULL CHECK (source_system='servicenow'),
 request_key text NOT NULL CHECK (length(btrim(request_key)) BETWEEN 1 AND 200),
 action text NOT NULL CHECK (action IN ('grant','revoke')),
 principal_id uuid NOT NULL,
 object_type text NOT NULL CHECK (object_type IN ('strategy','portfolio')),
 object_id uuid NOT NULL,
 assignment_id uuid,
 requested_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','applied','rejected')),
 error_code text,
 PRIMARY KEY(tenant_id,id),
 UNIQUE(tenant_id,source_system,request_key,action),
 FOREIGN KEY(tenant_id,principal_id) REFERENCES platform.tenant_member(tenant_id,principal_id),
 FOREIGN KEY(tenant_id,assignment_id) REFERENCES platform.object_access_assignment(tenant_id,id),
 CHECK ((status='applied' AND assignment_id IS NOT NULL AND error_code IS NULL)
    OR (status='rejected' AND error_code IS NOT NULL)
    OR (status='pending' AND assignment_id IS NULL AND error_code IS NULL))
);
CREATE INDEX access_fulfilment_status ON platform.access_fulfilment_event(tenant_id,status,requested_at);
ALTER TABLE platform.access_fulfilment_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON platform.access_fulfilment_event
 USING (tenant_id=platform.current_tenant() AND platform.application_context())
 WITH CHECK(tenant_id=platform.current_tenant() AND platform.application_context());
CREATE TRIGGER access_fulfilment_capture AFTER INSERT OR UPDATE ON platform.access_fulfilment_event
 FOR EACH ROW EXECUTE FUNCTION platform.capture_record('id');
-- No write grants for app or worker: a dedicated fulfilment identity, endpoint,
-- authority validation and reconciliation must be reviewed before activation.
GRANT SELECT ON platform.access_fulfilment_event TO spm_app;
