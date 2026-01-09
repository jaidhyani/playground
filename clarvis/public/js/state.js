export const state = {
  sessions: [],
  activeSessionId: null,
  messages: [],
  promptQueue: [],
  currentTool: null,
  pendingPermission: null,
  isTyping: false,
  toolActivity: null,
  lastPrompt: null,
  lastError: null,
  searchQuery: '',
  searchOpen: false,
  config: {
    workingDirectory: '',
    model: 'claude-sonnet-4-5',
    permissionMode: 'default',
    permissionTimeout: null,
    systemPrompt: ''
  },
  ui: {
    sidebarOpen: false,
    configPanelOpen: false
  }
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  for (const fn of listeners) {
    try {
      fn(state);
    } catch (e) {
      console.error('State listener error:', e);
    }
  }
}

export function setActiveSession(id) {
  state.activeSessionId = id;
  const session = state.sessions.find(s => s.id === id);
  if (session) {
    state.messages = session.messages || [];
    state.promptQueue = session.promptQueue || [];
    state.config = { ...session.config };
    session.unreadCount = 0;
  } else {
    state.messages = [];
    state.promptQueue = [];
  }
  notify();
}

export function addSession(session) {
  // Avoid duplicates (e.g., from WS when we already added locally)
  if (state.sessions.some(s => s.id === session.id)) return;
  state.sessions.push({
    ...session,
    messages: session.messages || [],
    unreadCount: session.unreadCount || 0
  });
  notify();
}

export function updateSession(id, updates) {
  const session = state.sessions.find(s => s.id === id);
  if (session) {
    Object.assign(session, updates);
    notify();
  }
}

export function removeSession(id) {
  state.sessions = state.sessions.filter(s => s.id !== id);
  if (state.activeSessionId === id) {
    state.activeSessionId = state.sessions[0]?.id || null;
  }
  notify();
}

export function addMessage(sessionId, message) {
  const session = state.sessions.find(s => s.id === sessionId);
  if (session) {
    if (!session.messages) session.messages = [];
    session.messages.push(message);
    if (sessionId === state.activeSessionId) {
      state.messages = session.messages;
    } else if (message.role === 'assistant') {
      session.unreadCount = (session.unreadCount || 0) + 1;
    }
    notify();
  }
}

export function setCurrentTool(tool) {
  state.currentTool = tool;
  notify();
}

export function setPendingPermission(permission) {
  state.pendingPermission = permission;
  notify();
}

export function toggleSidebar(open) {
  state.ui.sidebarOpen = open ?? !state.ui.sidebarOpen;
  notify();
}

export function toggleConfigPanel(open) {
  state.ui.configPanelOpen = open ?? !state.ui.configPanelOpen;
  notify();
}

export function addToQueue(queuedPrompt) {
  state.promptQueue.push(queuedPrompt);
  notify();
}

export function removeFromQueue(promptId) {
  state.promptQueue = state.promptQueue.filter(p => p.id !== promptId);
  notify();
}

export function setQueue(queue) {
  state.promptQueue = queue;
  notify();
}

export function setTyping(isTyping) {
  state.isTyping = isTyping;
  notify();
}

export function setToolActivity(activity) {
  state.toolActivity = activity;
  notify();
}

export function setLastPrompt(prompt) {
  state.lastPrompt = prompt;
  notify();
}

export function setLastError(error) {
  state.lastError = error;
  notify();
}

export function setSearchQuery(query) {
  state.searchQuery = query;
  notify();
}

export function setSearchOpen(open) {
  state.searchOpen = open;
  if (!open) {
    state.searchQuery = '';
  }
  notify();
}
