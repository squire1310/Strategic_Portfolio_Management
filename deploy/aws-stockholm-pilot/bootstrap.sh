#!/usr/bin/env bash
# Disposable synthetic-data pilot only. Run from EC2 user data as root.
set -euo pipefail
exec > >(tee -a /var/log/spm-bootstrap.log) 2>&1

: "${SPM_REVISION:?Set SPM_REVISION to a reviewed commit SHA}"
if ! [[ "$SPM_REVISION" =~ ^[0-9a-f]{40}$ ]]; then
  echo 'SPM_REVISION must be a full Git commit SHA' >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git postgresql postgresql-contrib caddy openssl

# Node 22 is required by the application; pin the major release.
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/spm-nodesource.sh
bash /tmp/spm-nodesource.sh
apt-get install -y nodejs
npm install --global pnpm@11.25.0

if ! swapon --show=NAME | grep -q '^/swapfile$'; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
fi

id spm >/dev/null 2>&1 || useradd --system --home /opt/spm --shell /usr/sbin/nologin spm
git clone https://github.com/squire1310/Strategic_Portfolio_Management.git /opt/spm
git -C /opt/spm checkout --detach "$SPM_REVISION"
chown -R spm:spm /opt/spm

systemctl enable --now postgresql
runuser -u postgres -- createdb spm_pilot
for migration in /opt/spm/reconciled-core/migrations/V*.sql; do
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -1 -d spm_pilot -f "$migration"
done

db_password="$(openssl rand -hex 24)"
pilot_password="$(openssl rand -hex 18)"
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d spm_pilot -c "CREATE ROLE spm_pilot LOGIN PASSWORD '$db_password'"
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d spm_pilot -c 'GRANT spm_app TO spm_pilot'
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d spm_pilot <<'SQL'
INSERT INTO platform.tenant(tenant_id,tenant_code,name)
VALUES ('00000000-0000-4000-8000-000000000001','pilot_one','Synthetic portfolio pilot');
INSERT INTO platform.principal(principal_id,subject,display_name)
VALUES ('00000000-0000-4000-8000-000000000101','pilot:owner','Pilot contributor');
INSERT INTO platform.tenant_member(tenant_id,principal_id,member_role)
VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000101','contributor');
SQL

cd /opt/spm/app
runuser -u spm -- pnpm install --frozen-lockfile
runuser -u spm -- pnpm build:css
pilot_hash="$(printf '%s' "$pilot_password" | node src/hash-password.js)"

metadata_token="$(curl -fsS -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' http://169.254.169.254/latest/api/token)"
public_ip="$(curl -fsS -H "X-aws-ec2-metadata-token: $metadata_token" http://169.254.169.254/latest/meta-data/public-ipv4)"
hostname="spm-${public_ip//./-}.sslip.io"
origin="https://$hostname"

install -d -m 0700 /etc/spm
cat > /etc/spm/app.env <<EOF
SPM_DATABASE_URL=postgresql://spm_pilot:$db_password@127.0.0.1:5432/spm_pilot
SPM_PUBLIC_ORIGIN=$origin
SPM_BIND_ADDRESS=127.0.0.1
SPM_LOCAL_USERS_JSON='[{"username":"pilot","displayName":"Pilot contributor","tenantId":"00000000-0000-4000-8000-000000000001","actorId":"00000000-0000-4000-8000-000000000101","passwordHash":"$pilot_hash"}]'
EOF
chmod 0600 /etc/spm/app.env

cat > /etc/systemd/system/spm.service <<'EOF'
[Unit]
Description=Strategic Portfolio Management synthetic pilot
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=spm
Group=spm
WorkingDirectory=/opt/spm/app
EnvironmentFile=/etc/spm/app.env
ExecStart=/usr/bin/node /opt/spm/app/src/server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/opt/spm/app

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/caddy/Caddyfile <<EOF
$hostname {
    reverse_proxy 127.0.0.1:3000
}
EOF

cat > /root/spm-pilot-access.txt <<EOF
Synthetic pilot only. Do not enter real data.
URL: $origin
Username: pilot
Password: $pilot_password
EOF
chmod 0600 /root/spm-pilot-access.txt
unset db_password pilot_password pilot_hash

systemctl daemon-reload
systemctl enable --now spm
systemctl enable --now caddy
printf 'Bootstrap complete: %s\n' "$origin"

