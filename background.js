// ============================================================
// BACKGROUND SERVICE WORKER
// ============================================================

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({
    path: 'sidepanel.html',
    enabled: true
  });
});

// ============================================================
// MESSAGE ROUTING
// ============================================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // Google Doc fetch — called directly from sidepanel.js
  if (msg.type === 'FETCH_GOOGLE_DOC') {
    const url = msg.url || '';
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      sendResponse({ error: 'Could not extract Google Doc ID from URL.' });
      return true;
    }
    const exportUrl = `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
    fetch(exportUrl, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(text => {
        sendResponse({ content: text.substring(0, 15000) });
      })
      .catch(err => {
        sendResponse({ error: 'Google Docs fetch failed: ' + err.message });
      });
    return true;
  }

  return false;
});
