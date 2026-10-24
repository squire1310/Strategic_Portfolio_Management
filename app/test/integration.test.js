import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createStore } from '../src/domain.js';
import { createHttpServer } from '../src/server.js';

const tenantOne = '00000000-0000-4000-8000-000000000001';
const actorOne = '00000000-0000-4000-8000-000000000101';
const tenantTwo = '00000000-0000-4000-8000-000000000002';
const actorTwo = '00000000-0000-4000-8000-000000000102';

test('US-001–US-004 application slice', { skip: !process.env.SPM_TEST_DATABASE_URL }, async t => {
  const connectionString = process.env.SPM_TEST_DATABASE_URL;
  const store = createStore({ connectionString, tenantId: tenantOne, actorId: actorOne });
  const other = createStore({ connectionString, tenantId: tenantTwo, actorId: actorTwo });
  const wrongActor = createStore({ connectionString, tenantId: tenantOne, actorId: actorTwo });
  const server = createHttpServer(store);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const suffix = randomUUID().slice(0, 8);
  const post = async (command, body) => {
    const response = await fetch(`${base}/api/commands/${command}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  try {
    let strategy, objective, outcome, measure, observation, portfolio, investment;
    await t.test('local browser assets are served without external dependencies', async () => {
      const page = await fetch(base);
      assert.equal(page.status, 200);
      const markup = await page.text();
      assert.match(markup, /Define strategic intent/);
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
      const history = await (await fetch(`${base}/api/history/m01_strategy/measure_observation/${observation.id}`)).json();
      assert.equal(history.revisions.length, 2);
      assert.equal(history.audit.length, 2);
      assert.equal(history.revisions[0].actor_id, actorOne);
      const objectiveHistory = await (await fetch(`${base}/api/history/m01_strategy/objective/${objective.id}`)).json();
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
      const category = r.body;
      r = await post('investment', { categoryId: category.id, code: `investment_${suffix}`, title: 'Candidate investment' });
      assert.equal(r.status, 201); investment = r.body; assert.equal(investment.lifecycle, 'candidate');
      r = await post('membership', { portfolioId: portfolio.id, investmentId: investment.id, startDate: '2026-01-01', endDate: '2027-01-01' });
      assert.equal(r.status, 201);
      r = await post('membership', { portfolioId: portfolio.id, investmentId: investment.id, startDate: '2026-06-01', endDate: '2027-06-01' });
      assert.equal(r.status, 409);
      r = await post('alignment', { portfolioId: portfolio.id, objectiveId: objective.id, contribution: 'First explanation' });
      assert.equal(r.status, 201); const alignment = r.body;
      r = await post('alignment', { portfolioId: portfolio.id, objectiveId: objective.id, contribution: 'Revised explanation' });
      assert.equal(r.status, 201); assert.equal(r.body.id, alignment.id);
      const history = await (await fetch(`${base}/api/history/m02_portfolio/portfolio_objective/${alignment.id}`)).json();
      assert.equal(history.audit.length, 2);
      const workspace = await (await fetch(`${base}/api/workspace`)).json();
      assert.ok(workspace.alignments.some(row => row.id === alignment.id && row.contribution === 'Revised explanation'));
      r = await post('portfolio-retire', { id: portfolio.id, expectedVersion: 1 });
      assert.equal(r.status, 201); assert.equal(r.body.status, 'retired');
      r = await post('category-retire', { id: category.id, expectedVersion: 1 });
      assert.equal(r.status, 201); assert.equal(r.body.active, false);
      const retiredMemberships = await (await fetch(`${base}/api/workspace`)).json();
      assert.ok(retiredMemberships.memberships.some(row => row.portfolio_id === portfolio.id && row.investment_id === investment.id));
    });

    await t.test('cross-tenant references and mismatched actor fail', async () => {
      const foreign = await other.command('strategy', { code: `foreign_${suffix}`, name: 'Foreign', startDate: '2026-01-01', endDate: '2030-01-01' });
      const foreignObjective = await other.command('objective', { strategyId: foreign.id, code: `foreign_obj_${suffix}`, title: 'Foreign objective', validFrom: '2026-01-01', validUntil: '2030-01-01' });
      const r = await post('alignment', { portfolioId: portfolio.id, objectiveId: foreignObjective.id, contribution: 'Should fail' });
      assert.equal(r.status, 400);
      const workspace = await (await fetch(`${base}/api/workspace`)).json();
      assert.ok(!workspace.objectives.some(row => row.id === foreignObjective.id));
      await assert.rejects(() => wrongActor.workspace());
      const blocked = await fetch(`${base}/api/workspace`, { headers: { origin: 'https://example.org' } });
      assert.equal(blocked.status, 403);
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    await Promise.all([store.close(), other.close(), wrongActor.close()]);
  }
});

