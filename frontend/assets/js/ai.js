/* Gemini shopping assistant: floating widget on every page + full page (ai.html). The AI key never reaches the browser. */
const AI_SUGGESTIONS = ['Find a product', 'Find current offers', 'Compare products', 'Check product availability', 'Recommend a laptop under 60000', 'Explain product specifications', 'Explain store policies', 'Help with my order status'];
const AI_WELCOME = "Hi! I'm the ElectroMart assistant. I can help you find products, offers, compare items and answer store-policy questions using our live catalogue. For order status, please sign in first.";
const aiState = { history: [], busy: false, last: null };

function buildChat(container) {
  container.innerHTML = `<div class="ai-head"><b><i data-lucide="sparkles"></i> ElectroMart Assistant</b><button class="ai-close" aria-label="Close chat"><i data-lucide="x"></i></button></div>
    <div class="ai-msgs" aria-live="polite"></div>
    <div class="suggest">${AI_SUGGESTIONS.map((s) => `<button type="button">${esc(s)}</button>`).join('')}</div>
    <form class="ai-input"><input type="text" maxlength="500" placeholder="Ask about products, offers, orders…" aria-label="Your question" autocomplete="off"><button class="btn btn-primary btn-sm" aria-label="Send"><i data-lucide="send"></i></button></form>`;
  const msgs = container.querySelector('.ai-msgs'), input = container.querySelector('input');
  const add = (text, cls, links) => {
    const d = document.createElement('div'); d.className = 'msg ' + cls; d.textContent = text;
    if (links && links.length) { const l = document.createElement('div'); l.className = 'ai-links'; l.innerHTML = links.map((p) => `<a href="product-details.html?id=${esc(p.id)}">${esc(p.name)} · ${inr(p.price)}</a>`).join(''); d.appendChild(l); }
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d;
  };
  add(aiState.history.length ? 'Welcome back! What else can I help with?' : AI_WELCOME, 'bot');
  async function send(text) {
    text = text.trim(); if (!text || aiState.busy) return;
    aiState.busy = true; aiState.last = text; add(text, 'user'); input.value = '';
    const typing = document.createElement('div'); typing.className = 'msg bot typing'; typing.innerHTML = '<i></i><i></i><i></i>'; msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight;
    try {
      const r = await api('/api/ai/chat', { method: 'POST', auth: 'optional', body: { message: text, history: aiState.history.slice(-6) } });
      typing.remove(); add(r.answer, 'bot', r.products);
      aiState.history.push({ role: 'user', text }, { role: 'model', text: r.answer });
    } catch (e) {
      typing.remove(); const d = add(e.message, 'bot err');
      const retry = document.createElement('button'); retry.className = 'btn btn-sm btn-outline'; retry.style.marginTop = '6px'; retry.textContent = 'Retry'; retry.onclick = () => { d.remove(); send(aiState.last); }; d.appendChild(retry);
    }
    aiState.busy = false;
  }
  container.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); send(input.value); });
  container.querySelectorAll('.suggest button').forEach((b) => b.addEventListener('click', () => { const t = b.textContent; if (t === 'Find a product') { add(t, 'user'); add('Sure - tell me what you are looking for (for example "wireless headphones" or "phone under 20000").', 'bot'); input.focus(); } else send(t); }));
  icons();
  return container.querySelector('.ai-close');
}

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'ai') { const panel = document.getElementById('ai-page-panel'); panel.classList.add('ai-panel', 'open'); const c = buildChat(panel); c.style.display = 'none'; return; }
  if (['signin', 'signup', 'forgot', 'admin', 'checkout'].includes(page)) return;     // widget on main store pages only
  const fab = document.createElement('button'); fab.className = 'ai-fab'; fab.setAttribute('aria-label', 'Open AI shopping assistant'); fab.innerHTML = '<i data-lucide="message-circle"></i>';
  const panel = document.createElement('section'); panel.className = 'ai-panel'; panel.setAttribute('aria-label', 'AI shopping assistant');
  document.body.append(panel, fab);
  const close = buildChat(panel);
  const toggle = (open) => { panel.classList.toggle('open', open); fab.setAttribute('aria-expanded', open); if (open) panel.querySelector('input').focus(); };
  fab.onclick = () => toggle(!panel.classList.contains('open')); close.onclick = () => toggle(false);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
  icons();
});
