import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { roleCommands, commandsForRole } from './permissions.js';
import { createGroupResolver, prototypeModeAllowed, validatePrototypeAccount } from './identity.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const usernamePattern = /^[a-z][a-z0-9._-]{2,63}$/;
const sessionHours = 8;
const sessionMs = sessionHours * 60 * 60 * 1000;
const lockMs = 15 * 60 * 1000;
const maxFailures = 5;

export function hashPassword(password, salt = randomBytes(16)) {
  if (typeof password !== 'string' || password.length < 16) throw new Error('Use a password of at least 16 characters');
  const saltBytes = Buffer.isBuffer(salt) ? salt : Buffer.from(salt, 'hex');
  if (saltBytes.length !== 16) throw new Error('Password salt must be 16 bytes');
  const digest = scryptSync(password, saltBytes, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${saltBytes.toString('hex')}$${digest.toString('hex')}`;
}

function passwordMatches(password, encoded) {
  const match = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(encoded || '');
  if (!match) return false;
  const candidate = scryptSync(password, Buffer.from(match[1], 'hex'), 32, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(candidate, Buffer.from(match[2], 'hex'));
}

export function createAuth(users, { groupMappings = {}, requireGroups = false } = {}) {
  const resolveGroups = createGroupResolver(groupMappings);
  if (!Array.isArray(users) || users.length === 0) throw new Error('At least one local account is required');
  const byName = new Map();
  for (const user of users) {
    if (!usernamePattern.test(user.username || '') || !uuid.test(user.tenantId || '') || !uuid.test(user.actorId || '') ||
        !Object.hasOwn(roleCommands, user.role) ||
        !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(user.passwordHash || '') || byName.has(user.username)) {
      throw new Error('Invalid or duplicate local account configuration');
    }
    if (user.groupIds !== undefined || requireGroups) validatePrototypeAccount({ ...user, groupIds: user.groupIds ?? [] });
    if (user.portfolioIds !== undefined && (!Array.isArray(user.portfolioIds) || user.portfolioIds.some(id => !uuid.test(id)))) throw new Error('Invalid prototype portfolio scope');
    if (requireGroups && !user.groupIds?.length) throw new Error('Prototype accounts must have a mapped group');
    const entitlements = user.groupIds ? resolveGroups(user.groupIds) : { commands: commandsForRole(user.role), readKeys: null };
    byName.set(user.username, { username: user.username, displayName: user.displayName || user.username,
      tenantId: user.tenantId, actorId: user.actorId, role: user.role, passwordHash: user.passwordHash,
      groupIds: user.groupIds || [], portfolioIds: user.portfolioIds ?? [], requireGroups, allowedCommands: entitlements.commands, readKeys: entitlements.readKeys });
  }
  const sessions = new Map();
  const failures = new Map();
  const dummyHash = hashPassword('unused-placeholder-password');

  function login(username, password, address = '') {
    if (typeof username !== 'string' || typeof password !== 'string' || password.length > 1024) return null;
    const name = username.trim().toLowerCase();
    const key = `${address}:${name}`;
    const state = failures.get(key);
    if (state && state.until > Date.now() && state.count >= maxFailures) return null;
    const user = byName.get(name);
    const valid = passwordMatches(password, user?.passwordHash || dummyHash);
    if (!valid) {
      const count = state && state.until > Date.now() ? state.count + 1 : 1;
      failures.set(key, { count, until: Date.now() + lockMs });
      return null;
    }
    failures.delete(key);
    const token = randomBytes(32).toString('hex');
    sessions.set(token, { user, expires: Date.now() + sessionMs });
    return { token, user: publicUser(user) };
  }

  function resolve(cookieHeader) {
    const token = /(?:^|;\s*)spm_session=([a-f0-9]{64})(?:;|$)/.exec(cookieHeader || '')?.[1];
    if (!token) return null;
    const session = sessions.get(token);
    if (!session) return null;
    if (session.expires <= Date.now()) { sessions.delete(token); return null; }
    const current = byName.get(session.user.username);
    if (!current) return null;
    const entitlement = current.requireGroups ? resolveGroups(current.groupIds) : { commands: current.allowedCommands, readKeys: current.readKeys };
    const refreshed = entitlement.commands;
    return { token, user: publicUser({ ...current, allowedCommands: refreshed, readKeys: entitlement.readKeys, portfolioIds: current.requireGroups ? current.portfolioIds : null }), context: { tenantId: current.tenantId, actorId: current.actorId }, hasAppAccess: !current.requireGroups || resolveGroups(current.groupIds).bundles.length > 0 };
  }

  function logout(token) { if (token) sessions.delete(token); }
  // Test-only membership simulation: changed memberships are resolved on the next request.
  function updatePrototypeGroups(username, groupIds) {
    const current = byName.get(username);
    if (!current || !current.requireGroups) throw new Error('Prototype group update unavailable');
    validatePrototypeAccount({ groupIds });
    current.groupIds = [...groupIds];
  }
  return { login, resolve, logout, updatePrototypeGroups };
}

function publicUser(user) { return { username: user.username, displayName: user.displayName,
  role: user.role, allowedCommands: user.allowedCommands ?? commandsForRole(user.role), readKeys: user.readKeys ?? null, portfolioIds: user.portfolioIds ?? null }; }

export function authFromEnvironment() {
  prototypeModeAllowed();
  let users;
  try { users = JSON.parse(process.env.SPM_LOCAL_USERS_JSON || ''); }
  catch { throw new Error('SPM_LOCAL_USERS_JSON must contain a local account array'); }
  let groupMappings = {};
  try { groupMappings = JSON.parse(process.env.SPM_GROUP_MAPPINGS_JSON || '{}'); }
  catch { throw new Error('SPM_GROUP_MAPPINGS_JSON must be an object'); }
  return createAuth(users, { groupMappings, requireGroups: process.env.SPM_IDENTITY_PROVIDER === 'prototype' });
}

export function sessionCookie(token, secure) {
  return `spm_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionHours * 3600}${secure ? '; Secure' : ''}`;
}

export function expiredSessionCookie(secure) {
  return `spm_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;
}
