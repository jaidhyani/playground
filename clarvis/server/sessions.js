import { query } from '@anthropic-ai/claude-agent-sdk';
import { randomUUID } from 'crypto';
import { basename } from 'path';
import { saveSession, loadAllSessions, deleteSessionFile } from './persistence.js';

const sessions = new Map();
const knownDirectories = new Set();

export function getAllSessions() {
  return Array.from(sessions.values()).map(s => {
    const lastMsg = s.messages?.[s.messages.length - 1];
    const lastMessagePreview = lastMsg?.content
      ? truncatePreview(lastMsg.content, 100)
      : null;

    return {
      id: s.id,
      name: s.name,
      status: s.status,
      workingDirectory: s.config.workingDirectory,
      createdAt: s.createdAt,
      lastActivity: s.lastActivity,
      messageCount: s.messageCount,
      queueLength: s.promptQueue?.length || 0,
      archived: s.archived || false,
      lastMessagePreview
    };
  });
}

function truncatePreview(content, maxLength) {
  if (!content || typeof content !== 'string') return '';
  const cleaned = content.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength) + '...';
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
      systemPrompt: config.systemPrompt,
      permissionTimeout: config.permissionTimeout ?? null  // null = wait indefinitely
    },
    messages: [],
    promptQueue: [],
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
    promptQueue: [],
    abortController: null
  };

  sessions.set(newId, forked);
  await saveSession(forked);
  return forked;
}

export function queuePrompt(sessionId, prompt) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  const queuedPrompt = {
    id: randomUUID(),
    prompt,
    queuedAt: Date.now()
  };

  if (!session.promptQueue) session.promptQueue = [];
  session.promptQueue.push(queuedPrompt);
  return queuedPrompt;
}

export function getQueue(sessionId) {
  const session = sessions.get(sessionId);
  return session?.promptQueue || [];
}

export function cancelQueuedPrompt(sessionId, promptId) {
  const session = sessions.get(sessionId);
  if (!session?.promptQueue) return false;

  const index = session.promptQueue.findIndex(p => p.id === promptId);
  if (index === -1) return false;

  session.promptQueue.splice(index, 1);
  return true;
}

export function dequeuePrompt(sessionId) {
  const session = sessions.get(sessionId);
  if (!session?.promptQueue?.length) return null;
  return session.promptQueue.shift();
}

export async function renameSession(id, newName) {
  const session = sessions.get(id);
  if (!session) {
    throw new Error(`Session ${id} not found`);
  }

  session.name = newName.trim() || session.name;
  await saveSession(session);
  return session;
}

export async function archiveSession(id, archived = true) {
  const session = sessions.get(id);
  if (!session) {
    throw new Error(`Session ${id} not found`);
  }

  session.archived = archived;
  await saveSession(session);
  return session;
}

export async function clearSessionMessages(id) {
  const session = sessions.get(id);
  if (!session) {
    throw new Error(`Session ${id} not found`);
  }

  session.messages = [];
  session.messageCount = 0;
  session.lastActivity = Date.now();
  await saveSession(session);
  return session;
}

// Auto-archive sessions inactive for longer than threshold
// Returns array of session IDs that were archived
export async function autoArchiveInactiveSessions(thresholdMs) {
  if (!thresholdMs || thresholdMs <= 0) return [];

  const now = Date.now();
  const archived = [];

  for (const session of sessions.values()) {
    // Skip already archived or currently running sessions
    if (session.archived || session.status === 'running') continue;

    const inactiveTime = now - session.lastActivity;
    if (inactiveTime > thresholdMs) {
      session.archived = true;
      await saveSession(session);
      archived.push(session.id);
    }
  }

  return archived;
}
