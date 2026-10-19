/* Checkout: address, payment method (Razorpay TEST / COD), order placement. */
document.addEventListener('DOMContentLoaded', () => { if (document.body.dataset.page === 'checkout') initCheckout(); });

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve; s.onerror = () => reject(new Error('Could not load Razorpay. Check your internet connection.'));
    document.head.appendChild(s);
  });
}

async function initCheckout() {
  const session = await Auth.requireLogin();            // signed-out users go to sign-in, then come back here
  if (!session) return;
  const root = document.getElementById('checkout-root');
  const buyNowMode = new URLSearchParams(location.search).get('mode') === 'buynow';
  let items;
  if (buyNowMode) { try { items = [JSON.parse(sessionStorage.getItem('em_buy_now'))].filter(Boolean); } catch { items = []; } } else items = Cart.get();
  items = items.map((i) => ({ product_id: i.product_id, quantity: i.quantity }));
  if (!items.length) { root.innerHTML = emptyState('shopping-bag', 'Nothing to check out', 'Your cart is empty.', '<a class="btn btn-primary" href="products.html">Browse products</a>'); return icons(); }

  root.innerHTML = '<div class="panel"><div class="skeleton" style="height:200px"></div></div>';
  let cfg, check;
  try { [cfg, check] = await Promise.all([api('/api/config'), api('/api/products/validate-cart', { method: 'POST', body: { items } })]); }
  catch (e) { root.innerHTML = errorState(e.message); document.getElementById('retry-btn').onclick = initCheckout; return icons(); }

  const bad = check.items.filter((r) => !r.product || !r.available || r.requested > r.max_quantity);
  if (bad.length) { root.innerHTML = `<div class="alert alert-error">Some items are unavailable or have limited stock. Please review your cart.</div><a class="btn btn-primary" href="cart.html">Back to cart</a>`; return; }
  const rows = check.items.map((r) => ({ p: r.product, qty: r.requested }));
  const subtotal = rows.reduce((s, r) => s + r.p.price * r.qty, 0);
  const shipping = subtotal >= cfg.freeShippingAbove ? 0 : cfg.shippingFlat;
  const tax = Math.round(subtotal * cfg.taxRatePercent) / 100;
  const total = subtotal + shipping + tax;
  const saved = JSON.parse(localStorage.getItem('em_addr') || '{}');
  const name = saved.full_name || (session.user.user_metadata && session.user.user_metadata.full_name) || '';
  const razorOk = !!cfg.razorpayKeyId;

  root.innerHTML = `<form id="co-form" class="two-col" novalidate><div>
    <div class="panel"><h3>Delivery address</h3>
      <div class="form-row"><div class="field"><label for="full_name">Full name</label><input id="full_name" name="full_name" value="${esc(name)}" autocomplete="name" required><div class="err"></div></div>
      <div class="field"><label for="phone">Mobile number</label><input id="phone" name="phone" value="${esc(saved.phone || '')}" inputmode="tel" autocomplete="tel" placeholder="10-digit number" required><div class="err"></div></div></div>
      <div class="field"><label for="line1">Address line 1</label><input id="line1" name="line1" value="${esc(saved.line1 || '')}" autocomplete="address-line1" required><div class="err"></div></div>
      <div class="field"><label for="line2">Address line 2 (optional)</label><input id="line2" name="line2" value="${esc(saved.line2 || '')}" autocomplete="address-line2"></div>
      <div class="form-row"><div class="field"><label for="city">City</label><input id="city" name="city" value="${esc(saved.city || '')}" required><div class="err"></div></div><div class="field"><label for="state">State</label><input id="state" name="state" value="${esc(saved.state || '')}" required><div class="err"></div></div></div>
      <div class="field" style="max-width:220px"><label for="pincode">PIN code</label><input id="pincode" name="pincode" value="${esc(saved.pincode || '')}" inputmode="numeric" maxlength="6" required><div class="err"></div></div></div>
    <div class="panel"><h3>Payment method</h3>
      <label class="pay-opt"><input type="radio" name="pay" value="razorpay" ${razorOk ? 'checked' : 'disabled'}><span><b>Pay online (Razorpay - TEST mode)</b><br><small style="color:var(--muted)">${razorOk ? 'Cards / UPI / netbanking using Razorpay test credentials. No real money is charged.' : 'Online payment is not configured on the server.'}</small></span></label>
      ${cfg.codEnabled ? `<label class="pay-opt"><input type="radio" name="pay" value="cod" ${razorOk ? '' : 'checked'}><span><b>Cash on Delivery</b><br><small style="color:var(--muted)">Pay when your order arrives.</small></span></label>` : ''}
    </div></div>
    <aside class="panel"><h3>Order summary</h3>${rows.map((r) => `<div class="summary-row"><span>${esc(r.p.name)} × ${r.qty}</span><span>${inr(r.p.price * r.qty)}</span></div>`).join('')}
      <div class="summary-row" style="border-top:1px solid var(--border);margin-top:6px"><span>Subtotal</span><span>${inr(subtotal)}</span></div><div class="summary-row"><span>Shipping</span><span>${shipping ? inr(shipping) : 'Free'}</span></div>${tax ? `<div class="summary-row"><span>Tax</span><span>${inr(tax)}</span></div>` : ''}
      <div class="summary-row total"><span>Total</span><span>${inr(total)}</span></div>
      <div id="co-alert" class="alert" style="display:none;margin-top:12px"></div>
      <button class="btn btn-primary btn-block" id="place-btn" type="submit">Place order</button>
      <p style="font-size:.78rem;color:var(--muted);margin-top:8px">The server re-checks prices and stock when you place the order.</p></aside></form>`;
  icons();

  const form = document.getElementById('co-form'), alertBox = document.getElementById('co-alert'), btn = document.getElementById('place-btn');
  let placing = false, pendingVerify = null;
  const setBusy = (b, label) => { placing = b; btn.disabled = b; btn.innerHTML = b ? `<span class="spinner"></span> ${label}` : 'Place order'; };
  const done = (orderId) => { if (buyNowMode) sessionStorage.removeItem('em_buy_now'); else Cart.clear(); location.replace('order-confirmation.html?id=' + orderId); };
  const fail = (m) => { alertBox.className = 'alert alert-error'; alertBox.textContent = m; alertBox.style.display = 'block'; };

  function readAddress() {
    const a = {}; let ok = true;
    ['full_name', 'phone', 'line1', 'line2', 'city', 'state', 'pincode'].forEach((k) => { a[k] = form.elements[k].value.trim(); });
    const rules = { full_name: [a.full_name.length >= 2, 'Enter the recipient name.'], phone: [/^(\+91)?[6-9]\d{9}$/.test(a.phone.replace(/[\s-]/g, '')), 'Enter a valid 10-digit mobile number.'], line1: [a.line1.length >= 5, 'Enter your address.'], city: [a.city.length >= 2, 'Enter your city.'], state: [a.state.length >= 2, 'Enter your state.'], pincode: [/^\d{6}$/.test(a.pincode), 'Enter a valid 6-digit PIN code.'] };
    for (const [k, [valid, msg]] of Object.entries(rules)) { const f = form.elements[k].closest('.field'); f.classList.toggle('invalid', !valid); f.querySelector('.err').textContent = valid ? '' : msg; ok = ok && valid; }
    return ok ? a : null;
  }

  async function verify(payload) {
    try {
      await api('/api/payments/verify', { method: 'POST', auth: true, body: payload });
      done(payload.orderId);
    } catch (e) {
      if (e.status === 0 || e.status >= 500) {            // network problem: payment may have succeeded - let the customer retry safely (idempotent)
        pendingVerify = payload;
        alertBox.className = 'alert alert-info'; alertBox.innerHTML = 'We could not confirm your payment because of a network problem. Your money is safe. <button type="button" class="btn btn-sm btn-primary" id="retry-verify">Retry confirmation</button>';
        alertBox.style.display = 'block'; document.getElementById('retry-verify').onclick = () => { alertBox.style.display = 'none'; verify(pendingVerify); };
      } else fail(e.message);
      setBusy(false);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); if (placing) return;                  // blocks duplicate checkout clicks
    alertBox.style.display = 'none';
    const address = readAddress(); if (!address) return toast('Please fix the highlighted fields.', 'error');
    localStorage.setItem('em_addr', JSON.stringify(address));
    const method = form.elements.pay.value;
    setBusy(true, method === 'cod' ? 'Placing order…' : 'Starting payment…');
    try {
      if (method === 'cod') {
        const { order } = await api('/api/orders', { method: 'POST', auth: true, body: { items, address, paymentMethod: 'cod' } });
        return done(order.id);
      }
      await loadRazorpay();
      const o = await api('/api/payments/create-order', { method: 'POST', auth: true, body: { items, address } });
      let paid = false;
      const rz = new window.Razorpay({
        key: o.keyId, amount: o.amount, currency: o.currency, name: 'ElectroMart', description: 'Order ' + o.orderNumber, order_id: o.razorpayOrderId,
        prefill: { name: address.full_name, email: session.user.email, contact: address.phone }, theme: { color: '#2563EB' },
        handler: (resp) => { paid = true; setBusy(true, 'Verifying payment…'); verify({ orderId: o.orderId, razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature }); },
        modal: { ondismiss: async () => { if (paid) return; setBusy(false); try { const r = await api('/api/payments/cancel', { method: 'POST', auth: true, body: { orderId: o.orderId } }); if (r.result === 'paid') return done(o.orderId); } catch { /* stale-order cleanup job will release stock */ } fail('Payment was cancelled. You have not been charged and your cart is unchanged.'); } },
      });
      rz.on('payment.failed', (r) => { api('/api/payments/failed', { method: 'POST', auth: true, body: { orderId: o.orderId, reason: r.error && r.error.description } }).catch(() => {}); toast('Payment failed. You can try again in the payment window.', 'error'); });
      rz.open();
    } catch (err) { fail(err.message); setBusy(false); }
  });
}
