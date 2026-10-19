/* Shared helpers: API calls, formatting, product cards, header/footer. */
const CFG = window.ELECTROMART_CONFIG;
const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status; } }

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: Number(n) % 1 ? 2 : 0 });
const fmtDate = (d) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const icons = () => { if (window.lucide) window.lucide.createIcons(); };

async function getToken() { const { data } = await sb.auth.getSession(); return data.session ? data.session.access_token : null; }

function showWake(on) { const b = $('#wake-banner'); if (b) b.style.display = on ? 'block' : 'none'; }

// auth: true = must be signed in, 'optional' = send token if available
async function api(path, { method = 'GET', body, auth = false, form } = {}) {
  const headers = {};
  if (auth) {
    const t = await getToken();
    if (!t && auth === true) throw new ApiError('Please sign in to continue.', 401);
    if (t) headers.Authorization = 'Bearer ' + t;
  }
  let payload;
  if (form) payload = form; else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const ctrl = new AbortController();
  const wake = setTimeout(() => showWake(true), 4000);          // Render free tier may be waking up
  const kill = setTimeout(() => ctrl.abort(), 60000);
  let res;
  try { res = await fetch(CFG.API_BASE_URL + path, { method, headers, body: payload, signal: ctrl.signal }); }
  catch (e) { throw new ApiError(e.name === 'AbortError' ? 'The server took too long to respond. Please try again.' : 'Cannot reach the server. Check your connection and try again.', 0); }
  finally { clearTimeout(wake); clearTimeout(kill); showWake(false); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong. Please try again.', res.status);
  return data;
}

// Downloads a protected file (e.g. the order PDF) with the user's token
async function downloadPdf(orderId, name) {
  const t = await getToken();
  const res = await fetch(`${CFG.API_BASE_URL}/api/orders/${orderId}/pdf`, { headers: { Authorization: 'Bearer ' + t } });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new ApiError(d.error || 'Could not download the PDF.', res.status); }
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: `${name}.pdf` });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function toast(msg, type = '') {
  let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; box.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

/* ---------- product UI helpers ---------- */
const FALLBACK_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#F1F5F9"/><g fill="none" stroke="#94A3B8" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"><rect x="110" y="130" width="180" height="120" rx="14"/><path d="M160 290h80M200 250v40"/></g></svg>');
const imgTag = (url, alt, lazy = true) => `<img src="${esc(url || FALLBACK_IMG)}" alt="${esc(alt)}" ${lazy ? 'loading="lazy"' : ''} onerror="this.onerror=null;this.src='${FALLBACK_IMG.replace(/'/g, '%27')}'">`;

function stockBadge(p) {
  if (p.stock_status === 'out_of_stock') return '<span class="stock out">Out of Stock</span>';
  if (p.stock_status === 'low_stock') return '<span class="stock low">Only few left</span>';
  return '<span class="stock in">In Stock</span>';
}
const discBadge = (p) => (p.discount_percent > 0 ? `<span class="badge-off">${p.discount_percent}% off</span>` : '');
function starsHtml(p) {
  if (!p.avg_rating || !p.review_count) return '';          // hide when no genuine reviews
  const full = Math.round(p.avg_rating);
  return `<div class="stars" aria-label="Rated ${p.avg_rating} out of 5">${'★'.repeat(full)}${'☆'.repeat(5 - full)} <small>${p.avg_rating} (${p.review_count})</small></div>`;
}
function priceHtml(p) { return `<div class="price-row"><span class="price">${inr(p.price)}</span>${p.original_price ? `<span class="mrp">${inr(p.original_price)}</span>` : ''}</div>`; }

function productCard(p) {
  const out = p.stock_status === 'out_of_stock';
  return `<article class="pcard">
    <a class="pimg" href="product-details.html?id=${p.id}" aria-label="${esc(p.name)}">${imgTag(p.image_url, p.name)}${p.discount_percent > 0 ? `<span class="badge-off">${p.discount_percent}% off</span>` : ''}</a>
    <div class="pbody">
      <a class="pname" href="product-details.html?id=${p.id}">${esc(p.name)}</a>
      ${starsHtml(p)}${priceHtml(p)}${stockBadge(p)}
      <div style="display:flex;gap:8px;margin-top:6px">
        <button class="btn btn-primary" style="flex:1" data-buy="${p.id}" ${out ? 'disabled' : ''}>${out ? 'Unavailable' : 'Buy Now'}</button>
        <button class="btn btn-outline btn-sm" data-add="${p.id}" title="Add to cart" aria-label="Add ${esc(p.name)} to cart" ${out ? 'disabled' : ''}><i data-lucide="shopping-cart"></i></button>
      </div></div></article>`;
}
const skeletonCards = (n = 8) => Array.from({ length: n }, () => '<div class="pcard"><div class="skeleton" style="aspect-ratio:1"></div><div class="pbody"><div class="skeleton" style="height:18px"></div><div class="skeleton" style="height:18px;width:60%"></div></div></div>').join('');
const emptyState = (icon, title, msg, btn = '') => `<div class="empty"><i data-lucide="${icon}"></i><h3>${esc(title)}</h3><p>${esc(msg)}</p>${btn}</div>`;
const errorState = (msg, retryId = 'retry-btn') => `<div class="empty"><i data-lucide="wifi-off"></i><h3>Something went wrong</h3><p>${esc(msg)}</p><button class="btn btn-primary" id="${retryId}">Try again</button></div>`;

/* ---------- layout ---------- */
function renderLayout() {
  const nav = document.body.dataset.nav || '';
  const hdr = $('#site-header');
  if (hdr) hdr.outerHTML = `<div id="wake-banner" class="wake-banner">The server is waking up (free hosting) - this can take up to a minute…</div>
  <header class="site-header"><div class="container nav-row">
    <a class="logo" href="index.html"><span class="mark"><i data-lucide="zap"></i></span>ElectroMart</a>
    <button class="icon-btn menu-toggle" id="menu-toggle" aria-label="Open menu" aria-expanded="false"><i data-lucide="menu"></i></button>
    <nav class="nav-links" id="nav-links" aria-label="Main">
      <a href="index.html" class="${nav === 'home' ? 'active' : ''}">Home</a>
      <a href="products.html" class="${nav === 'products' ? 'active' : ''}">Products</a>
      <a href="index.html#categories">Categories</a>
      <a href="products.html?offers=true" class="${nav === 'offers' ? 'active' : ''}">Offers</a>
      <a href="index.html#about">About</a>
      <a href="ai.html" class="${nav === 'ai' ? 'active' : ''}">AI Assistant</a>
    </nav>
    <form class="search" id="search-form" role="search"><input type="search" id="search-input" placeholder="Search electronics…" aria-label="Search products" maxlength="80"><button aria-label="Search"><i data-lucide="search"></i></button></form>
    <div class="nav-actions">
      <a class="icon-btn" href="cart.html" aria-label="Cart"><i data-lucide="shopping-cart"></i><span class="badge-count" id="cart-count" style="display:none">0</span></a>
      <div id="account-area"></div>
    </div></div></header>`;
  const ftr = $('#site-footer');
  if (ftr) ftr.outerHTML = `<footer class="site-footer"><div class="container"><div class="foot-grid">
    <div><h4>ElectroMart</h4><p>Genuine electronics, honest prices. A college project demonstrating a full-stack online store.</p></div>
    <div><h4>Shop</h4><a href="products.html">All products</a><a href="products.html?offers=true">Offers</a><a href="orders.html">My orders</a></div>
    <div><h4>Support</h4><a href="ai.html">Ask the AI assistant</a><a href="index.html#about">About us</a><a href="#" data-policy="shipping">Shipping policy</a></div>
    <div><h4>Policies</h4><a href="#" data-policy="returns">Returns</a><a href="#" data-policy="cancellation">Cancellation</a><a href="#" data-policy="payment">Payments</a></div>
    </div><p class="copy">© ${new Date().getFullYear()} ElectroMart · Payments run in Razorpay TEST mode - no real money is charged.</p></div></footer>`;
  const toggle = $('#menu-toggle');
  if (toggle) toggle.addEventListener('click', () => { const o = $('#nav-links').classList.toggle('open'); toggle.setAttribute('aria-expanded', o); });
  const sf = $('#search-form');
  if (sf) { sf.addEventListener('submit', (e) => { e.preventDefault(); const q = $('#search-input').value.trim(); location.href = 'products.html' + (q ? '?search=' + encodeURIComponent(q) : ''); });
    const cur = new URLSearchParams(location.search).get('search'); if (cur) $('#search-input').value = cur; }
  const POL = { shipping: 'Shipping: a flat charge applies, free above the free-shipping amount shown at checkout.', returns: 'Returns: contact support with your order number.', cancellation: 'Cancellation: you can cancel from My Orders before the order is shipped.', payment: 'Payments: Razorpay (test mode) or Cash on Delivery.' };
  $$('[data-policy]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); toast(POL[a.dataset.policy]); }));
  icons();
}
document.addEventListener('DOMContentLoaded', renderLayout);
