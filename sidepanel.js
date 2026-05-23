// ============================================================
// STATE
// ============================================================
let apiKeys = {
  venice: '', openai: '', anthropic: '', gemini: '',
  xai: '', mistral: '', deepseek: '', custom: ''
};
let customEndpoint = '';
let systemPrompt = '';
let searchProvider = '';
let searchApiKey = '';
let currentProject = null;
let sessionMessages = [];
let attachedFiles = [];
let voiceActive = false;
let recognition = null;


// ============================================================
// ON LOAD
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadApiKeys();
  loadProjects();
  setupEventListeners();
});


// ============================================================
// LOAD API KEYS
// ============================================================
function loadApiKeys() {
  chrome.storage.local.get(['apiKeys', 'lastModel', 'customEndpoint', 'searchProvider', 'searchApiKey'], (data) => {
    if (data.apiKeys) {
      apiKeys = { ...apiKeys, ...data.apiKeys };
      document.getElementById('key-venice').value    = apiKeys.venice    || '';
      document.getElementById('key-openai').value    = apiKeys.openai    || '';
      document.getElementById('key-anthropic').value = apiKeys.anthropic || '';
      document.getElementById('key-gemini').value    = apiKeys.gemini    || '';
      document.getElementById('key-xai').value       = apiKeys.xai       || '';
      document.getElementById('key-mistral').value   = apiKeys.mistral   || '';
      document.getElementById('key-deepseek').value  = apiKeys.deepseek  || '';
      document.getElementById('key-custom').value    = apiKeys.custom    || '';
    }
    if (data.lastModel) {
      document.getElementById('model-select').value = data.lastModel;
    }
    if (data.customEndpoint) {
      customEndpoint = data.customEndpoint;
      document.getElementById('custom-endpoint').value = customEndpoint;
    }
    if (data.searchProvider) {
      searchProvider = data.searchProvider;
      document.getElementById('search-provider').value = searchProvider;
    }
    if (data.searchApiKey) {
      searchApiKey = data.searchApiKey;
      document.getElementById('key-search').value = searchApiKey;
    }
  });
}


// ============================================================
// PROJECTS
// ============================================================
function loadProjects() {
  chrome.storage.local.get(['projects', 'lastProjectId'], (data) => {
    const projects = data.projects || {};
    populateProjectSelector(projects);
    if (data.lastProjectId && projects[data.lastProjectId]) {
      selectProject(data.lastProjectId, projects);
    }
  });
}


function populateProjectSelector(projects) {
  const select = document.getElementById('project-select');
  select.innerHTML = '<option value="">— Project —</option>';
  Object.keys(projects).forEach((id) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = projects[id].name;
    select.appendChild(opt);
  });
  if (currentProject) select.value = currentProject.id;
}


// ============================================================
// BUILD SYSTEM PROMPT WITH SESSION LOG
// ============================================================
function buildSystemPrompt(project) {
  const parts = [];
  const baseContext = project.active_context || '';
  if (baseContext) parts.push(baseContext);

  const log = project.session_log || [];
  if (log.length > 0) {
    const recentLog = log.slice(-20);
    parts.push('--- PAST SESSION HISTORY ---');
    recentLog.forEach((entry, i) => {
      const date = new Date(entry.timestamp).toLocaleString();
      parts.push(`[Session ${i + 1} — ${date}]\n${entry.summary}`);
    });
    parts.push('--- END OF PAST SESSIONS ---');
    parts.push('You have full context of all past sessions above. Continue from where we left off.');
  }

  return parts.join('\n\n');
}


function selectProject(id, projects) {
  currentProject = { id, ...projects[id] };
  document.getElementById('project-select').value = id;
  document.getElementById('context-box').value = currentProject.active_context || '';
  systemPrompt = buildSystemPrompt(currentProject);
  if (currentProject.preferred_model) {
    document.getElementById('model-select').value = currentProject.preferred_model;
  }
  chrome.storage.local.set({ lastProjectId: id });
  sessionMessages = currentProject.session_messages || [];
  renderChat();
  updateMsgCount();
  const logCount = (currentProject.session_log || []).length;
  setStatus(currentProject.name + ' loaded.' + (logCount > 0 ? ' ' + logCount + ' past session(s) in memory.' : ''));
}


function saveCurrentProject(callback) {
  if (!currentProject) return;
  const context = document.getElementById('context-box').value;
  const model = document.getElementById('model-select').value;
  chrome.storage.local.get(['projects'], (data) => {
    const projects = data.projects || {};
    if (!projects[currentProject.id]) return;
    projects[currentProject.id].active_context   = context;
    projects[currentProject.id].preferred_model  = model;
    projects[currentProject.id].session_messages = sessionMessages;
    currentProject.active_context   = context;
    currentProject.preferred_model  = model;
    currentProject.session_messages = sessionMessages;
    systemPrompt = buildSystemPrompt(currentProject);
    chrome.storage.local.set({ projects }, () => { if (callback) callback(); });
  });
}


function createNewProject() {
  const name = prompt('Project name:');
  if (!name || !name.trim()) return;
  const id = 'proj_' + Date.now();
  const newProject = {
    name: name.trim(),
    preferred_model: document.getElementById('model-select').value,
    active_context: '',
    session_messages: [],
    session_log: []
  };
  chrome.storage.local.get(['projects'], (data) => {
    const projects = data.projects || {};
    projects[id] = newProject;
    chrome.storage.local.set({ projects }, () => {
      populateProjectSelector(projects);
      selectProject(id, projects);
      setStatus('Project created.');
    });
  });
}


function deleteCurrentProject() {
  if (!currentProject) { setStatus('No project selected.'); return; }
  if (!confirm('Delete project "' + currentProject.name + '"?')) return;
  chrome.storage.local.get(['projects'], (data) => {
    const projects = data.projects || {};
    delete projects[currentProject.id];
    currentProject = null;
    sessionMessages = [];
    systemPrompt = '';
    document.getElementById('context-box').value = '';
    document.getElementById('project-select').value = '';
    document.getElementById('chat-area').innerHTML = '';
    chrome.storage.local.set({ projects }, () => {
      populateProjectSelector(projects);
      setStatus('Project deleted.');
    });
  });
}


// ============================================================
// CHAT RENDERING
// ============================================================
function renderChat(filter) {
  const area = document.getElementById('chat-area');
  area.innerHTML = '';
  sessionMessages.forEach((msg) => {
    if (msg.role === 'system') return;
    const displayText = msg.displayLabel || msg.content;
    appendBubble(msg.role, msg.content, displayText, filter, false);
  });
  scrollToBottom();
}


function appendBubble(role, rawContent, displayText, highlight, scroll) {
  const area = document.getElementById('chat-area');
  const wrap = document.createElement('div');
  wrap.className = 'bubble-wrap ' + (role === 'user' ? 'user' : 'assistant');

  const bubble = document.createElement('div');
  bubble.className = 'bubble ' + (role === 'user' ? 'user' : 'assistant');

  if (role === 'assistant') {
    renderAssistantContent(bubble, rawContent, highlight);
  } else {
    const shownText = displayText || rawContent;
    if (highlight && shownText.toLowerCase().includes(highlight.toLowerCase())) {
      const escaped = shownText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const regex = new RegExp('(' + highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      bubble.innerHTML = escaped.replace(regex, '<span class="highlight">$1</span>');
    } else {
      bubble.textContent = shownText;
    }
  }

  const meta = document.createElement('div');
  meta.className = 'bubble-meta';
  meta.textContent = role === 'user' ? 'You' : getModelLabel();
  wrap.appendChild(bubble);
  wrap.appendChild(meta);

  if (role === 'assistant') {
    const actions = document.createElement('div');
    actions.className = 'response-actions';
    const dlBtn = document.createElement('button');
    dlBtn.textContent = '⬇ Download';
    dlBtn.addEventListener('click', () => downloadText(rawContent, 'jenny-response.txt'));
    actions.appendChild(dlBtn);
    wrap.appendChild(actions);
  }

  area.appendChild(wrap);
  if (scroll) scrollToBottom();
}

// ============================================================
// RENDER ASSISTANT CONTENT — markdown links + code blocks
// ============================================================
function renderAssistantContent(bubble, content, highlight) {
  bubble.innerHTML = '';
  const parts = content.split(/(```[\s\S]*?```)/g);

  parts.forEach((part) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const inner = part.slice(3, -3);
      const newline = inner.indexOf('\n');
      const lang = newline > -1 ? inner.slice(0, newline).trim() : '';
      const code = newline > -1 ? inner.slice(newline + 1) : inner;

      const wrap = document.createElement('div');
      wrap.className = 'code-block-wrap';
      const pre = document.createElement('pre');
      pre.textContent = code;
      wrap.appendChild(pre);

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'code-block-actions';

      const copyBtn = document.createElement('button');
      copyBtn.textContent = '📋 Copy';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(code).then(() => {
          copyBtn.textContent = '✅ Copied';
          setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
        });
      });

      const dlBtn = document.createElement('button');
      dlBtn.textContent = '⬇ Download';
      dlBtn.addEventListener('click', () => downloadText(code, 'jenny-code.' + (lang || 'txt')));

      actionsDiv.appendChild(copyBtn);
      actionsDiv.appendChild(dlBtn);
      wrap.appendChild(actionsDiv);
      bubble.appendChild(wrap);

    } else {
      if (part === '') return;

      const container = document.createElement('span');
      container.style.whiteSpace = 'pre-wrap';

      const linkRegex = /(\[([^\]]+)\]\((https?:\/\/[^)]+)\))|(https?:\/\/[^\s\])"']+)/g;
      let lastIndex = 0;
      let match;

      while ((match = linkRegex.exec(part)) !== null) {
        if (match.index > lastIndex) {
          container.appendChild(renderTextSpan(part.slice(lastIndex, match.index), highlight));
        }
        const a = document.createElement('a');
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        if (match[1]) {
          a.href = match[3];
          a.textContent = match[2];
        } else {
          a.href = match[4];
          a.textContent = match[4];
        }
        container.appendChild(a);
        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < part.length) {
        container.appendChild(renderTextSpan(part.slice(lastIndex), highlight));
      }

      bubble.appendChild(container);
    }
  });
}


function renderTextSpan(text, highlight) {
  const span = document.createElement('span');
  if (highlight && text.toLowerCase().includes(highlight.toLowerCase())) {
    const escaped = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const regex = new RegExp('(' + highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    span.innerHTML = escaped.replace(regex, '<span class="highlight">$1</span>');
  } else {
    span.textContent = text;
  }
  return span;
}


function showTyping() {
  const area = document.getElementById('chat-area');
  const wrap = document.createElement('div');
  wrap.className = 'bubble-wrap assistant';
  wrap.id = 'typing-indicator';
  wrap.innerHTML = `<div class="typing"><span></span><span></span><span></span></div>`;
  area.appendChild(wrap);
  scrollToBottom();
}


function removeTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}


function scrollToBottom() {
  const area = document.getElementById('chat-area');
  area.scrollTop = area.scrollHeight;
}


function getModelLabel() {
  const select = document.getElementById('model-select');
  const opt = select.options[select.selectedIndex];
  return opt ? opt.text : 'Assistant';
}


function updateMsgCount() {
  const visible = sessionMessages.filter(m => m.role !== 'system').length;
  document.getElementById('msg-count').textContent = visible > 0 ? visible + ' msgs' : '';
}


function doSearch(term) {
  if (!term.trim()) {
    renderChat();
    document.getElementById('btn-search-clear').style.display = 'none';
    return;
  }
  document.getElementById('btn-search-clear').style.display = 'inline-block';
  renderChat(term);
}


// ============================================================
// FILE ATTACHMENTS
// ============================================================
function handleFiles(files) {
  Array.from(files).forEach((file) => {
    const reader = new FileReader();
    if (file.type.startsWith('image/')) {
      reader.onload = (e) => {
        attachedFiles.push({ name: file.name, type: 'image', dataUrl: e.target.result, mimeType: file.type });
        renderAttachments();
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = (e) => {
        attachedFiles.push({ name: file.name, type: 'text', content: e.target.result });
        renderAttachments();
      };
      reader.readAsText(file);
    }
  });
}


function renderAttachments() {
  const preview = document.getElementById('attachments-preview');
  preview.innerHTML = '';
  if (attachedFiles.length === 0) { preview.style.display = 'none'; return; }
  preview.style.display = 'flex';
  attachedFiles.forEach((file, index) => {
    const tag = document.createElement('div');
    tag.className = 'attachment-tag';
    tag.innerHTML = `<span>${file.type === 'image' ? '🖼' : '📄'} ${file.name}</span><span class="remove-file" data-index="${index}">✕</span>`;
    preview.appendChild(tag);
  });
  preview.querySelectorAll('.remove-file').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      attachedFiles.splice(parseInt(e.target.dataset.index), 1);
      renderAttachments();
    });
  });
}


// ============================================================
// WEB SEARCH
// ============================================================
function needsLiveSearch(text) {
  const triggers = [
    'today', 'tonight', 'right now', 'current', 'currently', 'latest',
    'live', 'news', 'price', 'weather', 'score', 'stock', 'crypto',
    'bitcoin', 'what is happening', 'what happened', 'breaking',
    'forecast', 'now', 'this week', 'this month', 'recently', 'update'
  ];
  const lower = text.toLowerCase();
  return triggers.some(t => lower.includes(t));
}


async function callSearchApi(query) {
  if (!searchProvider || !searchApiKey) return null;

  if (searchProvider === 'tavily') {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: searchApiKey,
        query: query,
        search_depth: 'basic',
        max_results: 5
      })
    });
    if (!res.ok) throw new Error('Tavily error: ' + res.status);
    const data = await res.json();
    return (data.results || [])
      .map(r => `[${r.title}](${r.url})\n${r.content}`)
      .join('\n\n');
  }

  if (searchProvider === 'serper') {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': searchApiKey },
      body: JSON.stringify({ q: query, num: 5 })
    });
    if (!res.ok) throw new Error('Serper error: ' + res.status);
    const data = await res.json();
    return (data.organic || [])
      .map(r => `[${r.title}](${r.link})\n${r.snippet}`)
      .join('\n\n');
  }

  if (searchProvider === 'brave') {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': searchApiKey }
    });
    if (!res.ok) throw new Error('Brave Search error: ' + res.status);
    const data = await res.json();
    return (data.web?.results || [])
      .map(r => `[${r.title}](${r.url})\n${r.description}`)
      .join('\n\n');
  }

  if (searchProvider === 'serpapi') {
    const res = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=5&api_key=${searchApiKey}`);
    if (!res.ok) throw new Error('SerpAPI error: ' + res.status);
    const data = await res.json();
    return (data.organic_results || [])
      .map(r => `[${r.title}](${r.link})\n${r.snippet}`)
      .join('\n\n');
  }

  return null;
}


async function sendWithSearch(text, forceSearch) {
  if (!currentProject) { setStatus('Select a project first.'); return; }

  const shouldSearch = forceSearch || (searchProvider && searchApiKey && needsLiveSearch(text));

  let fullPrompt = text;
  let displayLabel = text;

  if (shouldSearch) {
    setStatus('Searching the web...');
    try {
      const results = await callSearchApi(text);
      if (results) {
        fullPrompt = `User question: ${text}\n\nLive web search results:\n${results}\n\nUsing the search results above, answer the user's question with up to date information. Cite sources where relevant.`;
        displayLabel = '🔍 ' + text;
      }
    } catch (e) {
      setStatus('Search failed: ' + e.message + ' — answering without web data.');
    }
  }

  const [provider, modelName] = getProviderAndModel();

  sessionMessages.push({ role: 'user', content: fullPrompt, displayLabel });
  appendBubble('user', fullPrompt, displayLabel, null, true);

  const btn = document.getElementById('btn-send');
  btn.disabled = true;
  showTyping();
  setStatus('Thinking...');

  callModel(provider, modelName, systemPrompt, sessionMessages)
    .then((response) => {
      removeTyping();
      sessionMessages.push({ role: 'assistant', content: response });
      appendBubble('assistant', response, response, null, true);
      updateMsgCount();
      saveCurrentProject(null);
      setStatus('');
      if (voiceActive) speak(response);
    })
    .catch((err) => {
      removeTyping();
      const errMsg = '⚠️ Error: ' + err.message;
      sessionMessages.push({ role: 'assistant', content: errMsg });
      appendBubble('assistant', errMsg, errMsg, null, true);
      setStatus('Error.');
    })
    .finally(() => { btn.disabled = false; });
}


// ============================================================
// SEND MESSAGE
// ============================================================
function sendMessage() {
  const input = document.getElementById('message-box');
  const text = input.value.trim();
  if (!text && attachedFiles.length === 0) return;
  if (!currentProject) { setStatus('Select a project first.'); return; }

  input.value = '';

  if (attachedFiles.length > 0) {
    const [provider, modelName] = getProviderAndModel();
    const userContent = buildContentWithFiles(text, attachedFiles);
    const displayLabel = text || '[Files attached]';
    attachedFiles = [];
    renderAttachments();
    sessionMessages.push({ role: 'user', content: userContent, displayLabel });
    appendBubble('user', userContent, displayLabel, null, true);
    const btn = document.getElementById('btn-send');
    btn.disabled = true;
    showTyping();
    setStatus('Thinking...');
    callModel(provider, modelName, systemPrompt, sessionMessages)
      .then((response) => {
        removeTyping();
        sessionMessages.push({ role: 'assistant', content: response });
        appendBubble('assistant', response, response, null, true);
        updateMsgCount();
        saveCurrentProject(null);
        setStatus('');
        if (voiceActive) speak(response);
      })
      .catch((err) => {
        removeTyping();
        const errMsg = '⚠️ Error: ' + err.message;
        sessionMessages.push({ role: 'assistant', content: errMsg });
        appendBubble('assistant', errMsg, errMsg, null, true);
        setStatus('Error.');
      })
      .finally(() => { btn.disabled = false; });
    return;
  }

  sendWithSearch(text, false);
}


function autoSend(fullPrompt, displayLabel) {
  if (!currentProject) { setStatus('Select a project first.'); return; }
  const [provider, modelName] = getProviderAndModel();

  sessionMessages.push({ role: 'user', content: fullPrompt, displayLabel });
  appendBubble('user', fullPrompt, displayLabel, null, true);

  const btn = document.getElementById('btn-send');
  btn.disabled = true;
  showTyping();
  setStatus('Thinking...');

  callModel(provider, modelName, systemPrompt, sessionMessages)
    .then((response) => {
      removeTyping();
      sessionMessages.push({ role: 'assistant', content: response });
      appendBubble('assistant', response, response, null, true);
      updateMsgCount();
      saveCurrentProject(null);
      setStatus('');
      if (voiceActive) speak(response);
    })
    .catch((err) => {
      removeTyping();
      const errMsg = '⚠️ Error: ' + err.message;
      sessionMessages.push({ role: 'assistant', content: errMsg });
      appendBubble('assistant', errMsg, errMsg, null, true);
      setStatus('Error.');
    })
    .finally(() => { btn.disabled = false; });
}


// ============================================================
// BUILD CONTENT WITH FILES
// ============================================================
function buildContentWithFiles(text, files) {
  const parts = [];
  if (text) parts.push({ type: 'text', text });
  files.forEach(f => {
    if (f.type === 'image') {
      parts.push({ type: 'image_url', image_url: { url: f.dataUrl } });
    } else {
      parts.push({ type: 'text', text: `[File: ${f.name}]\n${f.content}` });
    }
  });
  return parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts;
}


// ============================================================
// GET PROVIDER AND MODEL
// ============================================================
function getProviderAndModel() {
  const val = document.getElementById('model-select').value;
  if (!val) return ['venice', ''];
  const parts = val.split('|');
  if (parts.length === 2) {
    const provider = parts[0];
    const model = parts[1];
    if (provider === 'venice' && model.startsWith('flux-')) return ['venice-image', model];
    return [provider, model];
  }
  return ['venice', val];
}


// ============================================================
// CALL MODEL — dispatcher
// ============================================================
async function callModel(provider, modelName, context, messages) {
  if (provider === 'venice-image') return callVeniceImage(modelName, messages);
  if (provider === 'anthropic')    return callAnthropic(modelName, context, messages);
  if (provider === 'gemini')       return callGemini(modelName, context, messages);

  const endpoints = {
    venice:   'https://api.venice.ai/api/v1/chat/completions',
    openai:   'https://api.openai.com/v1/chat/completions',
    xai:      'https://api.x.ai/v1/chat/completions',
    mistral:  'https://api.mistral.ai/v1/chat/completions',
    deepseek: 'https://api.deepseek.com/v1/chat/completions',
    custom:   customEndpoint || ''
  };
  const key = apiKeys[provider] || apiKeys.custom;
  const endpoint = endpoints[provider];
  if (!endpoint) throw new Error('Unknown provider: ' + provider);
  if (!key) throw new Error('No API key for ' + provider);
  return callOpenAIFormat(endpoint, key, modelName, context, messages);
}


async function callOpenAIFormat(endpoint, key, model, context, messages) {
  const sysMsg = context ? [{ role: 'system', content: context }] : [];
  const cleanMsgs = messages.map(m => ({ role: m.role, content: m.content }));
  const body = {
    model,
    messages: [...sysMsg, ...cleanMsgs],
    temperature: 0.7,
    max_tokens: 4096
  };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify(body)
  });
  if (!res.ok) { const e = await res.text(); throw new Error(res.status + ': ' + e); }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '(no response)';
}


async function callAnthropic(model, context, messages) {
  const key = apiKeys.anthropic;
  if (!key) throw new Error('No Anthropic API key. Add it in ⚙ Settings.');
  const msgs = messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
  const body = { model, max_tokens: 4096, messages: msgs };
  if (context) body.system = context;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const e = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new Error('Anthropic API key is invalid or unauthorised. Check your key in ⚙ Settings.');
    }
    throw new Error('Anthropic ' + res.status + ': ' + e);
  }
  const data = await res.json();
  return data.content?.[0]?.text || '(no response)';
}


async function callGemini(model, context, messages) {
  const key = apiKeys.gemini;
  if (!key) throw new Error('No Gemini API key.');
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
  }));
  const body = { contents };
  if (context) body.systemInstruction = { parts: [{ text: context }] };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) { const e = await res.text(); throw new Error('Gemini ' + res.status + ': ' + e); }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '(no response)';
}


async function callVeniceImage(model, messages) {
  const key = apiKeys.venice;
  if (!key) throw new Error('No Venice API key.');
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const prompt = typeof lastUser?.content === 'string' ? lastUser.content : 'A beautiful image';
  const body = { model, prompt, width: 1024, height: 1024, steps: 20, cfg_scale: 7, safe_mode: false };
  const res = await fetch('https://api.venice.ai/api/v1/image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify(body)
  });
  if (!res.ok) { const e = await res.text(); throw new Error('Venice Image ' + res.status + ': ' + e); }
  const data = await res.json();
  const imgUrl = data.images?.[0] || data.data?.[0]?.url || data.url;
  if (!imgUrl) throw new Error('No image URL in response.');
  return `![Generated Image](${imgUrl})`;
}


// ============================================================
// PAGE READING
// ============================================================
function readPage() {
  setStatus('Reading page...');
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (!tabs[0]) { setStatus('No active tab.'); return; }
    const tab = tabs[0];
    const url = tab.url || '';

    if (url.includes('docs.google.com/document')) {
      chrome.runtime.sendMessage({ type: 'FETCH_GOOGLE_DOC', url }, (response) => {
        if (chrome.runtime.lastError || !response || response.error) {
          setStatus('Could not read Google Doc. Make sure you are signed in and the doc is shared with you.');
          return;
        }
        autoSend(
          'The user clicked "Read Page". Here is the page content:\n\n' + response.content + '\n\nSummarise what this page is about in 2-3 sentences, then ask what they would like to know.',
          '📄 Read: ' + (tab.title || 'Google Doc').substring(0, 40)
        );
      });
      return;
    }

    const result = await injectAndSend(tab.id, { type: 'READ_PAGE' });
    if (result.error) { setStatus('Could not read page: ' + result.error); return; }
    autoSend(
      'The user clicked "Read Page". Here is the page content:\n\n' + result.content + '\n\nSummarise what this page is about in 2-3 sentences, then ask what they would like to know.',
      '📄 Read: ' + (tab.title || 'page').substring(0, 40)
    );
  });
}


function snapshotPage() {
  setStatus('Snapping page...');
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (!tabs[0]) { setStatus('No active tab.'); return; }
    const tab = tabs[0];

    const result = await injectAndSend(tab.id, { type: 'SNAPSHOT' });
    if (result.error) { setStatus('Could not snapshot page: ' + result.error); return; }
    autoSend(
      'The user clicked "Snapshot". Here are the interactive elements on the page:\n\n' + result.content + '\n\nList the key actions available on this page and ask what the user would like to do.',
      '📸 Snap: ' + (tab.title || 'page').substring(0, 40)
    );
  });
}


function injectAndSend(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (!chrome.runtime.lastError && response) {
        resolve(response);
        return;
      }
      chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }, () => {
        if (chrome.runtime.lastError) {
          resolve({ error: chrome.runtime.lastError.message });
          return;
        }
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, message, (response2) => {
            if (chrome.runtime.lastError || !response2) {
              resolve({ error: 'No response after injection.' });
            } else {
              resolve(response2);
            }
          });
        }, 300);
      });
    });
  });
}


// ============================================================
// WRAP UP
// ============================================================
async function startWrapUp() {
  if (!currentProject) { setStatus('No project selected.'); return; }

  const realMessages = sessionMessages.filter(m => {
    if (m.role === 'system') return false;
    if (m.role === 'user') {
      const label = m.displayLabel || '';
      const content = typeof m.content === 'string' ? m.content : '';
      if (label.startsWith('📄 Read:')) return false;
      if (label.startsWith('📸 Snap:')) return false;
      if (content.startsWith('The user clicked "Read Page"')) return false;
      if (content.startsWith('The user clicked "Snapshot"')) return false;
    }
    return true;
  });

  if (realMessages.length === 0) { setStatus('No real conversation to wrap up yet.'); return; }

  const existingContext = document.getElementById('context-box').value.trim();

  const wrapPrompt = `You are a session summarizer for a developer project called "${currentProject.name}".

${existingContext ? `EXISTING PROJECT CONTEXT:\n${existingContext}\n\n` : ''}NEW CONVERSATION THIS SESSION:
${realMessages.map(m => `[${m.role.toUpperCase()}]: ${typeof m.content === 'string' ? m.content.substring(0, 500) : JSON.stringify(m.content).substring(0, 500)}`).join('\n')}

Produce a concise updated project context block covering:
1. PROJECT — what this project is
2. CURRENT STATE — where things stand right now
3. DECISIONS MADE — key technical or design decisions
4. COMPLETED — what was finished this session
5. OPEN ITEMS — what still needs to be done
6. BUGS / DEAD ENDS — problems found and how resolved
7. ARCHITECTURE RULES — things to never change or always remember
8. NEXT STEP — the single most important next action

Be specific and technical. This will be injected as the system prompt for the next session so any model can continue immediately without missing context. Keep it under 600 words.`;

  setStatus('Generating wrap-up...');
  const [provider, modelName] = getProviderAndModel();

  try {
    const reply = await callModel(provider, modelName, '', [{ role: 'user', content: wrapPrompt }]);
    document.getElementById('wrapup-box').value = reply;
    document.getElementById('wrapup-panel').style.display = 'block';
    setStatus('Review wrap-up — edit if needed, then save.');
  } catch (e) {
    setStatus('Wrap-up failed: ' + e.message);
  }
}


function saveWrapUp() {
  if (!currentProject) return;
  const text = document.getElementById('wrapup-box').value.trim();
  if (!text) return;

  chrome.storage.local.get(['projects'], (data) => {
    const projects = data.projects || {};
    if (!projects[currentProject.id]) return;

    projects[currentProject.id].session_log = projects[currentProject.id].session_log || [];
    projects[currentProject.id].session_log.push({
      timestamp: new Date().toISOString(),
      summary: text
    });

    projects[currentProject.id].active_context = text;
    currentProject.session_log = projects[currentProject.id].session_log;
    currentProject.active_context = text;

    document.getElementById('context-box').value = text;
    systemPrompt = buildSystemPrompt(currentProject);

    chrome.storage.local.set({ projects }, () => {
      const count = currentProject.session_log.length;
      setStatus('Wrap-up saved. ' + count + ' session(s) in memory. Context updated.');
      document.getElementById('wrapup-panel').style.display = 'none';
    });
  });
}


function newSession() {
  if (!currentProject) { setStatus('No project selected.'); return; }
  sessionMessages = [];
  saveCurrentProject(() => {
    renderChat();
    updateMsgCount();
    const logCount = (currentProject.session_log || []).length;
    setStatus('New session started. ' + logCount + ' past session(s) loaded into memory.');
  });
}


// ============================================================
// VOICE
// ============================================================
function toggleVoice() {
  if (voiceActive) stopVoice();
  else startVoice();
}


function startVoice() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    setStatus('Speech recognition not supported.');
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.trim();
    if (transcript.toLowerCase().includes('jenny')) {
      const clean = transcript.replace(/jenny/gi, '').trim();
      if (clean) {
        document.getElementById('message-box').value = clean;
        sendMessage();
      }
    }
  };

  recognition.onerror = (e) => {
    if (e.error !== 'no-speech') setStatus('Voice error: ' + e.error);
  };

  recognition.onend = () => {
    if (voiceActive) recognition.start();
  };

  recognition.start();
  voiceActive = true;
  document.getElementById('btn-voice').textContent = '🔴 Listening';
  setStatus('Voice active — say "Jenny [message]"');
}


function stopVoice() {
  if (recognition) {
    recognition.onend = null;
    recognition.stop();
    recognition = null;
  }
  voiceActive = false;
  document.getElementById('btn-voice').textContent = '🎤 Voice';
  setStatus('Voice stopped.');
}


function speak(text) {
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text.substring(0, 300));
  utt.rate = 1.0;
  window.speechSynthesis.speak(utt);
}


// ============================================================
// DOWNLOAD
// ============================================================
function downloadText(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'jenny-response.txt';
  a.click();
  URL.revokeObjectURL(url);
}


// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {

  document.getElementById('btn-send').addEventListener('click', sendMessage);
  document.getElementById('message-box').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); sendMessage(); }
  });

  document.getElementById('btn-new-project').addEventListener('click', createNewProject);
  document.getElementById('btn-delete-project').addEventListener('click', deleteCurrentProject);
  document.getElementById('project-select').addEventListener('change', (e) => {
    if (!e.target.value) return;
    chrome.storage.local.get(['projects'], (data) => {
      selectProject(e.target.value, data.projects || {});
    });
  });

  document.getElementById('btn-wrapup').addEventListener('click', startWrapUp);
  document.getElementById('btn-wrapup-save').addEventListener('click', saveWrapUp);
  document.getElementById('btn-wrapup-cancel').addEventListener('click', () => {
    document.getElementById('wrapup-panel').style.display = 'none';
  });

  document.getElementById('btn-new-session').addEventListener('click', newSession);
  document.getElementById('btn-voice').addEventListener('click', toggleVoice);

  document.getElementById('btn-copy').addEventListener('click', () => {
    const last = [...sessionMessages].reverse().find(m => m.role === 'assistant');
    if (last) navigator.clipboard.writeText(last.content).then(() => setStatus('Copied!'));
    else setStatus('Nothing to copy.');
  });

  document.getElementById('btn-clear-chat').addEventListener('click', () => {
    if (confirm('Clear chat display? Messages are still saved in the project.')) {
      document.getElementById('chat-area').innerHTML = '';
    }
  });

  document.getElementById('search-input').addEventListener('input', (e) => {
    doSearch(e.target.value);
  });
  document.getElementById('btn-search-clear').addEventListener('click', () => {
    document.getElementById('search-input').value = '';
    doSearch('');
  });

  document.getElementById('btn-keys-toggle').addEventListener('click', () => {
    const panel = document.getElementById('api-keys-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('btn-save-keys').addEventListener('click', () => {
    apiKeys.venice    = document.getElementById('key-venice').value.trim();
    apiKeys.openai    = document.getElementById('key-openai').value.trim();
    apiKeys.anthropic = document.getElementById('key-anthropic').value.trim();
    apiKeys.gemini    = document.getElementById('key-gemini').value.trim();
    apiKeys.xai       = document.getElementById('key-xai').value.trim();
    apiKeys.mistral   = document.getElementById('key-mistral').value.trim();
    apiKeys.deepseek  = document.getElementById('key-deepseek').value.trim();
    apiKeys.custom    = document.getElementById('key-custom').value.trim();
    customEndpoint    = document.getElementById('custom-endpoint').value.trim();
    searchProvider    = document.getElementById('search-provider').value;
    searchApiKey      = document.getElementById('key-search').value.trim();
    chrome.storage.local.set({ apiKeys, customEndpoint, searchProvider, searchApiKey });
    setStatus('Keys saved.');
    document.getElementById('api-keys-panel').style.display = 'none';
  });

  document.getElementById('btn-cancel-keys').addEventListener('click', () => {
    document.getElementById('api-keys-panel').style.display = 'none';
  });

  document.getElementById('btn-ctx-toggle').addEventListener('click', () => {
    const panel = document.getElementById('context-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('btn-save-context').addEventListener('click', () => {
    const newContext = document.getElementById('context-box').value.trim();
    if (currentProject) {
      currentProject.active_context = newContext;
      systemPrompt = buildSystemPrompt(currentProject);
      chrome.storage.local.get(['projects'], (data) => {
        const projects = data.projects || {};
        if (projects[currentProject.id]) {
          projects[currentProject.id].active_context = newContext;
          chrome.storage.local.set({ projects });
        }
      });
    }
    setStatus('Context saved.');
    document.getElementById('context-panel').style.display = 'none';
  });

  document.getElementById('btn-clear-context').addEventListener('click', () => {
    document.getElementById('context-box').value = '';
    if (currentProject) {
      currentProject.active_context = '';
      systemPrompt = buildSystemPrompt(currentProject);
    }
    setStatus('Context cleared.');
  });

  document.getElementById('model-select').addEventListener('change', () => {
    const val = document.getElementById('model-select').value;
    document.getElementById('custom-endpoint-row').style.display =
      val.startsWith('custom|') ? 'block' : 'none';
    chrome.storage.local.set({ lastModel: val });
  });

  document.getElementById('file-input').addEventListener('change', (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  });

  document.getElementById('btn-read-page').addEventListener('click', readPage);
  document.getElementById('btn-snapshot').addEventListener('click', snapshotPage);

  document.getElementById('btn-web-search').addEventListener('click', () => {
    const text = document.getElementById('message-box').value.trim();
    if (!text) { setStatus('Type a question first then click Search.'); return; }
    if (!searchProvider || !searchApiKey) {
      setStatus('Set a search provider and key in ⚙ settings first.');
      return;
    }
    document.getElementById('message-box').value = '';
    sendWithSearch(text, true);
  });
}


// ============================================================
// STATUS
// ============================================================
function setStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
}