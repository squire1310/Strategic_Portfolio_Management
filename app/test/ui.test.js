import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpServer } from '../src/server.js';
import { createAuth, hashPassword } from '../src/auth.js';

test('GOV.UK Frontend assets and non-GOV.UK header are served locally', async () => {
  const auth = createAuth([{ username: 'pilot', tenantId: '00000000-0000-4000-8000-000000000001',
    actorId: '00000000-0000-4000-8000-000000000101', role: 'executive', passwordHash: hashPassword('test-password-long') }]);
  const server = createHttpServer({}, { auth });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const loginPage = await fetch(`${base}/login`);
    assert.equal(loginPage.status, 200);
    assert.match(await loginPage.text(), /govuk-error-summary|login-form/);
    const unauthenticated = await fetch(base, { redirect: 'manual' });
    assert.equal(unauthenticated.status, 303);
    const invalid = await fetch(`${base}/api/login`, { method: 'POST', headers: { origin: base, 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'pilot', password: 'wrong-password' }) });
    assert.equal(invalid.status, 401);
    const valid = await fetch(`${base}/api/login`, { method: 'POST', headers: { origin: base, 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'pilot', password: 'test-password-long' }) });
    assert.equal(valid.status, 200);
    const cookie = valid.headers.get('set-cookie').split(';')[0];
    const page = await fetch(base, { headers: { cookie } });
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /class="govuk-skip-link"/);
    assert.match(html, /class="govuk-header__link govuk-header__service-name"/);
    assert.match(html, /class="govuk-phase-banner"/);
    assert.match(html, /class="govuk-form-group"/);
    assert.match(html, /class="govuk-button"/);
    assert.match(html, /href="\/policy"/);
    assert.match(html, /href="\/investments"/);
    assert.doesNotMatch(html, /govuk-header__logotype|govuk-logo|GDS Transport/);
    assert.equal((await fetch(`${base}/policy`, { headers: { cookie } })).status, 200);
    const stylesheet = await fetch(`${base}/govuk.css`);
    assert.equal(stylesheet.status, 200);
    const css = await stylesheet.text();
    assert.match(css, /\.govuk-button/);
    assert.match(css, /\.govuk-error-summary/);
    assert.match(css, /Helvetica Neue/);
    const script = await fetch(`${base}/app.js`);
    assert.equal(script.status, 200);
    assert.match(await script.text(), /govuk-notification-banner/);
    const logout = await fetch(`${base}/api/logout`, { method: 'POST', headers: { origin: base, cookie } });
    assert.equal(logout.status, 200);
    const signedOut = await fetch(base, { redirect: 'manual', headers: { cookie } });
    assert.equal(signedOut.status, 303);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
