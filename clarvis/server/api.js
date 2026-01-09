import {
  getAllSessions,
  getSession,
  createSession,
  deleteSession,
  runPrompt,
  interruptSession,
  addUserMessage,
  forkSession,
  queuePrompt,
  getQueue,
  cancelQueuedPrompt,
  dequeuePrompt,
  renameSession
} from './sessions.js';
import { broadcast, broadcastAll } from './ws-hub.js';
import { createPermissionHandler, handlePermissionResponse } from './permissions.js';
import { getToken, regenerateToken } from './auth.js';

export async function handleApiRequest(req, res, parsedUrl) {
  const path = parsedUrl.pathname;
  const method = req.method;

  res.setHeader('Content-Type', 'application/json');

  if (path === '/api/sessions' && method === 'GET') {
    return sendJson(res, 200, getAllSessions());
  }

  if (path === '/api/sessions' && method === 'POST') {
    const body = await readBody(req);
    const session = await createSession(body);
    broadcastAll({ type: 'session:created', session: summarizeSession(session) });
    return sendJson(res, 201, summarizeSession(session));
  }

  const sessionMatch = path.match(/^\/api\/sessions\/([^/]+)$/);
  if (sessionMatch) {
    const id = sessionMatch[1];

    if (method === 'GET') {
      const session = getSession(id);
      if (!session) return sendJson(res, 404, { error: 'Session not found' });
      return sendJson(res, 200, {
        ...summarizeSession(session),
        messages: session.messages,
        config: session.config
      });
    }

    if (method === 'DELETE') {
      const deleted = await deleteSession(id);
      if (!deleted) return sendJson(res, 404, { error: 'Session not found' });
      broadcastAll({ type: 'session:deleted', sessionId: id });
      return sendJson(res, 200, { success: true });
    }
  }

  const promptMatch = path.match(/^\/api\/sessions\/([^/]+)\/prompt$/);
  if (promptMatch && method === 'POST') {
    const id = promptMatch[1];
    const session = getSession(id);
    if (!session) return sendJson(res, 404, { error: 'Session not found' });

    const body = await readBody(req);
    if (!body.prompt) return sendJson(res, 400, { error: 'prompt required' });

    if (session.status === 'running') {
      const queued = queuePrompt(id, body.prompt);
      broadcast(id, { type: 'queue:added', payload: queued });
      return sendJson(res, 202, { status: 'queued', queued });
    }

    const userMessage = await addUserMessage(id, body.prompt);

    broadcast(id, {
      type: 'message:user',
      payload: { content: body.prompt, timestamp: userMessage.timestamp }
    });

    runPromptAsync(id, body.prompt);
    return sendJson(res, 202, { status: 'running' });
  }

  const queueMatch = path.match(/^\/api\/sessions\/([^/]+)\/queue$/);
  if (queueMatch && method === 'GET') {
    const id = queueMatch[1];
    return sendJson(res, 200, getQueue(id));
  }

  const cancelQueueMatch = path.match(/^\/api\/sessions\/([^/]+)\/queue\/([^/]+)$/);
  if (cancelQueueMatch && method === 'DELETE') {
    const [, sessionId, promptId] = cancelQueueMatch;
    const success = cancelQueuedPrompt(sessionId, promptId);
    if (success) {
      broadcast(sessionId, { type: 'queue:cancelled', payload: { promptId } });
    }
    return sendJson(res, success ? 200 : 404, { success });
  }

  const interruptMatch = path.match(/^\/api\/sessions\/([^/]+)\/interrupt$/);
  if (interruptMatch && method === 'POST') {
    const id = interruptMatch[1];
    const success = interruptSession(id);
    return sendJson(res, 200, { success });
  }

  const forkMatch = path.match(/^\/api\/sessions\/([^/]+)\/fork$/);
  if (forkMatch && method === 'POST') {
    const id = forkMatch[1];
    try {
      const forked = await forkSession(id);
      broadcastAll({ type: 'session:created', session: summarizeSession(forked) });
      return sendJson(res, 201, summarizeSession(forked));
    } catch (error) {
      return sendJson(res, 404, { error: error.message });
    }
  }

  const renameMatch = path.match(/^\/api\/sessions\/([^/]+)\/rename$/);
  if (renameMatch && method === 'POST') {
    const id = renameMatch[1];
    const body = await readBody(req);
    if (!body.name) return sendJson(res, 400, { error: 'name required' });
    try {
      const session = await renameSession(id, body.name);
      broadcastAll({ type: 'session:renamed', sessionId: id, payload: { name: session.name } });
      return sendJson(res, 200, summarizeSession(session));
    } catch (error) {
      return sendJson(res, 404, { error: error.message });
    }
  }

  const permissionMatch = path.match(/^\/api\/permission\/([^/]+)$/);
  if (permissionMatch && method === 'POST') {
    const requestId = permissionMatch[1];
    const body = await readBody(req);
    const success = handlePermissionResponse(requestId, body.decision, body.updatedInput);
    return sendJson(res, success ? 200 : 404, { success });
  }

  // Auth endpoints - GET returns status only (token hidden unless authenticated)
  if (path === '/api/auth/token' && method === 'GET') {
    const token = getToken();
    const authHeader = req.headers.authorization;
    const isAuthenticated = authHeader && authHeader.replace('Bearer ', '') === token;

    // Only return the actual token if already authenticated
    return sendJson(res, 200, {
      token: isAuthenticated ? token : null,
      enabled: token !== null
    });
  }

  if (path === '/api/auth/token' && method === 'POST') {
    const newToken = await regenerateToken();
    return sendJson(res, 200, { token: newToken });
  }

  return sendJson(res, 404, { error: 'Not found' });
}

async function runPromptAsync(sessionId, prompt) {
  const session = getSession(sessionId);
  if (!session) return;

  broadcast(sessionId, { type: 'session:status', payload: { status: 'running' } });

  try {
    const canUseTool = createPermissionHandler(sessionId);

    for await (const message of runPrompt(sessionId, prompt, { canUseTool })) {
      switch (message.type) {
        case 'system':
          if (message.subtype === 'init') {
            broadcast(sessionId, {
              type: 'session:init',
              payload: { agentSessionId: message.session_id, tools: message.tools }
            });
          }
          break;

        case 'assistant':
          broadcast(sessionId, {
            type: 'message:assistant',
            payload: { content: message.content, timestamp: Date.now() }
          });
          break;

        case 'tool_call':
          broadcast(sessionId, {
            type: 'tool:start',
            payload: {
              toolName: message.tool_name,
              input: message.input,
              toolUseId: message.tool_use_id
            }
          });
          break;

        case 'tool_result':
          broadcast(sessionId, {
            type: 'tool:result',
            payload: {
              toolName: message.tool_name,
              result: truncateResult(message.result),
              toolUseId: message.tool_use_id
            }
          });
          break;

        case 'error':
          broadcast(sessionId, {
            type: 'error',
            payload: { error: message.error }
          });
          break;
      }
    }
  } catch (error) {
    broadcast(sessionId, {
      type: 'error',
      payload: { error: error.message }
    });
  }

  const finalSession = getSession(sessionId);
  broadcast(sessionId, {
    type: 'session:status',
    payload: { status: finalSession?.status || 'ended' }
  });

  const nextPrompt = dequeuePrompt(sessionId);
  if (nextPrompt) {
    broadcast(sessionId, { type: 'queue:processing', payload: nextPrompt });
    const userMessage = await addUserMessage(sessionId, nextPrompt.prompt);
    broadcast(sessionId, {
      type: 'message:user',
      payload: { content: nextPrompt.prompt, timestamp: userMessage.timestamp }
    });
    runPromptAsync(sessionId, nextPrompt.prompt);
  }
}

function summarizeSession(session) {
  return {
    id: session.id,
    name: session.name,
    status: session.status,
    workingDirectory: session.config.workingDirectory,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity,
    messageCount: session.messageCount
  };
}

function truncateResult(result) {
  if (typeof result === 'string' && result.length > 5000) {
    return result.slice(0, 5000) + '\n... (truncated)';
  }
  return result;
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}
