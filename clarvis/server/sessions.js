import { query } from '@anthropic-ai/claude-agent-sdk';
import { randomUUID } from 'crypto';
import { basename } from 'path';
import { saveSession, loadAllSessions, deleteSessionFile } from './persistence.js';

const sessions = new Map();
const knownDirectories = new Set();

export function getAllSessions() {
  return Array.from(sessions.values()).map(s => ({
    id: s.id,
    name: s.name,
    status: s.status,
    workingDirectory: s.config.workingDirectory,
    createdAt: s.createdAt,
    lastActivity: s.lastActivity,
    messageCount: s.messageCount
  }));
}

export async function initSessions(workingDirectory) {
  const cwd = workingDirectory || process.cwd();
  knownDirectories.add(cwd);

  const savedSessions = await loadAllSessions(cwd);
  for (const saved of savedSessions) {
    if (!sessions.has(saved.id)) {
      sessions.set(saved.id, {
        ...saved,
        abortController: null
      });
      knownDirectories.add(saved.config.workingDirectory);
    }
  }

  console.log(`Loaded ${savedSessions.length} sessions from ${cwd}`);
  return savedSessions.length;
}

export function getSession(id) {
  return sessions.get(id);
}

export async function createSession(config) {
  const id = randomUUID();
  const workingDirectory = config.workingDirectory || process.cwd();
  const session = {
    id,
    name: config.name || basename(workingDirectory),
    status: 'idle',
    createdAt: Date.now(),
    lastActivity: Date.now(),
    messageCount: 0,
    config: {
      workingDirectory,
      permissionMode: config.permissionMode || 'default',
      model: config.model || 'claude-sonnet-4-5',
      systemPrompt: config.systemPrompt
    },
    messages: [],
    abortController: null
  };
  sessions.set(id, session);
  knownDirectories.add(workingDirectory);

  await saveSession(session);
  return session;
}

export async function deleteSession(id) {
  const session = sessions.get(id);
  if (!session) return false;

  if (session.abortController) {
    session.abortController.abort();
  }

  await deleteSessionFile(session.config.workingDirectory, id);
  sessions.delete(id);
  return true;
}

export async function* runPrompt(sessionId, prompt, options = {}) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  session.status = 'running';
  session.lastActivity = Date.now();
  session.abortController = new AbortController();

  const queryOptions = {
    model: session.config.model,
    workingDirectory: session.config.workingDirectory,
    permissionMode: session.config.permissionMode
  };

  if (session.config.systemPrompt) {
    queryOptions.systemPrompt = session.config.systemPrompt;
  }

  if (options.resume) {
    queryOptions.resume = options.resume;
  }

  if (options.canUseTool) {
    queryOptions.canUseTool = options.canUseTool;
  }

  try {
    const response = query({ prompt, options: queryOptions });

    for await (const message of response) {
      session.lastActivity = Date.now();

      if (message.type === 'system' && message.subtype === 'init') {
        session.agentSessionId = message.session_id;
      }

      if (message.type === 'assistant') {
        session.messageCount++;
        session.messages.push({
          role: 'assistant',
          content: message.content,
          timestamp: Date.now()
        });
      }

      yield message;
    }

    session.status = 'idle';
    await saveSession(session);
  } catch (error) {
    session.status = 'error';
    session.lastError = error.message;
    await saveSession(session);
    throw error;
  } finally {
    session.abortController = null;
  }
}

export async function addUserMessage(sessionId, content) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  const message = {
    role: 'user',
    content,
    timestamp: Date.now()
  };
  session.messages.push(message);
  session.messageCount++;
  session.lastActivity = Date.now();
  await saveSession(session);
  return message;
}

export function interruptSession(id) {
  const session = sessions.get(id);
  if (session?.abortController) {
    session.abortController.abort();
    session.status = 'idle';
    return true;
  }
  return false;
}

export async function forkSession(id) {
  const original = sessions.get(id);
  if (!original) {
    throw new Error(`Session ${id} not found`);
  }

  const newId = randomUUID();
  const forked = {
    id: newId,
    name: `${original.name} (fork)`,
    status: 'idle',
    createdAt: Date.now(),
    lastActivity: Date.now(),
    messageCount: original.messageCount,
    config: { ...original.config },
    messages: original.messages.map(m => ({ ...m })),
    abortController: null
  };

  sessions.set(newId, forked);
  await saveSession(forked);
  return forked;
}
