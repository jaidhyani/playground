import { query } from '@anthropic-ai/claude-agent-sdk';
import { randomUUID } from 'crypto';
import { basename } from 'path';
import { saveSession, loadAllSessions, deleteSessionFile } from './persistence.js';

const sessions = new Map();
const knownDirectories = new Set();

// Cache for models and commands (fetched once on first query)
let cachedModels = null;
let cachedCommands = null;
let cachedSlashCommands = null; // All slash commands from init message

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

// Extract text from SDK content blocks
// SDK returns content as array: [{type: 'text', text: '...'}, ...]
function extractTextContent(contentBlocks) {
  if (!contentBlocks) return '';
  if (typeof contentBlocks === 'string') return contentBlocks;
  if (!Array.isArray(contentBlocks)) return String(contentBlocks);

  return contentBlocks
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n');
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
      model: config.model || 'sonnet',
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
    cwd: session.config.workingDirectory,
    permissionMode: session.config.permissionMode,
    abortController: session.abortController
  };

  if (session.config.systemPrompt) {
    queryOptions.systemPrompt = session.config.systemPrompt;
  }

  // Resume from the session's agent session ID if we have one
  if (session.agentSessionId) {
    queryOptions.resume = session.agentSessionId;
  }

  if (options.canUseTool) {
    queryOptions.canUseTool = options.canUseTool;
  }

  try {
    const response = query({ prompt, options: queryOptions });

    // Fetch models and commands on first query (cache them)
    if (!cachedModels) {
      try {
        const allModels = await response.supportedModels();
        // Filter out "Custom model" entries - keep only standard aliases
        cachedModels = allModels.filter(m => m.description !== 'Custom model');
        console.log(`Loaded ${cachedModels.length} available models`);
      } catch (e) {
        console.error('Failed to fetch models:', e.message);
      }
    }
    if (!cachedCommands) {
      try {
        cachedCommands = await response.supportedCommands();
        console.log(`Loaded ${cachedCommands.length} skill commands`);
      } catch (e) {
        console.error('Failed to fetch commands:', e.message);
      }
    }

    for await (const message of response) {
      session.lastActivity = Date.now();

      if (message.type === 'system' && message.subtype === 'init') {
        session.agentSessionId = message.session_id;

        // Note: message.slash_commands only contains skill commands, not built-in CLI commands
        if (!cachedSlashCommands && message.slash_commands) {
          cachedSlashCommands = message.slash_commands;
        }
      }

      if (message.type === 'assistant') {
        // Extract text content from the message structure
        // SDK returns: { type: 'assistant', message: { content: [{type: 'text', text: '...'}] } }
        const content = extractTextContent(message.message?.content);
        session.messageCount++;
        session.messages.push({
          role: 'assistant',
          content,
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

// Get available models (cached after first query)
export function getAvailableModels() {
  return cachedModels || [];
}

// Get available slash commands
// Merges skill commands (with descriptions) with built-in CLI commands
export function getAvailableCommands() {
  const skillCommands = cachedCommands || [];

  // Built-in CLI commands (not exposed by SDK but handled by Claude Code)
  const builtInCommands = [
    { name: 'clear', description: 'Clear conversation history and start fresh', argumentHint: '' },
    { name: 'help', description: 'Show available commands and help', argumentHint: '' },
    { name: 'model', description: 'Change the current model (e.g., /model sonnet)', argumentHint: '<model>' },
    { name: 'bug', description: 'Report a bug', argumentHint: '' },
    { name: 'doctor', description: 'Check Claude Code health and configuration', argumentHint: '' },
    { name: 'login', description: 'Log in to your Anthropic account', argumentHint: '' },
    { name: 'logout', description: 'Log out of your account', argumentHint: '' },
    { name: 'memory', description: 'View and manage CLAUDE.md memory files', argumentHint: '' },
    { name: 'permissions', description: 'View and manage tool permissions', argumentHint: '' },
    { name: 'status', description: 'Show current session status and info', argumentHint: '' },
    { name: 'vim', description: 'Toggle vim keybindings mode', argumentHint: '' },
    { name: 'terminal-setup', description: 'Configure terminal integration (Shift+Enter)', argumentHint: '' },
    { name: 'config', description: 'Open or edit configuration', argumentHint: '' },
    { name: 'add-dir', description: 'Add a directory to the allowed list', argumentHint: '<directory>' },
    { name: 'mcp', description: 'View MCP server status and configuration', argumentHint: '' }
  ];

  // Build merged command list: built-in commands first, then skill commands
  const commands = [];
  const seenNames = new Set();

  // Add built-in commands
  for (const cmd of builtInCommands) {
    seenNames.add(cmd.name);
    commands.push(cmd);
  }

  // Add skill commands (these have better descriptions from SDK)
  for (const cmd of skillCommands) {
    if (!seenNames.has(cmd.name)) {
      seenNames.add(cmd.name);
      commands.push(cmd);
    }
  }

  // Sort alphabetically for easier discovery
  commands.sort((a, b) => a.name.localeCompare(b.name));

  return commands;
}

// Update session model
export async function setSessionModel(id, model) {
  const session = sessions.get(id);
  if (!session) {
    throw new Error(`Session ${id} not found`);
  }

  session.config.model = model;
  await saveSession(session);
  return session;
}
