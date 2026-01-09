export const state = {
  sessions: [],
  activeSessionId: null,
  messages: [],
  currentTool: null,
  pendingPermission: null,
  config: {
    workingDirectory: '',
    model: 'claude-sonnet-4-5',
    permissionMode: 'default'
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
    state.config = { ...session.config };
  } else {
    state.messages = [];
  }
  notify();
}

export function addSession(session) {
  state.sessions.push({ ...session, messages: [] });
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
