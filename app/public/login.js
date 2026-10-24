const form = document.querySelector('#login-form');
const errorArea = document.querySelector('#login-error');

form.addEventListener('submit', async event => {
  event.preventDefault();
  errorArea.replaceChildren();
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: form.elements.username.value, password: form.elements.password.value })
    });
    if (!response.ok) throw new Error('Check your username and password and try again.');
    window.location.assign('/');
  } catch (error) {
    const box = document.createElement('div'); box.className = 'govuk-error-summary'; box.role = 'alert'; box.tabIndex = -1;
    const title = document.createElement('h2'); title.className = 'govuk-error-summary__title'; title.textContent = 'There is a problem';
    const body = document.createElement('div'); body.className = 'govuk-error-summary__body'; body.textContent = error.message;
    box.append(title, body); errorArea.append(box); box.focus();
    form.elements.password.value = '';
  }
});

