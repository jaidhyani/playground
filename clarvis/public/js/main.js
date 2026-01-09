import {
  state,
  subscribe,
  setActiveSession,
  toggleSidebar,
  toggleConfigPanel,
  setPendingPermission
} from './state.js';
import { connect, subscribe as wsSubscribe } from './ws.js';
import * as api from './api.js';
import { renderAll } from './render.js';

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
  renderAll();
}

function bindEvents() {
  $('#new-session-btn')?.addEventListener('click', createNewSession);

  $('#session-list')?.addEventListener('click', (e) => {
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

  $('#permission-allow')?.addEventListener('click', () => handlePermission('allow'));
  $('#permission-deny')?.addEventListener('click', () => handlePermission('deny'));

  $('#tool-toggle')?.addEventListener('click', toggleToolPanel);
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

function autoResize() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
}

init();
