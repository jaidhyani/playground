import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

import { initWebSocket, broadcastAll } from './ws-hub.js';
import { handleApiRequest } from './api.js';
import { initSessions, autoArchiveInactiveSessions } from './sessions.js';
import { initAuth, getToken } from './auth.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;
const AUTH_ENABLED = process.env.AUTH === 'true';
const AUTO_ARCHIVE_HOURS = parseFloat(process.env.AUTO_ARCHIVE_HOURS) || 0;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // Auth check for API endpoints (skip for auth status check)
  if (AUTH_ENABLED && url.pathname.startsWith('/api/') && url.pathname !== '/api/auth/token') {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    if (token !== getToken()) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
  }

  if (url.pathname.startsWith('/api/')) {
    return handleApiRequest(req, res, url);
  }

  await serveStatic(req, res, url);
});

async function serveStatic(req, res, url) {
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = join(PUBLIC_DIR, filePath);

  try {
    const stats = await stat(filePath);
    if (stats.isDirectory()) {
      filePath = join(filePath, 'index.html');
    }

    const content = await readFile(filePath);
    const ext = extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', mime);
    res.statusCode = 200;
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Not Found');
    } else {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Internal Server Error');
    }
  }
}

initWebSocket(server, AUTH_ENABLED ? getToken : null);

async function start() {
  const cwd = process.cwd();

  if (AUTH_ENABLED) {
    await initAuth(cwd);
  }

  await initSessions(cwd);

  // Set up auto-archive if configured
  if (AUTO_ARCHIVE_HOURS > 0) {
    const thresholdMs = AUTO_ARCHIVE_HOURS * 60 * 60 * 1000;
    const checkIntervalMs = Math.min(thresholdMs / 4, 60 * 60 * 1000); // Check at most every hour

    setInterval(async () => {
      const archivedIds = await autoArchiveInactiveSessions(thresholdMs);
      for (const id of archivedIds) {
        broadcastAll({ type: 'session:archived', sessionId: id, payload: { archived: true } });
      }
      if (archivedIds.length > 0) {
        console.log(`Auto-archived ${archivedIds.length} inactive session(s)`);
      }
    }, checkIntervalMs);

    console.log(`Auto-archive enabled: sessions inactive for ${AUTO_ARCHIVE_HOURS}h will be archived`);
  }

  server.listen(PORT, () => {
    console.log(`Clarvis running at http://localhost:${PORT}`);
    if (AUTH_ENABLED) {
      console.log(`Auth enabled - token required for API access`);
      console.log(`Token stored in: ${cwd}/.clarvis/auth-token`);
    }
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
