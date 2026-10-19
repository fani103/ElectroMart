const { JSDOM, VirtualConsole } = require('jsdom'); const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '../../frontend');
const P = (id, o = {}) => ({ id, name: 'Demo ' + id, description: 'desc', category: 'Laptops', price: 1000, original_price: 2000, discount_percent: 50, stock_quantity: 3, stock_status: 'low_stock', image_url: null, specifications: { RAM: '8 GB' }, is_active: true, created_at: new Date().toISOString(), avg_rating: null, review_count: 0, ...o });
const prods = [P('11111111-1111-4111-8111-111111111111'), P('22222222-2222-4222-8222-222222222222', { stock_quantity: 0, stock_status: 'out_of_stock', original_price: null, discount_percent: 0 }), P('33333333-3333-4333-8333-333333333333', { stock_quantity: 50, stock_status: 'in_stock', avg_rating: 4.5, review_count: 2 })];
const order = { id: 'o1', order_number: 'EM261018-ABC123', created_at: new Date().toISOString(), payment_method: 'cod', payment_status: 'cod_due', order_status: 'confirmed', subtotal: 1000, shipping_charge: 99, tax: 0, total: 1099, discount: 0, user_id: 'u1', shipping_address: { full_name: 'Ravi', line1: '12 Main Road', city: 'Hyd', state: 'TS', pincode: '500001', phone: '9876543210' }, order_items: [{ id: 'i1', product_id: prods[0].id, product_name: 'Demo 1', quantity: 1, line_total: 1000, unit_price: 1000 }], customer: { full_name: 'Ravi', email: 'r@x.com' } };
function route(url, opts = {}) {
  const u = new URL(url); const p = u.pathname; const m = opts.method || 'GET';
  if (p === '/api/config') return { codEnabled: true, razorpayKeyId: 'rzp_test_x', freeShippingAbove: 5000, shippingFlat: 99, taxRatePercent: 0, maxQtyPerItem: 10 };
  if (p === '/api/products/reviews/latest') return { reviews: [{ rating: 5, comment: 'Great', author: 'Ravi', product: 'Demo 1' }] };
  if (p === '/api/products/validate-cart') { const items = JSON.parse(opts.body).items; return { items: items.map((i) => { const pr = prods.find((x) => x.id === i.product_id); return { product_id: i.product_id, available: pr.stock_quantity > 0, product: pr, requested: i.quantity, max_quantity: Math.min(pr.stock_quantity, 10) }; }) }; }
  if (p === '/api/products') return { products: prods, total: 3, page: 1, limit: 12 };
  if (p.startsWith('/api/products/')) return { product: prods[0], related: [prods[2]], reviews: [{ id: 'r', rating: 5, comment: 'Nice', author: 'Ravi', created_at: new Date().toISOString() }] };
  if (p.startsWith('/api/reviews/eligibility')) return { eligible: true };
  if (p === '/api/orders') return { orders: [order] };
  if (p.startsWith('/api/orders/')) return { order, reviewable_item_ids: [] };
  if (p === '/api/admin/me') return { isAdmin: true };
  if (p === '/api/admin/analytics') return { overview: { total_products: 3, active_products: 3, total_orders: 1, cancelled_orders: 0, total_customers: 1, pending_orders: 1, low_stock: 1, out_of_stock: 1 }, money: { order_value: 1099, collected_revenue: 0, cod_outstanding: 1099, refund_pending: 0, refunded: 0 }, sales_trend: [{ date: '2026-10-18', revenue: 0 }], best_sellers: [{ name: 'Demo 1', units: 1, revenue: 1000 }], order_status: { confirmed: 1 }, payment_status: { cod_due: 1 } };
  if (p === '/api/admin/products') return { products: prods.map((x) => ({ ...x, original_price_raw: x.original_price })) };
  if (p === '/api/admin/orders') return { orders: [order] };
  if (p === '/api/admin/reviews') return { reviews: [] };
  if (p === '/api/admin/notifications') return { notifications: [] };
  if (p === '/api/ai/chat') return { answer: 'Demo 1 is available for ₹1,000.', products: [{ id: prods[0].id, name: 'Demo 1', price: 1000 }] };
  throw new Error('unmocked ' + m + ' ' + p);
}
const PORT = 8765; const srv = http.createServer((q, r) => { try { const f = path.join(ROOT, q.url.split('?')[0]); r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/css' }); r.end(fs.readFileSync(f)); } catch { r.writeHead(404); r.end(); } }).listen(PORT);
async function load(file, { query = '', session = true, cart = null, buynow = null } = {}) {
  const errors = []; const vc = new VirtualConsole(); vc.on('jsdomError', (e) => { if (/Could not load link|Not implemented: navigation/.test(e.message)) { if (/navigation/.test(e.message)) errors.nav = (errors.nav||0)+1; return; } errors.push('jsdomError: ' + (e.detail && e.detail.stack || e.message)); }); vc.on('error', (e) => errors.push('console.error: ' + e));
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/<script src="https:[^>]*><\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://localhost:' + PORT + '/' + file + query, runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      const sess = session ? { access_token: 't', user: { id: 'u1', email: 'r@x.com', user_metadata: { full_name: 'Ravi Kumar' } } } : null;
      w.lucide = { createIcons() {} };
      const chan = { on() { return chan; }, subscribe(cb) { setTimeout(() => cb('SUBSCRIBED'), 5); return chan; } };
      w.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: sess } }), onAuthStateChange: (cb) => { setTimeout(() => cb('INITIAL_SESSION', sess), 1); return { data: { subscription: {} } }; }, signOut: async () => ({}), signInWithPassword: async () => ({ error: null }) }, channel: () => chan, removeChannel() {} }) };
      w.fetch = async (url, opts) => { try { const body = route(url, opts); return { ok: true, status: 200, json: async () => body }; } catch (e) { errors.push(e.message); return { ok: false, status: 500, json: async () => ({ error: e.message }) }; } };
      w.confirm = () => true; w.scrollTo = () => {};
      if (cart) w.localStorage.setItem('em_cart', JSON.stringify(cart)); if (buynow) w.sessionStorage.setItem('em_buy_now', JSON.stringify(buynow));
    } });
  await new Promise((r) => setTimeout(r, 700)); return { dom, errors, doc: dom.window.document };
}
const results = []; const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); };
(async () => {
  let t = await load('index.html');
  ok('home: 6 categories', t.doc.querySelectorAll('.cat').length === 6); ok('home: featured/latest/offers grids filled', t.doc.querySelectorAll('.pcard').length >= 9);
  ok('home: Buy Now on cards', [...t.doc.querySelectorAll('.pcard .btn-primary')].every((b) => /Buy Now|Unavailable/.test(b.textContent)));
  ok('home: green discount badge + low stock label', !!t.doc.querySelector('.badge-off') && !!t.doc.querySelector('.stock.low')); ok('home: out-of-stock disabled', !!t.doc.querySelector('[data-buy][disabled]'));
  ok('home: no rating shown when none, shown when present', t.doc.querySelectorAll('.stars').length > 0 && !t.doc.querySelector('.pcard .stars + .stars'));
  ok('home: reviews section visible (real review)', t.doc.getElementById('reviews-section').style.display === 'block'); ok('home: AI fab present', !!t.doc.querySelector('.ai-fab')); ok('home: header+footer', !!t.doc.querySelector('.site-header') && !!t.doc.querySelector('.site-footer')); ok('home: no errors', t.errors.length === 0, t.errors.join(' | '));
  t = await load('products.html', { query: '?category=Laptops' });  ok('catalog: products render', t.doc.querySelectorAll('.pcard').length === 3); ok('catalog: category preset', t.doc.getElementById('f-category').value === 'Laptops'); ok('catalog: no errors', t.errors.length === 0, t.errors.join(' | '));
  t = await load('product-details.html', { query: '?id=' + prods[0].id }); ok('details: renders name/price/specs/related/reviews', !!t.doc.querySelector('.d-info h1') && !!t.doc.querySelector('.spec-table') && t.doc.querySelectorAll('.pcard').length === 1 && !!t.doc.querySelector('.review')); ok('details: review form shown to eligible user', !!t.doc.getElementById('rev-submit')); ok('details: no errors', t.errors.length === 0, t.errors.join(' | '));
  t = await load('cart.html', { cart: [{ product_id: prods[0].id, quantity: 2, name: 'x', price: 1 }, { product_id: prods[1].id, quantity: 1 }] });
  ok('cart: out-of-stock item auto-removed', t.doc.querySelectorAll('.cart-item').length === 1); ok('cart: total uses server price (2×1000 + 99 shipping)', /2,099/.test(t.doc.querySelector('.summary-row.total').textContent)); ok('cart: no errors', t.errors.length === 0, t.errors.join(' | '));
  t = await load('cart.html'); ok('cart: empty state', !!t.doc.querySelector('.empty'));
  t = await load('checkout.html', { query: '?mode=buynow', buynow: { product_id: prods[0].id, quantity: 1 } }); ok('checkout: form + payment options', !!t.doc.getElementById('co-form') && t.doc.querySelectorAll('input[name=pay]').length === 2); ok('checkout: no errors', t.errors.length === 0, t.errors.join(' | '));
  t = await load('checkout.html', { session: false }); ok('checkout: signed-out triggers redirect', t.errors.nav >= 1);
  t = await load('orders.html'); ok('orders: card, tracker, PDF, cancel, COD label', !!t.doc.querySelector('.order-card') && !!t.doc.querySelector('.tracker') && !!t.doc.querySelector('[data-pdf]') && !!t.doc.querySelector('[data-cancel]') && /COD/.test(t.doc.body.textContent) && /due on delivery/.test(t.doc.body.textContent)); ok('orders: no errors', t.errors.length === 0, t.errors.join(' | '));
  t = await load('order-confirmation.html', { query: '?id=o1' }); ok('confirmation: accepted COD + PDF button + totals', /Order accepted/.test(t.doc.body.textContent) && !!t.doc.getElementById('pdf-btn') && /1,099/.test(t.doc.body.textContent)); ok('confirmation: no errors', t.errors.length === 0, t.errors.join(' | '));
  t = await load('admin.html'); ok('admin: app shown after admin check', !t.doc.getElementById('admin-app').classList.contains('hidden')); ok('admin: stats + trend + best sellers', t.doc.querySelectorAll('.stat').length === 12 && t.doc.querySelectorAll('#trend div').length === 1 && /Demo 1/.test(t.doc.getElementById('best').textContent)); ok('admin: live indicator on', t.doc.getElementById('live').classList.contains('on')); ok('admin: no errors', t.errors.length === 0, t.errors.join(' | '));
  t = await load('admin.html', { session: false }); ok('admin: signed-out triggers redirect', t.errors.nav >= 1);
  t = await load('signin.html', { session: false }); ok('signin: admin link at bottom', /Admin\? Go to Admin Dashboard/.test(t.doc.querySelector('.admin-link').textContent) && t.doc.querySelector('.admin-link').getAttribute('href') === 'admin.html');
  t = await load('signin.html', { session: true, query: '?redirect=checkout.html%3Fmode%3Dbuynow' }); ok('signin: signed-in user bounced', t.errors.nav >= 1); ok('safeRedirect accepts checkout.html?mode=buynow', t.dom.window.eval("Auth.safeRedirect('checkout.html?mode=buynow')") === 'checkout.html?mode=buynow');
  t = await load('signin.html', { session: true, query: '?redirect=https%3A%2F%2Fevil.com' }); ok('safeRedirect rejects evil urls', ['https://evil.com','//evil.com','javascript:alert(1)','/x.html','a.html/../../b'].every(u => t.dom.window.eval(`Auth.safeRedirect(${JSON.stringify(u)})`) === null));
  for (const f of ['signup.html', 'forgot-password.html', 'ai.html']) { t = await load(f, { session: false }); ok(f + ': loads, no errors', t.errors.length === 0 && t.doc.body.children.length > 0, t.errors.join(' | ')); }
  t = await load('ai.html', { session: false }); const form = t.doc.querySelector('#ai-page-panel form'); form.querySelector('input').value = 'phones'; form.dispatchEvent(new t.dom.window.Event('submit', { cancelable: true })); await new Promise((r) => setTimeout(r, 300));
  ok('ai page: answer + product link rendered', /available for/.test(t.doc.querySelector('.ai-msgs').textContent) && !!t.doc.querySelector('.ai-links a'));
  const bad = results.filter((r) => r[0] === 'FAIL'); results.forEach((r) => console.log(r[0], r[1], r[2] || '')); console.log(`\n${results.length - bad.length}/${results.length} passed`); process.exit(bad.length ? 1 : 0);
})();
