// Background service worker for Tab Overview extension

// Cache for tab screenshots
const screenshotCache = new Map();

// URL of the overview page
const OVERVIEW_URL = chrome.runtime.getURL('overview.html');

// Check if a URL can be captured (only http/https are reliably capturable)
function isCapturableUrl(url) {
  return url && (url.startsWith('http://') || url.startsWith('https://'));
}

// Open overview page when extension icon is clicked
chrome.action.onClicked.addListener(async () => {
  // Check if overview tab already exists
  const tabs = await chrome.tabs.query({ url: OVERVIEW_URL });

  if (tabs.length > 0) {
    // Focus existing overview tab
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    // Open new overview tab
    await chrome.tabs.create({ url: OVERVIEW_URL });
  }
});

// Capture screenshot when a tab is activated and broadcast to overview
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);

    // Only capture http/https URLs (skip internal/extension pages)
    if (!isCapturableUrl(tab.url)) {
      return;
    }

    // Small delay to let the tab render
    await new Promise(resolve => setTimeout(resolve, 100));

    // Use vanilla captureVisibleTab for the active/focused tab (simpler and less disruptive)
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg',
      quality: 70
    });

    if (dataUrl) {
      // Cache it
      const cacheKey = `${tab.id}-${tab.url}`;
      screenshotCache.set(cacheKey, dataUrl);

      // Broadcast to any listening overview pages
      chrome.runtime.sendMessage({
        action: 'screenshotUpdated',
        tabId: tab.id,
        dataUrl: dataUrl
      }).catch(() => {
        // No listeners, ignore
      });
    }
  } catch (error) {
    console.log('Error capturing on activation:', error.message);
  }
});

// Listen for messages from overview page
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
    // Start capture and stream results back
    captureAllTabPreviewsStreaming(sender.tab?.id);
    sendResponse({ success: true, streaming: true });
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

// Capture a single tab using the debugger API (no tab switching required)
async function captureTabWithDebugger(tabId) {
  const debuggee = { tabId };

  try {
    // Attach debugger to the tab
    await chrome.debugger.attach(debuggee, '1.3');

    // Capture screenshot using DevTools Protocol
    const result = await chrome.debugger.sendCommand(debuggee, 'Page.captureScreenshot', {
      format: 'jpeg',
      quality: 70
    });

    // Detach debugger
    await chrome.debugger.detach(debuggee);

    if (result && result.data) {
      return `data:image/jpeg;base64,${result.data}`;
    }
    return null;
  } catch (error) {
    // Try to detach if we attached
    try {
      await chrome.debugger.detach(debuggee);
    } catch (e) {
      // Ignore detach errors
    }
    console.log('Debugger capture failed for tab', tabId, error.message);
    return null;
  }
}

// Capture previews of ALL tabs using debugger API, streaming results back
async function captureAllTabPreviewsStreaming() {
  try {
    const windows = await chrome.windows.getAll({ populate: true });
    const allTabs = windows
      .filter(w => w.type === 'normal')
      .flatMap(w => w.tabs);

    const totalTabs = allTabs.filter(tab => isCapturableUrl(tab.url)).length;

    let captured = 0;

    for (const win of windows) {
      if (win.type !== 'normal') continue;

      for (const tab of win.tabs) {
        try {
          // Only capture http/https URLs
          if (!isCapturableUrl(tab.url)) {
            continue;
          }

          // Use debugger API to capture without switching tabs
          const dataUrl = await captureTabWithDebugger(tab.id);

          if (dataUrl) {
            // Cache it
            const cacheKey = `${tab.id}-${tab.url}`;
            screenshotCache.set(cacheKey, dataUrl);

            captured++;

            // Send this screenshot immediately to the popup
            chrome.runtime.sendMessage({
              action: 'screenshotCaptured',
              tabId: tab.id,
              dataUrl: dataUrl,
              progress: { captured, total: totalTabs }
            }).catch(() => {
              // Popup might be closed, ignore
            });
          }
        } catch (e) {
          console.log('Could not capture tab:', tab.id, e.message);
        }
      }
    }

    // Signal completion
    chrome.runtime.sendMessage({
      action: 'captureComplete',
      progress: { captured, total: totalTabs }
    }).catch(() => {});

  } catch (error) {
    console.error('Error capturing all tab previews:', error);
    chrome.runtime.sendMessage({
      action: 'captureError',
      error: error.message
    }).catch(() => {});
  }
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
