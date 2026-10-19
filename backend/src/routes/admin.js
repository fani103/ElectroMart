const router = require('express').Router();
const multer = require('multer');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const settings = require('../config/settings');
const adminAuth = require('../middleware/adminAuth');
const orderService = require('../services/orderService');
const pay = require('../services/paymentService');
const { notifyLater, retryFailed } = require('../services/emailService');
const { decorate } = require('../services/productService');
const { validateProductInput, isUuid, HttpError } = require('../utils/validation');

router.use(adminAuth);   // every route below: valid login + admin role checked in the database

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const mustId = (id) => { if (!isUuid(id)) throw new HttpError(404, 'Not found.'); return id; };

router.get('/me', (req, res) => res.json({ isAdmin: true, email: req.user.email }));

// ---------------- Analytics ----------------
// Rules: collected revenue = orders with payment_status 'paid' (Razorpay verified on server, or COD collection recorded).
// Cancelled/refund_pending/refunded orders are NOT in collected revenue. COD outstanding = cod_due on non-cancelled orders.
router.get('/analytics', async (req, res, next) => {
  try {
    const [{ data: orders, error: e1 }, { data: products, error: e2 }, { count: customers }] = await Promise.all([
      supabase.from('orders').select('id, total, order_status, payment_status, payment_method, refund_amount, created_at, order_items(product_name, quantity, line_total)').limit(10000),
      supabase.from('products').select('id, name, stock_quantity, is_active'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
    ]);
    if (e1 || e2) throw e1 || e2;
    const sum = (arr, f = (o) => o.total) => Math.round(arr.reduce((s, o) => s + Number(f(o)), 0) * 100) / 100;
    const valid = orders.filter((o) => o.order_status !== 'cancelled');
    const active = products.filter((p) => p.is_active);
    const count = (key) => orders.reduce((m, o) => { m[o[key]] = (m[o[key]] || 0) + 1; return m; }, {});

    const trend = {};
    for (let i = 29; i >= 0; i--) trend[new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)] = 0;
    for (const o of orders.filter((x) => x.payment_status === 'paid')) { const d = o.created_at.slice(0, 10); if (d in trend) trend[d] += Number(o.total); }

    const sold = {};
    for (const o of valid) for (const it of o.order_items) { const s = (sold[it.product_name] = sold[it.product_name] || { name: it.product_name, units: 0, revenue: 0 }); s.units += it.quantity; s.revenue += Number(it.line_total); }

    res.json({
      generated_at: new Date().toISOString(),
      overview: {
        total_products: products.length, active_products: active.length,
        total_orders: valid.length, cancelled_orders: orders.length - valid.length, total_customers: customers || 0,
        pending_orders: orders.filter((o) => ['pending', 'confirmed'].includes(o.order_status)).length,
        low_stock: active.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= settings.lowStockThreshold).length,
        out_of_stock: active.filter((p) => p.stock_quantity === 0).length,
      },
      money: {
        order_value: sum(valid),
        collected_revenue: sum(orders.filter((o) => o.payment_status === 'paid')),
        cod_outstanding: sum(valid.filter((o) => o.payment_method === 'cod' && o.payment_status === 'cod_due')),
        refund_pending: sum(orders.filter((o) => o.payment_status === 'refund_pending')),
        refunded: sum(orders.filter((o) => o.payment_status === 'refunded'), (o) => o.refund_amount),
      },
      sales_trend: Object.entries(trend).map(([date, revenue]) => ({ date, revenue })),
      best_sellers: Object.values(sold).sort((a, b) => b.units - a.units).slice(0, 5),
      order_status: count('order_status'), payment_status: count('payment_status'),
    });
  } catch (e) { next(e); }
});

// ---------------- Products ----------------
router.get('/products', async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ products: data.map((p) => ({ ...decorate(p), original_price_raw: p.original_price })) });
  } catch (e) { next(e); }
});

router.post('/products', async (req, res, next) => {
  try {
    const row = validateProductInput(req.body);
    const { data, error } = await supabase.from('products').insert(row).select().single();
    if (error) throw error;
    res.status(201).json({ product: data });
  } catch (e) { next(e); }
});

router.put('/products/:id', async (req, res, next) => {
  try {
    const row = { ...validateProductInput(req.body, { partial: true }), updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('products').update(row).eq('id', mustId(req.params.id)).select().maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Product not found.');
    res.json({ product: data });
  } catch (e) { next(e); }
});

// "Delete" = deactivate (keeps order history intact). Re-activate with PUT {is_active:true}.
router.delete('/products/:id', async (req, res, next) => {
  try {
    const { error } = await supabase.from('products').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', mustId(req.params.id));
    if (error) throw error;
    res.json({ deactivated: true });
  } catch (e) { next(e); }
});

// POST /api/admin/products/image  (multipart, field "image") -> { url }
router.post('/products/image', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, 'Choose an image file.');
    const ext = EXT[req.file.mimetype];
    if (!ext) throw new HttpError(400, 'Only JPG, PNG or WebP images are allowed.');
    const path = `products/${Date.now()}-${crypto.randomBytes(5).toString('hex')}.${ext}`;
    const { error } = await supabase.storage.from(settings.storageBucket).upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) throw new HttpError(502, `Image upload failed: ${error.message}`);
    const { data } = supabase.storage.from(settings.storageBucket).getPublicUrl(path);
    res.status(201).json({ url: data.publicUrl });
  } catch (e) { next(e); }
});

// ---------------- Orders ----------------
router.get('/orders', async (req, res, next) => {
  try {
    let q = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(200);
    if (req.query.status) q = q.eq('order_status', req.query.status);
    const { data, error } = await q;
    if (error) throw error;
    const ids = [...new Set(data.map((o) => o.user_id))];
    const { data: profs } = ids.length ? await supabase.from('profiles').select('id, full_name, email').in('id', ids) : { data: [] };
    const byId = new Map((profs || []).map((p) => [p.id, p]));
    res.json({ orders: data.map((o) => ({ ...o, customer: byId.get(o.user_id) || null })) });
  } catch (e) { next(e); }
});

router.patch('/orders/:id/status', async (req, res, next) => {
  try {
    const next_ = String(req.body.status || '');
    const order = await orderService.updateStatus(mustId(req.params.id), next_);
    if (next_ === 'shipped' || next_ === 'delivered') notifyLater(order.id, next_);
    res.json({ order });
  } catch (e) { next(e); }
});

router.post('/orders/:id/cod-collected', async (req, res, next) => {
  try { res.json({ order: await orderService.recordCodCollection(mustId(req.params.id)) }); } catch (e) { next(e); }
});

router.post('/orders/:id/cancel', async (req, res, next) => {
  try {
    const id = mustId(req.params.id);
    await orderService.cancelOrder(id);
    notifyLater(id, 'cancelled');
    res.json({ order: await orderService.getOrder(id) });
  } catch (e) { next(e); }
});

// Refund: Razorpay refunds go through the Razorpay API and are only marked "refunded" when Razorpay says processed.
// COD orders (cash already collected) need { manual: true } = admin confirms they returned the cash themselves.
router.post('/orders/:id/refund', async (req, res, next) => {
  try {
    const o = await orderService.getOrder(mustId(req.params.id));
    if (!o) throw new HttpError(404, 'Order not found.');
    if (o.payment_status !== 'refund_pending') throw new HttpError(409, 'This order has no refund pending.');
    let status = 'processed', refundId = null;
    if (o.payment_method === 'razorpay') {
      if (!o.razorpay_payment_id) throw new HttpError(409, 'No Razorpay payment is recorded for this order.');
      const r = await pay.refundPayment(o).catch((e) => { throw new HttpError(502, `Razorpay refund failed: ${(e.error && e.error.description) || e.message}`); });
      status = r.status; refundId = r.id;
    } else if (req.body.manual !== true) {
      throw new HttpError(400, 'For COD orders confirm the manual refund with { "manual": true }.');
    }
    if (status === 'processed') {
      await supabase.from('orders').update({ payment_status: 'refunded', refund_id: refundId, refund_amount: o.total, refunded_at: new Date().toISOString() }).eq('id', o.id).eq('payment_status', 'refund_pending');
      notifyLater(o.id, 'refund_confirmed');
    } else {
      await supabase.from('orders').update({ refund_id: refundId }).eq('id', o.id);
    }
    res.json({ status: status === 'processed' ? 'refunded' : 'refund_initiated_awaiting_confirmation', order: await orderService.getOrder(o.id) });
  } catch (e) { next(e); }
});

// ---------------- Reviews ----------------
router.get('/reviews', async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('reviews').select('*, products(name)').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    const ids = [...new Set(data.map((r) => r.user_id))];
    const { data: profs } = ids.length ? await supabase.from('profiles').select('id, full_name, email').in('id', ids) : { data: [] };
    const byId = new Map((profs || []).map((p) => [p.id, p]));
    res.json({ reviews: data.map((r) => ({ ...r, customer: byId.get(r.user_id) || null })) });
  } catch (e) { next(e); }
});

router.patch('/reviews/:id', async (req, res, next) => {
  try {
    if (!['approved', 'hidden'].includes(req.body.status)) throw new HttpError(400, 'Status must be approved or hidden.');
    const { error } = await supabase.from('reviews').update({ status: req.body.status }).eq('id', mustId(req.params.id));
    if (error) throw error;
    res.json({ updated: true });
  } catch (e) { next(e); }
});

// ---------------- Email notifications ----------------
router.get('/notifications', async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('notifications').select('*, orders(order_number)').neq('status', 'sent').order('updated_at', { ascending: false }).limit(50);
    if (error) throw error;
    res.json({ notifications: data });
  } catch (e) { next(e); }
});
router.post('/notifications/retry', async (req, res, next) => {
  try { res.json({ results: await retryFailed() }); } catch (e) { next(e); }
});

module.exports = router;
