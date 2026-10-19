const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const settings = require('../config/settings');
const supabase = require('../config/supabase');
const orderService = require('../services/orderService');
const { notifyLater } = require('../services/emailService');
const { generateOrderPdf } = require('../services/pdfService');
const { validateCartItems, validateAddress, isUuid, HttpError } = require('../utils/validation');

// POST /api/orders  (COD only; Razorpay orders start at /api/payments/create-order)
router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (req.body.paymentMethod !== 'cod') throw new HttpError(400, 'Use /api/payments/create-order for online payments.');
    if (!settings.codEnabled) throw new HttpError(403, 'Cash on Delivery is currently unavailable.');
    const items = validateCartItems(req.body.items);
    const address = validateAddress(req.body.address);
    const id = await orderService.createOrder(req.user.id, items, address, 'cod');
    notifyLater(id, 'order_confirmation');
    res.status(201).json({ order: await orderService.getOrder(id) });
  } catch (e) { next(e); }
});

router.get('/', requireAuth, async (req, res, next) => {
  try { res.json({ orders: await orderService.listOrdersForUser(req.user.id) }); } catch (e) { next(e); }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) throw new HttpError(404, 'Order not found.');
    const admin = await orderService.isAdminUser(req.user.id);
    const order = await orderService.getOrderForUser(req.params.id, req.user.id, admin);
    // which items can be reviewed (delivered, not reviewed yet)
    let reviewable = [];
    if (order.order_status === 'delivered' && order.user_id === req.user.id) {
      const { data } = await supabase.from('reviews').select('order_item_id').in('order_item_id', order.order_items.map((i) => i.id));
      const done = new Set((data || []).map((r) => r.order_item_id));
      reviewable = order.order_items.filter((i) => i.product_id && !done.has(i.id)).map((i) => i.id);
    }
    res.json({ order, reviewable_item_ids: reviewable });
  } catch (e) { next(e); }
});

// Customer cancels own order (only before shipping)
router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) throw new HttpError(404, 'Order not found.');
    const o = await orderService.getOrderForUser(req.params.id, req.user.id);
    await orderService.cancelOrder(o.id);
    notifyLater(o.id, 'cancelled');
    res.json({ order: await orderService.getOrder(o.id) });
  } catch (e) { next(e); }
});

// GET /api/orders/:id/pdf - owner or admin only; never public
router.get('/:id/pdf', requireAuth, async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) throw new HttpError(404, 'Order not found.');
    const admin = await orderService.isAdminUser(req.user.id);
    const order = await orderService.getOrderForUser(req.params.id, req.user.id, admin);
    if (order.order_status === 'pending') throw new HttpError(409, 'The confirmation PDF is available after the order is confirmed.');
    const { data: customer } = await supabase.from('profiles').select('email, full_name').eq('id', order.user_id).maybeSingle();
    const pdf = await generateOrderPdf(order, customer);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${order.order_number}.pdf"`, 'Cache-Control': 'private, no-store' });
    res.send(pdf);
  } catch (e) { next(e); }
});

module.exports = router;
