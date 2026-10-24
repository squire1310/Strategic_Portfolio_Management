import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createStore } from '../src/domain.js';
import { createHttpServer } from '../src/server.js';
import { createAuth, hashPassword } from '../src/auth.js';
import { roleCommands } from '../src/permissions.js';

const tenantOne = '00000000-0000-4000-8000-000000000001';
const actorOne = '00000000-0000-4000-8000-000000000101';
const tenantTwo = '00000000-0000-4000-8000-000000000002';
const actorTwo = '00000000-0000-4000-8000-000000000102';

test('US-001–US-004 application slice', { skip: !process.env.SPM_TEST_DATABASE_URL }, async t => {
  const connectionString = process.env.SPM_TEST_DATABASE_URL;
  const store = createStore({ connectionString, tenantId: tenantOne, actorId: actorOne });
  const other = createStore({ connectionString, tenantId: tenantTwo, actorId: actorTwo });
  const wrongActor = createStore({ connectionString, tenantId: tenantOne, actorId: actorTwo });
  const auth = createAuth([
    ...Object.keys(roleCommands).filter(role => role !== 'viewer').map(role => ({
      username: `pilot-${role.replaceAll('_', '-')}`, displayName: role, tenantId: tenantOne, actorId: actorOne,
      role, passwordHash: hashPassword('integration-test-password') })),
    { username: 'pilot-two', displayName: 'Pilot two', tenantId: tenantTwo, actorId: actorTwo,
      role: 'executive', passwordHash: hashPassword('another-test-password') }
  ]);
  const server = createHttpServer(store, { auth });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const anonymous = await fetch(base, { redirect: 'manual' });
  assert.equal(anonymous.status, 303);
  assert.equal(anonymous.headers.get('location'), '/login');
  const denied = await fetch(`${base}/api/workspace`);
  assert.equal(denied.status, 401);
  const cookies = {};
  for (const role of Object.keys(roleCommands).filter(value => value !== 'viewer')) {
    const login = await fetch(`${base}/api/login`, { method: 'POST',
      headers: { origin: base, 'content-type': 'application/json' },
      body: JSON.stringify({ username: `pilot-${role.replaceAll('_', '-')}`, password: 'integration-test-password' }) });
    assert.equal(login.status, 200);
    cookies[role] = login.headers.get('set-cookie').split(';')[0];
    assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  }
  const cookie = cookies.executive;
  const get = path => fetch(`${base}${path}`, { headers: { cookie } });
  const suffix = randomUUID().slice(0, 8);
  const post = async (command, body) => {
    const role = Object.keys(roleCommands).find(key => roleCommands[key].includes(command));
    const response = await fetch(`${base}/api/commands/${command}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base, cookie: cookies[role] }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  try {
    let strategy, objective, outcome, measure, observation, portfolio, investment, membership, category, alignment;
    await t.test('local browser assets are served without external dependencies', async () => {
      const page = await get('/');
      assert.equal(page.status, 200);
      const markup = await page.text();
      assert.match(markup, /Strategic portfolio management/);
      assert.match(markup, /govuk-skip-link/);
      assert.match(markup, /govuk-header__service-name/);
      assert.match(markup, /govuk-form-group/);
      assert.doesNotMatch(markup, /govuk-header__logotype/);
      const stylesheet = await fetch(`${base}/govuk.css`);
      assert.equal(stylesheet.status, 200);
      assert.match(await stylesheet.text(), /govuk-button/);
      const script = await fetch(`${base}/app.js`);
      assert.equal(script.status, 200);
      assert.match(await script.text(), /strategy_of_objective/);
    });
    await t.test('strategy, objective, outcome, measure and correction retain history', async () => {
      let r = await post('strategy', { code: `strategy_${suffix}`, name: 'Test strategy', startDate: '2026-01-01', endDate: '2030-01-01' });
      assert.equal(r.status, 201); strategy = r.body;
      r = await post('objective', { strategyId: strategy.id, code: `objective_${suffix}`, title: 'Improve outcome', validFrom: '2026-01-01', validUntil: '2030-01-01' });
      assert.equal(r.status, 201); objective = r.body;
      r = await post('objective-update', { id: objective.id, expectedVersion: 1, title: 'Improve the service outcome', status: 'active' });
      assert.equal(r.status, 201); assert.equal(r.body.row_version, 2); objective = r.body;
      r = await post('outcome', { objectiveId: objective.id, code: `outcome_${suffix}`, statement: 'Better service', contributionRationale: 'Directly advances the objective' });
      assert.equal(r.status, 201); outcome = r.body;
      r = await post('measure', { outcomeId: outcome.id, code: `measure_${suffix}`, name: 'Coverage', unit: 'percent', direction: 'increase', baselineValue: 30, targetValue: 70 });
      assert.equal(r.status, 201); measure = r.body;
      r = await post('observation', { measureId: measure.id, observedOn: '2026-10-01', value: 40, evidenceUri: 'synthetic:source' });
      assert.equal(r.status, 201); observation = r.body;
      r = await post('observation', { measureId: measure.id, observedOn: '2026-10-02', value: 41 });
      assert.equal(r.status, 400);
      r = await post('observation-correction', { id: observation.id, expectedVersion: 1, value: 45, evidenceUri: 'synthetic:correction' });
      assert.equal(r.status, 201); assert.equal(r.body.row_version, 2);
      r = await post('observation-correction', { id: observation.id, expectedVersion: 1, value: 50, evidenceUri: 'synthetic:stale' });
      assert.equal(r.status, 409);
      const history = await (await get(`/api/history/m01_strategy/measure_observation/${observation.id}`)).json();
      assert.equal(history.revisions.length, 2);
      assert.equal(history.audit.length, 2);
      assert.equal(history.revisions[0].actor_id, actorOne);
      const objectiveHistory = await (await get(`/api/history/m01_strategy/objective/${objective.id}`)).json();
      assert.equal(objectiveHistory.revisions.length, 2);
    });

    await t.test('hierarchy cycles and duplicate tenant codes fail', async () => {
      let r = await post('objective', { strategyId: strategy.id, parentObjectiveId: objective.id, code: `child_${suffix}`, title: 'Child objective', validFrom: '2026-01-01', validUntil: '2030-01-01' });
      assert.equal(r.status, 201);
      const child = r.body;
      r = await post('objective-parent', { id: objective.id, parentObjectiveId: child.id, expectedVersion: 1 });
      assert.equal(r.status, 400);
      r = await post('strategy', { code: strategy.code, name: 'Duplicate', startDate: '2026-01-01', endDate: '2030-01-01' });
      assert.equal(r.status, 409);
    });

    await t.test('portfolio, membership, alignment and audit', async () => {
      let r = await post('portfolio', { code: `portfolio_${suffix}`, name: 'Portfolio' });
      assert.equal(r.status, 201); portfolio = r.body;
      r = await post('portfolio', { code: `sub_${suffix}`, name: 'Sub-portfolio', parentPortfolioId: portfolio.id });
      assert.equal(r.status, 201);
      r = await post('portfolio-parent', { id: portfolio.id, parentPortfolioId: r.body.id, expectedVersion: 1 });
      assert.equal(r.status, 400);
      r = await post('category', { code: `category_${suffix}`, label: 'Digital' });
      assert.equal(r.status, 201);
      category = r.body;
      r = await post('investment', { categoryId: category.id, code: `investment_${suffix}`, title: 'Candidate investment' });
      assert.equal(r.status, 201); investment = r.body; assert.equal(investment.lifecycle, 'candidate');
      r = await post('membership', { portfolioId: portfolio.id, investmentId: investment.id, startDate: '2026-01-01', endDate: '2027-01-01' });
      assert.equal(r.status, 201); membership = r.body;
      r = await post('membership', { portfolioId: portfolio.id, investmentId: investment.id, startDate: '2026-06-01', endDate: '2027-06-01' });
      assert.equal(r.status, 409);
      r = await post('alignment', { portfolioId: portfolio.id, objectiveId: objective.id, contribution: 'First explanation' });
      assert.equal(r.status, 201); alignment = r.body;
      r = await post('alignment', { portfolioId: portfolio.id, objectiveId: objective.id, contribution: 'Revised explanation' });
      assert.equal(r.status, 201); assert.equal(r.body.id, alignment.id);
      const history = await (await get(`/api/history/m02_portfolio/portfolio_objective/${alignment.id}`)).json();
      assert.equal(history.audit.length, 2);
      const workspace = await (await get('/api/workspace')).json();
      assert.ok(workspace.alignments.some(row => row.id === alignment.id && row.contribution === 'Revised explanation'));
      r = await post('portfolio-retire', { id: portfolio.id, expectedVersion: 1 });
      assert.equal(r.status, 201); assert.equal(r.body.status, 'retired');
      r = await post('category-retire', { id: category.id, expectedVersion: 1 });
      assert.equal(r.status, 201); assert.equal(r.body.active, false);
      const retiredMemberships = await (await get('/api/workspace')).json();
      assert.ok(retiredMemberships.memberships.some(row => row.portfolio_id === portfolio.id && row.investment_id === investment.id));
    });

    await t.test('cross-tenant references and mismatched actor fail', async () => {
      const foreign = await other.command('strategy', { code: `foreign_${suffix}`, name: 'Foreign', startDate: '2026-01-01', endDate: '2030-01-01' });
      const foreignObjective = await other.command('objective', { strategyId: foreign.id, code: `foreign_obj_${suffix}`, title: 'Foreign objective', validFrom: '2026-01-01', validUntil: '2030-01-01' });
      const r = await post('alignment', { portfolioId: portfolio.id, objectiveId: foreignObjective.id, contribution: 'Should fail' });
      assert.equal(r.status, 400);
      const workspace = await (await get('/api/workspace')).json();
      assert.ok(!workspace.objectives.some(row => row.id === foreignObjective.id));
      await assert.rejects(() => wrongActor.workspace());
      const blocked = await fetch(`${base}/api/workspace`, { headers: { cookie, origin: 'https://example.org' } });
      assert.equal(blocked.status, 403);
      const csrf = await fetch(`${base}/api/commands/strategy`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{}' });
      assert.equal(csrf.status, 403);
      const secondLogin = await fetch(`${base}/api/login`, { method: 'POST', headers: { origin: base, 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'pilot-two', password: 'another-test-password' }) });
      assert.equal(secondLogin.status, 200);
      const secondCookie = secondLogin.headers.get('set-cookie').split(';')[0];
      const secondWorkspace = await (await fetch(`${base}/api/workspace`, { headers: { cookie: secondCookie } })).json();
      assert.ok(secondWorkspace.strategies.some(row => row.id === foreign.id));
      assert.ok(!secondWorkspace.strategies.some(row => row.id === strategy.id));
    });

    await t.test('role-owned revisions and removals retain audit history', async () => {
      let r = await post('strategy-update', { id: strategy.id, expectedVersion: 1, name: 'Revised strategy', description: 'Executive revision' });
      assert.equal(r.status, 201); assert.equal(r.body.row_version, 2);
      r = await post('outcome-update', { id: outcome.id, expectedVersion: 1, statement: 'Improved service', contributionRationale: 'Policy revision' });
      assert.equal(r.status, 201); assert.equal(r.body.row_version, 2);
      r = await post('measure-update', { id: measure.id, expectedVersion: 1, name: 'Revised coverage', unit: 'percent', direction: 'increase', baselineValue: 30, targetValue: 80 });
      assert.equal(r.status, 201); assert.equal(r.body.row_version, 2);
      r = await post('observation-void', { id: observation.id, expectedVersion: 2, reason: 'Synthetic source corrected' });
      assert.equal(r.status, 201); assert.equal(r.body.voided, true);
      r = await post('observation-correction', { id: observation.id, expectedVersion: 3, value: 46, evidenceUri: 'synthetic:late' });
      assert.equal(r.status, 409);
      r = await post('portfolio', { code: `editable_portfolio_${suffix}`, name: 'Editable portfolio' });
      assert.equal(r.status, 201); const editablePortfolio = r.body;
      r = await post('portfolio-update', { id: editablePortfolio.id, expectedVersion: 1, name: 'Revised portfolio' });
      assert.equal(r.status, 201); assert.equal(r.body.row_version, 2);
      r = await post('category', { code: `editable_category_${suffix}`, label: 'Editable' });
      assert.equal(r.status, 201); const editableCategory = r.body;
      r = await post('category-update', { id: editableCategory.id, expectedVersion: 1, label: 'Revised category' });
      assert.equal(r.status, 201); assert.equal(r.body.row_version, 2);
      r = await post('membership-update', { id: membership.id, expectedVersion: 1, startDate: '2026-02-01', endDate: '2027-01-01', weight: 0.75 });
      assert.equal(r.status, 201); assert.equal(r.body.row_version, 2);
      r = await post('membership-remove', { id: membership.id, expectedVersion: 2 });
      assert.equal(r.status, 201);
      r = await post('investment-update', { id: investment.id, expectedVersion: 1, title: 'Revised candidate', categoryId: editableCategory.id });
      assert.equal(r.status, 201); assert.equal(r.body.row_version, 2);
      r = await post('investment-retire', { id: investment.id, expectedVersion: 2 });
      assert.equal(r.status, 201); assert.equal(r.body.lifecycle, 'cancelled');
      r = await post('alignment-remove', { portfolioId: portfolio.id, objectiveId: objective.id });
      assert.equal(r.status, 201);
      r = await post('measure-retire', { id: measure.id, expectedVersion: 2 });
      assert.equal(r.status, 201); assert.equal(r.body.status, 'retired');
      r = await post('outcome-retire', { id: outcome.id, expectedVersion: 2 });
      assert.equal(r.status, 201); assert.equal(r.body.status, 'retired');
      r = await post('objective-update', { id: objective.id, expectedVersion: 2, title: 'Retired objective', status: 'retired' });
      assert.equal(r.status, 201); assert.equal(r.body.status, 'retired');
      r = await post('strategy-retire', { id: strategy.id, expectedVersion: 2 });
      assert.equal(r.status, 201); assert.equal(r.body.status, 'retired');
      r = await post('portfolio-retire', { id: editablePortfolio.id, expectedVersion: 2 });
      assert.equal(r.status, 201);
      r = await post('category-retire', { id: editableCategory.id, expectedVersion: 2 });
      assert.equal(r.status, 201);
      const observationHistory = await (await get(`/api/history/m01_strategy/measure_observation/${observation.id}`)).json();
      assert.equal(observationHistory.revisions.length, 3);
      const membershipHistory = await (await get(`/api/history/m02_portfolio/portfolio_membership/${membership.id}`)).json();
      assert.equal(membershipHistory.audit.at(-1).operation, 'DELETE');
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    await Promise.all([store.close(), other.close(), wrongActor.close()]);
  }
});
