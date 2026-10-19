/* Admin dashboard. The page is only a UI: every API call is re-checked for admin role on the server. */
const A = { tab: 'overview', timers: [], channel: null, seq: 0, inflight: false, products: [], orders: [] };
const TRANS = { confirmed: 'processing', processing: 'shipped', shipped: 'delivered' };
const money = (n) => inr(n || 0);
const pillT = (cls, text) => `<span class="status-pill s-${cls}">${text}</span>`;

document.addEventListener('DOMContentLoaded', () => { if (document.body.dataset.page === 'admin') initAdmin(); });

async function initAdmin() {
  const gate = document.getElementById('admin-gate'), app = document.getElementById('admin-app');
  const session = await Auth.requireLogin(); if (!session) return;
  try { await api('/api/admin/me', { auth: true }); }
  catch (e) {
    gate.innerHTML = e.status === 403 ? emptyState('shield-x', 'Admin access required', 'Your account is not an administrator. Opening this page does not grant admin rights.', '<a class="btn btn-primary" href="index.html">Back to store</a>') : errorState(e.message);
    const rb = document.getElementById('retry-btn'); if (rb) rb.onclick = () => location.reload(); return icons();
  }
  gate.style.display = 'none'; app.classList.remove('hidden');
  document.getElementById('admin-email').textContent = session.user.email;
  document.getElementById('admin-tabs').addEventListener('click', (e) => { const t = e.target.closest('[data-tab]'); if (t) showTab(t.dataset.tab); });
  document.getElementById('refresh-btn').onclick = () => refreshAll(true);
  document.getElementById('logout-admin').onclick = () => Auth.logout();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAll(); });
  window.addEventListener('beforeunload', cleanup);
  showTab('overview'); startLive(); icons();
}

function cleanup() { A.timers.forEach(clearInterval); A.timers = []; if (A.channel) { sb.removeChannel(A.channel); A.channel = null; } }

/* ---- live updates: Supabase Realtime when connected, plus a 45s polling fallback ---- */
function startLive() {
  cleanup();
  let debounce;
  const trigger = () => { clearTimeout(debounce); debounce = setTimeout(() => refreshAll(), 900); };    // collapses bursts of events into ONE refresh
  A.channel = sb.channel('admin-live');
  ['orders', 'products', 'payments'].forEach((t) => A.channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, trigger));
  A.channel.subscribe((status) => { const el = document.getElementById('live'); const on = status === 'SUBSCRIBED'; el.classList.toggle('on', on); el.lastChild.textContent = on ? ' Live' : ' Polling (live connection unavailable)'; });
  A.timers.push(setInterval(() => { if (!document.hidden) refreshAll(); }, 45000));
}

async function refreshAll(manual) {
  if (A.inflight && !manual) return;                       // never run two refreshes at once
  A.inflight = true; const mine = ++A.seq;                 // stale responses are ignored below
  const btn = document.getElementById('refresh-btn'); btn.disabled = true;
  try {
    if (A.tab === 'overview') await loadOverview(mine);
    if (A.tab === 'products') await loadProducts(mine);
    if (A.tab === 'orders') await loadOrders(mine);
    if (A.tab === 'reviews') await loadReviews(mine);
    if (A.tab === 'emails') await loadEmails(mine);
    document.getElementById('last-updated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN');
    document.getElementById('conn-err').style.display = 'none';
  } catch (e) { const c = document.getElementById('conn-err'); c.textContent = 'Could not refresh: ' + e.message; c.style.display = 'block'; }
  btn.disabled = false; A.inflight = false;
}

function showTab(t) {
  A.tab = t;
  document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('hidden', p.id !== 'tab-' + t));
  refreshAll(true);
}

/* ---- Overview ---- */
async function loadOverview(mine) {
  const d = await api('/api/admin/analytics', { auth: true }); if (mine !== A.seq) return;
  const o = d.overview, m = d.money;
  const stat = (label, val, warn) => `<div class="stat ${warn ? 'warn' : ''}"><small>${label}</small><b>${val}</b></div>`;
  document.getElementById('stats').innerHTML = [
    stat('Products (active)', `${o.active_products} / ${o.total_products}`), stat('Orders (excl. cancelled)', o.total_orders), stat('Customers', o.total_customers),
    stat('Collected revenue', money(m.collected_revenue)), stat('Pending orders', o.pending_orders), stat('Low-stock products', o.low_stock, o.low_stock > 0), stat('Out of stock', o.out_of_stock, o.out_of_stock > 0),
    stat('Order value', money(m.order_value)), stat('COD outstanding', money(m.cod_outstanding)), stat('Refund pending', money(m.refund_pending), m.refund_pending > 0), stat('Refunded', money(m.refunded)), stat('Cancelled orders', o.cancelled_orders),
  ].join('');
  const max = Math.max(1, ...d.sales_trend.map((x) => x.revenue));
  document.getElementById('trend').innerHTML = d.sales_trend.map((x) => `<div style="height:${Math.max(2, (x.revenue / max) * 100)}%" title="${x.date}: ${money(x.revenue)}"></div>`).join('');
  document.getElementById('best').innerHTML = d.best_sellers.length ? d.best_sellers.map((b) => `<div class="kv"><span>${esc(b.name)}</span><b>${b.units} sold</b></div>`).join('') : '<p style="color:var(--muted)">No sales yet.</p>';
  const list = (obj) => Object.keys(obj).length ? Object.entries(obj).map(([k, v]) => `<div class="kv"><span>${pill(k)}</span><b>${v}</b></div>`).join('') : '<p style="color:var(--muted)">No orders yet.</p>';
  document.getElementById('st-order').innerHTML = list(d.order_status); document.getElementById('st-pay').innerHTML = list(d.payment_status);
}

/* ---- Products ---- */
async function loadProducts(mine) {
  const { products } = await api('/api/admin/products', { auth: true }); if (mine !== A.seq) return;
  A.products = products;
  document.getElementById('products-body').innerHTML = products.length ? products.map((p) => `<tr><td style="width:56px">${imgTag(p.image_url, p.name)}</td><td><b>${esc(p.name)}</b><br><small>${esc(p.category)}</small></td>
    <td>${inr(p.price)}${p.original_price ? `<br><small class="mrp">${inr(p.original_price)}</small>` : ''}</td><td>${p.stock_quantity}<br>${stockBadge(p)}</td><td>${p.is_active ? pillT('confirmed', 'active') : pillT('cancelled', 'inactive')}</td>
    <td><div class="row-actions"><button class="btn btn-ghost btn-sm" data-edit="${p.id}">Edit</button>${p.is_active ? `<button class="btn btn-danger btn-sm" data-off="${p.id}">Deactivate</button>` : `<button class="btn btn-green btn-sm" data-on="${p.id}">Activate</button>`}</div></td></tr>`).join('') : '<tr><td colspan="6">No products yet - click "Add product".</td></tr>';
  icons();
}

function specsToText(o) { return Object.entries(o || {}).map(([k, v]) => `${k}: ${v}`).join('\n'); }
function textToSpecs(t) { const o = {}; t.split('\n').forEach((l) => { const i = l.indexOf(':'); if (i > 0) o[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }); return o; }

function openProductModal(p) {
  const f = document.getElementById('product-form'); f.reset();
  document.getElementById('pm-title').textContent = p ? 'Edit product' : 'Add product';
  f.elements.product_id.value = p ? p.id : ''; f.elements.name.value = p ? p.name : ''; f.elements.category.value = p ? p.category : CATEGORIES[0]; f.elements.price.value = p ? p.price : '';
  f.elements.original_price.value = p && p.original_price_raw ? p.original_price_raw : ''; f.elements.stock_quantity.value = p ? p.stock_quantity : 0; f.elements.description.value = p ? p.description : '';
  f.elements.specs.value = p ? specsToText(p.specifications) : ''; f.elements.image_url.value = p && p.image_url ? p.image_url : '';
  document.getElementById('pm-preview').innerHTML = p && p.image_url ? imgTag(p.image_url, 'Preview') : '';
  document.getElementById('pm-alert').style.display = 'none'; document.getElementById('product-modal').classList.add('open');
}

function wireProducts() {
  document.getElementById('f-cat').innerHTML = CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join('');
  document.getElementById('add-product').onclick = () => openProductModal(null);
  document.getElementById('pm-cancel').onclick = () => document.getElementById('product-modal').classList.remove('open');
  document.getElementById('products-body').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.edit) openProductModal(A.products.find((p) => p.id === b.dataset.edit));
    try {
      if (b.dataset.off && confirm('Deactivate this product? It will disappear from the store (order history is kept).')) { await api('/api/admin/products/' + b.dataset.off, { method: 'DELETE', auth: true }); toast('Product deactivated', 'success'); refreshAll(true); }
      if (b.dataset.on) { await api('/api/admin/products/' + b.dataset.on, { method: 'PUT', auth: true, body: { is_active: true } }); toast('Product activated', 'success'); refreshAll(true); }
    } catch (err) { toast(err.message, 'error'); }
  });
  document.getElementById('pm-file').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('Image must be 5 MB or smaller.', 'error');
    const fd = new FormData(); fd.append('image', file);
    const st = document.getElementById('pm-upload-state'); st.innerHTML = '<span class="spinner"></span> Uploading…';
    try { const { url } = await api('/api/admin/products/image', { method: 'POST', auth: true, form: fd }); document.getElementById('product-form').image_url.value = url; document.getElementById('pm-preview').innerHTML = imgTag(url, 'Preview'); st.textContent = 'Uploaded ✓'; }
    catch (err) { st.textContent = ''; toast(err.message, 'error'); }
  };
  document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target; const box = document.getElementById('pm-alert'); box.style.display = 'none';
    const body = { name: f.elements.name.value, category: f.elements.category.value, price: f.elements.price.value, original_price: f.elements.original_price.value || null, stock_quantity: Number(f.elements.stock_quantity.value), description: f.elements.description.value, specifications: textToSpecs(f.elements.specs.value), image_url: f.elements.image_url.value || null };
    const btn = document.getElementById('pm-save'); btn.disabled = true;
    try {
      const pid = f.elements.product_id.value;
      await api(pid ? '/api/admin/products/' + pid : '/api/admin/products', { method: pid ? 'PUT' : 'POST', auth: true, body });
      document.getElementById('product-modal').classList.remove('open'); toast('Product saved', 'success'); refreshAll(true);
    } catch (err) { box.className = 'alert alert-error'; box.textContent = err.message; box.style.display = 'block'; }
    btn.disabled = false;
  });
}

/* ---- Orders ---- */
async function loadOrders(mine) {
  const status = document.getElementById('order-filter').value;
  const { orders } = await api('/api/admin/orders' + (status ? '?status=' + status : ''), { auth: true }); if (mine !== A.seq) return;
  A.orders = orders;
  document.getElementById('orders-body').innerHTML = orders.length ? orders.map((o) => `<tr><td><b>${esc(o.order_number)}</b><br><small>${fmtDate(o.created_at)}</small></td><td>${esc(o.customer ? o.customer.full_name || o.customer.email : '-')}<br><small>${esc(o.customer ? o.customer.email : '')}</small></td>
    <td>${inr(o.total)}</td><td><b>${payLabel(o)}</b><br>${pill(o.payment_status)}</td><td>${pill(o.order_status)}</td><td><div class="row-actions"><button class="btn btn-ghost btn-sm" data-view="${o.id}">View</button>${actionButtons(o)}</div></td></tr>`).join('') : '<tr><td colspan="6">No orders found.</td></tr>';
}
function actionButtons(o) {
  let h = '';
  const next = TRANS[o.order_status];
  const blocked = o.payment_method === 'razorpay' && o.payment_status !== 'paid';
  if (next && !blocked) h += `<button class="btn btn-primary btn-sm" data-status="${o.id}|${next}">Mark ${next}</button>`;
  if (o.payment_method === 'cod' && o.payment_status === 'cod_due' && o.order_status !== 'cancelled') h += `<button class="btn btn-green btn-sm" data-cod="${o.id}">COD collected</button>`;
  if (['pending', 'confirmed', 'processing'].includes(o.order_status)) h += `<button class="btn btn-danger btn-sm" data-cancel="${o.id}">Cancel</button>`;
  if (o.payment_status === 'refund_pending') h += `<button class="btn btn-sm" style="background:#F3E8FF;color:#6B21A8" data-refund="${o.id}">${o.payment_method === 'cod' ? 'Confirm manual refund' : 'Refund via Razorpay'}</button>`;
  return h;
}
function viewOrder(o) {
  document.getElementById('order-detail').innerHTML = `<h3>${esc(o.order_number)}</h3><div class="kv"><span>Placed</span><span>${fmtDate(o.created_at)}</span></div><div class="kv"><span>Payment</span><span>${payLabel(o)} · ${esc(payStatusLabel(o))}</span></div>
    ${o.razorpay_payment_id ? `<div class="kv"><span>Razorpay ref</span><span>${esc(o.razorpay_payment_id)}</span></div>` : ''}${o.cod_collected_at ? `<div class="kv"><span>COD collected</span><span>${fmtDate(o.cod_collected_at)}</span></div>` : ''}
    <h4 style="margin:12px 0 4px">Items</h4>${o.order_items.map((i) => `<div class="kv"><span>${esc(i.product_name)} × ${i.quantity}</span><span>${inr(i.line_total)}</span></div>`).join('')}
    <div class="kv"><span>Shipping</span><span>${inr(o.shipping_charge)}</span></div><div class="kv"><b>Total</b><b>${inr(o.total)}</b></div>
    <h4 style="margin:12px 0 4px">Delivery</h4><p style="font-size:.9rem">${addrHtml(o.shipping_address)}</p>
    <div style="margin-top:14px;display:flex;gap:8px"><button class="btn btn-outline btn-sm" id="od-pdf"><i data-lucide="download"></i> PDF</button><button class="btn btn-ghost btn-sm" id="od-close">Close</button></div>`;
  document.getElementById('order-modal').classList.add('open'); icons();
  document.getElementById('od-close').onclick = () => document.getElementById('order-modal').classList.remove('open');
  document.getElementById('od-pdf').onclick = (e) => pdfClick(e.currentTarget, o);
}
function wireOrders() {
  document.getElementById('order-filter').onchange = () => refreshAll(true);
  document.getElementById('orders-body').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const call = async (path, method, body, ok) => { b.disabled = true; try { const r = await api('/api/admin/orders/' + path, { method, auth: true, body }); toast(typeof ok === 'function' ? ok(r) : ok, 'success'); refreshAll(true); } catch (err) { toast(err.message, 'error'); b.disabled = false; } };
    if (b.dataset.view) viewOrder(A.orders.find((o) => o.id === b.dataset.view));
    if (b.dataset.status) { const [id, st] = b.dataset.status.split('|'); call(id + '/status', 'PATCH', { status: st }, 'Order marked ' + st); }
    if (b.dataset.cod) { if (confirm('Confirm that the cash for this order was collected?')) call(b.dataset.cod + '/cod-collected', 'POST', {}, 'COD collection recorded'); }
    if (b.dataset.cancel) { if (confirm('Cancel this order and return stock?')) call(b.dataset.cancel + '/cancel', 'POST', {}, 'Order cancelled'); }
    if (b.dataset.refund) {
      const o = A.orders.find((x) => x.id === b.dataset.refund);
      if (o.payment_method === 'cod') { if (confirm('Only confirm if you have ALREADY returned the cash to the customer.')) call(o.id + '/refund', 'POST', { manual: true }, 'Refund recorded'); }
      else if (confirm('Send a refund request to Razorpay (test mode)?')) call(o.id + '/refund', 'POST', {}, (r) => (r.status === 'refunded' ? 'Refund confirmed by Razorpay' : 'Refund initiated - waiting for Razorpay to confirm'));
    }
  });
}

/* ---- Reviews ---- */
async function loadReviews(mine) {
  const { reviews } = await api('/api/admin/reviews', { auth: true }); if (mine !== A.seq) return;
  document.getElementById('reviews-body').innerHTML = reviews.length ? reviews.map((r) => `<tr><td>${esc(r.products ? r.products.name : '-')}</td><td>${'★'.repeat(r.rating)}</td><td>${esc(r.comment || '')}</td><td>${esc(r.customer ? r.customer.email : '')}</td><td>${pillT(r.status === 'approved' ? 'delivered' : 'cancelled', r.status)}</td>
    <td><button class="btn btn-sm ${r.status === 'approved' ? 'btn-danger' : 'btn-green'}" data-rev="${r.id}|${r.status === 'approved' ? 'hidden' : 'approved'}">${r.status === 'approved' ? 'Hide' : 'Approve'}</button></td></tr>`).join('') : '<tr><td colspan="6">No reviews yet.</td></tr>';
}
function wireReviews() {
  document.getElementById('reviews-body').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-rev]'); if (!b) return; const [id, status] = b.dataset.rev.split('|');
    try { await api('/api/admin/reviews/' + id, { method: 'PATCH', auth: true, body: { status } }); toast('Review ' + status, 'success'); refreshAll(true); } catch (err) { toast(err.message, 'error'); }
  });
}

/* ---- Emails ---- */
async function loadEmails(mine) {
  const { notifications } = await api('/api/admin/notifications', { auth: true }); if (mine !== A.seq) return;
  document.getElementById('emails-body').innerHTML = notifications.length ? notifications.map((n) => `<tr><td>${esc(n.orders ? n.orders.order_number : '')}</td><td>${esc(n.type)}</td><td>${esc(n.status)}</td><td>${n.attempts}</td><td>${esc(n.last_error || '')}</td></tr>`).join('') : '<tr><td colspan="5">All emails delivered. 🎉</td></tr>';
}
function wireEmails() {
  document.getElementById('retry-emails').onclick = async (e) => {
    e.target.disabled = true;
    try { const { results } = await api('/api/admin/notifications/retry', { method: 'POST', auth: true }); toast(`Retried ${results.length} email(s).`, 'success'); refreshAll(true); } catch (err) { toast(err.message, 'error'); }
    e.target.disabled = false;
  };
}
document.addEventListener('DOMContentLoaded', () => { if (document.body.dataset.page === 'admin') { wireProducts(); wireOrders(); wireReviews(); wireEmails(); } });
