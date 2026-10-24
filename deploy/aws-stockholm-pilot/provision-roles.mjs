// Run as root on the disposable EC2 pilot after the role-aware application code is checked out.
// Passwords are written only to root-owned files; this script prints no credentials.
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, copyFileSync, appendFileSync, chmodSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { hashPassword } from '../../app/src/auth.js';

if (process.getuid?.() !== 0) throw new Error('Run as root');
const envPath = '/etc/spm/app.env';
const backupPath = '/etc/spm/app.env.pre-roles';
const accessPath = '/root/spm-pilot-access.txt';
const original = readFileSync(envPath, 'utf8');
const match = /^SPM_LOCAL_USERS_JSON='([^']*)'$/m.exec(original);
if (!match) throw new Error('Local account configuration not found');
const users = JSON.parse(match[1]);
const pilot = users.find(user => user.username === 'pilot');
if (!pilot) throw new Error('Existing pilot account not found');
const tenantId = pilot.tenantId;
if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new Error('Invalid tenant identifier');

const roles = [
  ['policy', 'Policy', '00000000-0000-4000-8000-000000000102'],
  ['portfolio-manager', 'Portfolio Manager', '00000000-0000-4000-8000-000000000103'],
  ['engagement-lead', 'Engagement Lead', '00000000-0000-4000-8000-000000000104']
];
const sql = roles.map(([username, title, actorId]) => `
INSERT INTO platform.principal(principal_id,subject,display_name)
VALUES ('${actorId}','pilot:${username}','${title}') ON CONFLICT (principal_id) DO NOTHING;
INSERT INTO platform.tenant_member(tenant_id,principal_id,member_role)
VALUES ('${tenantId}','${actorId}','contributor')
ON CONFLICT (tenant_id,principal_id) DO UPDATE SET member_role='contributor',active=true;
`).join('\n');
execFileSync('runuser', ['-u', 'postgres', '--', 'psql', '-v', 'ON_ERROR_STOP=1', '-1', '-d', 'spm_pilot'],
  { input: sql, stdio: ['pipe', 'ignore', 'pipe'] });

if (!existsSync(backupPath)) { copyFileSync(envPath, backupPath); chmodSync(backupPath, 0o600); }
pilot.role = 'executive';
let accessAdditions = '';
for (const [username, title, actorId] of roles) {
  if (users.some(user => user.username === username)) continue;
  const password = randomBytes(18).toString('hex');
  const role = username.replaceAll('-', '_');
  users.push({ username, displayName: title, tenantId, actorId, role, passwordHash: hashPassword(password) });
  accessAdditions += `\n${title}\nUsername: ${username}\nPassword: ${password}\n`;
}
const revised = original.replace(match[0], `SPM_LOCAL_USERS_JSON='${JSON.stringify(users)}'`);
writeFileSync(`${envPath}.new`, revised, { mode: 0o600 });
chmodSync(`${envPath}.new`, 0o600);
writeFileSync(`${accessPath}.new`, readFileSync(accessPath, 'utf8') + accessAdditions, { mode: 0o600 });
chmodSync(`${accessPath}.new`, 0o600);
execFileSync('mv', [`${envPath}.new`, envPath]);
execFileSync('mv', [`${accessPath}.new`, accessPath]);
console.log(`Provisioned ${users.length} role accounts for the synthetic pilot`);
