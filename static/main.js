const chat = document.getElementById('chat-container');
const input = document.getElementById('message-input');
const send = document.getElementById('send-btn');
const charCount = document.getElementById('char-count');
const modeInputs = [...document.querySelectorAll('input[name="response-mode"]')];
const modeCards = [...document.querySelectorAll('.mode-card')];
const modeOptions = document.querySelector('.mode-options');
const modeStatus = document.getElementById('mode-status');
const sidebar = document.getElementById('sidebar');
const scrim = document.getElementById('scrim');
const menuBtn = document.getElementById('menu-btn');
const welcomeTemplate = document.getElementById('welcome-template');
const LOGO_SRC = document.querySelector('.brand-logo').getAttribute('src');
const MAX_CHARS = Number(input.maxLength) || 2000;

const MODES = {
  answer: {
    endpoint: '/answer', label: 'Chat', status: 'Chat mode', placeholder: 'Ask anything…',
    suggestions: [
      ['Explain Python lambdas', 'with a short example'],
      ['What is retrieval-augmented generation?', 'in plain language'],
      ['Write a regex for emails', 'and explain each part'],
      ['Tips for a technical interview', 'for a junior developer'],
    ],
  },
  kbanswer: {
    endpoint: '/kbanswer', label: 'Knowledge base', status: 'Answering from knowledge base',
    placeholder: 'Ask the quantum-computing knowledge base…',
    suggestions: [
      ['What is a qubit?', 'and how is it different from a bit'],
      ['Could quantum computers break encryption?', 'what the article says'],
      ['What is quantum decoherence?', 'and why it matters'],
      ['What is quantum supremacy?', 'and has it been achieved'],
    ],
  },
  search: {
    endpoint: '/search', label: 'Sources', status: 'Searching sources',
    placeholder: 'Search the knowledge base for…',
    suggestions: [
      ['Superconducting qubits', 'find relevant passages'],
      ['Shor’s algorithm', 'find relevant passages'],
      ['Quantum error correction', 'find relevant passages'],
      ['Post-quantum cryptography', 'find relevant passages'],
    ],
  },
};

const ICONS = {
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
  retry: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"/></svg>',
};

let busy = false;

/* ---------- Mode handling ---------- */
function currentMode() {
  return modeInputs.find(option => option.checked)?.value || 'answer';
}

function setMode(mode) {
  const option = modeInputs.find(o => o.value === mode);
  if (!option || option.disabled) return;
  option.checked = true;
  syncMode();
}

function syncMode() {
  const mode = currentMode();
  const config = MODES[mode];
  modeOptions.style.setProperty('--mode-index', modeInputs.findIndex(o => o.value === mode));
  modeCards.forEach(card => card.setAttribute('aria-pressed', String(card.dataset.mode === mode)));
  modeStatus.textContent = config.status;
  input.placeholder = config.placeholder;
  renderSuggestions();
}

/* ---------- Welcome + suggestions ---------- */
function showWelcome() {
  chat.replaceChildren(welcomeTemplate.content.cloneNode(true));
  renderSuggestions();
}

function renderSuggestions() {
  const list = document.getElementById('suggestions');
  if (!list) return;
  list.replaceChildren(...MODES[currentMode()].suggestions.map(([title, hint]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'suggestion';
    button.innerHTML = '<strong></strong><small></small>';
    button.querySelector('strong').textContent = title;
    button.querySelector('small').textContent = hint;
    button.addEventListener('click', () => sendMessage(title));
    return button;
  }));
}

/* ---------- Sending ---------- */
async function sendMessage(text = input.value) {
  const message = text.trim();
  if (!message || busy) return;
  const mode = currentMode();
  if (text === input.value) {
    input.value = '';
    onInput();
  }
  displayUserMessage(message, mode);
  await requestAnswer(message, mode);
}

async function requestAnswer(message, mode) {
  setBusy(true);
  const started = performance.now();
  try {
    const response = await fetch(MODES[mode].endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const elapsed = (performance.now() - started) / 1000;
    displayAssistantMessage(data.message || 'I could not find an answer.', mode, elapsed);
  } catch (error) {
    console.error(error);
    displayError(message, mode);
  } finally {
    setBusy(false);
    input.focus();
  }
}

function setBusy(state) {
  busy = state;
  modeInputs.forEach(option => { option.disabled = state; });
  updateSendState();
  document.getElementById('typing-indicator')?.remove();
  if (!state) return;
  const label = { answer: 'Thinking', kbanswer: 'Reading the knowledge base', search: 'Searching sources' }[currentMode()];
  const indicator = createMessageShell('assistant');
  indicator.id = 'typing-indicator';
  indicator.querySelector('.message-content').innerHTML =
    `<div class="typing" role="status"><span class="typing-dots"><i></i><i></i><i></i></span>${label}…</div>`;
  appendToChat(indicator);
}

/* ---------- Rendering ---------- */
function createMessageShell(sender) {
  const wrapper = document.createElement('article');
  wrapper.className = `message ${sender}-message`;
  if (sender === 'assistant') {
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = `<img src="${LOGO_SRC}" alt="AskWise">`;
    wrapper.append(avatar);
  }
  const content = document.createElement('div');
  content.className = 'message-content';
  wrapper.append(content);
  return wrapper;
}

function appendToChat(node) {
  document.getElementById('welcome-state')?.remove();
  chat.appendChild(node);
  chat.scrollTop = chat.scrollHeight;
}

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function metaRow(parts) {
  const meta = document.createElement('div');
  meta.className = 'message-meta';
  meta.append(...parts.filter(Boolean));
  return meta;
}

function span(className, text) {
  const el = document.createElement('span');
  if (className) el.className = className;
  el.textContent = text;
  return el;
}

function actionButton(icon, label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'meta-action';
  button.innerHTML = `${ICONS[icon]}<span>${label}</span>`;
  button.addEventListener('click', () => onClick(button));
  return button;
}

function displayUserMessage(message) {
  const wrapper = createMessageShell('user');
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = message;
  wrapper.querySelector('.message-content').append(bubble, metaRow([span('', timeNow())]));
  appendToChat(wrapper);
}

function displayAssistantMessage(message, mode, elapsed) {
  const wrapper = createMessageShell('assistant');
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  const text = String(message);
  const sources = mode === 'search' ? parseSources(text) : null;
  if (sources) {
    bubble.append(renderSources(sources));
  } else {
    bubble.classList.add('prose');
    bubble.innerHTML = renderMarkdown(text);
  }
  const copy = actionButton('copy', 'Copy', button => copyText(text, button));
  wrapper.querySelector('.message-content').append(
    bubble,
    metaRow([span('mode-tag', MODES[mode].label), span('', timeNow()), span('', `${elapsed.toFixed(1)}s`), copy]),
  );
  appendToChat(wrapper);
}

function displayError(message, mode) {
  const wrapper = createMessageShell('assistant');
  wrapper.classList.add('is-error');
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = 'Sorry, I ran into a problem reaching the model. Please try again.';
  const retry = actionButton('retry', 'Retry', () => {
    if (busy) return;
    wrapper.remove();
    requestAnswer(message, mode);
  });
  wrapper.querySelector('.message-content').append(bubble, metaRow([retry]));
  appendToChat(wrapper);
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    button.innerHTML = `${ICONS.check}<span>Copied</span>`;
    setTimeout(() => { button.innerHTML = `${ICONS.copy}<span>Copy</span>`; }, 1600);
  } catch {
    button.querySelector('span').textContent = 'Copy failed';
  }
}

/* ---------- Search results ---------- */
// The /search endpoint returns "Source 1\n<text>\nSource 2\n<text>..." — split it into cards.
function parseSources(text) {
  if (!/^Source \d+\n/.test(text)) return null;
  const parts = text.split(/^Source (\d+)\n/m).slice(1);
  // The vector store can hold duplicate chunks, so show each passage once.
  const seen = new Set();
  const sources = [];
  for (let i = 1; i < parts.length; i += 2) {
    const text = cleanWikiMarkup(parts[i] || '');
    if (seen.has(text)) continue;
    seen.add(text);
    sources.push({ index: sources.length + 1, text });
  }
  return sources;
}

// Knowledge-base chunks come from raw Wikipedia markup; make them readable.
function cleanWikiMarkup(text) {
  let cleaned = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<ref[\s\S]*?<\/ref>/g, '');
  // Templates nest ({{cite … {{…}} }}), so strip innermost-first until none remain.
  for (let prev; prev !== cleaned;) {
    prev = cleaned;
    cleaned = cleaned.replace(/\{\{[^{}]*\}\}/g, '');
  }
  return cleaned
    .replace(/\{\{[^{}]*$/, '')
    .replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/^[^[]*?\]\]/, '')
    .replace(/\[\[|\]\]|\{\{|\}\}/g, '')
    .replace(/'{2,}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderSources(sources) {
  const container = document.createElement('div');
  container.className = 'sources';
  const summary = document.createElement('p');
  summary.className = 'sources-summary';
  summary.textContent = `Found ${sources.length} relevant passage${sources.length === 1 ? '' : 's'}:`;
  container.append(summary);
  sources.forEach(({ index, text }) => {
    const card = document.createElement('section');
    card.className = 'source-card';
    card.innerHTML = `<div class="source-head"><span class="source-num">${Number(index)}</span>Quantum computing · Wikipedia</div>`;
    const body = document.createElement('p');
    body.className = 'source-text';
    body.textContent = text || '(empty passage)';
    card.append(body);
    if (text.length > 320) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'source-toggle';
      toggle.textContent = 'Show more';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.addEventListener('click', () => {
        const expanded = card.classList.toggle('expanded');
        toggle.textContent = expanded ? 'Show less' : 'Show more';
        toggle.setAttribute('aria-expanded', String(expanded));
      });
      card.append(toggle);
    }
    container.append(card);
  });
  return container;
}

/* ---------- Minimal, safe markdown ---------- */
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function renderInline(text) {
  return escapeHtml(text)
    // Knowledge-base answers can echo Wikipedia's <math> markup; show it as inline math.
    .replace(/&lt;math&gt;(.*?)&lt;\/math&gt;/g, (_, tex) =>
      `<code>${tex.replace(/\\rangle/g, '⟩').replace(/\\langle/g, '⟨').replace(/\\(?:,|;| )/g, ' ')}</code>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function renderMarkdown(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${paragraph.map(renderInline).join('<br>')}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) html.push(`<${list.type}>${list.items.map(item => `<li>${renderInline(item)}</li>`).join('')}</${list.type}>`);
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```\s*([\w+-]*)/);
    if (fence) {
      flushParagraph(); flushList();
      const code = [];
      while (++i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i]);
      const lang = fence[1] ? `<span class="code-lang">${escapeHtml(fence[1])}</span>` : '';
      html.push(`<pre>${lang}<code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)/);
    const bullet = line.match(/^\s*[-*•]\s+(.*)/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (heading) {
      flushParagraph(); flushList();
      html.push(`<${heading[1].length <= 2 ? 'h3' : 'h4'}>${renderInline(heading[2])}</${heading[1].length <= 2 ? 'h3' : 'h4'}>`);
    } else if (bullet || ordered) {
      flushParagraph();
      const type = bullet ? 'ul' : 'ol';
      if (list && list.type !== type) flushList();
      list ??= { type, items: [] };
      list.items.push((bullet || ordered)[1]);
    } else if (!line.trim()) {
      flushParagraph(); flushList();
    } else if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph(); flushList();
  return html.join('');
}

/* ---------- Composer ---------- */
function onInput() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  const length = input.value.length;
  charCount.textContent = `${length} / ${MAX_CHARS}`;
  charCount.classList.toggle('near-limit', length > MAX_CHARS * 0.9);
  updateSendState();
}

function updateSendState() {
  send.disabled = busy || !input.value.trim();
}

/* ---------- Theme ---------- */
function toggleTheme() {
  const root = document.documentElement;
  const isDark = root.dataset.theme
    ? root.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = isDark ? 'light' : 'dark';
  try { localStorage.setItem('askwise-theme', root.dataset.theme); } catch {}
}

/* ---------- Mobile drawer ---------- */
function setSidebar(open) {
  sidebar.classList.toggle('open', open);
  scrim.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
  if (open) document.getElementById('sidebar-close').focus();
}

/* ---------- Wiring ---------- */
send.addEventListener('click', () => sendMessage());
input.addEventListener('input', onInput);
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    sendMessage();
  }
});
modeInputs.forEach(option => option.addEventListener('change', syncMode));
modeCards.forEach(card => card.addEventListener('click', () => {
  setMode(card.dataset.mode);
  if (sidebar.classList.contains('open')) setSidebar(false);
  input.focus();
}));
document.getElementById('clear-btn').addEventListener('click', () => {
  if (busy) return;
  showWelcome();
  input.focus();
});
document.getElementById('theme-btn').addEventListener('click', toggleTheme);
menuBtn.addEventListener('click', () => setSidebar(true));
document.getElementById('sidebar-close').addEventListener('click', () => { setSidebar(false); menuBtn.focus(); });
scrim.addEventListener('click', () => setSidebar(false));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && sidebar.classList.contains('open')) { setSidebar(false); menuBtn.focus(); }
});

showWelcome();
syncMode();
onInput();
