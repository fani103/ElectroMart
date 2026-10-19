/* Guest cart in localStorage. Merged with the user's saved cart after login. */
const Cart = {
  KEY: 'em_cart', uid: null,
  get() { try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); } catch { return []; } },
  save(items) {
    localStorage.setItem(this.KEY, JSON.stringify(items));
    if (this.uid) localStorage.setItem('em_cart_user_' + this.uid, JSON.stringify(items));
    this.updateBadge();
  },
  count() { return this.get().reduce((n, i) => n + i.quantity, 0); },
  updateBadge() { const b = document.getElementById('cart-count'); if (!b) return; const n = this.count(); b.textContent = n; b.style.display = n ? 'grid' : 'none'; },
  add(p, qty = 1) {
    if (p.stock_status === 'out_of_stock' || p.stock_quantity <= 0) { toast('Sorry, this product is out of stock.', 'error'); return false; }
    const items = this.get(); const max = Math.min(p.stock_quantity, 10);
    const ex = items.find((i) => i.product_id === p.id);
    const want = (ex ? ex.quantity : 0) + qty;
    if (want > max) { toast(`Only ${max} unit(s) available.`, 'error'); if (ex) ex.quantity = max; else items.push({ product_id: p.id, quantity: max, name: p.name, price: p.price, image_url: p.image_url }); this.save(items); return false; }
    if (ex) ex.quantity = want; else items.push({ product_id: p.id, quantity: qty, name: p.name, price: p.price, image_url: p.image_url });
    this.save(items); toast('Added to cart', 'success'); return true;
  },
  setQty(id, q) { const items = this.get(); const it = items.find((i) => i.product_id === id); if (!it) return; it.quantity = Math.max(1, q); this.save(items); },
  remove(id) { this.save(this.get().filter((i) => i.product_id !== id)); },
  clear() { this.save([]); },
  // After login: merge the guest cart with the cart saved for this user (quantities added; backend re-checks stock)
  mergeUser(uid) {
    this.uid = uid;
    let saved = []; try { saved = JSON.parse(localStorage.getItem('em_cart_user_' + uid) || '[]'); } catch { /* ignore */ }
    const merged = this.get();
    for (const s of saved) { const ex = merged.find((i) => i.product_id === s.product_id); if (ex) ex.quantity = Math.min(10, Math.max(ex.quantity, s.quantity)); else merged.push(s); }
    this.save(merged);
  },
};

async function fetchProduct(id) { return (await api('/api/products/' + id)).product; }

// Buy Now: validate availability, remember the intent, then go to checkout (sign-in is handled there)
async function buyNow(id, qty = 1) {
  try {
    const p = await fetchProduct(id);
    if (p.stock_status === 'out_of_stock') return toast('Sorry, this product is out of stock.', 'error');
    sessionStorage.setItem('em_buy_now', JSON.stringify({ product_id: id, quantity: Math.min(qty, p.stock_quantity) }));
    location.href = 'checkout.html?mode=buynow';
  } catch (e) { toast(e.message, 'error'); }
}

document.addEventListener('click', async (e) => {
  const buy = e.target.closest('[data-buy]'); const add = e.target.closest('[data-add]');
  if (buy && !buy.disabled) { buy.disabled = true; await buyNow(buy.dataset.buy, Number(buy.dataset.qty || 1)); buy.disabled = false; }
  if (add && !add.disabled) { try { Cart.add(await fetchProduct(add.dataset.add), 1); } catch (err) { toast(err.message, 'error'); } }
});
document.addEventListener('DOMContentLoaded', () => Cart.updateBadge());
window.addEventListener('storage', () => Cart.updateBadge());

/* ---------------- Cart page ---------------- */
async function initCartPage() {
  const root = document.getElementById('cart-root');
  const render = async () => {
    const items = Cart.get();
    if (!items.length) { root.innerHTML = emptyState('shopping-cart', 'Your cart is empty', 'Add some products to get started.', '<a class="btn btn-primary" href="products.html">Browse products</a>'); icons(); return; }
    root.innerHTML = '<div class="panel"><div class="skeleton" style="height:90px;margin-bottom:10px"></div><div class="skeleton" style="height:90px"></div></div>';
    let cfg, check;
    try { [cfg, check] = await Promise.all([api('/api/config'), api('/api/products/validate-cart', { method: 'POST', body: { items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })) } })]); }
    catch (e) { root.innerHTML = errorState(e.message); document.getElementById('retry-btn').onclick = render; icons(); return; }

    // Remove unavailable items, clamp quantities to current stock
    let changed = false; const rows = [];
    for (const r of check.items) {
      if (!r.product || !r.available) { Cart.remove(r.product_id); changed = true; continue; }
      const it = Cart.get().find((i) => i.product_id === r.product_id);
      if (it.quantity > r.max_quantity) { Cart.setQty(r.product_id, r.max_quantity); it.quantity = r.max_quantity; changed = true; }
      rows.push({ p: r.product, qty: it.quantity, max: r.max_quantity });
    }
    if (changed) toast('Your cart was updated to match current availability.');
    if (!rows.length) return render();
    const subtotal = rows.reduce((s, r) => s + r.p.price * r.qty, 0);
    const shipping = subtotal >= cfg.freeShippingAbove ? 0 : cfg.shippingFlat;
    const tax = Math.round(subtotal * cfg.taxRatePercent) / 100;
    root.innerHTML = `<div class="two-col"><div class="panel">${rows.map((r) => `<div class="cart-item"><a href="product-details.html?id=${r.p.id}">${imgTag(r.p.image_url, r.p.name)}</a>
        <div><a class="nm" href="product-details.html?id=${r.p.id}">${esc(r.p.name)}</a><div class="price-row"><span class="price" style="font-size:1rem">${inr(r.p.price)}</span>${r.p.original_price ? `<span class="mrp">${inr(r.p.original_price)}</span>` : ''}${discBadge(r.p)}</div>${stockBadge(r.p)}
        <div style="margin-top:8px;display:flex;gap:10px;align-items:center"><div class="qty"><button data-dec="${r.p.id}" aria-label="Decrease">−</button><input value="${r.qty}" readonly aria-label="Quantity"><button data-inc="${r.p.id}" data-max="${r.max}" aria-label="Increase">+</button></div><button class="btn btn-danger btn-sm" data-rm="${r.p.id}"><i data-lucide="trash-2"></i> Remove</button></div></div>
        <b>${inr(r.p.price * r.qty)}</b></div>`).join('')}</div>
      <aside class="panel"><h3>Order summary</h3><div class="summary-row"><span>Subtotal</span><b>${inr(subtotal)}</b></div><div class="summary-row"><span>Shipping</span><span>${shipping ? inr(shipping) : 'Free'}</span></div>${tax ? `<div class="summary-row"><span>Tax</span><span>${inr(tax)}</span></div>` : ''}
        <div class="summary-row total"><span>Total</span><span>${inr(subtotal + shipping + tax)}</span></div>
        <p style="font-size:.78rem;color:var(--muted);margin:8px 0">Final prices are confirmed by the server at checkout.</p>
        <button class="btn btn-primary btn-block" id="go-checkout">Proceed to checkout</button></aside></div>`;
    icons();
    root.onclick = (e) => {
      const t = e.target.closest('button'); if (!t) return;
      const cur = (id) => Cart.get().find((i) => i.product_id === id);
      if (t.dataset.rm) { Cart.remove(t.dataset.rm); render(); }
      if (t.dataset.dec) { Cart.setQty(t.dataset.dec, cur(t.dataset.dec).quantity - 1); render(); }
      if (t.dataset.inc) { const c = cur(t.dataset.inc); if (c.quantity >= Number(t.dataset.max)) return toast(`Only ${t.dataset.max} available.`, 'error'); Cart.setQty(t.dataset.inc, c.quantity + 1); render(); }
      if (t.id === 'go-checkout') { sessionStorage.removeItem('em_buy_now'); location.href = 'checkout.html'; }
    };
  };
  render();
}
document.addEventListener('DOMContentLoaded', () => { if (document.body.dataset.page === 'cart') initCartPage(); });
