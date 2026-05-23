// ============================================================
// CONTENT SCRIPT — Jenny Copilot
// ============================================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // READ PAGE — full readable text
  if (msg.type === 'READ_PAGE') {
    try {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('script, style, noscript, svg').forEach(el => el.remove());
      const text = (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
      const title = document.title || '';
      const url = window.location.href;
      const content = `Page: ${title}\nURL: ${url}\n\n${text}`.substring(0, 15000);
      sendResponse({ content });
    } catch (e) {
      sendResponse({ error: 'Content script error: ' + e.message });
    }
    return true;
  }

  // SNAPSHOT — interactive elements map
  if (msg.type === 'SNAPSHOT') {
    try {
      const title = document.title || '';
      const url = window.location.href;
      const selectors = 'a, button, input, select, textarea, [role="button"], [role="link"], [onclick]';
      const elements = Array.from(document.querySelectorAll(selectors));

      let lines = [`Page: ${title}`, `URL: ${url}`, ``, `Interactive Elements:`];
      let count = 0;

      elements.forEach((el) => {
        if (count >= 80) return;
        const tag = el.tagName.toLowerCase();
        const type = el.type || '';
        const text = (el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().substring(0, 80);
        const href = el.href ? el.href.substring(0, 80) : '';
        const id = el.id ? `#${el.id}` : '';
        const cls = el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/)[0]}` : '';

        let desc = `[${count + 1}] <${tag}${type ? ' type=' + type : ''}${id}${cls}>`;
        if (text) desc += ` "${text}"`;
        if (href) desc += ` → ${href}`;
        lines.push(desc);
        count++;
      });

      const content = lines.join('\n').substring(0, 15000);
      sendResponse({ content });
    } catch (e) {
      sendResponse({ error: 'Snapshot error: ' + e.message });
    }
    return true;
  }

  return false;
});
