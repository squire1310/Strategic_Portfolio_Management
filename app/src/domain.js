import pg from 'pg';
import {evaluateCommitteeQuorum} from './committee-quorum.js';
import {validateScenarioConstraints,evaluateScenarioConstraint,rankScenarioCandidates} from './scenario-constraints.js';
import { randomUUID } from 'node:crypto';

const { Pool } = pg;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const codePattern = /^[a-z][a-z0-9_]{1,62}$/;

export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const requiredText = (value, field, max = 2000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new AppError(400, `${field} is required (maximum ${max} characters)`);
  return value.trim();
};
const optionalText = (value, field, max = 2000) => value == null || value === '' ? null : requiredText(value, field, max);
const uuid = (value, field) => {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new AppError(400, `${field} must be a UUID`);
  return value;
};
const optionalUuid = (value, field) => value == null || value === '' ? null : uuid(value, field);
const code = (value) => {
  if (typeof value !== 'string' || !codePattern.test(value)) throw new AppError(400, 'code must use lowercase letters, digits and underscores');
  return value;
};
const date = (value, field) => {
  const parsed = typeof value === 'string' && datePattern.test(value) ? new Date(`${value}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) throw new AppError(400, `${field} must be a real YYYY-MM-DD date`);
  return value;
};
const optionalDate = (value, field) => value == null || value === '' ? null : date(value, field);
const interval = (start, end) => {
  const a = date(start, 'startDate'), b = date(end, 'endDate');
  if (a >= b) throw new AppError(400, 'endDate must be after startDate');
  return [a, b];
};
const version = value => {
  if (!Number.isInteger(value) || value < 1) throw new AppError(400, 'expectedVersion must be a positive integer');
  return value;
};
const finiteNumber = (value, field) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new AppError(400, `${field} must be a finite number`);
  return value;
};
const one = async (client, sql, args, missing = 'Record not found') => {
  const result = await client.query(sql, args);
  if (result.rowCount !== 1) throw new AppError(404, missing);
  return result.rows[0];
};

export function createStore({ connectionString, tenantId, actorId }) {
  if (tenantId != null) uuid(tenantId, 'tenantId');
  if (actorId != null) uuid(actorId, 'actorId');
  if ((tenantId == null) !== (actorId == null)) throw new Error('Tenant and actor defaults must be supplied together');
  if (!connectionString) throw new Error('SPM_DATABASE_URL is required');
  const pool = new Pool({ connectionString, max: 5, statement_timeout: 5000, idleTimeoutMillis: 10000 });

  async function transaction(work, { write = false, context } = {}) {
    const identity = context || { tenantId, actorId };
    uuid(identity.tenantId, 'tenantId'); uuid(identity.actorId, 'actorId');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id',$1,true), set_config('app.actor_id',$2,true), set_config('app.request_id',$3,true)", [identity.tenantId, identity.actorId, randomUUID()]);
      const membership = await client.query(`SELECT member_role FROM platform.tenant_member
        WHERE tenant_id=platform.current_tenant() AND principal_id=platform.current_actor() AND active`);
      if (!membership.rowCount) throw new AppError(403, 'Active tenant membership required');
      const actor = membership.rows[0];
      if (write && !['contributor', 'administrator'].includes(actor.member_role)) throw new AppError(403, 'Write permission required');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async function command(name, body, context, portfolioIds = null, strategyIds = null) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError(400, 'JSON object required');
    return transaction(async client => {
      if (strategyIds !== null && ['strategy','strategy-update','strategy-retire','objective','objective-update','objective-parent','outcome','outcome-update','outcome-retire','measure','measure-update','measure-retire','observation','observation-correction','observation-void'].includes(name)) throw new AppError(403, 'Strategy scoped writes require object-level verification');
      if (portfolioIds !== null) {
        const allowed = new Set(['portfolio-update','portfolio-retire','membership','membership-update','membership-remove','alignment','alignment-remove','investment-update']);
        if (!allowed.has(name)) throw new AppError(403, 'Scoped command not supported');
        let portfolioId = body.portfolioId;
        if (['portfolio-update','portfolio-retire'].includes(name)) portfolioId = body.id;
        if (['membership-update','membership-remove'].includes(name)) {
          const row = await client.query('SELECT portfolio_id FROM m02_portfolio.portfolio_membership WHERE tenant_id=platform.current_tenant() AND id=$1', [uuid(body.id,'id')]);
          portfolioId = row.rows[0]?.portfolio_id;
        }
        if (name === 'investment-update') {
          const rows = await client.query('SELECT portfolio_id FROM m02_portfolio.portfolio_membership WHERE tenant_id=platform.current_tenant() AND investment_id=$1', [uuid(body.id,'id')]);
          if (!rows.rowCount || rows.rows.some(r => !portfolioIds.includes(r.portfolio_id))) throw new AppError(403, 'Investment scope denied');
        } else if (!portfolioId || !portfolioIds.includes(portfolioId)) throw new AppError(403, 'Portfolio scope denied');
      }
      switch (name) {
        case 'strategy': {
          const [a, b] = interval(body.startDate, body.endDate);
          return one(client, `INSERT INTO m01_strategy.strategy
            (tenant_id,code,name,description,horizon,owner_id)
            VALUES (platform.current_tenant(),$1,$2,$3,daterange($4::date,$5::date,'[)'),platform.current_actor())
            RETURNING *`, [code(body.code), requiredText(body.name, 'name', 200), optionalText(body.description, 'description'), a, b]);
        }
        case 'strategy-update': {
          const updated = await client.query(`UPDATE m01_strategy.strategy SET name=$3,description=$4
            WHERE tenant_id=platform.current_tenant() AND id=$1 AND row_version=$2 AND status<>'retired' RETURNING *`,
            [uuid(body.id, 'id'), version(body.expectedVersion), requiredText(body.name, 'name', 200), optionalText(body.description, 'description')]);
          if (!updated.rowCount) throw new AppError(409, 'Stale, missing or retired strategy');
          return updated.rows[0];
        }
        case 'strategy-retire': {
          const updated = await client.query(`UPDATE m01_strategy.strategy SET status='retired'
            WHERE tenant_id=platform.current_tenant() AND id=$1 AND row_version=$2 AND status<>'retired' RETURNING *`,
            [uuid(body.id, 'id'), version(body.expectedVersion)]);
          if (!updated.rowCount) throw new AppError(409, 'Stale, missing or already retired strategy');
          return updated.rows[0];
        }
        case 'objective': {
          const priority = body.priority == null ? 3 : body.priority;
          if (!Number.isInteger(priority) || priority < 1 || priority > 5) throw new AppError(400, 'priority must be 1–5');
          const [validFrom, validUntil] = interval(body.validFrom, body.validUntil);
          return one(client, `INSERT INTO m01_strategy.objective
            (tenant_id,strategy_id,parent_objective_id,code,title,description,priority,owner_id,valid_during)
            VALUES (platform.current_tenant(),$1,$2,$3,$4,$5,$6,platform.current_actor(),
              tstzrange(($7::date::timestamp AT TIME ZONE 'UTC'),($8::date::timestamp AT TIME ZONE 'UTC'),'[)')) RETURNING *`,
            [uuid(body.strategyId, 'strategyId'), optionalUuid(body.parentObjectiveId, 'parentObjectiveId'), code(body.code), requiredText(body.title, 'title', 200), optionalText(body.description, 'description'), priority, validFrom, validUntil]);
        }
        case 'objective-update': {
          const status = requiredText(body.status, 'status', 20);
          if (!['draft', 'active', 'retired'].includes(status)) throw new AppError(400, 'Invalid objective status');
          const updated = await client.query(`UPDATE m01_strategy.objective SET title=$3,description=$4,status=$5
            WHERE tenant_id=platform.current_tenant() AND id=$1 AND row_version=$2 RETURNING *`,
            [uuid(body.id, 'id'), version(body.expectedVersion), requiredText(body.title, 'title', 200), optionalText(body.description, 'description'), status]);
          if (!updated.rowCount) throw new AppError(409, 'Stale or missing objective');
          return updated.rows[0];
        }
        case 'objective-parent': {
          const id = uuid(body.id, 'id'), parentId = optionalUuid(body.parentObjectiveId, 'parentObjectiveId');
          const expected = version(body.expectedVersion);
          const current = await one(client, `SELECT * FROM m01_strategy.objective WHERE tenant_id=platform.current_tenant() AND id=$1`, [id]);
          await client.query(`SELECT id FROM m01_strategy.strategy WHERE tenant_id=platform.current_tenant() AND id=$1 FOR UPDATE`, [current.strategy_id]);
          if (parentId === id) throw new AppError(400, 'Objective cannot parent itself');
          if (parentId) {
            const descendant = await client.query(`WITH RECURSIVE descendants AS (
              SELECT id FROM m01_strategy.objective WHERE tenant_id=platform.current_tenant() AND id=$1
              UNION ALL SELECT child.id FROM m01_strategy.objective child JOIN descendants d ON child.parent_objective_id=d.id
              WHERE child.tenant_id=platform.current_tenant()) SELECT 1 FROM descendants WHERE id=$2 LIMIT 1`, [id, parentId]);
            if (descendant.rowCount) throw new AppError(400, 'Objective hierarchy cycle rejected');
          }
          const updated = await client.query(`UPDATE m01_strategy.objective SET parent_objective_id=$2
            WHERE tenant_id=platform.current_tenant() AND id=$1 AND row_version=$3 RETURNING *`, [id, parentId, expected]);
          if (!updated.rowCount) throw new AppError(409, 'Stale objective version');
          return updated.rows[0];
        }
        case 'outcome':
          return one(client, `INSERT INTO m01_strategy.outcome
            (tenant_id,objective_id,code,statement,contribution_rationale,target_date,owner_id)
            VALUES (platform.current_tenant(),$1,$2,$3,$4,$5,platform.current_actor()) RETURNING *`,
            [uuid(body.objectiveId, 'objectiveId'), code(body.code), requiredText(body.statement, 'statement'), requiredText(body.contributionRationale, 'contributionRationale'), optionalDate(body.targetDate, 'targetDate')]);
        case 'outcome-update': {
          const updated = await client.query(`UPDATE m01_strategy.outcome SET statement=$3,contribution_rationale=$4,target_date=$5
            WHERE tenant_id=platform.current_tenant() AND id=$1 AND row_version=$2 AND status<>'retired' RETURNING *`,
            [uuid(body.id, 'id'), version(body.expectedVersion), requiredText(body.statement, 'statement'),
              requiredText(body.contributionRationale, 'contributionRationale'), optionalDate(body.targetDate, 'targetDate')]);
          if (!updated.rowCount) throw new AppError(409, 'Stale, missing or retired outcome');
          return updated.rows[0];
        }
        case 'outcome-retire': {
          const updated = await client.query(`UPDATE m01_strategy.outcome SET status='retired'
            WHERE tenant_id=platform.current_tenant() AND id=$1 AND row_version=$2 AND status<>'retired' RETURNING *`,
            [uuid(body.id, 'id'), version(body.expectedVersion)]);
          if (!updated.rowCount) throw new AppError(409, 'Stale, missing or already retired outcome');
          return updated.rows[0];
        }
        case 'measure': {
          const direction = requiredText(body.direction, 'direction', 20);
          if (!['increase', 'decrease', 'maintain'].includes(direction)) throw new AppError(400, 'Invalid direction');
          return one(client, `INSERT INTO m01_strategy.measure
            (tenant_id,outcome_id,code,name,unit,direction,baseline_value,target_value,owner_id)
            VALUES (platform.current_tenant(),$1,$2,$3,$4,$5,$6,$7,platform.current_actor()) RETURNING *`,
            [uuid(body.outcomeId, 'outcomeId'), code(body.code), requiredText(body.name, 'name', 200), requiredText(body.unit, 'unit', 50), direction,
              body.baselineValue == null ? null : finiteNumber(body.baselineValue, 'baselineValue'),
              body.targetValue == null ? null : finiteNumber(body.targetValue, 'targetValue')]);
        }
        case 'measure-update': {
          const direction = requiredText(body.direction, 'direction', 20);
          if (!['increase', 'decrease', 'maintain'].includes(direction)) throw new AppError(400, 'Invalid direction');
          const updated = await client.query(`UPDATE m01_strategy.measure SET name=$3,unit=$4,direction=$5,
            baseline_value=$6,target_value=$7 WHERE tenant_id=platform.current_tenant() AND id=$1 AND row_version=$2
            AND status<>'retired' RETURNING *`,
            [uuid(body.id, 'id'), version(body.expectedVersion), requiredText(body.name, 'name', 200),
              requiredText(body.unit, 'unit', 50), direction,
              body.baselineValue == null ? null : finiteNumber(body.baselineValue, 'baselineValue'),
              body.targetValue == null ? null : finiteNumber(body.targetValue, 'targetValue')]);
          if (!updated.rowCount) throw new AppError(409, 'Stale, missing or retired measure');
          return updated.rows[0];
        }
        case 'measure-retire': {
          const updated = await client.query(`UPDATE m01_strategy.measure SET status='retired'
            WHERE tenant_id=platform.current_tenant() AND id=$1 AND row_version=$2 AND status<>'retired' RETURNING *`,
            [uuid(body.id, 'id'), version(body.expectedVersion)]);
          if (!updated.rowCount) throw new AppError(409, 'Stale, missing or already retired measure');
          return updated.rows[0];
        }
        case 'observation':
          return one(client, `INSERT INTO m01_strategy.measure_observation
            (tenant_id,measure_id,observed_on,value,evidence_uri)
            VALUES (platform.current_tenant(),$1,$2,$3,$4) RETURNING *`,
            [uuid(body.measureId, 'measureId'), date(body.observedOn, 'observedOn'), finiteNumber(body.value, 'value'), requiredText(body.evidenceUri, 'evidenceUri', 1000)]);
        case 'observation-correction': {
          const updated = await client.query(`UPDATE m01_strategy.measure_observation
            SET value=$3,evidence_uri=$4 WHERE tenant_id=platform.current_tenant() AND id=$1 AND row_version=$2 AND NOT voided RETURNING *`,
            [uuid(body.id, 'id'), version(body.expectedVersion), finiteNumber(body.value, 'value'), requiredText(body.evidenceUri, 'correction evidence', 1000)]);
          if (!updated.rowCount) throw new AppError(409, 'Stale or missing observation');
          return updated.rows[0];
        }
        case 'observation-void': {
          const updated = await client.query(`UPDATE m01_strategy.measure_observation SET voided=true,void_reason=$3
            WHERE tenant_id=platform.current_tenant() AND id=$1 AND row_version=$2 AND NOT voided RETURNING *`,
            [uuid(body.id, 'id'), version(body.expectedVersion), requiredText(body.reason, 'reason', 1000)]);
          if (!updated.rowCount) throw new AppError(409, 'Stale, missing or already voided observation');
          return updated.rows[0];
        }
        case 'portfolio':
          return one(client, `INSERT INTO m02_portfolio.portfolio
            (tenant_id,parent_portfolio_id,code,name,owner_id)
            VALUES (platform.current_tenant(),$1,$2,$3,platform.current_actor()) RETURNING *`,
            [optionalUuid(body.parentPortfolioId, 'parentPortfolioId'), code(body.code), requiredText(body.name, 'name', 200)]);
        case 'portfolio-update': {
          const updated = await client.query(`UPDATE m02_portfolio.portfolio SET name=$3
            WHERE tenant_id=platform.current_tenant() AND id=$1 AND row_version=$2 AND status='active' RETURNING *`,
            [uuid(body.id, 'id'), version(body.expectedVersion), requiredText(body.name, 'name', 200)]);
          if (!updated.rowCount) throw new AppError(409, 'Stale, missing or retired portfolio');
          return updated.rows[0];
        }
        case 'portfolio-retire': {
          const updated = await client.query(`UPDATE m02_portfolio.portfolio SET status='retired'
            WHERE tenant_id=platform.current_tenant() AND id=$1 AND row_version=$2 AND status='active' RETURNING *`,
            [uuid(body.id, 'id'), version(body.expectedVersion)]);
          if (!updated.rowCount) throw new AppError(409, 'Stale, missing or already retired portfolio');
          return updated.rows[0];
        }
        case 'portfolio-parent': {
          const id = uuid(body.id, 'id'), parentId = optionalUuid(body.parentPortfolioId, 'parentPortfolioId');
          await client.query(`SELECT id FROM m02_portfolio.portfolio WHERE tenant_id=platform.current_tenant() ORDER BY id FOR UPDATE`);
          if (parentId === id) throw new AppError(400, 'Portfolio cannot parent itself');
          if (parentId) {
            const descendant = await client.query(`WITH RECURSIVE descendants AS (
              SELECT id FROM m02_portfolio.portfolio WHERE tenant_id=platform.current_tenant() AND id=$1
              UNION ALL SELECT child.id FROM m02_portfolio.portfolio child JOIN descendants d ON child.parent_portfolio_id=d.id
              WHERE child.tenant_id=platform.current_tenant()) SELECT 1 FROM descendants WHERE id=$2 LIMIT 1`, [id, parentId]);
            if (descendant.rowCount) throw new AppError(400, 'Portfolio hierarchy cycle rejected');
          }
          const updated = await client.query(`UPDATE m02_portfolio.portfolio SET parent_portfolio_id=$2
            WHERE tenant_id=platform.current_tenant() AND id=$1 AND row_version=$3 RETURNING *`, [id, parentId, version(body.expectedVersion)]);
          if (!updated.rowCount) throw new AppError(409, 'Stale portfolio version');
          return updated.rows[0];
        }
        case 'category':
          return one(client, `INSERT INTO m02_portfolio.investment_category
            (tenant_id,code,label) VALUES (platform.current_tenant(),$1,$2) RETURNING *`,
            [code(body.code), requiredText(body.label, 'label', 200)]);
        case 'category-update': {
          const updated = await client.query(`UPDATE m02_portfolio.investment_category SET label=$3
            WHERE tenant_id=platform.current_tenant() AND id=$1 AND row_version=$2 AND active RETURNING *`,
            [uuid(body.id, 'id'), version(body.expectedVersion), requiredText(body.label, 'label', 200)]);
          if (!updated.rowCount) throw new AppError(409, 'Stale, missing or retired category');
          return updated.rows[0];
        }
        case 'category-retire': {
          const updated = await client.query(`UPDATE m02_portfolio.investment_category SET active=false
            WHERE tenant_id=platform.current_tenant() AND id=$1 AND row_version=$2 AND active RETURNING *`,
            [uuid(body.id, 'id'), version(body.expectedVersion)]);
          if (!updated.rowCount) throw new AppError(409, 'Stale, missing or already retired category');
          return updated.rows[0];
        }
        case 'investment':
          return one(client, `INSERT INTO m05_investment.investment
            (tenant_id,category_id,code,title,sponsor_id,owner_id)
            VALUES (platform.current_tenant(),$1,$2,$3,platform.current_actor(),platform.current_actor()) RETURNING *`,
            [uuid(body.categoryId, 'categoryId'), code(body.code), requiredText(body.title, 'title', 200)]);
        case 'investment-update': {
          const updated = await client.query(`UPDATE m05_investment.investment SET title=$3,category_id=$4
            WHERE tenant_id=platform.current_tenant() AND id=$1 AND row_version=$2 AND lifecycle='candidate' RETURNING *`,
            [uuid(body.id, 'id'), version(body.expectedVersion), requiredText(body.title, 'title', 200), uuid(body.categoryId, 'categoryId')]);
          if (!updated.rowCount) throw new AppError(409, 'Stale, missing or no longer candidate investment');
          return updated.rows[0];
        }
        case 'investment-retire': {
          const updated = await client.query(`UPDATE m05_investment.investment SET lifecycle='cancelled'
            WHERE tenant_id=platform.current_tenant() AND id=$1 AND row_version=$2 AND lifecycle='candidate'
            AND NOT EXISTS (SELECT 1 FROM m02_portfolio.portfolio_membership pm
              WHERE pm.tenant_id=platform.current_tenant() AND pm.investment_id=$1) RETURNING *`,
            [uuid(body.id, 'id'), version(body.expectedVersion)]);
          if (!updated.rowCount) throw new AppError(409, 'Stale, governed or still assigned investment');
          return updated.rows[0];
        }
        case 'membership': {
          const [a, b] = interval(body.startDate, body.endDate);
          const weight = body.weight == null ? 1 : finiteNumber(body.weight, 'weight');
          if (weight <= 0 || weight > 1) throw new AppError(400, 'weight must be greater than 0 and at most 1');
          return one(client, `INSERT INTO m02_portfolio.portfolio_membership
            (tenant_id,portfolio_id,investment_id,membership_during,allocation_weight)
            VALUES (platform.current_tenant(),$1,$2,daterange($3::date,$4::date,'[)'),$5) RETURNING *`,
            [uuid(body.portfolioId, 'portfolioId'), uuid(body.investmentId, 'investmentId'), a, b, weight]);
        }
        case 'membership-update': {
          const [a, b] = interval(body.startDate, body.endDate);
          const weight = finiteNumber(body.weight, 'weight');
          if (weight <= 0 || weight > 1) throw new AppError(400, 'weight must be greater than 0 and at most 1');
          const updated = await client.query(`UPDATE m02_portfolio.portfolio_membership pm
            SET membership_during=daterange($3::date,$4::date,'[)'),allocation_weight=$5
            FROM m05_investment.investment i WHERE pm.tenant_id=platform.current_tenant() AND pm.id=$1
            AND pm.row_version=$2 AND i.tenant_id=pm.tenant_id AND i.id=pm.investment_id
            AND i.lifecycle='candidate' RETURNING pm.*`,
            [uuid(body.id, 'id'), version(body.expectedVersion), a, b, weight]);
          if (!updated.rowCount) throw new AppError(409, 'Stale, missing or governed portfolio assignment');
          return updated.rows[0];
        }
        case 'membership-remove': {
          const removed = await client.query(`DELETE FROM m02_portfolio.portfolio_membership pm
            USING m05_investment.investment i WHERE pm.tenant_id=platform.current_tenant() AND pm.id=$1
            AND pm.row_version=$2 AND i.tenant_id=pm.tenant_id AND i.id=pm.investment_id
            AND i.lifecycle='candidate' RETURNING pm.*`,
            [uuid(body.id, 'id'), version(body.expectedVersion)]);
          if (!removed.rowCount) throw new AppError(409, 'Stale, missing or governed portfolio assignment');
          return removed.rows[0];
        }
        case 'alignment':
          return one(client, `INSERT INTO m02_portfolio.portfolio_objective
            (tenant_id,portfolio_id,objective_id,contribution)
            VALUES (platform.current_tenant(),$1,$2,$3)
            ON CONFLICT (tenant_id,portfolio_id,objective_id) DO UPDATE SET contribution=EXCLUDED.contribution RETURNING *`,
            [uuid(body.portfolioId, 'portfolioId'), uuid(body.objectiveId, 'objectiveId'), requiredText(body.contribution, 'contribution')]);
        case 'alignment-remove': {
          const removed = await client.query(`DELETE FROM m02_portfolio.portfolio_objective
            WHERE tenant_id=platform.current_tenant() AND portfolio_id=$1 AND objective_id=$2 RETURNING *`,
            [uuid(body.portfolioId, 'portfolioId'), uuid(body.objectiveId, 'objectiveId')]);
          if (!removed.rowCount) throw new AppError(404, 'Alignment not found');
          return removed.rows[0];
        }
        default: throw new AppError(404, 'Unknown command');
      }
    }, { write: true, context });
  }

  const tables = {
    strategies: 'm01_strategy.strategy', objectives: 'm01_strategy.objective', outcomes: 'm01_strategy.outcome',
    measures: 'm01_strategy.measure', observations: 'm01_strategy.measure_observation',
    portfolios: 'm02_portfolio.portfolio', categories: 'm02_portfolio.investment_category',
    investments: 'm05_investment.investment', memberships: 'm02_portfolio.portfolio_membership',
    alignments: 'm02_portfolio.portfolio_objective'
  };
  const portfolioPredicate = {
    portfolios: 'id = ANY($1::uuid[])',
    memberships: 'portfolio_id = ANY($1::uuid[])',
    alignments: 'portfolio_id = ANY($1::uuid[])',
    investments: `EXISTS (SELECT 1 FROM m02_portfolio.portfolio_membership pm
      WHERE pm.tenant_id=platform.current_tenant() AND pm.investment_id=investment.id AND pm.portfolio_id = ANY($1::uuid[]))`
  };
  const strategyPredicate = {
    strategies: 'id = ANY($1::uuid[])',
    objectives: 'strategy_id = ANY($1::uuid[])',
    outcomes: 'EXISTS (SELECT 1 FROM m01_strategy.objective o WHERE o.tenant_id=platform.current_tenant() AND o.id=outcome.objective_id AND o.strategy_id=ANY($1::uuid[]))',
    measures: 'EXISTS (SELECT 1 FROM m01_strategy.outcome u JOIN m01_strategy.objective o ON o.tenant_id=u.tenant_id AND o.id=u.objective_id WHERE u.tenant_id=platform.current_tenant() AND u.id=measure.outcome_id AND o.strategy_id=ANY($1::uuid[]))',
    observations: 'EXISTS (SELECT 1 FROM m01_strategy.measure m JOIN m01_strategy.outcome u ON u.tenant_id=m.tenant_id AND u.id=m.outcome_id JOIN m01_strategy.objective o ON o.tenant_id=u.tenant_id AND o.id=u.objective_id WHERE m.tenant_id=platform.current_tenant() AND m.id=measure_observation.measure_id AND o.strategy_id=ANY($1::uuid[]))'
  };
  async function workspace(context, readKeys = null, portfolioIds = null, strategyIds = null) {
    return transaction(async client => {
      const data = {};
      for (const [key, table] of Object.entries(tables)) {
        if (readKeys !== null && !readKeys.includes(key)) { data[key] = []; continue; }
        if (portfolioIds !== null && key === 'categories') { data[key] = []; continue; }
        if (portfolioIds !== null && !portfolioPredicate[key] && ['portfolios', 'memberships', 'alignments', 'investments'].includes(key)) { data[key] = []; continue; }
        const isStrategy = strategyIds !== null && Object.hasOwn(strategyPredicate, key);
        const restricted = isStrategy ? strategyPredicate[key] : portfolioIds !== null ? portfolioPredicate[key] : null;
        const filterIds = isStrategy ? strategyIds : portfolioIds;
        const sql = restricted
          ? `SELECT * FROM ${table} WHERE tenant_id=platform.current_tenant() AND ${restricted} ORDER BY 1,2 LIMIT 500`
          : `SELECT * FROM ${table} WHERE tenant_id=platform.current_tenant() ORDER BY 1,2 LIMIT 500`;
        data[key] = (await client.query(sql, restricted ? [filterIds] : [])).rows;
      }
      return data;
    }, { context });
  }
  async function history(schema, table, id, context, readKeys = null, portfolioIds = null, strategyIds = null) {
    const full = `${schema}.${table}`;
    const key = Object.keys(tables).find(k => tables[k] === full);
    if (!key) throw new AppError(404, 'Unknown entity type');
    if (readKeys !== null && !readKeys.includes(key)) throw new AppError(404, 'Record not found');
    uuid(id, 'id');
    return transaction(async client => {
      const restricted = strategyIds !== null && Object.hasOwn(strategyPredicate,key) ? strategyPredicate[key] : portfolioIds !== null ? portfolioPredicate[key] : null;
      const scopeIds = strategyIds !== null && Object.hasOwn(strategyPredicate,key) ? strategyIds : portfolioIds;
      if ((strategyIds !== null && Object.hasOwn(strategyPredicate,key)) || (portfolioIds !== null && Object.hasOwn(portfolioPredicate,key))) {
        if (!restricted) throw new AppError(404, 'Record not found');
        const accessible = await client.query(`SELECT 1 FROM ${full} WHERE tenant_id=platform.current_tenant() AND id=$2 AND ${restricted} LIMIT 1`, [scopeIds, id]);
        if (!accessible.rowCount) throw new AppError(404, 'Record not found');
      }
      const revisions = (await client.query(`SELECT version_no,lower(recorded_during) AS recorded_at,valid_during,payload,operation,actor_id
        FROM platform.entity_revision WHERE tenant_id=platform.current_tenant() AND schema_name=$1 AND table_name=$2 AND entity_id=$3
        ORDER BY version_no`, [schema, table, id])).rows;
      const audit = (await client.query(`SELECT occurred_at,operation,actor_id,old_row,new_row FROM platform.audit_event
        WHERE tenant_id=platform.current_tenant() AND schema_name=$1 AND table_name=$2 AND entity_id=$3 ORDER BY occurred_at`, [schema, table, id])).rows;
      return { revisions, audit };
    }, { context });
  }
  async function scenarioRanking(context, scenarioId) {
    uuid(scenarioId,'scenarioId');
    return transaction(async client => {
      const scenario=await one(client,`SELECT * FROM m04_selection.scenario
        WHERE tenant_id=platform.current_tenant() AND id=$1`,[scenarioId]);
      if(scenario.owner_id!==context.actorId) throw new AppError(403,'Scenario owner required');
      const candidates=(await client.query(`SELECT id,aggregate_score FROM m04_selection.scenario_candidate
        WHERE tenant_id=platform.current_tenant() AND scenario_id=$1`,[scenarioId])).rows;
      return {scenarioId,scenarioStatus:scenario.status,
        candidates:rankScenarioCandidates(candidates.map(c=>({id:c.id,score:Number(c.aggregate_score)})),scenario.constraint_set)};
    },{context});
  }
  async function recordInvestmentDecision(body,context) {
    if(!body || typeof body!=='object'||Array.isArray(body)) throw new AppError(400,'Decision details required');
    const sessionId=uuid(body.sessionId,'sessionId');
    const decisionType=requiredText(body.decisionType,'decisionType',20);
    if(!['defer','reject'].includes(decisionType))
      throw new AppError(403,'Approval and effectuation require a separate governed command');
    const rationale=requiredText(body.rationale,'rationale',2000);
    return transaction(async client=>{
      const session=await one(client,`SELECT s.*,f.evidence_snapshot,b.chair_id FROM m06_governance.committee_session s
        JOIN m06_governance.committee_finalisation f ON f.tenant_id=s.tenant_id AND f.session_id=s.id
        JOIN m06_governance.decision_body b ON b.tenant_id=s.tenant_id AND b.id=s.decision_body_id
        WHERE s.tenant_id=platform.current_tenant() AND s.id=$1`,[sessionId]);
      if(session.evidence_snapshot?.summary?.quorumMet!==true) throw new AppError(409,'Finalised quorum required');
      const ballot=session.evidence_snapshot.summary;
      if(ballot.forVotes<=ballot.against) throw new AppError(409,'Recorded vote does not support a positive decision');
      const delegated=await client.query(`SELECT 1 FROM m06_governance.delegation
        WHERE tenant_id=platform.current_tenant() AND decision_body_id=$1 AND delegate_id=platform.current_actor()
        AND scope_code IN ('investment','all') AND effective_during @> $2::timestamptz`,
        [session.decision_body_id,session.held_at]);
      if(session.chair_id!==context.actorId && !delegated.rowCount) throw new AppError(403,'Effective investment decision authority required');
      const investment=await one(client,`SELECT * FROM m05_investment.investment
        WHERE tenant_id=platform.current_tenant() AND id=$1 FOR UPDATE`,[session.investment_id]);
      if([investment.owner_id,investment.sponsor_id].includes(context.actorId))
        throw new AppError(403,'Decision maker cannot be investment owner or sponsor');
      if(investment.lifecycle!=='candidate') throw new AppError(409,'Candidate investment required');
      const decision=await one(client,`INSERT INTO m05_investment.investment_decision
        (tenant_id,decision_body_id,decided_by,investment_id,subject_type,subject_id,decision_type,
        rationale,decided_at,effective_on)
        VALUES(platform.current_tenant(),$1,platform.current_actor(),$2,'investment',$2,$3,$4,
        transaction_timestamp(),CURRENT_DATE) RETURNING *`,
        [session.decision_body_id,investment.id,decisionType,rationale]);
      await client.query(`INSERT INTO m05_investment.committee_decision_evidence
        (tenant_id,session_id,decision_id) VALUES(platform.current_tenant(),$1,$2)`,
        [sessionId,decision.id]);
      return {decision,investmentLifecycle:investment.lifecycle,effectuated:false};
    },{write:true,context});
  }
  async function committeeDecisionReadiness(context, sessionId) {
    uuid(sessionId,'sessionId');
    return transaction(async client => {
      const result=await one(client,`SELECT s.id,s.investment_id,s.decision_body_id,
        f.evidence_snapshot,f.finalised_at,b.chair_id
        FROM m06_governance.committee_session s
        JOIN m06_governance.committee_finalisation f ON f.tenant_id=s.tenant_id AND f.session_id=s.id
        JOIN m06_governance.decision_body b ON b.tenant_id=s.tenant_id AND b.id=s.decision_body_id
        WHERE s.tenant_id=platform.current_tenant() AND s.id=$1`,[sessionId]);
      if(result.chair_id!==context.actorId) throw new AppError(403,'Committee chair required');
      if(result.evidence_snapshot?.summary?.quorumMet!==true) throw new AppError(409,'Quorum evidence required');
      const existing=(await client.query(`SELECT id FROM m05_investment.investment_decision
        WHERE tenant_id=platform.current_tenant() AND investment_id=$1 AND decision_body_id=$2 LIMIT 1`,
        [result.investment_id,result.decision_body_id])).rows;
      return {sessionId,investmentId:result.investment_id,decisionBodyId:result.decision_body_id,
        finalisedAt:result.finalised_at,quorumVerified:true,
        priorDecisionExists:existing.length>0,approvalGranted:false,
        status:'evidence_ready_only'};
    },{context});
  }
  async function recordCommitteeSession(body, context) {
    if (!body || typeof body!=='object' || !Array.isArray(body.participants)) throw new AppError(400,'Participant evidence required');
    const investmentId=uuid(body.investmentId,'investmentId'), decisionBodyId=uuid(body.decisionBodyId,'decisionBodyId');
    const heldAt=body.heldAt;
    if(typeof heldAt!=='string'||Number.isNaN(Date.parse(heldAt))) throw new AppError(400,'Valid meeting timestamp required');
    const required=body.quorumRequired;
    if(!Number.isInteger(required)||required<1||required>100) throw new AppError(400,'Valid quorum required');
    if(!body.participants.length) throw new AppError(400,'Meeting participants required');
    return transaction(async client => {
      const bodyRow=await one(client,`SELECT chair_id FROM m06_governance.decision_body WHERE tenant_id=platform.current_tenant() AND id=$1`,[decisionBodyId]);
      if(bodyRow.chair_id!==context.actorId) throw new AppError(403,'Decision body chair required');
      await one(client,`SELECT id FROM m05_investment.investment WHERE tenant_id=platform.current_tenant() AND id=$1`,[investmentId]);
      const delegates=(await client.query(`SELECT DISTINCT delegate_id FROM m06_governance.delegation
        WHERE tenant_id=platform.current_tenant() AND decision_body_id=$1
        AND effective_during @> $2::timestamptz`,[decisionBodyId,heldAt])).rows.map(r=>r.delegate_id);
      const participants=body.participants.map(p=>({
        principalId:uuid(p.principalId,'principalId'),attended:p.attended===true,
        conflictDeclared:p.conflictDeclared===true,recused:p.recused===true,vote:p.vote??null,
        evidenceNote:p.evidenceNote??null
      }));
      for(const p of participants) {
        if(p.conflictDeclared && (typeof p.evidenceNote!=='string'||!p.evidenceNote.trim()))
          throw new AppError(400,'Conflict evidence note required');
      }
      let summary;
      try {summary=evaluateCommitteeQuorum({required,participants,eligiblePrincipalIds:delegates});}
      catch(e){throw new AppError(400,e.message);}
      if(!summary.quorumMet) throw new AppError(409,'Committee quorum not met');
      const session=await one(client,`INSERT INTO m06_governance.committee_session
        (tenant_id,decision_body_id,investment_id,held_at,quorum_required,recorded_by)
        VALUES(platform.current_tenant(),$1,$2,$3,$4,platform.current_actor()) RETURNING *`,
        [decisionBodyId,investmentId,heldAt,required]);
      for(const p of participants) await client.query(`INSERT INTO m06_governance.committee_participant
        (tenant_id,session_id,principal_id,attended,conflict_declared,recused,vote,evidence_note)
        VALUES(platform.current_tenant(),$1,$2,$3,$4,$5,$6,$7)`,
        [session.id,p.principalId,p.attended,p.conflictDeclared,p.recused,p.vote,p.evidenceNote]);
      const finalisation=await one(client,`INSERT INTO m06_governance.committee_finalisation
        (tenant_id,session_id,finalised_by,quorum_met,evidence_snapshot)
        VALUES(platform.current_tenant(),$1,platform.current_actor(),true,$2::jsonb) RETURNING *`,
        [session.id,JSON.stringify({delegates,participants,summary,heldAt,decisionBodyId,investmentId})]);
      return {session,finalisation,summary};
    },{write:true,context});
  }
  async function committeeSessionEvaluation(context, sessionId) {
    uuid(sessionId,'sessionId');
    return transaction(async client => {
      const session=await one(client,`SELECT * FROM m06_governance.committee_session
        WHERE tenant_id=platform.current_tenant() AND id=$1`,[sessionId]);
      const chair=await one(client,`SELECT chair_id FROM m06_governance.decision_body
        WHERE tenant_id=platform.current_tenant() AND id=$1`,[session.decision_body_id]);
      if(chair.chair_id!==context.actorId && session.recorded_by!==context.actorId)
        throw new AppError(403,'Session chair or recorder required');
      const participants=(await client.query(`SELECT principal_id,attended,conflict_declared,recused,vote
        FROM m06_governance.committee_participant WHERE tenant_id=platform.current_tenant()
        AND session_id=$1`,[sessionId])).rows;
      const delegates=(await client.query(`SELECT DISTINCT delegate_id FROM m06_governance.delegation
        WHERE tenant_id=platform.current_tenant() AND decision_body_id=$1
        AND effective_during @> $2::timestamptz`,[session.decision_body_id,session.held_at])).rows;
      const eligiblePrincipalIds=delegates.map(r=>r.delegate_id);
      const summary=evaluateCommitteeQuorum({required:session.quorum_required,
        participants:participants.map(p=>({principalId:p.principal_id,attended:p.attended,
          conflictDeclared:p.conflict_declared,recused:p.recused,vote:p.vote})),eligiblePrincipalIds});
      return {sessionId,decisionBodyId:session.decision_body_id,investmentId:session.investment_id,
        heldAt:session.held_at,summary};
    },{context});
  }
  async function scenarioOverride(action, body, context) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError(400,'JSON object required');
    return transaction(async client => {
      if (action==='request') {
        const scenarioId=uuid(body.scenarioId,'scenarioId'),assessmentId=uuid(body.assessmentId,'assessmentId');
        const scenario=await one(client,`SELECT * FROM m04_selection.scenario
          WHERE tenant_id=platform.current_tenant() AND id=$1`,[scenarioId]);
        if(scenario.owner_id!==context.actorId) throw new AppError(403,'Scenario owner required');
        if(scenario.status!=='draft') throw new AppError(409,'Scenario already locked');
        const assessment=await one(client,`SELECT * FROM m04_selection.assessment
          WHERE tenant_id=platform.current_tenant() AND id=$1`,[assessmentId]);
        if(assessment.status!=='completed'||assessment.scoring_model_id!==scenario.scoring_model_id)
          throw new AppError(409,'Completed compatible assessment required');
        const evidence=requiredText(body.justification,'justification',2000);
        if(evidence.length<20) throw new AppError(400,'Detailed justification required');
        return one(client,`INSERT INTO m04_selection.scenario_override
          (tenant_id,scenario_id,assessment_id,requested_by,justification)
          VALUES(platform.current_tenant(),$1,$2,platform.current_actor(),$3) RETURNING *`,
          [scenarioId,assessmentId,evidence]);
      }
      if(action==='decide') {
        const id=uuid(body.id,'id');
        const request=await one(client,`SELECT * FROM m04_selection.scenario_override
          WHERE tenant_id=platform.current_tenant() AND id=$1 FOR UPDATE`,[id]);
        if(request.requested_by===context.actorId) throw new AppError(403,'Independent override decider required');
        const mandate=await client.query(`SELECT 1 FROM m04_selection.override_mandate WHERE tenant_id=platform.current_tenant()
          AND principal_id=platform.current_actor() AND effective_during @> transaction_timestamp()
          AND (revoked_at IS NULL OR revoked_at>transaction_timestamp()) LIMIT 1`);
        if(!mandate.rowCount) throw new AppError(403,'Effective override mandate required');
        if(request.decision!=='pending') throw new AppError(409,'Override already decided');
        const decision=requiredText(body.decision,'decision',20);
        if(!['approved','rejected'].includes(decision)) throw new AppError(400,'Unsupported override decision');
        const reason=requiredText(body.reason,'reason',2000);
        if(reason.length<20) throw new AppError(400,'Detailed decision reason required');
        return one(client,`UPDATE m04_selection.scenario_override SET decision=$2,
          decision_reason=$3,decided_by=platform.current_actor(),decided_at=transaction_timestamp()
          WHERE tenant_id=platform.current_tenant() AND id=$1 RETURNING *`,[id,decision,reason]);
      }
      throw new AppError(404,'Unknown override action');
    },{write:true,context});
  }
  async function recommendation(action, body, context) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError(400,'JSON object required');
    return transaction(async client => {
      if(action==='create-scenario') {
        const modelId=uuid(body.scoringModelId,'scoringModelId');
        await one(client,`SELECT id FROM m04_selection.scoring_model WHERE tenant_id=platform.current_tenant()
          AND id=$1 AND status='active'`,[modelId],'Active scoring model required');
        let constraints;
        try {constraints=validateScenarioConstraints(body.constraints || {});} catch(e){throw new AppError(400,e.message);}
        return one(client,`INSERT INTO m04_selection.scenario
          (tenant_id,code,name,scoring_model_id,owner_id,constraint_set)
          VALUES(platform.current_tenant(),$1,$2,$3,platform.current_actor(),$4::jsonb) RETURNING *`,
          [code(body.code),requiredText(body.name,'name',200),modelId,JSON.stringify(constraints)]);
      }
      if(action==='recommend') {
        const scenarioId=uuid(body.scenarioId,'scenarioId'), assessmentId=uuid(body.assessmentId,'assessmentId');
        const scenario=await one(client,`SELECT * FROM m04_selection.scenario
          WHERE tenant_id=platform.current_tenant() AND id=$1 FOR UPDATE`,[scenarioId]);
        if(scenario.owner_id!==context.actorId) throw new AppError(403,'Scenario owner required');
        if(scenario.status!=='draft') throw new AppError(409,'Scenario is locked');
        const assessment=await one(client,`SELECT * FROM m04_selection.assessment
          WHERE tenant_id=platform.current_tenant() AND id=$1`,[assessmentId]);
        if(assessment.status!=='completed'||assessment.scoring_model_id!==scenario.scoring_model_id)
          throw new AppError(409,'Completed compatible assessment required');
        const outcome=requiredText(body.outcome,'outcome',10);
        if(!['select','defer','reject'].includes(outcome)) throw new AppError(400,'Unsupported recommendation');
        const aggregate=await client.query(`SELECT round(sum(cs.score/c.maximum_score*c.weight*100)::numeric,4) AS total,
          count(*)::int AS scored FROM m04_selection.criterion_score cs
          JOIN m04_selection.criterion c ON c.tenant_id=cs.tenant_id AND c.id=cs.criterion_id
          WHERE cs.tenant_id=platform.current_tenant() AND cs.assessment_id=$1`,[assessmentId]);
        if(!aggregate.rows[0].scored) throw new AppError(409,'Assessment has no scores');
        let constraintEvaluation;
        try { constraintEvaluation=evaluateScenarioConstraint(scenario.constraint_set,Number(aggregate.rows[0].total),outcome,body.overrideReason); }
        catch(e){throw new AppError(409,e.message);}
        if(constraintEvaluation.exception) {
          const approval=await client.query(`SELECT 1 FROM m04_selection.scenario_override WHERE tenant_id=platform.current_tenant() AND scenario_id=$1 AND assessment_id=$2 AND decision='approved'`,[scenarioId,assessmentId]);
          if(!approval.rowCount) throw new AppError(403,'Independent approved override required');
        }
        const rationale=requiredText(body.rationale,'rationale',2000)+(constraintEvaluation.exception ? '\nOverride: '+constraintEvaluation.reason : '');
        const inclusion={select:'selected',defer:'considered',reject:'excluded'}[outcome];
        const candidate=await one(client,`INSERT INTO m04_selection.scenario_candidate
          (tenant_id,scenario_id,demand_id,assessment_id,aggregate_score,inclusion)
          VALUES(platform.current_tenant(),$1,$2,$3,$4,$5)
          ON CONFLICT(tenant_id,scenario_id,demand_id) DO UPDATE
          SET assessment_id=EXCLUDED.assessment_id,aggregate_score=EXCLUDED.aggregate_score,
              inclusion=EXCLUDED.inclusion RETURNING *`,
          [scenarioId,assessment.demand_id,assessmentId,aggregate.rows[0].total,inclusion]);
        await client.query(`UPDATE m04_selection.scenario SET status='locked'
          WHERE tenant_id=platform.current_tenant() AND id=$1`,[scenarioId]);
        const result=await one(client,`INSERT INTO m04_selection.selection_recommendation
          (tenant_id,scenario_id,demand_id,recommendation,rationale,proposed_by)
          VALUES(platform.current_tenant(),$1,$2,$3,$4,platform.current_actor()) RETURNING *`,
          [scenarioId,assessment.demand_id,outcome,rationale]);
        return {candidate,recommendation:result};
      }
      throw new AppError(404,'Unknown recommendation action');
    },{write:true,context});
  }
  async function assessmentResults(context, id) {
    uuid(id,'id');
    return transaction(async client => {
      const assessment=await one(client,`SELECT * FROM m04_selection.assessment
        WHERE tenant_id=platform.current_tenant() AND id=$1`,[id]);
      if(assessment.assessor_id!==context.actorId) throw new AppError(403,'Assessment owner required');
      const scores=(await client.query(`SELECT c.id AS criterion_id,c.name,c.weight,c.maximum_score,
        cs.score,cs.evidence,
        CASE WHEN cs.id IS NULL THEN NULL ELSE
          round((cs.score/c.maximum_score*c.weight*100)::numeric,4) END AS weighted_points
        FROM m04_selection.criterion c LEFT JOIN m04_selection.criterion_score cs
          ON cs.tenant_id=c.tenant_id AND cs.criterion_id=c.id AND cs.assessment_id=$2
        WHERE c.tenant_id=platform.current_tenant() AND c.scoring_model_id=$1 ORDER BY c.code`,
        [assessment.scoring_model_id,id])).rows;
      const total=scores.every(r=>r.score!==null)
        ? scores.reduce((sum,r)=>sum+Number(r.weighted_points),0) : null;
      return {assessment,criteria:scores,weightedTotal:total===null?null:Number(total.toFixed(4)),
        totalWeight:scores.reduce((sum,r)=>sum+Number(r.weight),0),complete:scores.length>0&&scores.every(r=>r.score!==null)};
    },{context});
  }
  async function assessment(action, body, context) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError(400,'JSON object required');
    return transaction(async client => {
      if (action === 'create') {
        const demandId=uuid(body.demandId,'demandId'), modelId=uuid(body.scoringModelId,'scoringModelId');
        const demand=await one(client,`SELECT status,submitted_by FROM m03_demand.demand
          WHERE tenant_id=platform.current_tenant() AND id=$1`,[demandId]);
        if(!['triage','assessed','accepted'].includes(demand.status)) throw new AppError(409,'Demand not assessment eligible');
        if(demand.submitted_by===context.actorId) throw new AppError(403,'Independent assessor required');
        await one(client,`SELECT id FROM m04_selection.scoring_model
          WHERE tenant_id=platform.current_tenant() AND id=$1 AND status='active'
            AND effective_during @> CURRENT_DATE`,[modelId],'Active scoring model required');
        const basis=await one(client,`SELECT cr.id FROM m03_demand.case_revision cr
          JOIN m03_demand.business_case bc ON bc.tenant_id=cr.tenant_id AND bc.id=cr.business_case_id
          WHERE bc.tenant_id=platform.current_tenant() AND bc.demand_id=$1
          ORDER BY cr.revision_no DESC LIMIT 1`,[demandId],'Submitted case revision required');
        return one(client,`INSERT INTO m04_selection.assessment
          (tenant_id,demand_id,scoring_model_id,assessor_id,case_revision_id)
          VALUES(platform.current_tenant(),$1,$2,platform.current_actor(),$3) RETURNING *`,[demandId,modelId,basis.id]);
      }
      const id=uuid(body.id,'id'), expected=version(body.expectedVersion);
      const current=await one(client,`SELECT * FROM m04_selection.assessment
        WHERE tenant_id=platform.current_tenant() AND id=$1 FOR UPDATE`,[id]);
      if(current.assessor_id!==context.actorId) throw new AppError(403,'Assessment owner required');
      if(current.status!=='draft'||current.row_version!==expected) throw new AppError(409,'Assessment closed or stale');
      if(action==='score') {
        const criterionId=uuid(body.criterionId,'criterionId');
        const criterion=await one(client,`SELECT maximum_score FROM m04_selection.criterion
          WHERE tenant_id=platform.current_tenant() AND scoring_model_id=$1 AND id=$2`,
          [current.scoring_model_id,criterionId]);
        const score=finiteNumber(body.score,'score');
        if(score<0||score>Number(criterion.maximum_score)) throw new AppError(400,'Score outside criterion range');
        const saved=await one(client,`INSERT INTO m04_selection.criterion_score
          (tenant_id,assessment_id,scoring_model_id,criterion_id,score,evidence)
          VALUES(platform.current_tenant(),$1,$2,$3,$4,$5)
          ON CONFLICT(tenant_id,assessment_id,criterion_id) DO UPDATE
          SET score=EXCLUDED.score,evidence=EXCLUDED.evidence RETURNING *`,
          [id,current.scoring_model_id,criterionId,score,requiredText(body.evidence,'evidence',2000)]);
        const assessment=await one(client,`UPDATE m04_selection.assessment SET rationale=COALESCE(rationale,'Scoring in progress')
          WHERE tenant_id=platform.current_tenant() AND id=$1 RETURNING *`,[id]);
        return {assessment,score:saved};
      }
      if(action==='complete') {
        const coverage=await client.query(`SELECT
          (SELECT count(*)::int FROM m04_selection.criterion WHERE tenant_id=platform.current_tenant() AND scoring_model_id=$1) AS total,
          (SELECT count(*)::int FROM m04_selection.criterion_score WHERE tenant_id=platform.current_tenant() AND assessment_id=$2) AS scored`,
          [current.scoring_model_id,id]);
        const {total,scored}=coverage.rows[0];
        if(!total||total!==scored) throw new AppError(409,'Every scoring criterion requires evidence');
        return one(client,`UPDATE m04_selection.assessment SET status='completed',
          completed_at=transaction_timestamp(),rationale=$2
          WHERE tenant_id=platform.current_tenant() AND id=$1 RETURNING *`,
          [id,requiredText(body.rationale,'rationale',2000)]);
      }
      throw new AppError(404,'Unknown assessment action');
    },{write:true,context});
  }
  async function proposalList(context, reviewer = false) {
    return transaction(async client => {
      const rows = await client.query(`SELECT d.id,d.code,d.title,d.description,d.status,d.row_version,
        d.submitted_at,d.submitted_by,
        (SELECT max(cr.revision_no) FROM m03_demand.business_case bc
         JOIN m03_demand.case_revision cr ON cr.tenant_id=bc.tenant_id AND cr.business_case_id=bc.id
         WHERE bc.tenant_id=d.tenant_id AND bc.demand_id=d.id) AS latest_revision,
        (SELECT ir.feedback FROM m03_demand.intake_review ir
         WHERE ir.tenant_id=d.tenant_id AND ir.demand_id=d.id
         ORDER BY ir.reviewed_at DESC LIMIT 1) AS latest_feedback
        FROM m03_demand.demand d WHERE d.tenant_id=platform.current_tenant()
        AND (CASE WHEN $1::boolean THEN d.status IN ('submitted','triage') AND d.submitted_by<>platform.current_actor()
                  ELSE d.submitted_by=platform.current_actor() END)
        ORDER BY d.created_at DESC LIMIT 200`,[reviewer]);
      return rows.rows;
    },{context});
  }
  async function proposal(action, body, context) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError(400,'JSON object required');
    return transaction(async client => {
      if (action === 'create') {
        return one(client,`INSERT INTO m03_demand.demand
          (tenant_id,code,title,description,sponsor_id,submitted_by)
          VALUES(platform.current_tenant(),$1,$2,$3,platform.current_actor(),platform.current_actor()) RETURNING *`,
          [code(body.code),requiredText(body.title,'title',200),optionalText(body.description,'description')]);
      }
      const id=uuid(body.id,'id');
      const current=await one(client,`SELECT * FROM m03_demand.demand
        WHERE tenant_id=platform.current_tenant() AND id=$1 FOR UPDATE`,[id]);
      if(!['review','accept'].includes(action) && current.submitted_by !== context.actorId) throw new AppError(403,'Proposal owner required');
      if(current.row_version !== version(body.expectedVersion)) throw new AppError(409,'Stale proposal');
      if(action === 'edit') {
        if(current.status !== 'draft') throw new AppError(409,'Only draft proposals can be edited');
        return one(client,`UPDATE m03_demand.demand SET title=$2,description=$3
          WHERE tenant_id=platform.current_tenant() AND id=$1 RETURNING *`,
          [id,requiredText(body.title,'title',200),optionalText(body.description,'description')]);
      }
      if(action === 'submit') {
        if(current.status !== 'draft') throw new AppError(409,'Proposal is not in draft');
        const summary=requiredText(body.summary,'summary',4000);
        if(!Array.isArray(body.options)||!Array.isArray(body.assumptions))
          throw new AppError(400,'Options and assumptions must be arrays');
        const businessCase=await client.query(`INSERT INTO m03_demand.business_case
          (tenant_id,demand_id,owner_id,title) VALUES(platform.current_tenant(),$1,platform.current_actor(),$2)
          ON CONFLICT(tenant_id,demand_id) DO UPDATE SET title=EXCLUDED.title RETURNING id`,
          [id,current.title]);
        const caseId=businessCase.rows[0].id;
        const revision=await one(client,`INSERT INTO m03_demand.case_revision
          (tenant_id,business_case_id,revision_no,summary,options,assumptions,prepared_by)
          SELECT platform.current_tenant(),$1,COALESCE(MAX(revision_no),0)+1,$2,$3::jsonb,$4::jsonb,platform.current_actor()
          FROM m03_demand.case_revision WHERE tenant_id=platform.current_tenant() AND business_case_id=$1 RETURNING *`,
          [caseId,summary,JSON.stringify(body.options),JSON.stringify(body.assumptions)]);
        const updated=await one(client,`UPDATE m03_demand.demand SET status='submitted',
          submitted_at=COALESCE(submitted_at,transaction_timestamp())
          WHERE tenant_id=platform.current_tenant() AND id=$1 RETURNING *`,[id]);
        if (body.reviewerId != null) {
          const reviewerId=uuid(body.reviewerId,'reviewerId');
          if (reviewerId===context.actorId) throw new AppError(403,'Independent reviewer required');
          await one(client,`INSERT INTO platform.work_item
            (tenant_id,object_type,object_id,title,assignee_id,created_by,workflow_kind,case_revision_id)
            VALUES(platform.current_tenant(),'demand',$1,$2,$3,platform.current_actor(),'proposal_review',$4) RETURNING *`,
            [id,'Review proposal: '+current.title,reviewerId,revision.id]);
        }
        await client.query(`UPDATE platform.work_item SET state='completed',completed_at=transaction_timestamp(),
          completion_note='Proposal resubmitted' WHERE tenant_id=platform.current_tenant()
          AND object_type='demand' AND object_id=$1 AND workflow_kind='proposal_correction' AND state='open'
          AND assignee_id=platform.current_actor()`,[id]);
        return {proposal:updated,revision};
      }
      if(action === 'accept') {
        if (current.submitted_by === context.actorId) throw new AppError(403,'Independent intake acceptance required');
        if (current.status !== 'triage') throw new AppError(409,'Demand must complete triage first');
        const updated=await one(client,`UPDATE m03_demand.demand SET status='accepted'
          WHERE tenant_id=platform.current_tenant() AND id=$1 RETURNING *`,[id]);
        return {proposal:updated};
      }
      if(action === 'promote') {
        if(current.status !== 'accepted') throw new AppError(409,'Only accepted demand can be promoted');
        const existing=await client.query(`SELECT id FROM m05_investment.investment
          WHERE tenant_id=platform.current_tenant() AND origin_demand_id=$1`,[id]);
        if(existing.rowCount) throw new AppError(409,'Demand already promoted');
        const investment=await one(client,`INSERT INTO m05_investment.investment
          (tenant_id,origin_demand_id,category_id,code,title,sponsor_id,owner_id)
          VALUES(platform.current_tenant(),$1,$2,$3,$4,$5,platform.current_actor()) RETURNING *`,
          [id,uuid(body.categoryId,'categoryId'),code(body.code),current.title,current.sponsor_id]);
        return {proposal:current,investment};
      }
      if(action === 'review') {
        if(current.submitted_by === context.actorId) throw new AppError(403,'Independent reviewer required');
        if(current.status !== 'submitted') throw new AppError(409,'Proposal not awaiting review');
        const outcome=requiredText(body.outcome,'outcome',40);
        if(!['return_for_correction','accept_for_assessment'].includes(outcome)) throw new AppError(400,'Invalid review outcome');
        const revision=await one(client,`SELECT cr.id FROM m03_demand.case_revision cr
          JOIN m03_demand.business_case bc ON bc.tenant_id=cr.tenant_id AND bc.id=cr.business_case_id
          WHERE bc.tenant_id=platform.current_tenant() AND bc.demand_id=$1 ORDER BY cr.revision_no DESC LIMIT 1`,[id]);
        const evidence=await one(client,`INSERT INTO m03_demand.intake_review
          (tenant_id,demand_id,case_revision_id,reviewer_id,outcome,feedback)
          VALUES(platform.current_tenant(),$1,$2,platform.current_actor(),$3,$4) RETURNING *`,
          [id,revision.id,outcome,requiredText(body.feedback,'feedback',2000)]);
        const assignedReview=await client.query(`SELECT assignee_id FROM platform.work_item WHERE tenant_id=platform.current_tenant() AND workflow_kind='proposal_review' AND case_revision_id=$1 AND state='open'`,[revision.id]);
        if (assignedReview.rowCount && assignedReview.rows[0].assignee_id!==context.actorId) throw new AppError(403,'Review assigned to another reviewer');
        const pending=await client.query(`UPDATE platform.work_item SET state='completed',
          completed_at=transaction_timestamp(),completion_note='Intake review recorded'
          WHERE tenant_id=platform.current_tenant() AND workflow_kind='proposal_review'
            AND case_revision_id=$1 AND assignee_id=platform.current_actor() AND state='open'
          RETURNING id`,[revision.id]);
        if (body.requireAssignedTask===true && !pending.rowCount) throw new AppError(403,'Assigned review task required');
        if(outcome==='return_for_correction') {
          await one(client,`INSERT INTO platform.work_item
            (tenant_id,object_type,object_id,title,assignee_id,created_by,workflow_kind)
            VALUES(platform.current_tenant(),'demand',$1,$2,$3,platform.current_actor(),'proposal_correction')
            RETURNING *`,[id,'Correct proposal: '+current.title,current.submitted_by]);
        }
        const next=outcome==='return_for_correction'?'draft':'triage';
        const updated=await one(client,`UPDATE m03_demand.demand SET status=$2
          WHERE tenant_id=platform.current_tenant() AND id=$1 RETURNING *`,[id,next]);
        return {proposal:updated,review:evidence};
      }
      throw new AppError(404,'Unknown proposal action');
    },{write:true,context});
  }
  async function workItem(action, body, context, portfolioIds = null, strategyIds = null) {
    return transaction(async client => {
      if (action === 'created') return (await client.query(`SELECT * FROM platform.work_item WHERE tenant_id=platform.current_tenant() AND created_by=platform.current_actor() AND state='open' AND ($1::uuid[] IS NULL OR object_type <> 'portfolio' OR object_id=ANY($1::uuid[])) AND ($2::uuid[] IS NULL OR object_type <> 'strategy' OR object_id=ANY($2::uuid[])) ORDER BY created_at DESC LIMIT 200`,[portfolioIds,strategyIds])).rows;
      if (action === 'inbox') return (await client.query(`SELECT * FROM platform.work_item
        WHERE tenant_id=platform.current_tenant() AND assignee_id=platform.current_actor()
          AND ($1::uuid[] IS NULL OR object_type <> 'portfolio' OR object_id = ANY($1::uuid[]))
          AND ($2::uuid[] IS NULL OR object_type <> 'strategy' OR object_id = ANY($2::uuid[]))
          AND ($1::uuid[] IS NULL OR object_type <> 'demand')
        ORDER BY due_on NULLS LAST, created_at DESC LIMIT 200`, [portfolioIds,strategyIds])).rows;
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError(400,'JSON object required');
      if (action === 'create') {
        const type = requiredText(body.objectType,'objectType',20);
        if (!['portfolio','strategy'].includes(type)) throw new AppError(400,'Unsupported work item target');
        const target = uuid(body.objectId,'objectId');
        const table = type === 'strategy' ? 'm01_strategy.strategy' : 'm02_portfolio.portfolio';
        const found = await client.query(`SELECT 1 FROM ${table} WHERE tenant_id=platform.current_tenant() AND id=$1`,[target]);
        if (!found.rowCount) throw new AppError(404,'Work item target not found');
        const scope = type === 'strategy' ? strategyIds : portfolioIds;
        if (scope !== null && !scope.includes(target)) throw new AppError(403,'Work item target scope denied');
        return one(client,`INSERT INTO platform.work_item
          (tenant_id,object_type,object_id,title,assignee_id,created_by,due_on)
          VALUES(platform.current_tenant(),$1,$2,$3,$4,platform.current_actor(),$5) RETURNING *`,
          [type,target,requiredText(body.title,'title',200),uuid(body.assigneeId,'assigneeId'),
            optionalDate(body.dueOn,'dueOn')]);
      }
      const id = uuid(body.id,'id');
      const expected = version(body.expectedVersion);
      const row = await one(client,`SELECT * FROM platform.work_item WHERE tenant_id=platform.current_tenant() AND id=$1 FOR UPDATE`,[id]);
      const scope = row.object_type === 'strategy' ? strategyIds : portfolioIds;
      if (scope !== null && !scope.includes(row.object_id)) throw new AppError(404,'Work item not found');
      if (row.workflow_kind !== 'manual') throw new AppError(403,'Workflow task requires originating domain transition');
      if (row.state !== 'open' || row.row_version !== expected) throw new AppError(409,'Work item closed or stale');
      if (action === 'reassign') {
        if (row.created_by !== context.actorId) throw new AppError(403,'Only creator may reassign');
        return one(client,`UPDATE platform.work_item SET assignee_id=$2 WHERE tenant_id=platform.current_tenant() AND id=$1 RETURNING *`,
          [id,uuid(body.assigneeId,'assigneeId')]);
      }
      if (action === 'complete') {
        if (row.assignee_id !== context.actorId) throw new AppError(403,'Only assignee may complete');
        return one(client,`UPDATE platform.work_item SET state='completed',completed_at=transaction_timestamp(),
          completion_note=$2 WHERE tenant_id=platform.current_tenant() AND id=$1 RETURNING *`,
          [id,requiredText(body.note,'note',2000)]);
      }
      throw new AppError(404,'Unknown work item action');
    },{write:!['inbox','created'].includes(action),context});
  }
  async function assignedScopes(context) {
    return transaction(async client => {
      const rows = (await client.query(`SELECT object_type,object_id FROM platform.object_access_assignment
        WHERE tenant_id=platform.current_tenant() AND principal_id=platform.current_actor()
          AND effective_during @> transaction_timestamp()
          AND (revoked_at IS NULL OR revoked_at > transaction_timestamp())`)).rows;
      return {
        portfolioIds: rows.filter(r => r.object_type === 'portfolio').map(r => r.object_id),
        strategyIds: rows.filter(r => r.object_type === 'strategy').map(r => r.object_id)
      };
    }, { context });
  }
  return { command, workspace, history, assignedScopes, workItem, proposal, proposalList, assessment, assessmentResults, recommendation, scenarioRanking, scenarioOverride, committeeSessionEvaluation, recordCommitteeSession, committeeDecisionReadiness, recordInvestmentDecision, close: () => pool.end() };
}

export function httpError(error) {
  if (error instanceof AppError) return { status: error.status, message: error.message };
  if (error.code === '23505' || error.code === '23P01') return { status: 409, message: 'Duplicate code or overlapping period' };
  if (error.code === '23503') return { status: 400, message: 'Referenced record is missing or belongs to another tenant' };
  if (error.code === '23514' || error.code === '23502' || error.code === '22P02') return { status: 400, message: 'Invalid field or relationship' };
  if (error.code === '42501') return { status: 403, message: 'Database permission denied' };
  return { status: 500, message: 'Internal error' };
}
