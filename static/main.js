const chat = document.getElementById('chat-container');
const input = document.getElementById('message-input');
const mode = document.getElementById('function-select');
const send = document.getElementById('send-btn');
const endpoints = { answer: '/answer', kbanswer: '/kbanswer', search: '/search' };

async function sendMessage() {
  const message = input.value.trim();
  if (!message || send.disabled) return;
  displayMessage('user', message);
  input.value = '';
  resizeInput();
  setLoading(true);
  try {
    const response = await fetch(endpoints[mode.value] || '/answer', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({message})
    });
    if (!response.ok) throw new Error();
    const data = await response.json();
    displayMessage('assistant', data.message || 'I could not find an answer.');
  } catch {
    displayMessage('assistant', 'Sorry, I ran into a problem. Please try again.');
  } finally {
    setLoading(false);
    input.focus();
  }
}

function displayMessage(sender, message) {
  document.getElementById('welcome-state')?.remove();
  const wrapper = document.createElement('article');
  wrapper.className = `message ${sender}-message`;
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = sender === 'assistant' ? 'AW' : 'YOU';
  const content = document.createElement('div');
  content.className = 'message-content';
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = String(message);
  const time = document.createElement('time');
  time.className = 'timestamp';
  time.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  content.append(bubble, time);
  wrapper.append(avatar, content);
  chat.appendChild(wrapper);
  chat.scrollTop = chat.scrollHeight;
}

function setLoading(loading) {
  document.getElementById('typing-indicator')?.remove();
  send.disabled = loading;
  mode.disabled = loading;
  if (!loading) return;
  const indicator = document.createElement('div');
  indicator.id = 'typing-indicator';
  indicator.className = 'message assistant-message';
  indicator.innerHTML = '<div class="message-avatar">AW</div><div class="message-bubble typing" aria-label="AskWise is typing"><i></i><i></i><i></i></div>';
  chat.appendChild(indicator);
  chat.scrollTop = chat.scrollHeight;
}

function resizeInput() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
}

send.addEventListener('click', sendMessage);
input.addEventListener('input', resizeInput);
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }
});
document.getElementById('clear-btn').addEventListener('click', () => {
  chat.innerHTML = '<div class="welcome-state" id="welcome-state"><div class="welcome-icon">✦</div><h2>What can I help you explore?</h2><p>Ask a general question, get an answer from your knowledge base, or search its sources.</p></div>';
  input.focus();
});
