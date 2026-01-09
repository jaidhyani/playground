import {
  state,
  addMessage,
  updateSession,
  setCurrentTool,
  setPendingPermission,
  addSession,
  removeSession,
  addToQueue,
  removeFromQueue,
  setTyping,
  setToolActivity
} from './state.js';

let ws = null;
let reconnectTimeout = null;
let reconnectDelay = 1000;

export function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onopen = () => {
    console.log('WebSocket connected');
    reconnectDelay = 1000;

    for (const session of state.sessions) {
      subscribe(session.id);
    }
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleMessage(msg);
    } catch (e) {
      console.error('WebSocket message parse error:', e);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket closed, reconnecting...');
    scheduleReconnect();
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

function scheduleReconnect() {
  if (reconnectTimeout) return;
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    connect();
  }, reconnectDelay);
}

function handleMessage(msg) {
  const sessionId = msg.sessionId;

  switch (msg.type) {
    case 'connected':
      console.log('WebSocket client ID:', msg.clientId);
      break;

    case 'session:created':
      addSession(msg.session);
      subscribe(msg.session.id);
      break;

    case 'session:deleted':
      removeSession(sessionId);
      break;

    case 'session:status':
      updateSession(sessionId, { status: msg.payload.status });
      if (msg.payload.status === 'running') {
        setTyping(true);
      } else {
        setTyping(false);
        setToolActivity(null);
      }
      break;

    case 'session:init':
      updateSession(sessionId, { agentSessionId: msg.payload.agentSessionId });
      break;

    case 'message:user':
      addMessage(sessionId, {
        role: 'user',
        content: msg.payload.content,
        timestamp: msg.payload.timestamp
      });
      break;

    case 'message:assistant':
      addMessage(sessionId, {
        role: 'assistant',
        content: formatContent(msg.payload.content),
        timestamp: msg.payload.timestamp
      });
      break;

    case 'tool:start':
      setCurrentTool({
        name: msg.payload.toolName,
        status: 'running',
        input: msg.payload.input
      });
      setToolActivity(formatToolActivity(msg.payload.toolName, msg.payload.input));
      setTyping(false);
      break;

    case 'tool:result':
      setCurrentTool({
        name: msg.payload.toolName,
        status: 'complete',
        result: msg.payload.result
      });
      setToolActivity(null);
      setTyping(true);
      break;

    case 'permission:request':
      setPendingPermission({
        requestId: msg.payload.requestId,
        toolName: msg.payload.toolName,
        input: msg.payload.input,
        sessionId
      });
      break;

    case 'error':
      console.error('Session error:', msg.payload.error);
      break;

    case 'queue:added':
      addToQueue(msg.payload);
      break;

    case 'queue:cancelled':
      removeFromQueue(msg.payload.promptId);
      break;

    case 'queue:processing':
      removeFromQueue(msg.payload.id);
      break;
  }
}

function formatContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');
  }
  return String(content);
}

function formatToolActivity(toolName, input) {
  const descriptions = {
    Read: () => `Reading ${input?.file_path || 'file'}...`,
    Write: () => `Writing ${input?.file_path || 'file'}...`,
    Edit: () => `Editing ${input?.file_path || 'file'}...`,
    Bash: () => `Running command...`,
    Glob: () => `Searching for ${input?.pattern || 'files'}...`,
    Grep: () => `Searching for "${input?.pattern || 'pattern'}"...`,
    WebFetch: () => `Fetching ${input?.url || 'URL'}...`,
    WebSearch: () => `Searching web...`,
    Task: () => `Running subtask...`
  };

  const formatter = descriptions[toolName];
  return formatter ? formatter() : `Using ${toolName}...`;
}

export function subscribe(sessionId) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'subscribe', sessionId }));
  }
}

export function unsubscribe(sessionId) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'unsubscribe', sessionId }));
  }
}
