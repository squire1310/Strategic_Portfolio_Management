// Prototype application roles. Database tenant membership remains a separate gate.
export const roleCommands = Object.freeze({
  executive: Object.freeze(['strategy', 'strategy-update', 'strategy-retire']),
  policy: Object.freeze(['objective', 'objective-update', 'objective-parent', 'outcome', 'outcome-update', 'outcome-retire',
    'measure', 'measure-update', 'measure-retire', 'observation', 'observation-correction', 'observation-void']),
  portfolio_manager: Object.freeze(['portfolio', 'portfolio-update', 'portfolio-parent', 'portfolio-retire',
    'category', 'category-update', 'category-retire', 'alignment', 'alignment-remove']),
  engagement_lead: Object.freeze(['investment', 'investment-update', 'investment-retire',
    'membership', 'membership-update', 'membership-remove']),
  viewer: Object.freeze([])
});

export const roleLabels = Object.freeze({
  executive: 'Executive', policy: 'Policy', portfolio_manager: 'Portfolio Manager',
  engagement_lead: 'Engagement Lead', viewer: 'Viewer'
});

export function commandsForRole(role) { return roleCommands[role] || []; }
export function canRunCommand(role, command) { return commandsForRole(role).includes(command); }
