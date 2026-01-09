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

  const sessions = await api.getSessions();
  for (const session of sessions) {
    state.sessions.push({ ...session, messages: [] });
  }

  if (sessions.length > 0) {
    const firstSession = await api.getSession(sessions[0].id);
    state.sessions[0].messages = firstSession.messages || [];
    state.sessions[0].config = firstSession.config;
    setActiveSession(sessions[0].id);
  }

  connect();
  bindEvents();
  initLightbox();
  initToast();
  requestNotificationPermission();
  renderAll();
}

function bindEvents() {
  $('#new-session-btn')?.addEventListener('click', createNewSession);

  $('#session-list')?.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.session-delete-btn');
    if (deleteBtn) {
      e.stopPropagation();
      handleDeleteSession(deleteBtn.dataset.id);
      return;
    }

    const item = e.target.closest('.session-item');
    if (item) {
      setActiveSession(item.dataset.id);
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
}

function toggleToolPanel() {
  const wrapper = $('#tool-output-wrapper');
  if (wrapper) {
    wrapper.classList.toggle('collapsed');
  }
}

async function createNewSession() {
  const cwd = $('#config-cwd')?.value || '';
  const model = $('#config-model')?.value || 'claude-sonnet-4-5';
  const permissionMode = $('#config-permission')?.value || 'default';

  const session = await api.createSession({
    workingDirectory: cwd,
    model,
    permissionMode
  });

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

init();
