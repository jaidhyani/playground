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

export function forkSession(sessionId) {
  return request('POST', `/sessions/${sessionId}/fork`);
}

export function getQueue(sessionId) {
  return request('GET', `/sessions/${sessionId}/queue`);
}

export function cancelQueuedPrompt(sessionId, promptId) {
  return request('DELETE', `/sessions/${sessionId}/queue/${promptId}`);
}

export function renameSession(sessionId, name) {
  return request('POST', `/sessions/${sessionId}/rename`, { name });
}

export function archiveSession(sessionId, archived = true) {
  return request('POST', `/sessions/${sessionId}/archive`, { archived });
}

export function clearSessionMessages(sessionId) {
  return request('POST', `/sessions/${sessionId}/clear`);
}

export function getAuthToken() {
  return request('GET', '/auth/token');
}

export function regenerateAuthToken() {
  return request('POST', '/auth/token');
}
