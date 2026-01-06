// Tab Overview Extension - Main Popup Script

class TabOverview {
  constructor() {
    this.tabs = [];
    this.windows = [];
    this.tabGroups = [];
    this.screenshots = {};
    this.currentView = 'grid';
    this.currentWindowFilter = 'all';
    this.searchQuery = '';
    this.contextMenuTab = null;

    this.init();
  }

  async init() {
    await this.loadTabs();
    this.setupEventListeners();
    this.render();
  }

  async loadTabs() {
    try {
      // Get all windows with their tabs
      this.windows = await chrome.windows.getAll({ populate: true });
      this.tabs = this.windows.flatMap(w => w.tabs || []);

      // Try to get tab groups (Chrome 89+)
      try {
        this.tabGroups = await chrome.tabGroups.query({});
      } catch (e) {
        this.tabGroups = [];
      }

      // Capture screenshots of active tabs
      await this.captureScreenshots();

      this.updateStats();
      this.updateWindowFilter();
    } catch (error) {
      console.error('Error loading tabs:', error);
    }
  }

  async captureScreenshots() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'captureAllTabs'
      });

      if (response && response.success) {
        this.screenshots = response.screenshots;
      }
    } catch (error) {
      console.error('Error capturing screenshots:', error);
    }
  }

  setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.render();
    });

    // View toggle
    document.getElementById('viewGrid').addEventListener('click', () => {
      this.setView('grid');
    });

    document.getElementById('viewList').addEventListener('click', () => {
      this.setView('list');
    });

    // Window filter
    document.querySelector('.window-filter').addEventListener('click', (e) => {
      if (e.target.classList.contains('filter-btn')) {
        this.setWindowFilter(e.target.dataset.window);
      }
    });

    // Context menu
    document.getElementById('contextMenu').addEventListener('click', (e) => {
      if (e.target.dataset.action) {
        this.handleContextAction(e.target.dataset.action);
      }
    });

    // Close context menu on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.context-menu')) {
        this.hideContextMenu();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideContextMenu();
      }
      // Focus search on Ctrl/Cmd + F
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInput.focus();
      }
    });

    // Listen for tab changes
    chrome.tabs.onCreated.addListener(() => this.loadTabs());
    chrome.tabs.onRemoved.addListener(() => this.loadTabs());
    chrome.tabs.onUpdated.addListener(() => this.loadTabs());
    chrome.tabs.onActivated.addListener(() => this.loadTabs());
  }

  setView(view) {
    this.currentView = view;

    document.getElementById('viewGrid').classList.toggle('active', view === 'grid');
    document.getElementById('viewList').classList.toggle('active', view === 'list');

    const grid = document.getElementById('tabGrid');
    grid.classList.toggle('list-view', view === 'list');
  }

  setWindowFilter(windowId) {
    this.currentWindowFilter = windowId;

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.window === windowId);
    });

    this.render();
  }

  updateStats() {
    const tabCount = this.tabs.length;
    const windowCount = this.windows.filter(w => w.type === 'normal').length;

    document.getElementById('tabCount').textContent = `${tabCount} tab${tabCount !== 1 ? 's' : ''}`;
    document.getElementById('windowCount').textContent = `${windowCount} window${windowCount !== 1 ? 's' : ''}`;
  }

  updateWindowFilter() {
    const filterContainer = document.querySelector('.window-filter');
    const normalWindows = this.windows.filter(w => w.type === 'normal');

    filterContainer.innerHTML = `
      <button class="filter-btn ${this.currentWindowFilter === 'all' ? 'active' : ''}" data-window="all">All Windows</button>
      ${normalWindows.map((w, i) => `
        <button class="filter-btn ${this.currentWindowFilter === String(w.id) ? 'active' : ''}" data-window="${w.id}">
          Window ${i + 1} (${w.tabs.length})
        </button>
      `).join('')}
    `;
  }

  getFilteredTabs() {
    let filteredWindows = this.windows.filter(w => w.type === 'normal');

    if (this.currentWindowFilter !== 'all') {
      filteredWindows = filteredWindows.filter(w => String(w.id) === this.currentWindowFilter);
    }

    if (this.searchQuery) {
      return filteredWindows.map(w => ({
        ...w,
        tabs: w.tabs.filter(t =>
          t.title.toLowerCase().includes(this.searchQuery) ||
          t.url.toLowerCase().includes(this.searchQuery)
        )
      })).filter(w => w.tabs.length > 0);
    }

    return filteredWindows;
  }

  render() {
    const grid = document.getElementById('tabGrid');
    const filteredWindows = this.getFilteredTabs();

    if (filteredWindows.length === 0 || filteredWindows.every(w => w.tabs.length === 0)) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24">
            <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
          </svg>
          <p>${this.searchQuery ? 'No tabs match your search' : 'No tabs found'}</p>
        </div>
      `;
      return;
    }

    // Group tabs by window
    grid.innerHTML = filteredWindows.map((window, windowIndex) => {
      const tabs = this.renderTabs(window.tabs, window.id);

      if (this.currentWindowFilter === 'all' && filteredWindows.length > 1) {
        return `
          <div class="window-section">
            <div class="window-header">
              <h3>Window ${windowIndex + 1}</h3>
              <span class="tab-count">${window.tabs.length} tabs</span>
            </div>
            <div class="window-tabs">${tabs}</div>
          </div>
        `;
      }

      return tabs;
    }).join('');

    // Add event listeners to tab cards
    this.attachTabListeners();
  }

  renderTabs(tabs, windowId) {
    // Group tabs by their group
    const groupedTabs = this.groupTabsByGroup(tabs);

    return groupedTabs.map(group => {
      if (group.groupId && group.groupId !== -1) {
        const groupInfo = this.tabGroups.find(g => g.id === group.groupId);
        const color = groupInfo?.color || 'grey';
        const title = groupInfo?.title || 'Group';

        return `
          <div class="tab-group" style="background: ${this.getGroupColor(color)}20; border-left: 3px solid ${this.getGroupColor(color)}">
            <div class="tab-group-header">
              <span class="tab-group-color" style="background: ${this.getGroupColor(color)}"></span>
              <span>${title}</span>
            </div>
            ${group.tabs.map(tab => this.renderTabCard(tab, windowId)).join('')}
          </div>
        `;
      }

      return group.tabs.map(tab => this.renderTabCard(tab, windowId)).join('');
    }).join('');
  }

  groupTabsByGroup(tabs) {
    const groups = [];
    let currentGroup = { groupId: null, tabs: [] };

    tabs.forEach(tab => {
      const groupId = tab.groupId || -1;

      if (groupId !== currentGroup.groupId) {
        if (currentGroup.tabs.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = { groupId, tabs: [] };
      }

      currentGroup.tabs.push(tab);
    });

    if (currentGroup.tabs.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  getGroupColor(colorName) {
    const colors = {
      grey: '#5f6368',
      blue: '#1a73e8',
      red: '#d93025',
      yellow: '#f9ab00',
      green: '#188038',
      pink: '#d01884',
      purple: '#9334e6',
      cyan: '#007b83',
      orange: '#e8710a'
    };
    return colors[colorName] || colors.grey;
  }

  renderTabCard(tab, windowId) {
    const isActive = tab.active;
    const isPinned = tab.pinned;
    const hasScreenshot = this.screenshots[tab.id];
    const favicon = tab.favIconUrl || this.getDefaultFavicon(tab.url);

    const title = this.highlightSearch(this.escapeHtml(tab.title || 'Untitled'));
    const url = this.highlightSearch(this.escapeHtml(this.formatUrl(tab.url)));

    const badges = [];
    if (tab.audible) badges.push('<span class="badge audible">🔊</span>');
    if (tab.mutedInfo?.muted) badges.push('<span class="badge muted">🔇</span>');

    return `
      <div class="tab-card ${isActive ? 'active' : ''} ${isPinned ? 'pinned' : ''}"
           data-tab-id="${tab.id}"
           data-window-id="${windowId}">
        <div class="tab-preview">
          ${hasScreenshot
            ? `<img src="${hasScreenshot}" alt="Tab preview" loading="lazy">`
            : `<div class="placeholder"><img src="${favicon}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22 fill=%22%23666%22/></svg>'"></div>`
          }
          <button class="tab-close" title="Close tab">&times;</button>
          ${badges.length ? `<div class="tab-badges">${badges.join('')}</div>` : ''}
        </div>
        <div class="tab-info">
          <div class="tab-title">
            <img src="${favicon}" alt="" onerror="this.style.display='none'">
            <span>${title}</span>
          </div>
          <div class="tab-url">${url}</div>
        </div>
      </div>
    `;
  }

  highlightSearch(text) {
    if (!this.searchQuery) return text;

    const regex = new RegExp(`(${this.escapeRegex(this.searchQuery)})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + urlObj.pathname.slice(0, 30) + (urlObj.pathname.length > 30 ? '...' : '');
    } catch {
      return url.slice(0, 40);
    }
  }

  getDefaultFavicon(url) {
    try {
      const urlObj = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    } catch {
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="%23666"/></svg>';
    }
  }

  attachTabListeners() {
    document.querySelectorAll('.tab-card').forEach(card => {
      const tabId = parseInt(card.dataset.tabId);
      const windowId = parseInt(card.dataset.windowId);

      // Click to switch to tab
      card.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tab-close')) {
          this.switchToTab(tabId, windowId);
        }
      });

      // Close button
      card.querySelector('.tab-close').addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(tabId);
      });

      // Right-click context menu
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showContextMenu(e, tabId, windowId);
      });
    });
  }

  async switchToTab(tabId, windowId) {
    try {
      await chrome.windows.update(windowId, { focused: true });
      await chrome.tabs.update(tabId, { active: true });
      window.close();
    } catch (error) {
      console.error('Error switching to tab:', error);
    }
  }

  async closeTab(tabId) {
    try {
      await chrome.tabs.remove(tabId);
    } catch (error) {
      console.error('Error closing tab:', error);
    }
  }

  showContextMenu(e, tabId, windowId) {
    this.contextMenuTab = { tabId, windowId };
    const menu = document.getElementById('contextMenu');

    // Get tab info to update menu options
    const tab = this.tabs.find(t => t.id === tabId);
    if (tab) {
      const pinBtn = menu.querySelector('[data-action="pin"]');
      pinBtn.textContent = tab.pinned ? 'Unpin Tab' : 'Pin Tab';

      const muteBtn = menu.querySelector('[data-action="mute"]');
      muteBtn.textContent = tab.mutedInfo?.muted ? 'Unmute Tab' : 'Mute Tab';
    }

    // Position menu
    const x = Math.min(e.clientX, window.innerWidth - 170);
    const y = Math.min(e.clientY, window.innerHeight - 200);

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.add('visible');
  }

  hideContextMenu() {
    document.getElementById('contextMenu').classList.remove('visible');
    this.contextMenuTab = null;
  }

  async handleContextAction(action) {
    if (!this.contextMenuTab) return;

    const { tabId, windowId } = this.contextMenuTab;
    const tab = this.tabs.find(t => t.id === tabId);

    try {
      switch (action) {
        case 'reload':
          await chrome.tabs.reload(tabId);
          break;

        case 'duplicate':
          await chrome.tabs.duplicate(tabId);
          break;

        case 'pin':
          await chrome.tabs.update(tabId, { pinned: !tab?.pinned });
          break;

        case 'mute':
          await chrome.tabs.update(tabId, { muted: !tab?.mutedInfo?.muted });
          break;

        case 'close':
          await chrome.tabs.remove(tabId);
          break;

        case 'closeOthers':
          const window = this.windows.find(w => w.id === windowId);
          if (window) {
            const otherTabIds = window.tabs
              .filter(t => t.id !== tabId && !t.pinned)
              .map(t => t.id);
            await chrome.tabs.remove(otherTabIds);
          }
          break;

        case 'closeRight':
          const win = this.windows.find(w => w.id === windowId);
          if (win) {
            const tabIndex = win.tabs.findIndex(t => t.id === tabId);
            const rightTabIds = win.tabs
              .slice(tabIndex + 1)
              .filter(t => !t.pinned)
              .map(t => t.id);
            await chrome.tabs.remove(rightTabIds);
          }
          break;
      }
    } catch (error) {
      console.error('Error performing action:', error);
    }

    this.hideContextMenu();
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new TabOverview();
});
