import { randomBytes } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import qrcode from 'qrcode-terminal';

let authToken = null;
let tokenPath = null;

export async function initAuth(workingDirectory) {
  const clarvisDir = join(workingDirectory, '.clarvis');
  tokenPath = join(clarvisDir, 'auth-token');

  if (!existsSync(clarvisDir)) {
    await mkdir(clarvisDir, { recursive: true });
  }

  try {
    authToken = (await readFile(tokenPath, 'utf-8')).trim();
    console.log('Auth token loaded from', tokenPath);
  } catch {
    // Generate new token
    authToken = randomBytes(32).toString('hex');
    await writeFile(tokenPath, authToken, 'utf-8');
    printNewToken(authToken, tokenPath);
  }

  return authToken;
}

function printNewToken(token, path) {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                     AUTH TOKEN GENERATED                          ║');
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  console.log('║ Scan QR code or copy token below to authenticate:                 ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log('');
  qrcode.generate(token, { small: true });
  console.log('');
  console.log('Token:', token);
  console.log('Stored in:', path);
  console.log('');
}

export function getToken() {
  return authToken;
}

export async function regenerateToken() {
  authToken = randomBytes(32).toString('hex');
  if (tokenPath) {
    await writeFile(tokenPath, authToken, 'utf-8');
  }
  return authToken;
}

export function authMiddleware(req, res, next) {
  // Skip auth for static files
  if (!req.url.startsWith('/api/') && req.url !== '/ws') {
    return next();
  }

  // Skip if no token configured (development mode)
  if (!authToken) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Authorization required' }));
    return;
  }

  const token = authHeader.replace('Bearer ', '');
  if (token !== authToken) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid token' }));
    return;
  }

  next();
}

export function validateWsToken(token) {
  if (!authToken) return true;
  return token === authToken;
}
