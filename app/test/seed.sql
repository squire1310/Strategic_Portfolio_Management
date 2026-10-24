-- Ephemeral CI database only. This password must never be reused outside the test service.
CREATE ROLE spm_ci LOGIN PASSWORD 'ci-only-password';
GRANT spm_app TO spm_ci;

INSERT INTO platform.tenant(tenant_id,tenant_code,name) VALUES
  ('00000000-0000-4000-8000-000000000001','pilot_one','Synthetic tenant one'),
  ('00000000-0000-4000-8000-000000000002','pilot_two','Synthetic tenant two');
INSERT INTO platform.principal(principal_id,subject,display_name) VALUES
  ('00000000-0000-4000-8000-000000000101','test:pilot-one','Synthetic contributor one'),
  ('00000000-0000-4000-8000-000000000102','test:pilot-two','Synthetic contributor two');
INSERT INTO platform.tenant_member(tenant_id,principal_id,member_role) VALUES
  ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000101','contributor'),
  ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000102','contributor');

