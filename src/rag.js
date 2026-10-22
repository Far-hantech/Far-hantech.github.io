// "Ask my résumé" — a tiny retrieval-augmented answerer that runs in the browser.
// BM25 over hand-written chunks + keyword boost (the "rerank" step), then a
// grounded answer is streamed token-by-token with citations.

import { KB, SUGGESTIONS, SYNONYMS, EMAIL } from './data.js';

const STOP = new Set(
  'a an the and or but of to in on at for with about from by is are was were be been being do does did have has had you your yours i me my we our he she it its they them this that these those what which who whom whose where when why how can could would should will shall may might tell me please any some there here as into than then so if just also very really much many more most farhan mohammed his him'.split(' ')
);

const stem = (w) => w.replace(/(ing|ed|es|s)$/u, '').replace(/'s$/u, '');
const tokenize = (s) =>
  s.toLowerCase().replace(/[^a-z0-9+#.\- ]/g, ' ').split(/\s+/).map((t) => t.replace(/^[.\-]+|[.\-]+$/g, '')).filter((t) => t && !STOP.has(t));

// --- index ----------------------------------------------------------------
const docs = KB.map((c) => {
  const body = tokenize(`${c.title} ${c.title} ${c.text}`).map(stem);
  const kw = new Set(tokenize(c.keywords).map(stem));
  const tf = new Map();
  for (const t of body) tf.set(t, (tf.get(t) || 0) + 1);
  return { ...c, tf, len: body.length, kw };
});
const N = docs.length;
const avgLen = docs.reduce((a, d) => a + d.len, 0) / N;
const df = new Map();
for (const d of docs) for (const t of new Set([...d.tf.keys(), ...d.kw])) df.set(t, (df.get(t) || 0) + 1);
const idf = (t) => Math.log(1 + (N - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5));

function expand(q) {
  const base = tokenize(q);
  const out = new Map(); // term -> weight
  for (const t of base) {
    out.set(stem(t), Math.max(out.get(stem(t)) || 0, 1));
    for (const s of SYNONYMS[t] || SYNONYMS[stem(t)] || []) {
      const st = stem(s);
      out.set(st, Math.max(out.get(st) || 0, 0.55));
    }
  }
  return out;
}

function search(q) {
  const terms = expand(q);
  const k1 = 1.4, b = 0.7;
  const scored = docs.map((d) => {
    let bm = 0, boost = 0;
    for (const [t, wq] of terms) {
      const f = d.tf.get(t) || 0;
      if (f) bm += wq * idf(t) * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / avgLen)));
      if (d.kw.has(t)) boost += wq * idf(t) * 1.2; // "rerank": curated keywords outrank incidental mentions
    }
    return { d, bm, score: bm + boost };
  });
  const max = Math.max(...scored.map((s) => s.score), 1e-6);
  for (const s of scored) s.norm = s.score / max;
  return { scored, max, terms };
}

// --- tiny deterministic "embedding" for the visual ------------------------
function pseudoEmbed(q, n) {
  let h = 2166136261;
  for (const ch of q) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const out = [];
  for (let i = 0; i < n; i++) {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    out.push(((h >>> 0) % 1000) / 1000);
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function initRag(root, { reduce = false } = {}) {
  const win = root.querySelector('.rag__win');
  const log = root.querySelector('.rag__log');
  const form = root.querySelector('.rag__form');
  const input = form.querySelector('input');
  const suggest = root.querySelector('.rag__suggest');
  const kb = root.querySelector('.rag__kb');
  const list = root.querySelector('.rag__chunks');
  const vec = root.querySelector('.rag__vec');
  const steps = [...root.querySelectorAll('[data-step]')];
  const VDIM = window.innerWidth < 600 ? 28 : 48;
  let busy = false;

  // Render knowledge base
  root.querySelector('[data-kb-count]').textContent = `${KB.length} chunks`;
  list.innerHTML = KB.map(
    (c) => `<li class="chunk" data-id="${c.id}" style="--c:${c.color}">
      <span class="chunk__rank"></span>
      <div class="chunk__top"><span class="chunk__title">${esc(c.title)}</span><span class="chunk__score">—</span></div>
      <div class="chunk__src">${esc(c.src)}</div>
      <div class="chunk__bar"><i></i></div>
    </li>`
  ).join('');
  const chunkEls = new Map([...list.children].map((el) => [el.dataset.id, el]));

  vec.innerHTML = '<i></i>'.repeat(VDIM);
  const vecBars = [...vec.children];

  SUGGESTIONS.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = s;
    b.addEventListener('click', () => ask(s));
    suggest.appendChild(b);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) ask(q);
  });

  // clicking a citation flashes its chunk
  log.addEventListener('click', (e) => {
    const c = e.target.closest('.cite');
    if (!c) return;
    const el = chunkEls.get(c.dataset.id);
    if (!el) return;
    el.classList.remove('is-flash');
    void el.offsetWidth;
    el.classList.add('is-flash');
    list.scrollTo({ top: el.offsetTop - list.offsetTop - 10, behavior: 'smooth' });
  });

  function scrollLog() { log.scrollTop = log.scrollHeight; }
  function setStep(name) { steps.forEach((s) => s.classList.toggle('is-on', s.dataset.step === name)); }

  function addMsg(who, html) {
    const m = document.createElement('div');
    m.className = `msg msg--${who}`;
    m.innerHTML = `<span class="msg__who mono">${who === 'user' ? 'you' : 'farhan-rag'}</span><p>${html}</p>`;
    log.appendChild(m);
    scrollLog();
    return m;
  }

  async function ask(q) {
    if (busy) return;
    busy = true;
    input.value = '';
    suggest.querySelectorAll('button').forEach((b) => (b.disabled = true));
    win.classList.add('is-thinking');
    const t0 = performance.now();
    addMsg('user', esc(q));

    const fast = reduce ? 0 : 1;

    // 1. embed
    setStep('embed');
    const v = pseudoEmbed(q.toLowerCase(), VDIM);
    const colors = ['var(--yellow)', 'var(--pink)', 'var(--blue)', 'var(--green)', 'var(--violet)'];
    vecBars.forEach((bar, i) => {
      bar.style.transitionDelay = `${i * 8 * fast}ms`;
      bar.style.transform = `scaleY(${0.15 + v[i] * 0.85})`;
      bar.style.backgroundColor = colors[Math.floor(v[i] * colors.length)];
    });
    await sleep(650 * fast);

    // 2. retrieve
    setStep('retrieve');
    const { scored, max } = search(q);
    kb.classList.add('is-scored');
    chunkEls.forEach((el) => el.classList.remove('is-hit'));
    for (const s of scored) {
      const el = chunkEls.get(s.d.id);
      const bmNorm = Math.min(1, s.bm / max);
      el.querySelector('.chunk__bar i').style.transform = `scaleX(${bmNorm})`;
      el.querySelector('.chunk__score').textContent = bmNorm.toFixed(2);
    }
    await sleep(700 * fast);

    // 3. rerank
    setStep('rerank');
    const ranked = [...scored].sort((a, b) => b.score - a.score);
    const found = max > 0.6;
    const top = found ? ranked.filter((s, i) => i < 3 && s.norm > 0.28) : [];
    for (const s of scored) {
      const el = chunkEls.get(s.d.id);
      el.querySelector('.chunk__bar i').style.transform = `scaleX(${found ? s.norm : 0})`;
      el.querySelector('.chunk__score').textContent = found ? s.norm.toFixed(2) : '0.00';
    }
    top.forEach((s, i) => {
      const el = chunkEls.get(s.d.id);
      el.classList.add('is-hit');
      el.querySelector('.chunk__rank').textContent = i + 1;
    });
    if (top[0]) {
      const el = chunkEls.get(top[0].d.id);
      list.scrollTo({ top: el.offsetTop - list.offsetTop - 10, behavior: reduce ? 'auto' : 'smooth' });
    }
    await sleep(600 * fast);

    // 4. generate
    setStep('generate');
    let parts;
    if (!top.length) {
      parts = [
        { text: `Nothing in my knowledge base matches that one — but I'd love to answer it over a call. Drop me a line at ${EMAIL}.` },
      ];
    } else {
      parts = [{ text: top[0].d.answer, cite: 1, id: top[0].d.id }];
      if (top[1] && top[1].norm > 0.62) parts.push({ text: top[1].d.answer, cite: 2, id: top[1].d.id });
    }

    const bot = addMsg('bot', '');
    const p = bot.querySelector('p');
    const caret = document.createElement('span');
    caret.className = 'caret';
    p.appendChild(caret);

    let tokens = 0;
    for (const [pi, part] of parts.entries()) {
      if (pi > 0) p.insertBefore(document.createTextNode(' '), caret);
      const words = part.text.split(/(\s+)/);
      const node = document.createTextNode('');
      p.insertBefore(node, caret);
      for (const wd of words) {
        node.textContent += wd;
        if (wd.trim()) tokens++;
        if (fast) {
          if (wd.trim()) await sleep(16 + Math.random() * 28);
          scrollLog();
        }
      }
      if (part.cite) {
        const c = document.createElement('span');
        c.className = 'cite';
        c.dataset.id = part.id;
        c.title = KB.find((k) => k.id === part.id).src;
        c.textContent = part.cite;
        p.insertBefore(c, caret);
      }
    }
    caret.remove();
    const ms = Math.round(performance.now() - t0);
    const meta = document.createElement('div');
    meta.className = 'msg__meta mono';
    meta.textContent = top.length
      ? `${tokens} tokens · ${top.length} source${top.length > 1 ? 's' : ''} · ${ms}ms · 0 API calls`
      : `0 sources above threshold · ${ms}ms`;
    bot.appendChild(meta);
    scrollLog();

    setStep(null);
    win.classList.remove('is-thinking');
    suggest.querySelectorAll('button').forEach((b) => (b.disabled = false));
    busy = false;
  }

  return { ask };
}
