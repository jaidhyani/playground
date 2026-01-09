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

  container.innerHTML = state.sessions.map(session => {
    const unread = session.unreadCount || 0;
    const badgeHtml = unread > 0 ? `<span class="unread-badge">${unread}</span>` : '';
    return `
    <div class="session-item ${session.id === state.activeSessionId ? 'active' : ''}"
         data-id="${session.id}">
      <div class="session-item-content">
        <div class="session-item-title">
          ${escapeHtml(session.name || shortenPath(session.workingDirectory))}
          ${badgeHtml}
        </div>
        <div class="session-item-meta">
          <span class="status-badge ${session.status}">${session.status}</span>
          <span>${timeAgo(session.lastActivity)}</span>
        </div>
      </div>
      <button class="session-delete-btn" data-id="${session.id}" title="Delete session">✕</button>
    </div>
  `;
  }).join('');
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

  // Apply search filtering
  applySearchFilter(container);

  container.scrollTop = container.scrollHeight;
}

function applySearchFilter(container) {
  const messages = container.querySelectorAll('.message');
  const query = state.searchQuery?.toLowerCase() || '';

  messages.forEach((el, index) => {
    const msg = state.messages[index];
    if (!msg) return;

    const content = typeof msg.content === 'string' ? msg.content : '';
    const matches = query && content.toLowerCase().includes(query);

    // Show/hide based on search
    if (query) {
      el.classList.toggle('search-hidden', !matches);
    } else {
      el.classList.remove('search-hidden');
    }

    // Apply highlighting
    if (matches && query) {
      highlightText(el, query);
    } else {
      removeHighlights(el);
    }
  });
}

function highlightText(el, query) {
  const contentEl = el.querySelector('.message-content');
  if (!contentEl) return;

  // Remove existing highlights first
  removeHighlights(el);

  const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  for (const node of textNodes) {
    const text = node.textContent;
    const lowerText = text.toLowerCase();
    const index = lowerText.indexOf(query);

    if (index !== -1) {
      const before = text.slice(0, index);
      const match = text.slice(index, index + query.length);
      const after = text.slice(index + query.length);

      const span = document.createElement('span');
      span.className = 'search-highlight';
      span.textContent = match;

      const fragment = document.createDocumentFragment();
      if (before) fragment.appendChild(document.createTextNode(before));
      fragment.appendChild(span);
      if (after) fragment.appendChild(document.createTextNode(after));

      node.parentNode.replaceChild(fragment, node);
    }
  }
}

function removeHighlights(el) {
  el.querySelectorAll('.search-highlight').forEach(span => {
    const text = document.createTextNode(span.textContent);
    span.parentNode.replaceChild(text, span);
  });
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

export function renderActivityPanel() {
  const panel = $('#activity-panel');
  const typingIndicator = $('#typing-indicator');
  const toolActivity = $('#tool-activity');
  const toolActivityText = $('#tool-activity-text');

  if (!panel) return;

  const showTyping = state.isTyping;
  const showToolActivity = state.toolActivity !== null;

  if (!showTyping && !showToolActivity) {
    panel.classList.add('hidden');
    return;
  }

  panel.classList.remove('hidden');

  if (typingIndicator) {
    typingIndicator.classList.toggle('hidden', !showTyping);
  }

  if (toolActivity) {
    toolActivity.classList.toggle('hidden', !showToolActivity);
    if (toolActivityText && state.toolActivity) {
      toolActivityText.textContent = state.toolActivity;
    }
  }
}

export function renderErrorRetryPanel() {
  const panel = $('#error-retry-panel');
  if (!panel) return;

  if (!state.lastError || !state.lastPrompt) {
    panel.classList.add('hidden');
    return;
  }

  panel.classList.remove('hidden');
  const errorText = panel.querySelector('#error-text');
  if (errorText) {
    errorText.textContent = state.lastError;
  }
}

export function renderSearchBar() {
  const bar = $('#search-bar');
  const input = $('#search-input');
  const count = $('#search-results-count');

  if (!bar) return;

  if (state.searchOpen) {
    bar.classList.remove('hidden');

    // Update results count
    if (state.searchQuery) {
      const matches = countSearchMatches();
      count.textContent = `${matches} match${matches !== 1 ? 'es' : ''}`;
    } else {
      count.textContent = '';
    }
  } else {
    bar.classList.add('hidden');
  }
}

function countSearchMatches() {
  if (!state.searchQuery) return 0;
  const query = state.searchQuery.toLowerCase();
  return state.messages.filter(msg => {
    const content = typeof msg.content === 'string' ? msg.content : '';
    return content.toLowerCase().includes(query);
  }).length;
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
  renderActivityPanel();
  renderErrorRetryPanel();
  renderSearchBar();
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
