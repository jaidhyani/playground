import {
  state,
  subscribe,
  setActiveSession,
  toggleSidebar,
  toggleConfigPanel,
  setPendingPermission,
  addSession,
  setLastError,
  setSearchQuery,
  setSearchOpen
} from './state.js';
import { connect, subscribe as wsSubscribe } from './ws.js';
import * as api from './api.js';
import { renderAll, renderSessionHeader, renderSessionList } from './render.js';
import { initLightbox, handleImageClick } from './lightbox.js';
import { initToast } from './toast.js';
import { requestPermission as requestNotificationPermission } from './notifications.js';

const $ = (sel) => document.querySelector(sel);

async function init() {
  subscribe(renderAll);

  try {
    const sessions = await api.getSessions();
    if (Array.isArray(sessions)) {
      for (const session of sessions) {
        state.sessions.push({ ...session, messages: [] });
      }

      if (sessions.length > 0) {
        const firstSession = await api.getSession(sessions[0].id);
        state.sessions[0].messages = firstSession.messages || [];
        state.sessions[0].config = firstSession.config;
        setActiveSession(sessions[0].id);
      }
    }
  } catch (err) {
    console.error('Failed to load sessions:', err);
  }

  connect();
  bindEvents();
  initLightbox();
  initToast();
  requestNotificationPermission();
  initAuthSection();
  renderAll();
}

function bindEvents() {
  $('#new-session-btn')?.addEventListener('click', createNewSession);

  $('#session-list')?.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.session-delete-btn');
    if (deleteBtn) {
      e.stopPropagation();
      handleDeleteSession(deleteBtn.dataset.id);
      return;
    }

    const item = e.target.closest('.session-item');
    if (item) {
      await selectSession(item.dataset.id);
    }
  });

  $('#send-btn')?.addEventListener('click', sendMessage);

  $('#prompt-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  $('#prompt-input')?.addEventListener('input', autoResize);

  $('#menu-btn')?.addEventListener('click', () => toggleSidebar());

  $('#config-btn')?.addEventListener('click', () => toggleConfigPanel());
  $('#close-config')?.addEventListener('click', () => toggleConfigPanel(false));

  $('#fork-btn')?.addEventListener('click', forkCurrentSession);

  $('#permission-allow')?.addEventListener('click', () => handlePermission('allow'));
  $('#permission-deny')?.addEventListener('click', () => handlePermission('deny'));

  $('#tool-toggle')?.addEventListener('click', toggleToolPanel);

  $('#queue-list')?.addEventListener('click', handleQueueClick);

  $('#messages')?.addEventListener('click', handleImageClick);

  $('#session-title')?.addEventListener('click', startRename);

  $('#retry-btn')?.addEventListener('click', retryLastPrompt);
  $('#dismiss-error-btn')?.addEventListener('click', dismissError);

  $('#search-btn')?.addEventListener('click', openSearch);
  $('#search-close')?.addEventListener('click', closeSearch);
  $('#search-input')?.addEventListener('input', handleSearchInput);
  $('#search-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSearch();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl+F to open search
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      openSearch();
    }
  });
}

function toggleToolPanel() {
  const wrapper = $('#tool-output-wrapper');
  if (wrapper) {
    wrapper.classList.toggle('collapsed');
  }
}

async function selectSession(sessionId) {
  const session = state.sessions.find(s => s.id === sessionId);
  if (!session) return;

  // Load full session data if not already loaded (config, messages)
  if (!session.config) {
    const fullSession = await api.getSession(sessionId);
    session.messages = fullSession.messages || [];
    session.config = fullSession.config;
  }

  setActiveSession(sessionId);
}

async function createNewSession() {
  const cwd = $('#config-cwd')?.value || '';
  const model = $('#config-model')?.value || 'claude-sonnet-4-5';
  const permissionMode = $('#config-permission')?.value || 'default';
  const permissionTimeoutVal = $('#config-permission-timeout')?.value;
  const permissionTimeout = permissionTimeoutVal ? parseInt(permissionTimeoutVal, 10) : null;
  const systemPrompt = $('#config-system-prompt')?.value || '';

  const session = await api.createSession({
    workingDirectory: cwd,
    model,
    permissionMode,
    permissionTimeout,
    systemPrompt: systemPrompt || undefined
  });

  // Add session with its config (addSession checks for duplicates)
  addSession(session);
  state.config = { ...session.config };
  setActiveSession(session.id);
  wsSubscribe(session.id);
  toggleSidebar(false);
}

async function sendMessage() {
  const input = $('#prompt-input');
  const prompt = input?.value.trim();

  if (!prompt || !state.activeSessionId) return;

  input.value = '';
  autoResize.call(input);

  await api.sendPrompt(state.activeSessionId, prompt);
}

async function handlePermission(decision) {
  if (!state.pendingPermission) return;

  await api.respondPermission(state.pendingPermission.requestId, decision);
  setPendingPermission(null);
}

async function forkCurrentSession() {
  if (!state.activeSessionId) return;

  const forked = await api.forkSession(state.activeSessionId);
  addSession({ ...forked, messages: [] });
  setActiveSession(forked.id);

  const fullSession = await api.getSession(forked.id);
  const session = state.sessions.find(s => s.id === forked.id);
  if (session) {
    session.messages = fullSession.messages || [];
    session.config = fullSession.config;
  }
  renderAll();
}

function autoResize() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
}

async function handleQueueClick(e) {
  const cancelBtn = e.target.closest('.queue-item-cancel');
  if (!cancelBtn) return;

  const promptId = cancelBtn.dataset.promptId;
  if (promptId && state.activeSessionId) {
    await api.cancelQueuedPrompt(state.activeSessionId, promptId);
  }
}

function startRename() {
  if (!state.activeSessionId) return;

  const titleEl = $('#session-title');
  if (!titleEl || titleEl.tagName === 'INPUT') return;

  const session = state.sessions.find(s => s.id === state.activeSessionId);
  if (!session) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'session-title-input';
  input.className = 'session-title-input';
  input.value = session.name;

  input.addEventListener('blur', () => finishRename(input));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
    if (e.key === 'Escape') {
      input.value = session.name;
      input.blur();
    }
  });

  titleEl.replaceWith(input);
  input.focus();
  input.select();
}

async function finishRename(input) {
  const newName = input.value.trim();
  const session = state.sessions.find(s => s.id === state.activeSessionId);

  if (newName && newName !== session?.name) {
    await api.renameSession(state.activeSessionId, newName);
  }

  const span = document.createElement('span');
  span.id = 'session-title';
  span.textContent = session?.name || 'No session';
  span.addEventListener('click', startRename);

  input.replaceWith(span);
  renderSessionHeader();
  renderSessionList();
}

async function retryLastPrompt() {
  if (!state.lastPrompt || !state.activeSessionId) return;

  setLastError(null);
  await api.sendPrompt(state.activeSessionId, state.lastPrompt);
}

function dismissError() {
  setLastError(null);
}

async function handleDeleteSession(sessionId) {
  const session = state.sessions.find(s => s.id === sessionId);
  if (!session) return;

  const confirmed = confirm(`Delete session "${session.name}"?\n\nThis cannot be undone.`);
  if (!confirmed) return;

  await api.deleteSession(sessionId);
}

function openSearch() {
  setSearchOpen(true);
  setTimeout(() => {
    $('#search-input')?.focus();
  }, 0);
}

function closeSearch() {
  setSearchOpen(false);
  $('#search-input').value = '';
}

function handleSearchInput(e) {
  setSearchQuery(e.target.value);
}

// Auth token management
let cachedToken = null;
let tokenVisible = false;

async function initAuthSection() {
  const section = $('#auth-section');
  if (!section) return;

  const authInfo = await api.getAuthToken();
  if (!authInfo.enabled) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  cachedToken = authInfo.token;

  $('#token-show-btn')?.addEventListener('click', toggleTokenVisibility);
  $('#token-copy-btn')?.addEventListener('click', copyToken);
  $('#token-regenerate-btn')?.addEventListener('click', regenerateToken);
}

function toggleTokenVisibility() {
  if (!tokenVisible) {
    const confirmed = confirm('Show auth token?\n\nMake sure no one is looking at your screen.');
    if (!confirmed) return;
  }

  tokenVisible = !tokenVisible;
  const valueEl = $('#token-value');
  const showBtn = $('#token-show-btn');
  const copyBtn = $('#token-copy-btn');

  if (tokenVisible) {
    valueEl.textContent = cachedToken;
    valueEl.classList.remove('token-hidden');
    showBtn.textContent = 'Hide';
    copyBtn.classList.remove('hidden');
  } else {
    valueEl.textContent = '••••••••••••••••';
    valueEl.classList.add('token-hidden');
    showBtn.textContent = 'Show';
    copyBtn.classList.add('hidden');
  }
}

async function copyToken() {
  if (!cachedToken) return;

  try {
    await navigator.clipboard.writeText(cachedToken);
    const copyBtn = $('#token-copy-btn');
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 1500);
  } catch {
    alert('Failed to copy token');
  }
}

async function regenerateToken() {
  const confirmed = confirm(
    'Regenerate auth token?\n\n' +
    'This will invalidate the current token.\n' +
    'All connected clients will need the new token.'
  );
  if (!confirmed) return;

  const result = await api.regenerateAuthToken();
  cachedToken = result.token;

  if (tokenVisible) {
    $('#token-value').textContent = cachedToken;
  }

  alert('Token regenerated successfully.');
}

init();
