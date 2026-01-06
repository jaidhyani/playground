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
    this.isCapturing = false;
    this.pendingTabIds = new Set(); // Track tabs we're closing to skip redundant updates
    this.pendingMoveTabIds = new Set(); // Track tabs we're moving to skip redundant updates
    this.loadDebounceTimer = null;
    this.groupByDomain = false;
    this.collapsedDomains = new Set();
    this.draggedTab = null;
    this.dropIndicator = null;
    this.dropTarget = null; // { tabId, windowId, position: 'before' | 'after' }

    this.init();
  }

  async init() {
    await this.loadTabs();
    this.setupEventListeners();
    this.createDropIndicator();
    this.render();
  }

  createDropIndicator() {
    this.dropIndicator = document.createElement('div');
    this.dropIndicator.className = 'drop-indicator';
    this.dropIndicator.style.display = 'none';
    document.body.appendChild(this.dropIndicator);
  }

  showDropIndicator(card, position) {
    const rect = card.getBoundingClientRect();
    const indicator = this.dropIndicator;

    indicator.style.display = 'block';
    indicator.style.height = `${rect.height}px`;
    indicator.style.top = `${rect.top}px`;

    if (position === 'before') {
      indicator.style.left = `${rect.left - 12}px`;
    } else {
      indicator.style.left = `${rect.right + 8}px`;
    }
  }

  hideDropIndicator() {
    if (this.dropIndicator) {
      this.dropIndicator.style.display = 'none';
    }
    this.dropTarget = null;
  }

  // Debounced version for event listeners
  debouncedLoadTabs() {
    if (this.loadDebounceTimer) {
      clearTimeout(this.loadDebounceTimer);
    }
    this.loadDebounceTimer = setTimeout(() => {
      this.loadTabs(true);
    }, 150);
  }

  async loadTabs(isFromEvent = false) {
    try {
      // Get all windows with their tabs
      this.windows = await chrome.windows.getAll({ populate: true });
      this.tabs = this.windows.flatMap(w => w.tabs || []);

      // Clean up pendingTabIds - remove any that no longer exist
      const currentTabIds = new Set(this.tabs.map(t => t.id));
      for (const id of this.pendingTabIds) {
        if (!currentTabIds.has(id)) {
          this.pendingTabIds.delete(id);
        }
      }

      // Try to get tab groups (Chrome 89+)
      try {
        this.tabGroups = await chrome.tabGroups.query({});
      } catch (e) {
        this.tabGroups = [];
      }

      // Only capture screenshots on initial load, not from events
      if (!isFromEvent) {
        await this.captureScreenshots();
      }

      this.updateStats();
      this.updateWindowFilter();
      this.render();
    } catch (error) {
      console.error('Error loading tabs:', error);
    }
  }

  async captureScreenshots() {
    try {
      // First, get any cached screenshots from background
      const cachedResponse = await chrome.runtime.sendMessage({
        action: 'getCachedScreenshots'
      });

      if (cachedResponse && cachedResponse.success) {
        this.screenshots = { ...this.screenshots, ...cachedResponse.screenshots };
      }

      // Then capture currently visible tabs (one per window)
      const response = await chrome.runtime.sendMessage({
        action: 'captureAllTabs'
      });

      if (response && response.success) {
        this.screenshots = { ...this.screenshots, ...response.screenshots };
      }
    } catch (error) {
      console.error('Error capturing screenshots:', error);
    }
  }

  async captureActiveTab() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'captureAllTabs'
      });

      if (response && response.success) {
        this.screenshots = { ...this.screenshots, ...response.screenshots };
        this.render();
      }
    } catch (error) {
      console.error('Error capturing active tab:', error);
    }
  }

  async captureAllPreviews() {
    if (this.isCapturing) return;

    this.isCapturing = true;
    const captureBtn = document.getElementById('captureBtn');
    this.updateCaptureButton(captureBtn, 0, 0);

    try {
      await chrome.runtime.sendMessage({
        action: 'captureAllTabPreviews'
      });
      // Streaming response - screenshots come via onMessage listener
    } catch (error) {
      console.error('Error starting capture:', error);
      this.finishCapture();
    }
  }

  updateCaptureButton(btn, captured, total) {
    if (!btn) return;
    btn.disabled = true;
    const progress = total > 0 ? ` (${captured}/${total})` : '...';
    btn.innerHTML = `
      <svg class="spinner-icon" viewBox="0 0 24 24" width="16" height="16">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="31.4 31.4" stroke-linecap="round"/>
      </svg>
      <span>Capturing${progress}</span>
    `;
  }

  finishCapture() {
    this.isCapturing = false;
    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) {
      captureBtn.disabled = false;
      captureBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path fill="currentColor" d="M9 3L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2h-3.17L15 3H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
        </svg>
        <span>Capture Previews</span>
      `;
    }
  }

  handleScreenshotMessage(message) {
    if (message.action === 'screenshotCaptured') {
      // Update the screenshot and refresh just that card (during bulk capture)
      this.screenshots[message.tabId] = message.dataUrl;
      this.updateTabCardPreview(message.tabId, message.dataUrl);

      // Update button progress
      const captureBtn = document.getElementById('captureBtn');
      this.updateCaptureButton(captureBtn, message.progress.captured, message.progress.total);
    } else if (message.action === 'screenshotUpdated') {
      // Real-time update when user switches tabs
      this.screenshots[message.tabId] = message.dataUrl;
      this.updateTabCardPreview(message.tabId, message.dataUrl);
    } else if (message.action === 'captureComplete') {
      this.finishCapture();
    } else if (message.action === 'captureError') {
      console.error('Capture error:', message.error);
      this.finishCapture();
    }
  }

  updateTabCardPreview(tabId, dataUrl) {
    const card = document.querySelector(`[data-tab-id="${tabId}"]`);
    if (!card) return;

    const preview = card.querySelector('.tab-preview');
    if (!preview) return;

    // Replace placeholder with actual screenshot
    const existingImg = preview.querySelector('img:not(.placeholder img)');
    const placeholder = preview.querySelector('.placeholder');

    if (placeholder) {
      // Create new image and fade it in
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = 'Tab preview';
      img.style.opacity = '0';
      img.style.transition = 'opacity 0.2s';
      preview.insertBefore(img, placeholder);

      img.onload = () => {
        img.style.opacity = '1';
        placeholder.remove();
      };
    } else if (existingImg) {
      existingImg.src = dataUrl;
    }
  }

  setupEventListeners() {
    // Listen for streamed screenshots from background
    chrome.runtime.onMessage.addListener((message) => {
      this.handleScreenshotMessage(message);
    });

    // Search input
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.render();
    });

    // Capture button
    document.getElementById('captureBtn').addEventListener('click', () => {
      this.captureAllPreviews();
    });

    // Group by domain toggle
    document.getElementById('groupByDomain').addEventListener('click', () => {
      this.toggleGroupByDomain();
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

    // Listen for tab changes with debouncing
    chrome.tabs.onCreated.addListener(() => this.debouncedLoadTabs());
    chrome.tabs.onRemoved.addListener((tabId) => {
      // Skip if we already handled this tab removal optimistically
      if (this.pendingTabIds.has(tabId)) {
        this.pendingTabIds.delete(tabId);
        return;
      }
      this.debouncedLoadTabs();
    });
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      // Skip if we're moving this tab
      if (this.pendingMoveTabIds.has(tabId)) {
        return;
      }
      // Only reload for meaningful changes
      if (changeInfo.status === 'complete' || changeInfo.title || changeInfo.favIconUrl) {
        this.debouncedLoadTabs();
      }
    });
    chrome.tabs.onMoved.addListener((tabId) => {
      // Skip if we already handled this move optimistically
      if (this.pendingMoveTabIds.has(tabId)) {
        return;
      }
      this.debouncedLoadTabs();
    });
    chrome.tabs.onActivated.addListener(() => {
      this.debouncedLoadTabs();
      // Screenshot capture is handled by background script and broadcast via screenshotUpdated
    });
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

  toggleGroupByDomain() {
    this.groupByDomain = !this.groupByDomain;
    document.getElementById('groupByDomain').classList.toggle('active', this.groupByDomain);
    this.render();
  }

  getDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return 'other';
    }
  }

  groupTabsByDomain(tabs) {
    const groups = new Map();

    tabs.forEach(tab => {
      const domain = this.getDomain(tab.url);
      if (!groups.has(domain)) {
        groups.set(domain, []);
      }
      groups.get(domain).push(tab);
    });

    // Sort groups by tab count (descending), then alphabetically
    return Array.from(groups.entries())
      .sort((a, b) => {
        if (b[1].length !== a[1].length) {
          return b[1].length - a[1].length;
        }
        return a[0].localeCompare(b[0]);
      });
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

    // Get all tabs from filtered windows
    const allTabs = filteredWindows.flatMap(w => w.tabs);

    if (this.groupByDomain) {
      // Render grouped by domain
      const domainGroups = this.groupTabsByDomain(allTabs);
      grid.innerHTML = domainGroups.map(([domain, tabs]) => this.renderDomainGroup(domain, tabs)).join('');
    } else {
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
    }

    // Add event listeners to tab cards
    this.attachTabListeners();
  }

  renderDomainGroup(domain, tabs) {
    const isCollapsed = this.collapsedDomains.has(domain);
    const favicon = tabs[0]?.favIconUrl || this.getDefaultFavicon(`https://${domain}`);

    return `
      <div class="domain-group ${isCollapsed ? 'collapsed' : ''}" data-domain="${this.escapeHtml(domain)}">
        <div class="domain-group-header">
          <img class="domain-group-icon" src="${favicon}" alt="" onerror="this.style.display='none'">
          <span class="domain-group-name">${this.escapeHtml(domain)}</span>
          <span class="domain-group-count">${tabs.length} tab${tabs.length !== 1 ? 's' : ''}</span>
          <svg class="domain-group-toggle" viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
          </svg>
        </div>
        <div class="domain-group-tabs">
          ${tabs.map(tab => this.renderTabCard(tab, tab.windowId)).join('')}
        </div>
      </div>
    `;
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
           data-window-id="${windowId}"
           data-tab-index="${tab.index}"
           draggable="true">
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
    const grid = document.getElementById('tabGrid');

    // Grid-level drag handlers for showing indicator
    grid.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!this.draggedTab) return;

      e.dataTransfer.dropEffect = 'move';

      // Find the card under the cursor
      const card = e.target.closest('.tab-card');
      if (card && !card.classList.contains('dragging')) {
        const tabId = parseInt(card.dataset.tabId);
        const windowId = parseInt(card.dataset.windowId);
        const rect = card.getBoundingClientRect();
        const mouseX = e.clientX;

        // Determine if we're on the left or right half of the card
        const position = mouseX < rect.left + rect.width / 2 ? 'before' : 'after';

        this.dropTarget = {
          tabId,
          windowId,
          index: parseInt(card.dataset.tabIndex),
          position
        };

        this.showDropIndicator(card, position);
      }
    });

    grid.addEventListener('dragleave', (e) => {
      // Only hide if we're actually leaving the grid
      if (!grid.contains(e.relatedTarget)) {
        this.hideDropIndicator();
      }
    });

    grid.addEventListener('drop', (e) => {
      e.preventDefault();
      if (this.draggedTab && this.dropTarget) {
        const { windowId, index, position } = this.dropTarget;
        // Calculate actual target index based on position
        let targetIndex = index;
        if (position === 'after') {
          targetIndex = index + 1;
        }

        // If moving within same window and dragged tab is before target, adjust index
        if (this.draggedTab.windowId === windowId && this.draggedTab.index < index) {
          targetIndex--;
        }

        this.moveTab(this.draggedTab.tabId, this.draggedTab.windowId, windowId, targetIndex);
      }
      this.hideDropIndicator();
    });

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

      // Drag start
      card.addEventListener('dragstart', (e) => {
        this.draggedTab = { tabId, windowId, index: parseInt(card.dataset.tabIndex) };
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', tabId.toString());

        // Use a timeout to allow the drag image to be created before we style it
        setTimeout(() => {
          card.style.opacity = '0.4';
        }, 0);
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        card.style.opacity = '';
        this.draggedTab = null;
        this.hideDropIndicator();
      });
    });

    // Domain group collapse/expand handlers
    document.querySelectorAll('.domain-group-header').forEach(header => {
      header.addEventListener('click', () => {
        const group = header.closest('.domain-group');
        const domain = group.dataset.domain;
        if (this.collapsedDomains.has(domain)) {
          this.collapsedDomains.delete(domain);
          group.classList.remove('collapsed');
        } else {
          this.collapsedDomains.add(domain);
          group.classList.add('collapsed');
        }
      });
    });
  }

  async moveTab(tabId, fromWindowId, toWindowId, targetIndex) {
    try {
      // Track this tab so we skip redundant Chrome events
      this.pendingMoveTabIds.add(tabId);

      // Optimistically update the DOM immediately for smooth UX
      const draggedCard = document.querySelector(`[data-tab-id="${tabId}"]`);
      const targetCard = document.querySelector(`[data-tab-id="${this.dropTarget?.tabId}"]`);

      if (draggedCard && targetCard && this.dropTarget) {
        // Move the card in the DOM
        const parent = targetCard.parentNode;
        if (this.dropTarget.position === 'before') {
          parent.insertBefore(draggedCard, targetCard);
        } else {
          parent.insertBefore(draggedCard, targetCard.nextSibling);
        }

        // Update data attributes to reflect new position
        draggedCard.dataset.windowId = toWindowId;
      }

      // Update local state without full re-render
      this.updateLocalTabOrder(tabId, fromWindowId, toWindowId, targetIndex);

      // Move the tab via Chrome API
      await chrome.tabs.move(tabId, {
        windowId: toWindowId,
        index: targetIndex
      });

      // Clear pending flag after a short delay to let any Chrome events settle
      setTimeout(() => {
        this.pendingMoveTabIds.delete(tabId);
      }, 300);
    } catch (error) {
      console.error('Error moving tab:', error);
      this.pendingMoveTabIds.delete(tabId);
      this.loadTabs(true);
    }
  }

  updateLocalTabOrder(tabId, fromWindowId, toWindowId, targetIndex) {
    // Find and remove the tab from its original window
    const fromWindow = this.windows.find(w => w.id === fromWindowId);
    const toWindow = this.windows.find(w => w.id === toWindowId);

    if (!fromWindow) return;

    const tabIndex = fromWindow.tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const [tab] = fromWindow.tabs.splice(tabIndex, 1);
    tab.windowId = toWindowId;

    // Insert into target window
    if (toWindow) {
      toWindow.tabs.splice(targetIndex, 0, tab);

      // Update indices for all tabs in affected windows
      fromWindow.tabs.forEach((t, i) => t.index = i);
      if (fromWindowId !== toWindowId) {
        toWindow.tabs.forEach((t, i) => t.index = i);
      }
    }

    // Update flat tabs array
    this.tabs = this.windows.flatMap(w => w.tabs || []);

    // Update stats without re-rendering
    this.updateStats();
  }

  async switchToTab(tabId, windowId) {
    try {
      await chrome.windows.update(windowId, { focused: true });
      await chrome.tabs.update(tabId, { active: true });
      // Don't close - we're in a full tab now, user can navigate back
    } catch (error) {
      console.error('Error switching to tab:', error);
    }
  }

  async closeTab(tabId) {
    try {
      // Track this tab so we skip the redundant onRemoved event
      this.pendingTabIds.add(tabId);

      // Remove from local state immediately for instant UI feedback
      this.tabs = this.tabs.filter(t => t.id !== tabId);
      this.windows = this.windows.map(w => ({
        ...w,
        tabs: w.tabs.filter(t => t.id !== tabId)
      }));
      delete this.screenshots[tabId];

      // Update UI immediately - just remove the element instead of full re-render
      const card = document.querySelector(`[data-tab-id="${tabId}"]`);
      if (card) {
        card.style.transform = 'scale(0.8)';
        card.style.opacity = '0';
        card.style.transition = 'transform 0.15s, opacity 0.15s';
        setTimeout(() => {
          card.remove();
          this.updateStats();
          this.updateWindowFilter();
        }, 150);
      } else {
        this.updateStats();
        this.updateWindowFilter();
      }

      // Then remove via Chrome API
      await chrome.tabs.remove(tabId);
    } catch (error) {
      console.error('Error closing tab:', error);
      this.pendingTabIds.delete(tabId);
      // Reload tabs if there was an error to restore correct state
      await this.loadTabs();
    }
  }

  async closeTabs(tabIds) {
    if (!tabIds.length) return;

    try {
      // Track these tabs so we skip the redundant onRemoved events
      tabIds.forEach(id => this.pendingTabIds.add(id));

      // Remove from local state immediately for instant UI feedback
      const tabIdSet = new Set(tabIds);
      this.tabs = this.tabs.filter(t => !tabIdSet.has(t.id));
      this.windows = this.windows.map(w => ({
        ...w,
        tabs: w.tabs.filter(t => !tabIdSet.has(t.id))
      }));
      tabIds.forEach(id => delete this.screenshots[id]);

      // Animate out and remove elements
      tabIds.forEach(id => {
        const card = document.querySelector(`[data-tab-id="${id}"]`);
        if (card) {
          card.style.transform = 'scale(0.8)';
          card.style.opacity = '0';
          card.style.transition = 'transform 0.15s, opacity 0.15s';
        }
      });

      setTimeout(() => {
        tabIds.forEach(id => {
          const card = document.querySelector(`[data-tab-id="${id}"]`);
          if (card) card.remove();
        });
        this.updateStats();
        this.updateWindowFilter();
      }, 150);

      // Then remove via Chrome API
      await chrome.tabs.remove(tabIds);
    } catch (error) {
      console.error('Error closing tabs:', error);
      tabIds.forEach(id => this.pendingTabIds.delete(id));
      // Reload tabs if there was an error to restore correct state
      await this.loadTabs();
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
          await this.closeTab(tabId);
          break;

        case 'closeOthers':
          const window = this.windows.find(w => w.id === windowId);
          if (window) {
            const otherTabIds = window.tabs
              .filter(t => t.id !== tabId && !t.pinned)
              .map(t => t.id);
            await this.closeTabs(otherTabIds);
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
            await this.closeTabs(rightTabIds);
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
