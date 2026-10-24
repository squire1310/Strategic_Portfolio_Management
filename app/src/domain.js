import pg from 'pg';
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

  async function command(name, body, context) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError(400, 'JSON object required');
    return transaction(async client => {
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
  async function workspace(context) {
    return transaction(async client => {
      const data = {};
      for (const [key, table] of Object.entries(tables)) {
        data[key] = (await client.query(`SELECT * FROM ${table} WHERE tenant_id=platform.current_tenant() ORDER BY 1,2 LIMIT 500`)).rows;
      }
      return data;
    }, { context });
  }
  async function history(schema, table, id, context) {
    const full = `${schema}.${table}`;
    if (!Object.values(tables).includes(full)) throw new AppError(404, 'Unknown entity type');
    uuid(id, 'id');
    return transaction(async client => {
      const revisions = (await client.query(`SELECT version_no,lower(recorded_during) AS recorded_at,valid_during,payload,operation,actor_id
        FROM platform.entity_revision WHERE tenant_id=platform.current_tenant() AND schema_name=$1 AND table_name=$2 AND entity_id=$3
        ORDER BY version_no`, [schema, table, id])).rows;
      const audit = (await client.query(`SELECT occurred_at,operation,actor_id,old_row,new_row FROM platform.audit_event
        WHERE tenant_id=platform.current_tenant() AND schema_name=$1 AND table_name=$2 AND entity_id=$3 ORDER BY occurred_at`, [schema, table, id])).rows;
      return { revisions, audit };
    }, { context });
  }
  return { command, workspace, history, close: () => pool.end() };
}

export function httpError(error) {
  if (error instanceof AppError) return { status: error.status, message: error.message };
  if (error.code === '23505' || error.code === '23P01') return { status: 409, message: 'Duplicate code or overlapping period' };
  if (error.code === '23503') return { status: 400, message: 'Referenced record is missing or belongs to another tenant' };
  if (error.code === '23514' || error.code === '23502' || error.code === '22P02') return { status: 400, message: 'Invalid field or relationship' };
  if (error.code === '42501') return { status: 403, message: 'Database permission denied' };
  return { status: 500, message: 'Internal error' };
}
