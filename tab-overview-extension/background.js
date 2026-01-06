// Background service worker for Tab Overview extension

// Cache for tab screenshots
const screenshotCache = new Map();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureTab') {
    captureTabScreenshot(request.tabId, request.windowId)
      .then(dataUrl => sendResponse({ success: true, dataUrl }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }

  if (request.action === 'captureAllTabs') {
    captureAllTabsInWindow(request.windowId)
      .then(screenshots => sendResponse({ success: true, screenshots }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'getTabGroups') {
    chrome.tabGroups.query({})
      .then(groups => sendResponse({ success: true, groups }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'captureAllTabPreviews') {
    captureAllTabPreviews()
      .then(screenshots => sendResponse({ success: true, screenshots }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'getCachedScreenshots') {
    // Return all cached screenshots
    const cached = {};
    for (const [key, value] of screenshotCache.entries()) {
      const tabId = parseInt(key.split('-')[0]);
      if (!isNaN(tabId)) {
        cached[tabId] = value;
      }
    }
    sendResponse({ success: true, screenshots: cached });
    return true;
  }
});

// Capture screenshot of a specific tab
async function captureTabScreenshot(tabId, windowId) {
  try {
    // First, we need to activate the tab to capture it
    const currentTab = await chrome.tabs.get(tabId);

    // Check cache first
    const cacheKey = `${tabId}-${currentTab.url}`;
    if (screenshotCache.has(cacheKey)) {
      return screenshotCache.get(cacheKey);
    }

    // For the active tab, we can capture directly
    if (currentTab.active) {
      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: 'jpeg',
        quality: 50
      });
      screenshotCache.set(cacheKey, dataUrl);
      return dataUrl;
    }

    // For inactive tabs, return null (we'll use favicon/placeholder)
    return null;
  } catch (error) {
    console.error('Error capturing tab:', error);
    return null;
  }
}

// Capture active tab in each window
async function captureAllTabsInWindow(windowId) {
  const screenshots = {};

  try {
    const windows = await chrome.windows.getAll({ populate: true });

    for (const win of windows) {
      if (win.type === 'normal') {
        try {
          const dataUrl = await chrome.tabs.captureVisibleTab(win.id, {
            format: 'jpeg',
            quality: 50
          });

          // Find the active tab in this window
          const activeTab = win.tabs.find(t => t.active);
          if (activeTab) {
            screenshots[activeTab.id] = dataUrl;
          }
        } catch (e) {
          // Window might not be visible or capturable
          console.log('Could not capture window:', win.id, e.message);
        }
      }
    }
  } catch (error) {
    console.error('Error capturing tabs:', error);
  }

  return screenshots;
}

// Capture previews of ALL tabs by briefly activating each one
async function captureAllTabPreviews() {
  const screenshots = {};

  try {
    const windows = await chrome.windows.getAll({ populate: true });

    for (const win of windows) {
      if (win.type !== 'normal') continue;

      // Remember the originally active tab
      const originalActiveTab = win.tabs.find(t => t.active);
      if (!originalActiveTab) continue;

      // Capture each tab in this window
      for (const tab of win.tabs) {
        try {
          // Skip chrome:// and other restricted URLs
          if (tab.url.startsWith('chrome://') ||
              tab.url.startsWith('chrome-extension://') ||
              tab.url.startsWith('devtools://') ||
              tab.url.startsWith('edge://') ||
              tab.url.startsWith('about:')) {
            continue;
          }

          // Activate the tab
          await chrome.tabs.update(tab.id, { active: true });

          // Small delay to let the tab render
          await new Promise(resolve => setTimeout(resolve, 150));

          // Capture the screenshot
          const dataUrl = await chrome.tabs.captureVisibleTab(win.id, {
            format: 'jpeg',
            quality: 60
          });

          screenshots[tab.id] = dataUrl;

          // Cache it
          const cacheKey = `${tab.id}-${tab.url}`;
          screenshotCache.set(cacheKey, dataUrl);

        } catch (e) {
          console.log('Could not capture tab:', tab.id, e.message);
        }
      }

      // Restore the original active tab
      try {
        await chrome.tabs.update(originalActiveTab.id, { active: true });
      } catch (e) {
        console.log('Could not restore original tab:', e.message);
      }
    }
  } catch (error) {
    console.error('Error capturing all tab previews:', error);
  }

  return screenshots;
}

// Clean up cache when tabs are updated or closed
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    // Clear cached screenshot for this tab
    for (const key of screenshotCache.keys()) {
      if (key.startsWith(`${tabId}-`)) {
        screenshotCache.delete(key);
      }
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const key of screenshotCache.keys()) {
    if (key.startsWith(`${tabId}-`)) {
      screenshotCache.delete(key);
    }
  }
});

// Limit cache size
setInterval(() => {
  if (screenshotCache.size > 100) {
    const keysToDelete = Array.from(screenshotCache.keys()).slice(0, 50);
    keysToDelete.forEach(key => screenshotCache.delete(key));
  }
}, 60000);
