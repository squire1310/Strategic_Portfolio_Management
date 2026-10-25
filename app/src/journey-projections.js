// Read-only, permission-aware journey projections from canonical rows.
// Never persist these statuses or treat them as a substitute for governance decisions.
const collections = Object.freeze([
  ['strategies','strategy','status'],['objectives','objective','status'],
  ['outcomes','outcome','status'],['measures','measure','status'],
  ['portfolios','portfolio','status'],['categories','category','status'],
  ['investments','investment','lifecycle']
]);
export function deriveJourneyStatus(workspace) {
  const result = [];
  for (const [collection, objectType, field] of collections) {
    for (const row of workspace?.[collection] ?? []) {
      if (!row?.id || !row[field]) continue;
      result.push({ objectType, id: row.id, state: row[field],
        rowVersion: row.row_version ?? null, source: collection + '.' + field });
    }
  }
  for (const row of workspace?.observations ?? []) {
    if (!row?.id) continue;
    result.push({ objectType:'observation', id:row.id, state:row.voided ? 'voided':'recorded',
      rowVersion:row.row_version ?? null, source:'observations.voided' });
  }
  return result;
}
