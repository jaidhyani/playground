import { state } from './state.js';
import { renderMarkdown } from './markdown.js';

const $ = (sel) => document.querySelector(sel);

export function renderSessionList() {
  const container = $('#session-list');
  if (!container) return;

  if (state.sessions.length === 0) {
    container.innerHTML = '<p style="padding: 16px; color: var(--text-secondary)">No sessions</p>';
    return;
  }

  container.innerHTML = state.sessions.map(session => `
    <div class="session-item ${session.id === state.activeSessionId ? 'active' : ''}"
         data-id="${session.id}">
      <div class="session-item-title">${escapeHtml(session.name || shortenPath(session.workingDirectory))}</div>
      <div class="session-item-meta">
        <span class="status-badge ${session.status}">${session.status}</span>
        <span>${timeAgo(session.lastActivity)}</span>
      </div>
    </div>
  `).join('');
}

export function renderMessages() {
  const container = $('#messages');
  const emptyState = $('#empty-state');
  if (!container) return;

  if (!state.activeSessionId) {
    emptyState?.classList.remove('hidden');
    container.querySelectorAll('.message').forEach(el => el.remove());
    return;
  }

  emptyState?.classList.add('hidden');

  const existingMessages = container.querySelectorAll('.message').length;
  const newMessages = state.messages.slice(existingMessages);

  for (const msg of newMessages) {
    const el = document.createElement('div');
    el.className = `message ${msg.role}`;

    const content = msg.role === 'assistant'
      ? renderMarkdown(msg.content)
      : escapeHtml(msg.content);

    el.innerHTML = `<div class="message-content">${content}</div>`;
    container.appendChild(el);
  }

  container.scrollTop = container.scrollHeight;
}

export function renderSessionHeader() {
  const session = state.sessions.find(s => s.id === state.activeSessionId);
  const title = $('#session-title');
  const status = $('#session-status');

  if (title) {
    title.textContent = session ? (session.name || shortenPath(session.workingDirectory)) : 'No session';
  }
  if (status) {
    status.textContent = session?.status || '-';
    status.className = `status-badge ${session?.status || ''}`;
  }
}

export function renderToolPanel() {
  const panel = $('#tool-panel');
  const name = $('#tool-name');
  const status = $('#tool-status');
  const output = $('#tool-output');

  if (!panel) return;

  if (!state.currentTool) {
    panel.classList.add('hidden');
    return;
  }

  panel.classList.remove('hidden');
  if (name) name.textContent = state.currentTool.name;
  if (status) status.textContent = state.currentTool.status;
  if (output) {
    const content = state.currentTool.result || state.currentTool.input;
    output.textContent = typeof content === 'string'
      ? content
      : JSON.stringify(content, null, 2);
  }
}

export function renderPermissionModal() {
  const modal = $('#permission-modal');
  const tool = $('#permission-tool');
  const input = $('#permission-input');

  if (!modal) return;

  if (!state.pendingPermission) {
    modal.classList.add('hidden');
    return;
  }

  modal.classList.remove('hidden');
  if (tool) tool.textContent = `Tool: ${state.pendingPermission.toolName}`;
  if (input) {
    input.textContent = JSON.stringify(state.pendingPermission.input, null, 2);
  }
}

export function renderConfigPanel() {
  const panel = $('#config-panel');
  if (!panel) return;

  if (state.ui.configPanelOpen) {
    panel.classList.remove('hidden');
    const cwd = $('#config-cwd');
    const model = $('#config-model');
    const permission = $('#config-permission');
    if (cwd) cwd.value = state.config.workingDirectory;
    if (model) model.value = state.config.model;
    if (permission) permission.value = state.config.permissionMode;
  } else {
    panel.classList.add('hidden');
  }
}

export function renderSidebar() {
  const sidebar = $('#sidebar');
  if (sidebar) {
    sidebar.classList.toggle('open', state.ui.sidebarOpen);
  }
}

export function renderQueuePanel() {
  const panel = $('#queue-panel');
  const list = $('#queue-list');
  if (!panel || !list) return;

  if (state.promptQueue.length === 0) {
    panel.classList.add('hidden');
    return;
  }

  panel.classList.remove('hidden');
  list.innerHTML = state.promptQueue.map(item => `
    <div class="queue-item" data-id="${item.id}">
      <span class="queue-item-text">${escapeHtml(item.prompt)}</span>
      <button class="queue-item-cancel" data-prompt-id="${item.id}">✕</button>
    </div>
  `).join('');
}

export function renderAll() {
  renderSessionList();
  renderMessages();
  renderSessionHeader();
  renderToolPanel();
  renderPermissionModal();
  renderConfigPanel();
  renderSidebar();
  renderQueuePanel();
}

function shortenPath(path) {
  if (!path) return 'Unknown';
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 2) return path;
  return '.../' + parts.slice(-2).join('/');
}

function timeAgo(timestamp) {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
