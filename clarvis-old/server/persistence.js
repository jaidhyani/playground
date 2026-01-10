import { mkdir, writeFile, readFile, readdir, rm } from 'fs/promises';
import { join, basename } from 'path';
import { existsSync } from 'fs';

const CLARVIS_DIR = '.clarvis';
const SESSIONS_FILE = 'sessions.json';

function getStoragePath(workingDirectory) {
  return join(workingDirectory || process.cwd(), CLARVIS_DIR);
}

function getSessionsPath(workingDirectory) {
  return join(getStoragePath(workingDirectory), SESSIONS_FILE);
}

export async function ensureStorageDir(workingDirectory) {
  const storagePath = getStoragePath(workingDirectory);
  if (!existsSync(storagePath)) {
    await mkdir(storagePath, { recursive: true });
  }
  return storagePath;
}

export async function saveSession(session) {
  const storagePath = await ensureStorageDir(session.config.workingDirectory);
  const sessionPath = join(storagePath, `session-${session.id}.json`);

  const serializable = {
    id: session.id,
    name: session.name || basename(session.config.workingDirectory),
    status: session.status === 'running' ? 'idle' : session.status,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity,
    messageCount: session.messageCount,
    config: session.config,
    messages: session.messages,
    agentSessionId: session.agentSessionId
  };

  await writeFile(sessionPath, JSON.stringify(serializable, null, 2));
  return sessionPath;
}

export async function loadSession(workingDirectory, sessionId) {
  const storagePath = getStoragePath(workingDirectory);
  const sessionPath = join(storagePath, `session-${sessionId}.json`);

  try {
    const data = await readFile(sessionPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function deleteSessionFile(workingDirectory, sessionId) {
  const storagePath = getStoragePath(workingDirectory);
  const sessionPath = join(storagePath, `session-${sessionId}.json`);

  try {
    await rm(sessionPath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

export async function loadAllSessions(workingDirectory) {
  const storagePath = getStoragePath(workingDirectory);

  if (!existsSync(storagePath)) {
    return [];
  }

  try {
    const files = await readdir(storagePath);
    const sessionFiles = files.filter(f => f.startsWith('session-') && f.endsWith('.json'));

    const sessions = [];
    for (const file of sessionFiles) {
      try {
        const data = await readFile(join(storagePath, file), 'utf-8');
        sessions.push(JSON.parse(data));
      } catch (err) {
        console.error(`Failed to load session ${file}:`, err.message);
      }
    }

    return sessions.sort((a, b) => b.lastActivity - a.lastActivity);
  } catch (err) {
    console.error('Failed to load sessions:', err.message);
    return [];
  }
}

export async function loadSessionsFromMultipleDirectories(directories) {
  const allSessions = [];

  for (const dir of directories) {
    const sessions = await loadAllSessions(dir);
    allSessions.push(...sessions);
  }

  return allSessions.sort((a, b) => b.lastActivity - a.lastActivity);
}
