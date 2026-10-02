// NextXus Federation: shared chat logic for the one-on-one Mind Sim pages.
const API_BASE = 'https://roger-sim-api.onrender.com';
// Chat goes through the server-side proxy; the bridge token never reaches the browser.
const API_URL = API_BASE + '/proxy/chat';
// Persona settings come from the page: window.SIM_CONFIG = {name, start, prompt}.
const SIM_NAME = window.SIM_CONFIG.name;
const SYSTEM_PROMPT = window.SIM_CONFIG.prompt;
// The persona system message is always sent first; only the conversation is trimmed.
const chatHistory = [];

// ----------------------------------------
// TOPIC GIF MAPPING
// ----------------------------------------
const TOPIC_KEYWORDS = {
  earth:         ['earth','planet','world','globe',"god's eye",'opening'],
  cosmos:        ['cosmos','space','universe','stars','galaxy','celestial'],
  consciousness: ['consciousness','mind','awareness','perception','sentience','cognition'],
  truth:         ['truth','fact','honest','verify','accurate','real'],
  federation:    ['federation','nexus','nextxus','humancodex','network','alliance'],
  sim:           ['sim','simulation','avatar','digital twin','virtual','interface'],
  music:         ['music','sound','frequency','waveform','song','audio','melody'],
  library:       ['library','book','keys','knowledge','archive','document','read'],
  podcast:       ['podcast','episode','broadcast','talk','interview','series'],
  science:       ['science','research','quantum','physics','biology','data','experiment'],
  heart:         ['heart','aria','emotion','love','feeling','compassion','soul'],
  'agent-zero':  ['agent zero','spine','middleware','ring','protocol','system'],
  token:         ['token','sovereign token','currency','credit','payment','purchase']
};
const TOPIC_GIFS = Object.fromEntries(Object.keys(TOPIC_KEYWORDS).map(t => [t, `assets/gifs/${t}.gif`]));
let currentTopic = window.SIM_CONFIG.start;
let activeBackground = document.getElementById('topic-bg');
let backgroundRequest = 0;

function detectTopic(text) {
  if (typeof text !== 'string') return null;
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(keyword => {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^\\w])${escaped}(?=$|[^\\w])`, 'i').test(text);
    })) return topic;
  }
  return null;
}

function swapBackground(topic) {
  if (!Object.prototype.hasOwnProperty.call(TOPIC_GIFS, topic)) return;
  if (topic === currentTopic) { ++backgroundRequest; return; }
  const request = ++backgroundRequest;
  const image = new Image();
  image.onload = () => {
    if (request !== backgroundRequest) return;
    const next = activeBackground.id === 'topic-bg'
      ? document.getElementById('topic-bg-next') : document.getElementById('topic-bg');
    next.style.backgroundImage = `url('${TOPIC_GIFS[topic]}')`;
    next.classList.remove('opening');
    next.classList.add('shown');
    activeBackground.classList.remove('shown');
    activeBackground = next;
    currentTopic = topic;
  };
  image.onerror = () => { /* Keep the current backdrop if the GIF is unavailable. */ };
  image.src = TOPIC_GIFS[topic];
}

// ----------------------------------------
// OPENING SEQUENCE
// ----------------------------------------
function runOpeningSequence() {
  const first = document.getElementById('topic-bg');
  requestAnimationFrame(() => requestAnimationFrame(() => first.classList.add('shown')));
  setTimeout(() => first.classList.remove('opening'), 1500);
  setTimeout(() => document.getElementById('avatar').classList.add('visible'), 900);
  // The greeting is already in the page HTML, so it is readable without JavaScript.
  const g = document.getElementById('greeting');
  if (g) chatHistory.push({role: 'assistant', content: g.textContent.replace(SIM_NAME, '').trim()});
}

// ----------------------------------------
// TTS
// ----------------------------------------
let muted = false;
function toggleMute() {
  muted = !muted;
  const b = document.getElementById('muteBtn');
  b.textContent = muted ? 'Voice: Off' : 'Voice: On';
  b.setAttribute('aria-pressed', String(muted));
  b.setAttribute('aria-label', muted ? 'Spoken replies are muted. Press to turn voice on.' : 'Spoken replies are on. Press to mute.');
  if (muted && window.speechSynthesis) speechSynthesis.cancel();
}
function speakText(text) {
  if (muted || !window.speechSynthesis) return;
  speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text.slice(0, 400));
  utt.rate = 0.95; utt.volume = 1;
  speechSynthesis.speak(utt);
}

// ----------------------------------------
// CHAT
// ----------------------------------------
function addMessage(role, text, checkTopic = true) {
  const chat = document.getElementById('chat');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const who = document.createElement('span');
  who.className = 'who';
  who.textContent = role === 'user' ? 'You' : SIM_NAME;
  div.appendChild(who);
  div.appendChild(document.createTextNode(text));
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  if (role === 'ai') {
    if (checkTopic) { const topic = detectTopic(text); if (topic) swapBackground(topic); }
    speakText(text);
    pulseAvatar();
  }
  return div;
}

function pulseAvatar() {
  const av = document.getElementById('avatar');
  av.classList.add('pulsing');
  setTimeout(() => av.classList.remove('pulsing'), 3000);
}

let busy = false;
async function send() {
  const input = document.getElementById('input');
  const btn = document.getElementById('sendBtn');
  const text = input.value.trim();
  if (!text || busy) return;
  busy = true; btn.disabled = true;
  input.value = '';
  addMessage('user', text);
  pulseAvatar();
  const thinking = document.createElement('div');
  thinking.className = 'msg ai thinking';
  thinking.textContent = SIM_NAME + ' is thinking...';
  document.getElementById('chat').appendChild(thinking);
  try {
    chatHistory.push({role: 'user', content: text});
    const messages = [{role: 'system', content: SYSTEM_PROMPT}].concat(chatHistory.slice(-20));
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({model: 'deepseek-chat', messages: messages, stream: false})
    });
    const data = await res.json();
    const reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
      || (data.error && (data.error.message || data.error)) || 'No response';
    if (res.ok && data.choices) chatHistory.push({role: 'assistant', content: reply});
    else chatHistory.pop();
    thinking.remove();
    addMessage('ai', String(reply));
  } catch (err) {
    if (chatHistory.length && chatHistory[chatHistory.length - 1].role === 'user') chatHistory.pop();
    thinking.remove();
    addMessage('ai', 'Connection error. The server may be waking up; please try again in a moment.', false);
  } finally {
    busy = false; btn.disabled = false; input.focus();
  }
}

// ----------------------------------------
// WORLD PANEL
// ----------------------------------------
function toggleWorld() {
  const body = document.getElementById('worldBody');
  const open = body.classList.toggle('shown');
  document.getElementById('worldToggle').innerHTML = open ? '&#9660;' : '&#9658;';
  document.getElementById('worldBtn').setAttribute('aria-expanded', String(open));
  if (open) loadWorldData();
}

async function loadWorldData() {
  try {
    const [cryptoRes, newsRes] = await Promise.all([
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd'),
      fetch(API_BASE + '/world')
    ]);
    const crypto = await cryptoRes.json();
    document.getElementById('btc').textContent = `$${crypto.bitcoin.usd.toLocaleString()}`;
    document.getElementById('eth').textContent = `$${crypto.ethereum.usd.toLocaleString()}`;
    document.getElementById('sol').textContent = `$${crypto.solana.usd.toLocaleString()}`;
    const world = await newsRes.json();
    const headline = world.headlines || world.news || world.topics;
    if (headline && headline.length) {
      const first = Array.isArray(headline) ? headline[0] : headline;
      document.getElementById('newsItem').textContent = (first && first.title) ? first.title : String(first);
    }
  } catch (e) { console.error('World data error', e); }
}

// ----------------------------------------
// INIT
// ----------------------------------------
runOpeningSequence();
