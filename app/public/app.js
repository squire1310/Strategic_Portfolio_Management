const message = document.querySelector('#message');
let workspace = {};
document.querySelector('#sign-out').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.assign('/login');
});
const entityTypes = {
  strategies: ['m01_strategy', 'strategy'], objectives: ['m01_strategy', 'objective'],
  outcomes: ['m01_strategy', 'outcome'], measures: ['m01_strategy', 'measure'],
  observations: ['m01_strategy', 'measure_observation'], portfolios: ['m02_portfolio', 'portfolio'],
  categories: ['m02_portfolio', 'investment_category'], investments: ['m05_investment', 'investment'],
  memberships: ['m02_portfolio', 'portfolio_membership'], alignments: ['m02_portfolio', 'portfolio_objective']
};

const pages = {
  '/strategy': { title: 'Strategy', owner: 'Executive', role: 'executive',
    intro: 'Executive colleagues define and maintain strategic direction.',
    commands: ['strategy', 'strategy-update', 'strategy-retire'], lists: ['strategies'] },
  '/policy': { title: 'Objectives and outcomes', owner: 'Policy', role: 'policy',
    intro: 'Policy colleagues maintain objectives, outcomes, measures and observations.',
    commands: ['objective', 'objective-update', 'objective-parent', 'outcome', 'outcome-update', 'outcome-retire',
      'measure', 'measure-update', 'measure-retire', 'observation', 'observation-correction', 'observation-void'],
    lists: ['objectives', 'outcomes', 'measures', 'observations'] },
  '/portfolios': { title: 'Portfolios and categories', owner: 'Portfolio Manager', role: 'portfolio_manager',
    intro: 'Portfolio managers maintain the portfolio structure, categories and strategic alignments.',
    commands: ['portfolio', 'portfolio-update', 'portfolio-parent', 'portfolio-retire', 'category', 'category-update',
      'category-retire', 'alignment', 'alignment-remove'], lists: ['portfolios', 'categories', 'alignments'] },
  '/investments': { title: 'Investments and assignments', owner: 'Engagement Lead', role: 'engagement_lead',
    intro: 'Engagement leads maintain candidate investments and assign them to portfolios.',
    commands: ['investment', 'investment-update', 'investment-retire', 'membership', 'membership-update',
      'membership-remove'], lists: ['investments', 'memberships'] }
};
const roleHome = { executive: '/strategy', policy: '/policy', portfolio_manager: '/portfolios',
  engagement_lead: '/investments', viewer: '/strategy' };
const field = (name, label, type = 'text', options) => ({ name, label, type, options });
const editSpecs = {
  'strategy-update': { title: 'Revise strategy', source: 'strategies', fields: [field('name', 'Name'), field('description', 'Description', 'textarea')] },
  'strategy-retire': { title: 'Retire strategy', source: 'strategies', fields: [] },
  'objective-parent': { title: 'Change objective parent', source: 'objectives', fields: [field('parentObjectiveId', 'Parent objective', 'select', 'objectives')] },
  'outcome-update': { title: 'Revise outcome', source: 'outcomes', fields: [field('statement', 'Intended result', 'textarea'), field('contributionRationale', 'Contribution rationale', 'textarea'), field('targetDate', 'Target date', 'date')] },
  'outcome-retire': { title: 'Retire outcome', source: 'outcomes', fields: [] },
  'measure-update': { title: 'Revise measure', source: 'measures', fields: [field('name', 'Name'), field('unit', 'Unit'), field('direction', 'Direction', 'direction'), field('baselineValue', 'Baseline', 'number'), field('targetValue', 'Target', 'number')] },
  'measure-retire': { title: 'Retire measure', source: 'measures', fields: [] },
  'observation-void': { title: 'Void observation', source: 'observations', fields: [field('reason', 'Reason for voiding', 'textarea')] },
  'portfolio-update': { title: 'Revise portfolio', source: 'portfolios', fields: [field('name', 'Name')] },
  'portfolio-parent': { title: 'Change portfolio parent', source: 'portfolios', fields: [field('parentPortfolioId', 'Parent portfolio', 'select', 'portfolios')] },
  'category-update': { title: 'Revise category', source: 'categories', fields: [field('label', 'Label')] },
  'alignment-remove': { title: 'Remove alignment', source: 'alignments', fields: [] },
  'investment-update': { title: 'Revise candidate investment', source: 'investments', fields: [field('title', 'Title'), field('categoryId', 'Category', 'select', 'categories')] },
  'investment-retire': { title: 'Cancel candidate investment', source: 'investments', fields: [] },
  'membership-update': { title: 'Revise portfolio assignment', source: 'memberships', fields: [field('startDate', 'From', 'date'), field('endDate', 'Until', 'date'), field('weight', 'Allocation weight', 'number')] },
  'membership-remove': { title: 'Remove portfolio assignment', source: 'memberships', fields: [] }
};

function makeEditForm(command, spec) {
  const form = document.createElement('form'); form.className = 'app-form'; form.dataset.command = command;
  const heading = document.createElement('h3'); heading.className = 'govuk-heading-m'; heading.textContent = spec.title; form.append(heading);
  const target = document.createElement('div'); target.className = 'govuk-form-group';
  const targetLabel = document.createElement('label'); targetLabel.className = 'govuk-label'; targetLabel.textContent = `${({ strategies: 'Strategy', objectives: 'Objective', outcomes: 'Outcome', measures: 'Measure', observations: 'Observation', portfolios: 'Portfolio', categories: 'Category', alignments: 'Alignment', investments: 'Investment', memberships: 'Assignment' })[spec.source]} `;
  const select = document.createElement('select'); select.className = 'govuk-select'; select.name = command === 'alignment-remove' ? 'alignmentKey' : 'id';
  select.dataset.options = spec.source; select.required = true; targetLabel.append(select); target.append(targetLabel); form.append(target);
  if (command !== 'alignment-remove') {
    const group = document.createElement('div'); group.className = 'govuk-form-group';
    const label = document.createElement('label'); label.className = 'govuk-label'; label.textContent = 'Current version ';
    const input = document.createElement('input'); input.className = 'govuk-input govuk-input--width-5';
    input.type = 'number'; input.name = 'expectedVersion'; input.readOnly = true; input.required = true;
    label.append(input); group.append(label); form.append(group);
  }
  for (const item of spec.fields) {
    const group = document.createElement('div'); group.className = 'govuk-form-group';
    const label = document.createElement('label'); label.className = 'govuk-label'; label.textContent = `${item.label} `;
    let input;
    if (item.type === 'textarea') input = document.createElement('textarea');
    else if (item.type === 'select' || item.type === 'direction') input = document.createElement('select');
    else { input = document.createElement('input'); input.type = item.type; }
    input.name = item.name; input.className = item.type === 'textarea' ? 'govuk-textarea' : item.type === 'select' || item.type === 'direction' ? 'govuk-select' : 'govuk-input';
    if (item.options) { input.dataset.options = item.options; input.dataset.optional = ''; }
    if (item.type === 'direction') for (const value of ['increase', 'decrease', 'maintain']) {
      const option = document.createElement('option'); option.value = value; option.textContent = value; input.append(option);
    }
    if (item.type === 'number') input.step = 'any';
    if (!['targetDate', 'baselineValue', 'targetValue', 'parentObjectiveId', 'parentPortfolioId'].includes(item.name)) input.required = true;
    label.append(input); group.append(label); form.append(group);
  }
  const button = document.createElement('button'); button.className = 'govuk-button'; button.type = 'submit'; button.textContent = spec.title; form.append(button);
  return form;
}

function arrangePages() {
  const main = document.querySelector('main');
  for (const [path, config] of Object.entries(pages)) {
    const section = document.createElement('section'); section.className = 'app-section'; section.dataset.page = path; section.hidden = true;
    const heading = document.createElement('h2'); heading.className = 'govuk-heading-l'; heading.textContent = config.title; section.append(heading);
    const owner = document.createElement('p'); owner.className = 'govuk-body'; owner.textContent = `Maintained by: ${config.owner}`; section.append(owner);
    const notice = document.createElement('p'); notice.className = 'govuk-body app-read-only'; notice.textContent = `You can view these records. Only the ${config.owner} role can change them.`;
    notice.dataset.readOnlyNotice = ''; section.append(notice);
    const grid = document.createElement('div'); grid.className = 'app-form-grid'; grid.dataset.formGrid = ''; section.append(grid);
    for (const command of config.commands) {
      const form = document.querySelector(`form[data-command="${command}"]`) || makeEditForm(command, editSpecs[command]);
      grid.append(form);
    }
    for (const key of config.lists) section.append(document.getElementById(`${key}-list`).closest('.app-listing'));
    main.append(section);
  }
  for (const id of ['strategy', 'outcomes', 'portfolio']) document.getElementById(id).remove();
}
arrangePages();

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
  const singular = { strategies: 'strategy', categories: 'category', policies: 'policy',
    portfolios: 'portfolio', observations: 'observation', memberships: 'assignment', alignments: 'alignment' };
  for (const select of document.querySelectorAll('select[data-options]')) {
    const current = select.value;
    const key = select.dataset.options;
    select.replaceChildren();
    const blank = document.createElement('option');
    blank.value = ''; blank.textContent = select.hasAttribute('data-optional') ? 'None' : `Choose ${singular[key] || key.slice(0, -1)}`;
    select.append(blank);
    for (const row of workspace[key] || []) {
      const option = document.createElement('option');
      option.value = key === 'alignments' ? `${row.portfolio_id}|${row.objective_id}` : row.id;
      option.textContent = key === 'alignments' ? `${names('portfolios', row.portfolio_id)} · ${names('objectives', row.objective_id)}` : `${row.code ? `${row.code} · ` : ''}${label(row)}`;
      select.append(option);
    }
    select.value = current;
  }
  syncEditForms();
}
function syncEditForms() {
  const sources = { 'observation-correction': 'observations', 'objective-update': 'objectives',
    'portfolio-retire': 'portfolios', 'category-retire': 'categories' };
  for (const [command, spec] of Object.entries(editSpecs)) sources[command] = spec.source;
  for (const [command, key] of Object.entries(sources)) {
    const form = document.querySelector(`form[data-command="${command}"]`);
    const selected = command === 'alignment-remove' ? form.elements.alignmentKey.value : form.elements.id.value;
    const row = workspace[key]?.find(item => command === 'alignment-remove'
      ? `${item.portfolio_id}|${item.objective_id}` === selected : item.id === selected);
    if (form.elements.expectedVersion) form.elements.expectedVersion.value = row?.row_version || '';
    if (command === 'objective-update') {
      form.elements.title.value = row?.title || '';
      form.elements.description.value = row?.description || '';
      form.elements.status.value = row?.status || 'draft';
    }
    if (command === 'observation-correction') {
      form.elements.value.value = row?.value || '';
      form.elements.evidenceUri.value = row?.evidence_uri || '';
    }
    for (const item of editSpecs[command]?.fields || []) {
      const column = { contributionRationale: 'contribution_rationale', targetDate: 'target_date',
        baselineValue: 'baseline_value', targetValue: 'target_value', categoryId: 'category_id',
        parentObjectiveId: 'parent_objective_id', parentPortfolioId: 'parent_portfolio_id',
        weight: 'allocation_weight' }[item.name] || item.name;
      let value = row?.[column];
      if (item.name === 'startDate' || item.name === 'endDate') {
        const dates = row?.membership_during?.match(/\d{4}-\d{2}-\d{2}/g) || [];
        value = dates[item.name === 'startDate' ? 0 : 1];
      }
      form.elements[item.name].value = value == null ? '' : String(value).slice(0, item.type === 'date' ? 10 : undefined);
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
    const tr = document.createElement('tr'); tr.className = 'govuk-table__row';
    if (row.id) tr.id = `${key}-${row.id}`;
    for (const [, field] of fields) {
      const td = document.createElement('td'); td.className = 'govuk-table__cell';
      if ((field === 'objective_id' && key === 'alignments') || (field === 'strategy_id' && key === 'objectives')) {
        const link = document.createElement('a');
        link.href = `${field === 'objective_id' ? '/policy#objectives' : '/strategy#strategies'}-${row[field]}`;
        link.className = 'govuk-link'; link.textContent = cell(row, field);
        td.append(link);
      } else td.textContent = cell(row, field);
      tr.append(td);
    }
    const td = document.createElement('td'); td.className = 'govuk-table__cell';
    if (row.id) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'govuk-button govuk-button--secondary app-record-link'; button.textContent = 'History';
      button.setAttribute('aria-label', `History for ${label(row)}`);
      button.addEventListener('click', () => {
        window.location.assign(`/history?type=${encodeURIComponent(key)}&id=${encodeURIComponent(row.id)}`);
      });
      td.append(button);
    } else td.textContent = '—';
    tr.append(td); body.append(tr);
  }
  table.append(body); wrap.append(table); container.append(wrap);
}
function render() {
  fillOptions();
  renderTable('strategies-list', 'strategies', [['Code', 'code'], ['Name', 'name'], ['Horizon', 'horizon'], ['Status', 'status'], ['Version', 'row_version']]);
  renderTable('objectives-list', 'objectives', [['Code', 'code'], ['Title', 'title'], ['Strategy', 'strategy_id'], ['Parent', 'parent_objective_id'], ['Status', 'status'], ['Version', 'row_version']]);
  renderTable('outcomes-list', 'outcomes', [['Code', 'code'], ['Statement', 'statement'], ['Objective', 'objective_id'], ['Status', 'status'], ['Contribution', 'contribution_rationale']]);
  renderTable('measures-list', 'measures', [['Code', 'code'], ['Name', 'name'], ['Outcome', 'outcome_id'], ['Status', 'status'], ['Baseline', 'baseline_value'], ['Target', 'target_value']]);
  renderTable('observations-list', 'observations', [['Measure', 'measure_id'], ['Date', 'observed_on'], ['Value', 'value'], ['Voided', 'voided'], ['Version', 'row_version']]);
  renderTable('portfolios-list', 'portfolios', [['Code', 'code'], ['Name', 'name'], ['Parent', 'parent_portfolio_id'], ['Status', 'status'], ['Version', 'row_version']]);
  renderTable('categories-list', 'categories', [['Code', 'code'], ['Label', 'label'], ['Active', 'active'], ['Version', 'row_version']]);
  renderTable('investments-list', 'investments', [['Code', 'code'], ['Title', 'title'], ['Category', 'category_id'], ['State', 'lifecycle']]);
  renderTable('memberships-list', 'memberships', [['Portfolio', 'portfolio_id'], ['Investment', 'investment_id'], ['Period', 'membership_during'], ['Weight', 'allocation_weight']]);
  renderTable('alignments-list', 'alignments', [['Portfolio', 'portfolio_id'], ['Objective', 'objective_id'], ['Strategy', 'strategy_of_objective'], ['Contribution', 'contribution']]);
}
async function load() {
  const sessionResponse = await fetch('/api/session');
  if (sessionResponse.status === 401) { window.location.assign('/login'); return; }
  if (!sessionResponse.ok) throw new Error('Could not load session');
  const user = await sessionResponse.json();
  if (window.location.pathname === '/') { window.location.replace(roleHome[user.role] || '/strategy'); return; }
  const currentPage = pages[window.location.pathname];
  document.querySelector('#page-title').textContent = currentPage?.title || 'Record history';
  document.querySelector('#page-intro').textContent = currentPage?.intro || 'Inspect recorded versions and changes across the service.';
  document.querySelector('#signed-in-user').textContent = `Signed in as ${user.displayName} (${({ executive: 'Executive', policy: 'Policy', portfolio_manager: 'Portfolio Manager', engagement_lead: 'Engagement Lead', viewer: 'Viewer' })[user.role]}).`;
  for (const link of document.querySelectorAll('.app-page-nav a')) {
    if (new URL(link.href).pathname === window.location.pathname) link.setAttribute('aria-current', 'page');
  }
  for (const [path, config] of Object.entries(pages)) {
    const page = document.querySelector(`[data-page="${path}"]`);
    page.hidden = path !== window.location.pathname;
    page.querySelector('[data-read-only-notice]').hidden = user.role === config.role;
  }
  document.getElementById('history').hidden = window.location.pathname !== '/history';
  document.getElementById('inbox').hidden = window.location.pathname !== '/inbox';
  for (const form of document.querySelectorAll('form[data-command]')) form.hidden = !user.allowedCommands.includes(form.dataset.command);
  const response = await fetch('/api/workspace');
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Could not load records');
  workspace = payload;
  render();
  if (window.location.pathname === '/inbox') await loadInbox();
  if (window.location.pathname === '/history') {
    const params = new URLSearchParams(window.location.search);
    if (entityTypes[params.get('type')] && params.get('id')) await viewHistory(params.get('type'), params.get('id'));
  } else if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
}

async function loadInbox() {
  const container = document.getElementById('work-items-list');
  container.replaceChildren();
  const response = await fetch('/api/work-items/inbox');
  const items = await response.json();
  if (!response.ok) throw new Error(items.error || 'Could not load work items');
  if (!items.length) {
    const p = document.createElement('p'); p.className='govuk-body';
    p.textContent='No work items are currently assigned to you.'; container.append(p); return;
  }
  const table = document.createElement('table'); table.className='govuk-table';
  const head = document.createElement('thead');
  const tr = document.createElement('tr');
  for (const text of ['Task','Business object','Due date','Status','Action']) {
    const th=document.createElement('th'); th.scope='col'; th.className='govuk-table__header'; th.textContent=text; tr.append(th);
  }
  head.append(tr); table.append(head);
  const body=document.createElement('tbody');
  const today = new Date().toISOString().slice(0,10);
  for (const item of items) {
    const line=document.createElement('tr'); line.className='govuk-table__row';
    const overdue=item.state==='open' && item.due_on && item.due_on.slice(0,10)<today;
    for (const value of [item.title, item.object_type + ' · ' + item.object_id,
      item.due_on?.slice(0,10) || 'No due date', overdue ? 'Overdue' : item.state]) {
      const td=document.createElement('td'); td.className='govuk-table__cell'; td.textContent=value; line.append(td);
    }
    const cell=document.createElement('td'); cell.className='govuk-table__cell';
    if(item.state==='open') {
      const button=document.createElement('button'); button.type='button'; button.className='govuk-button govuk-button--secondary';
      button.textContent='Complete';
      button.addEventListener('click',async()=>{
        const note=window.prompt('Completion note (required)');
        if (!note?.trim()) return;
        try {
          const response=await fetch('/api/work-items/complete',{method:'POST',headers:{'content-type':'application/json'},
            body:JSON.stringify({id:item.id,expectedVersion:item.row_version,note})});
          const result=await response.json(); if(!response.ok) throw new Error(result.error || 'Unable to complete');
          show('Work item completed.'); await loadInbox();
        }catch(error){show(error.message,'error');}
      });
      cell.append(button);
    } else cell.textContent='—';
    line.append(cell);body.append(line);
  }
  table.append(body); container.append(table);
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
    if (form.dataset.command === 'alignment-remove') {
      [body.portfolioId, body.objectiveId] = body.alignmentKey.split('|');
      delete body.alignmentKey;
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
for (const form of document.querySelectorAll('form[data-command]')) {
  const editSelect = form.querySelector('select[name="id"],select[name="alignmentKey"]');
  editSelect?.addEventListener('change', syncEditForms);
}
load().catch(error => show(error.message, 'error'));
