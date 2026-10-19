/* My Orders + Order confirmation pages. */
const STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
const pill = (v) => `<span class="status-pill s-${esc(v)}">${esc(String(v).replace('_', ' '))}</span>`;
const payLabel = (o) => (o.payment_method === 'cod' ? 'COD' : 'Razorpay');
const payStatusLabel = (o) => ({ paid: 'Paid', cod_due: 'Payment due on delivery', pending: 'Pending', failed: 'Failed', cancelled: 'Cancelled', refund_pending: 'Refund pending', refunded: 'Refunded' }[o.payment_status] || o.payment_status);
const addrHtml = (a) => `${esc(a.full_name)}<br>${esc(a.line1)} ${esc(a.line2 || '')}<br>${esc(a.city)}, ${esc(a.state)} - ${esc(a.pincode)}<br>Phone: ${esc(a.phone)}`;

document.addEventListener('DOMContentLoaded', () => {
  const p = document.body.dataset.page;
  if (p === 'orders') initOrders();
  if (p === 'confirmation') initConfirmation();
});

function tracker(o) {
  if (o.order_status === 'cancelled') return '<p style="margin:10px 0">' + pill('cancelled') + '</p>';
  const idx = STEPS.indexOf(o.order_status);
  return `<div class="tracker" aria-label="Order progress">${STEPS.map((s, i) => `<div class="step ${i <= idx ? 'done' : ''}"><div class="dot">${i <= idx ? '✓' : ''}</div>${s}</div>`).join('')}</div>`;
}

async function pdfClick(btn, o) {
  btn.disabled = true;
  try { await downloadPdf(o.id, o.order_number); } catch (e) { toast(e.message, 'error'); }
  btn.disabled = false;
}

async function initOrders() {
  if (!(await Auth.requireLogin())) return;
  const root = document.getElementById('orders-root');
  const load = async () => {
    root.innerHTML = '<div class="order-card"><div class="skeleton" style="height:120px"></div></div>';
    try {
      const { orders } = await api('/api/orders', { auth: true });
      if (!orders.length) { root.innerHTML = emptyState('package', 'No orders yet', 'When you place an order it will show up here.', '<a class="btn btn-primary" href="products.html">Start shopping</a>'); return icons(); }
      root.innerHTML = orders.map((o) => `<div class="order-card" data-id="${o.id}">
        <div class="order-head"><div><b>${esc(o.order_number)}</b><br><small style="color:var(--muted)">${fmtDate(o.created_at)}</small></div>
          <div style="text-align:right"><b>${inr(o.total)}</b><br>${pill(o.order_status)} ${pill(o.payment_status)}</div></div>
        ${tracker(o)}
        <p style="font-size:.88rem;color:var(--muted)">Payment: <b style="color:var(--text)">${payLabel(o)}</b> · ${esc(payStatusLabel(o))}</p>
        ${o.order_items.map((i) => `<div class="summary-row"><span>${i.product_id ? `<a href="product-details.html?id=${i.product_id}">${esc(i.product_name)}</a>` : esc(i.product_name)} × ${i.quantity}</span><span>${inr(i.line_total)}</span></div>`).join('')}
        <div class="summary-row"><span>Shipping</span><span>${Number(o.shipping_charge) ? inr(o.shipping_charge) : 'Free'}</span></div>
        <p style="font-size:.85rem;margin:8px 0"><b>Delivery to:</b><br>${addrHtml(o.shipping_address)}</p>
        <div class="row-actions" style="display:flex;gap:8px;flex-wrap:wrap">
          ${o.order_status !== 'pending' ? `<button class="btn btn-outline btn-sm" data-pdf="${o.id}"><i data-lucide="download"></i> Download PDF</button>` : ''}
          ${['pending', 'confirmed', 'processing'].includes(o.order_status) ? `<button class="btn btn-danger btn-sm" data-cancel="${o.id}">Cancel order</button>` : ''}
          ${o.order_status === 'delivered' ? '<span style="font-size:.85rem;color:var(--muted)">Click a product above to write a review.</span>' : ''}</div></div>`).join('');
      icons();
      root.onclick = async (e) => {
        const d = e.target.closest('[data-pdf]'), c = e.target.closest('[data-cancel]');
        if (d) pdfClick(d, orders.find((o) => o.id === d.dataset.pdf));
        if (c && confirm('Cancel this order? Items will be returned to stock.')) {
          c.disabled = true;
          try { await api(`/api/orders/${c.dataset.cancel}/cancel`, { method: 'POST', auth: true }); toast('Order cancelled.', 'success'); load(); } catch (err) { toast(err.message, 'error'); c.disabled = false; }
        }
      };
    } catch (e) { root.innerHTML = errorState(e.message); document.getElementById('retry-btn').onclick = load; icons(); }
  };
  load();
}

async function initConfirmation() {
  if (!(await Auth.requireLogin())) return;
  const id = new URLSearchParams(location.search).get('id');
  const root = document.getElementById('confirm-root');
  try {
    const { order: o } = await api('/api/orders/' + encodeURIComponent(id), { auth: true });
    const unpaid = o.payment_method === 'razorpay' && o.payment_status !== 'paid';
    const headline = unpaid ? 'Payment not confirmed' : o.payment_method === 'cod' ? 'Order accepted!' : 'Payment successful - order confirmed!';
    root.innerHTML = `<div class="confirm-hero"><div class="tick" style="${unpaid ? 'background:#FEF3C7;color:#92400E' : ''}"><i data-lucide="${unpaid ? 'clock' : 'check'}"></i></div><h1 style="color:var(--navy)">${headline}</h1>
      <p style="color:var(--muted)">${unpaid ? 'We have not received a verified payment for this order yet.' : 'A confirmation email with your PDF is on its way.'}</p></div>
      <div class="panel"><div class="kv"><span>Order number</span><b>${esc(o.order_number)}</b></div><div class="kv"><span>Date</span><span>${fmtDate(o.created_at)}</span></div>
        <div class="kv"><span>Payment method</span><b>${payLabel(o)}</b></div><div class="kv"><span>Payment status</span><span>${pill(o.payment_status)} ${o.payment_status === 'cod_due' ? 'due on delivery' : ''}</span></div><div class="kv"><span>Order status</span>${pill(o.order_status)}</div></div>
      <div class="panel"><h3>Items</h3>${o.order_items.map((i) => `<div class="summary-row"><span>${esc(i.product_name)} × ${i.quantity}</span><span>${inr(i.line_total)}</span></div>`).join('')}
        <div class="summary-row" style="border-top:1px solid var(--border)"><span>Subtotal</span><span>${inr(o.subtotal)}</span></div><div class="summary-row"><span>Shipping</span><span>${Number(o.shipping_charge) ? inr(o.shipping_charge) : 'Free'}</span></div>${Number(o.tax) ? `<div class="summary-row"><span>Tax</span><span>${inr(o.tax)}</span></div>` : ''}
        <div class="summary-row total"><span>Total</span><span>${inr(o.total)}</span></div></div>
      <div class="panel"><h3>Delivery address</h3><p>${addrHtml(o.shipping_address)}</p></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:30px">${unpaid ? '' : '<button class="btn btn-primary" id="pdf-btn"><i data-lucide="download"></i> Download PDF</button>'}<a class="btn btn-outline" href="orders.html">View My Orders</a><a class="btn btn-ghost" href="products.html">Continue Shopping</a></div>`;
    const pb = document.getElementById('pdf-btn'); if (pb) pb.onclick = () => pdfClick(pb, o);
  } catch (e) { root.innerHTML = e.status === 404 ? emptyState('package-x', 'Order not found', 'This order does not exist or belongs to another account.', '<a class="btn btn-primary" href="orders.html">My Orders</a>') : errorState(e.message); const rb = document.getElementById('retry-btn'); if (rb) rb.onclick = initConfirmation; }
  icons();
}
