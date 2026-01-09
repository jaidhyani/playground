import { state } from './state.js';
import { renderMarkdown } from './markdown.js';
import { getVisibleMessages, renderLoadMoreBanner } from './virtual-scroll.js';

const $ = (sel) => document.querySelector(sel);
let visibleMessagesOffset = 0; // Track how many extra messages are loaded
let lastRenderedSessionId = null; // Track session changes
let lastSearchState = false; // Track search state changes

export function renderSessionList() {
  const container = $('#session-list');
  if (!container) return;

  if (state.sessions.length === 0) {
    container.innerHTML = '<p style="padding: 16px; color: var(--text-secondary)">No sessions</p>';
    return;
  }

  const activeSessions = state.sessions.filter(s => !s.archived);
  const archivedSessions = state.sessions.filter(s => s.archived);

  let html = activeSessions.map(session => renderSessionItem(session)).join('');

  if (archivedSessions.length > 0) {
    html += `
      <div class="session-section-header">
        <span>Archived (${archivedSessions.length})</span>
      </div>
    `;
    html += archivedSessions.map(session => renderSessionItem(session, true)).join('');
  }

  container.innerHTML = html;
}

function renderSessionItem(session, isArchived = false) {
  const unread = session.unreadCount || 0;
  const badgeHtml = unread > 0 ? `<span class="unread-badge">${unread}</span>` : '';
  const archiveBtn = isArchived
    ? `<button class="session-unarchive-btn" data-id="${session.id}" title="Restore session">↩</button>`
    : `<button class="session-archive-btn" data-id="${session.id}" title="Archive session">📦</button>`;

  // Use lastMessagePreview from API summary, or compute from loaded messages
  const lastMessage = session.messages?.[session.messages.length - 1];
  const previewText = lastMessage
    ? truncatePreview(lastMessage.content, 60)
    : (session.lastMessagePreview ? truncatePreview(session.lastMessagePreview, 60) : '');

  return `
    <div class="session-item ${session.id === state.activeSessionId ? 'active' : ''} ${isArchived ? 'archived' : ''}"
         data-id="${session.id}">
      <div class="session-item-content">
        <div class="session-item-title">
          ${escapeHtml(session.name || shortenPath(session.workingDirectory))}
          ${badgeHtml}
        </div>
        ${previewText ? `<div class="session-item-preview">${escapeHtml(previewText)}</div>` : ''}
        <div class="session-item-meta">
          <span class="status-badge ${session.status}">${session.status}</span>
          <span>${session.messageCount || 0} msgs</span>
          <span>${timeAgo(session.lastActivity)}</span>
        </div>
      </div>
      <div class="session-item-actions">
        ${archiveBtn}
        <button class="session-delete-btn" data-id="${session.id}" title="Delete session">✕</button>
      </div>
    </div>
  `;
}

function truncatePreview(content, maxLength) {
  if (!content || typeof content !== 'string') return '';
  const cleaned = content.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength) + '...';
}

export function renderMessages(forceFullRender = false) {
  const container = $('#messages');
  const emptyState = $('#empty-state');
  if (!container) return;

  if (!state.activeSessionId) {
    emptyState?.classList.remove('hidden');
    container.innerHTML = '';
    visibleMessagesOffset = 0;
    lastRenderedSessionId = null;
    return;
  }

  // Reset offset when switching sessions
  if (lastRenderedSessionId !== state.activeSessionId) {
    visibleMessagesOffset = 0;
    lastRenderedSessionId = state.activeSessionId;
    forceFullRender = true;
  }

  emptyState?.classList.add('hidden');

  // Disable virtual scroll during search to show all matching messages
  const isSearching = state.searchQuery && state.searchQuery.length > 0;

  // Force re-render when search state changes
  if (isSearching !== lastSearchState) {
    lastSearchState = isSearching;
    forceFullRender = true;
  }

  // Get visible messages (limited for performance, unless searching)
  const { visible, hiddenCount } = isSearching
    ? { visible: state.messages, hiddenCount: 0 }
    : getVisibleMessages(state.messages);
  const actualHidden = Math.max(0, hiddenCount - visibleMessagesOffset);

  // Check if we need to re-render or just append
  const existingMessages = container.querySelectorAll('.message').length;
  const existingBanner = container.querySelector('.load-more-banner');
  const expectedCount = visible.length + visibleMessagesOffset;

  // Force full render when message count exceeds limit (to show banner)
  const needsVirtualization = hiddenCount > 0 && !existingBanner && !isSearching;

  if (forceFullRender || existingMessages === 0 || existingBanner || needsVirtualization) {
    // Full re-render
    let html = renderLoadMoreBanner(actualHidden);

    const startIndex = Math.max(0, state.messages.length - expectedCount);
    const messagesToRender = state.messages.slice(startIndex);

    for (const msg of messagesToRender) {
      const content = msg.role === 'assistant'
        ? renderMarkdown(msg.content)
        : escapeHtml(msg.content);
      html += `<div class="message ${msg.role}"><div class="message-content">${content}</div></div>`;
    }

    container.innerHTML = html;

    // Bind load more button
    const loadMoreBtn = container.querySelector('.load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', loadMoreMessages);
    }
  } else {
    // Incremental append for new messages
    const newMessages = state.messages.slice(state.messages.length - expectedCount + existingMessages);
    for (const msg of newMessages) {
      const el = document.createElement('div');
      el.className = `message ${msg.role}`;

      const content = msg.role === 'assistant'
        ? renderMarkdown(msg.content)
        : escapeHtml(msg.content);

      el.innerHTML = `<div class="message-content">${content}</div>`;
      container.appendChild(el);
    }
  }

  // Apply search filtering
  applySearchFilter(container);

  container.scrollTop = container.scrollHeight;
}

function loadMoreMessages() {
  visibleMessagesOffset += 50; // Load 50 more messages
  renderMessages(true);
}

export function resetMessageOffset() {
  visibleMessagesOffset = 0;
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
  const stopBtn = $('#stop-btn');

  if (title) {
    title.textContent = session ? (session.name || shortenPath(session.workingDirectory)) : 'No session';
  }
  if (status) {
    status.textContent = session?.status || '-';
    status.className = `status-badge ${session?.status || ''}`;
  }
  if (stopBtn) {
    const isRunning = session?.status === 'running' || session?.status === 'waiting_permission';
    stopBtn.classList.toggle('hidden', !isRunning);
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
  const summary = $('#permission-summary');
  const input = $('#permission-input');

  if (!modal) return;

  if (!state.pendingPermission) {
    modal.classList.add('hidden');
    return;
  }

  modal.classList.remove('hidden');
  if (tool) tool.textContent = `Tool: ${state.pendingPermission.toolName}`;

  const fullInput = JSON.stringify(state.pendingPermission.input, null, 2);

  if (summary) {
    const truncated = fullInput.length > 100
      ? fullInput.slice(0, 100) + '...'
      : fullInput;
    summary.textContent = truncated;
  }

  if (input) {
    input.textContent = fullInput;
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
    const permissionTimeout = $('#config-permission-timeout');
    const systemPrompt = $('#config-system-prompt');
    if (cwd) cwd.value = state.config.workingDirectory || '';
    if (model) model.value = state.config.model;
    if (permission) permission.value = state.config.permissionMode;
    if (permissionTimeout) permissionTimeout.value = state.config.permissionTimeout || '';
    if (systemPrompt) systemPrompt.value = state.config.systemPrompt || '';
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
