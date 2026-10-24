import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpServer } from '../src/server.js';

test('GOV.UK Frontend assets and non-GOV.UK header are served locally', async () => {
  const server = createHttpServer({});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(base);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /class="govuk-skip-link"/);
    assert.match(html, /class="govuk-header__link govuk-header__service-name"/);
    assert.match(html, /class="govuk-phase-banner"/);
    assert.match(html, /class="govuk-form-group"/);
    assert.match(html, /class="govuk-button"/);
    assert.doesNotMatch(html, /govuk-header__logotype|govuk-logo|GDS Transport/);
    const stylesheet = await fetch(`${base}/govuk.css`);
    assert.equal(stylesheet.status, 200);
    const css = await stylesheet.text();
    assert.match(css, /\.govuk-button/);
    assert.match(css, /\.govuk-error-summary/);
    assert.match(css, /Helvetica Neue/);
    const script = await fetch(`${base}/app.js`);
    assert.equal(script.status, 200);
    assert.match(await script.text(), /govuk-notification-banner/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

