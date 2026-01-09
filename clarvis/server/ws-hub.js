import { WebSocketServer } from 'ws';

let wss = null;
const clientSessions = new Map();

export function initWebSocket(server) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    const clientId = Math.random().toString(36).slice(2);
    clientSessions.set(clientId, { ws, subscribedSessions: new Set() });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        handleClientMessage(clientId, msg);
      } catch (e) {
        console.error('Invalid WebSocket message:', e);
      }
    });

    ws.on('close', () => {
      clientSessions.delete(clientId);
    });

    ws.send(JSON.stringify({ type: 'connected', clientId }));
  });

  return wss;
}

function handleClientMessage(clientId, msg) {
  const client = clientSessions.get(clientId);
  if (!client) return;

  switch (msg.type) {
    case 'subscribe':
      client.subscribedSessions.add(msg.sessionId);
      break;
    case 'unsubscribe':
      client.subscribedSessions.delete(msg.sessionId);
      break;
  }
}

export function broadcast(sessionId, message) {
  if (!wss) return;

  const payload = JSON.stringify({ sessionId, ...message });

  for (const [, client] of clientSessions) {
    if (client.subscribedSessions.has(sessionId) || message.type === 'session:created') {
      if (client.ws.readyState === 1) {
        client.ws.send(payload);
      }
    }
  }
}

export function broadcastAll(message) {
  if (!wss) return;

  const payload = JSON.stringify(message);
  for (const [, client] of clientSessions) {
    if (client.ws.readyState === 1) {
      client.ws.send(payload);
    }
  }
}

export function sendToClient(clientId, message) {
  const client = clientSessions.get(clientId);
  if (client?.ws.readyState === 1) {
    client.ws.send(JSON.stringify(message));
  }
}

export function getConnectedClients() {
  return clientSessions.size;
}
