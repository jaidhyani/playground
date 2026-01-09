const BASE = '/api';

async function request(method, path, body) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, options);
  return res.json();
}

export function getSessions() {
  return request('GET', '/sessions');
}

export function getSession(id) {
  return request('GET', `/sessions/${id}`);
}

export function createSession(config) {
  return request('POST', '/sessions', config);
}

export function deleteSession(id) {
  return request('DELETE', `/sessions/${id}`);
}

export function sendPrompt(sessionId, prompt) {
  return request('POST', `/sessions/${sessionId}/prompt`, { prompt });
}

export function interruptSession(sessionId) {
  return request('POST', `/sessions/${sessionId}/interrupt`);
}

export function respondPermission(requestId, decision, updatedInput) {
  return request('POST', `/permission/${requestId}`, { decision, updatedInput });
}
