const baseUrl = (process.env.HRS_API_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');

async function request(path, { method='GET', token, body, headers={} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body && !(body instanceof FormData) ? {'Content-Type':'application/json'} : {}),
      ...(token ? {Authorization:`Bearer ${token}`} : {}),
      ...headers
    },
    body: body == null ? undefined : (body instanceof FormData ? body : JSON.stringify(body))
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const error = new Error(typeof data === 'string' ? data : (data?.message || data?.error || 'HRS request failed.'));
    error.status = response.status;
    throw error;
  }
  return data;
}

function login(username, password) { return request('/api/auth/login', {method:'POST', body:{username,password}}); }
function me(token) { return request('/api/auth/me', {token}); }
function logout(token) { return request('/api/auth/logout', {method:'POST', token}); }

async function importHrl(token, file) {
  const importPath = process.env.HRS_HRL_IMPORT_PATH;
  if (!importPath) throw new Error('HRS_HRL_IMPORT_PATH is not configured on the website server.');
  const form = new FormData();
  form.append('file', new Blob([file.buffer], {type:file.mimetype}), file.originalname);
  return request(importPath, {method:'POST', token, body:form});
}

module.exports = { login, me, logout, importHrl };
