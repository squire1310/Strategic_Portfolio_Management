const message = document.querySelector('#message');
let workspace = {};
const entityTypes = {
  strategies: ['m01_strategy', 'strategy'], objectives: ['m01_strategy', 'objective'],
  outcomes: ['m01_strategy', 'outcome'], measures: ['m01_strategy', 'measure'],
  observations: ['m01_strategy', 'measure_observation'], portfolios: ['m02_portfolio', 'portfolio'],
  categories: ['m02_portfolio', 'investment_category'], investments: ['m05_investment', 'investment'],
  memberships: ['m02_portfolio', 'portfolio_membership'], alignments: ['m02_portfolio', 'portfolio_objective']
};

function show(text, kind = 'ok') {
  message.replaceChildren();
  if (kind === 'error') {
    const box = document.createElement('div');
    box.className = 'govuk-error-summary'; box.setAttribute('role', 'alert');
    box.tabIndex = -1;
    const title = document.createElement('h2'); title.className = 'govuk-error-summary__title'; title.textContent = 'There is a problem';
    const body = document.createElement('div'); body.className = 'govuk-error-summary__body'; body.textContent = text;
    box.append(title, body); message.append(box); box.focus();
  } else {
    const box = document.createElement('div'); box.className = 'govuk-notification-banner govuk-notification-banner--success';
    box.setAttribute('role', 'status');
    const header = document.createElement('div'); header.className = 'govuk-notification-banner__header';
    const title = document.createElement('h2'); title.className = 'govuk-notification-banner__title'; title.textContent = 'Success';
    const content = document.createElement('div'); content.className = 'govuk-notification-banner__content';
    const paragraph = document.createElement('p'); paragraph.className = 'govuk-notification-banner__heading'; paragraph.textContent = text;
    header.append(title); content.append(paragraph); box.append(header, content); message.append(box);
  }
}
function label(row) { return row.name || row.title || row.label || row.statement || row.code || row.id; }
function names(key, id) { return workspace[key]?.find(row => row.id === id)?.name || workspace[key]?.find(row => row.id === id)?.title || workspace[key]?.find(row => row.id === id)?.code || id || '—'; }
function fillOptions() {
  for (const select of document.querySelectorAll('select[data-options]')) {
    const current = select.value;
    const key = select.dataset.options;
    select.replaceChildren();
    const blank = document.createElement('option');
    blank.value = ''; blank.textContent = select.hasAttribute('data-optional') ? 'None' : `Choose ${key.slice(0, -1)}`;
    select.append(blank);
    for (const row of workspace[key] || []) {
      const option = document.createElement('option');
      option.value = row.id;
      option.textContent = `${row.code ? `${row.code} · ` : ''}${label(row)}`;
      select.append(option);
    }
    select.value = current;
  }
  syncEditForms();
}
function syncEditForms() {
  const sources = { 'observation-correction': 'observations', 'objective-update': 'objectives',
    'portfolio-retire': 'portfolios', 'category-retire': 'categories' };
  for (const [command, key] of Object.entries(sources)) {
    const form = document.querySelector(`form[data-command="${command}"]`);
    const row = workspace[key]?.find(item => item.id === form.elements.id.value);
    form.elements.expectedVersion.value = row?.row_version || '';
    if (command === 'objective-update') {
      form.elements.title.value = row?.title || '';
      form.elements.description.value = row?.description || '';
      form.elements.status.value = row?.status || 'draft';
    }
  }
}
function cell(row, key) {
  if (key === 'strategy_of_objective') {
    const objective = workspace.objectives?.find(item => item.id === row.objective_id);
    return names('strategies', objective?.strategy_id);
  }
  if (key === 'strategy_id') return names('strategies', row[key]);
  if (key === 'objective_id' || key === 'parent_objective_id') return names('objectives', row[key]);
  if (key === 'outcome_id') return names('outcomes', row[key]);
  if (key === 'measure_id') return names('measures', row[key]);
  if (key === 'portfolio_id' || key === 'parent_portfolio_id') return names('portfolios', row[key]);
  if (key === 'category_id') return names('categories', row[key]);
  if (key === 'investment_id') return names('investments', row[key]);
  return row[key] == null ? '—' : String(row[key]);
}
function renderTable(containerId, key, fields) {
  const container = document.getElementById(containerId);
  const rows = workspace[key] || [];
  container.replaceChildren();
  if (!rows.length) { const p = document.createElement('p'); p.className = 'govuk-body'; p.textContent = 'No records yet.'; container.append(p); return; }
  const wrap = document.createElement('div'); wrap.className = 'app-table-scroll';
  const table = document.createElement('table'); table.className = 'govuk-table';
  const head = document.createElement('thead'); head.className = 'govuk-table__head';
  const trh = document.createElement('tr'); trh.className = 'govuk-table__row';
  for (const [name] of fields) { const th = document.createElement('th'); th.className = 'govuk-table__header'; th.scope = 'col'; th.textContent = name; trh.append(th); }
  const th = document.createElement('th'); th.className = 'govuk-table__header'; th.scope = 'col'; th.textContent = 'Record'; trh.append(th); head.append(trh); table.append(head);
  const body = document.createElement('tbody'); body.className = 'govuk-table__body';
  for (const row of rows) {
    const tr = document.createElement('tr'); tr.className = 'govuk-table__row'; tr.id = `${key}-${row.id}`;
    for (const [, field] of fields) {
      const td = document.createElement('td'); td.className = 'govuk-table__cell';
      if ((field === 'objective_id' && key === 'alignments') || (field === 'strategy_id' && key === 'objectives')) {
        const link = document.createElement('a');
        link.href = `#${field === 'objective_id' ? 'objectives' : 'strategies'}-${row[field]}`;
        link.className = 'govuk-link'; link.textContent = cell(row, field);
        td.append(link);
      } else td.textContent = cell(row, field);
      tr.append(td);
    }
    const td = document.createElement('td'); td.className = 'govuk-table__cell'; const button = document.createElement('button');
    button.type = 'button'; button.className = 'govuk-button govuk-button--secondary app-record-link'; button.textContent = 'History';
    button.setAttribute('aria-label', `History for ${label(row)}`);
    button.addEventListener('click', () => viewHistory(key, row.id));
    td.append(button); tr.append(td); body.append(tr);
  }
  table.append(body); wrap.append(table); container.append(wrap);
}
function render() {
  fillOptions();
  renderTable('strategies-list', 'strategies', [['Code', 'code'], ['Name', 'name'], ['Horizon', 'horizon'], ['Version', 'row_version']]);
  renderTable('objectives-list', 'objectives', [['Code', 'code'], ['Title', 'title'], ['Strategy', 'strategy_id'], ['Parent', 'parent_objective_id'], ['Version', 'row_version']]);
  renderTable('outcomes-list', 'outcomes', [['Code', 'code'], ['Statement', 'statement'], ['Objective', 'objective_id'], ['Contribution', 'contribution_rationale']]);
  renderTable('measures-list', 'measures', [['Code', 'code'], ['Name', 'name'], ['Outcome', 'outcome_id'], ['Baseline', 'baseline_value'], ['Target', 'target_value']]);
  renderTable('observations-list', 'observations', [['Measure', 'measure_id'], ['Date', 'observed_on'], ['Value', 'value'], ['Version', 'row_version']]);
  renderTable('portfolios-list', 'portfolios', [['Code', 'code'], ['Name', 'name'], ['Parent', 'parent_portfolio_id'], ['Version', 'row_version']]);
  renderTable('categories-list', 'categories', [['Code', 'code'], ['Label', 'label'], ['Active', 'active'], ['Version', 'row_version']]);
  renderTable('investments-list', 'investments', [['Code', 'code'], ['Title', 'title'], ['Category', 'category_id'], ['State', 'lifecycle']]);
  renderTable('memberships-list', 'memberships', [['Portfolio', 'portfolio_id'], ['Investment', 'investment_id'], ['Period', 'membership_during'], ['Weight', 'allocation_weight']]);
  renderTable('alignments-list', 'alignments', [['Portfolio', 'portfolio_id'], ['Objective', 'objective_id'], ['Strategy', 'strategy_of_objective'], ['Contribution', 'contribution']]);
}
async function load() {
  const response = await fetch('/api/workspace');
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Could not load records');
  workspace = payload;
  render();
}
async function viewHistory(key, id) {
  try {
    const [schema, table] = entityTypes[key];
    const response = await fetch(`/api/history/${schema}/${table}/${id}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
    const container = document.getElementById('history-list'); container.replaceChildren();
    const title = document.createElement('h3'); title.className = 'govuk-heading-m'; title.textContent = `${table} · ${id}`; container.append(title);
    for (const [section, rows] of [['Versions', payload.revisions], ['Audit events', payload.audit]]) {
      const h = document.createElement('h4'); h.className = 'govuk-heading-s'; h.textContent = section; container.append(h);
      if (!rows.length) { const p = document.createElement('p'); p.className = 'govuk-body'; p.textContent = 'No entries.'; container.append(p); continue; }
      for (const row of rows) {
        const details = document.createElement('details'); details.className = 'govuk-details app-history-entry'; const summary = document.createElement('summary'); summary.className = 'govuk-details__summary';
        summary.textContent = `${row.operation} · ${row.recorded_at || row.occurred_at} · actor ${row.actor_id || 'unknown'}`;
        const pre = document.createElement('pre'); pre.className = 'govuk-details__text'; pre.textContent = JSON.stringify(row.payload || row.new_row || row.old_row, null, 2);
        details.append(summary, pre); container.append(details);
      }
    }
    document.getElementById('history').scrollIntoView();
  } catch (error) { show(error.message, 'error'); }
}

for (const form of document.querySelectorAll('form[data-command]')) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const body = {};
    for (const element of form.elements) {
      if (!element.name || element.value === '') continue;
      body[element.name] = element.type === 'number' ? Number(element.value) : element.value;
    }
    try {
      const response = await fetch(`/api/commands/${form.dataset.command}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not save');
      show('Saved. The record and its audit trail are available below.');
      form.reset();
      await load();
    } catch (error) { show(error.message, 'error'); }
  });
}
for (const command of ['observation-correction', 'objective-update', 'portfolio-retire', 'category-retire']) {
  document.querySelector(`form[data-command="${command}"] select[name="id"]`).addEventListener('change', syncEditForms);
}
load().catch(error => show(error.message, 'error'));

