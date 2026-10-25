import { commandsForRole } from './permissions.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Prototype-compatible entitlement resolver. Group IDs are stable identifiers,
 * not display names. No group or role may grant formal investment approval.
 */
export function createGroupResolver(groupMappings = {}) {
  if (!groupMappings || typeof groupMappings !== 'object' || Array.isArray(groupMappings)) throw new Error('Invalid group mappings');
  const mapping = new Map();
  for (const [groupId, roles] of Object.entries(groupMappings)) {
    if (!uuid.test(groupId) || !Array.isArray(roles) || roles.some(r => !Object.hasOwn(ROLE_BUNDLES, r))) {
      throw new Error('Invalid group mapping');
    }
    mapping.set(groupId.toLowerCase(), [...new Set(roles)]);
  }
  return (groupIds = []) => {
    if (!Array.isArray(groupIds) || groupIds.some(id => typeof id !== 'string' || !uuid.test(id))) {
      throw new Error('Invalid group membership');
    }
    const bundles = [...new Set(groupIds.flatMap(id => mapping.get(id.toLowerCase()) || []))];
    return { bundles, commands: [...new Set(bundles.flatMap(commandsForRole))],
      readKeys: [...new Set(bundles.flatMap(bundle => READ_BUNDLES[bundle] || []))] };
  };
}

const STRATEGY_READS = Object.freeze(['strategies', 'objectives', 'outcomes', 'measures', 'observations']);
const PORTFOLIO_READS = Object.freeze(['portfolios', 'categories', 'investments', 'memberships', 'alignments']);
const READ_BUNDLES = Object.freeze({
  executive: STRATEGY_READS, policy: STRATEGY_READS, portfolio_manager: PORTFOLIO_READS,
  engagement_lead: PORTFOLIO_READS, verifier: PORTFOLIO_READS, condition_recorder: PORTFOLIO_READS,
  viewer: [...STRATEGY_READS, ...PORTFOLIO_READS]
});
const ROLE_BUNDLES = Object.freeze({
  executive: true, policy: true, portfolio_manager: true,
  engagement_lead: true, verifier: true, condition_recorder: true, viewer: true
});

export function prototypeModeAllowed(env = process.env) {
  const mode = env.SPM_DEPLOYMENT_ENV || 'development';
  if (!['development', 'test', 'prototype', 'production'].includes(mode)) throw new Error('Invalid SPM_DEPLOYMENT_ENV');
  if (mode === 'production' && (env.SPM_IDENTITY_PROVIDER || 'local') !== 'entra') {
    throw new Error('Production requires Entra identity; local/prototype authentication is prohibited');
  }
  if ((env.SPM_IDENTITY_PROVIDER || 'local') === 'entra') {
    throw new Error('Entra adapter is not implemented; fail closed rather than accepting unverified identities');
  }
  if (!['local', 'prototype'].includes(env.SPM_IDENTITY_PROVIDER || 'local')) throw new Error('Unsupported identity provider');
  return true;
}

export function validatePrototypeAccount(user) {
  if (!Array.isArray(user.groupIds) || user.groupIds.some(id => !uuid.test(id))) throw new Error('Invalid prototype group IDs');
  if (user.externalSubjectId !== undefined && !uuid.test(user.externalSubjectId)) throw new Error('Invalid immutable external subject ID');
  if (user.externalTenantId !== undefined && !uuid.test(user.externalTenantId)) throw new Error('Invalid external tenant ID');
}
