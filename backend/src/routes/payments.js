const router = require('express').Router();
const supabase = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const orderService = require('../services/orderService');
const pay = require('../services/paymentService');
const { notifyLater } = require('../services/emailService');
const { validateCartItems, validateAddress, isUuid, HttpError, clean } = require('../utils/validation');

// POST /api/payments/create-order { items, address }
// 1) validates + reserves stock + saves a pending order, 2) creates the Razorpay order from the TRUSTED total.
router.post('/create-order', requireAuth, async (req, res, next) => {
  let orderId = null;
  try {
    if (!pay.isTestKey) throw new HttpError(503, 'Online payment is not configured (Razorpay TEST keys required).');
    const items = validateCartItems(req.body.items);
    const address = validateAddress(req.body.address);
    orderId = await orderService.createOrder(req.user.id, items, address, 'razorpay');
    const order = await orderService.getOrder(orderId);
    const rz = await pay.createRazorpayOrder(order);
    res.status(201).json({ orderId: order.id, orderNumber: order.order_number, razorpayOrderId: rz.id, amount: rz.amount, currency: rz.currency, keyId: pay.publicKeyId() });
  } catch (e) {
    if (orderId) { try { await orderService.cancelOrder(orderId); } catch (_) { /* best effort: releases reserved stock */ } }
    next(e);
  }
});

// POST /api/payments/verify { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
router.post('/verify', requireAuth, async (req, res, next) => {
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!isUuid(orderId) || !razorpay_order_id || !razorpay_payment_id) throw new HttpError(400, 'Invalid payment details.');
    const order = await orderService.getOrderForUser(orderId, req.user.id);
    if (order.payment_method !== 'razorpay' || order.razorpay_order_id !== razorpay_order_id) throw new HttpError(400, 'Payment does not match this order.');
    if (!pay.verifyCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      await supabase.from('payments').update({ status: 'failed', failure_reason: 'Invalid signature', updated_at: new Date().toISOString() }).eq('provider_order_id', razorpay_order_id).eq('status', 'created');
      throw new HttpError(400, 'Payment verification failed. If money was deducted, contact support with your order number.');
    }
    const firstTime = await orderService.confirmPayment(order.id, razorpay_order_id, razorpay_payment_id); // idempotent
    if (firstTime) notifyLater(order.id, 'order_confirmation');
    res.json({ verified: true, order: await orderService.getOrder(order.id) });
  } catch (e) { next(e); }
});

// POST /api/payments/failed { orderId, reason }  - records a failed ATTEMPT (customer may retry in the same popup)
router.post('/failed', requireAuth, async (req, res, next) => {
  try {
    if (!isUuid(req.body.orderId)) throw new HttpError(400, 'Invalid order.');
    const o = await orderService.getOrderForUser(req.body.orderId, req.user.id);
    if (o.payment_status === 'pending') {
      await supabase.from('payments').update({ failure_reason: clean(req.body.reason, 200) || 'Payment failed', updated_at: new Date().toISOString() }).eq('order_id', o.id).eq('status', 'created');
    }
    res.json({ recorded: true });
  } catch (e) { next(e); }
});

// POST /api/payments/cancel { orderId } - checkout popup closed without paying: release stock, never mark paid
router.post('/cancel', requireAuth, async (req, res, next) => {
  try {
    if (!isUuid(req.body.orderId)) throw new HttpError(400, 'Invalid order.');
    await orderService.getOrderForUser(req.body.orderId, req.user.id);   // ownership check
    const result = await pay.cancelUnpaidOrder(req.body.orderId);
    if (result === 'paid') notifyLater(req.body.orderId, 'order_confirmation');
    res.json({ result });
  } catch (e) { next(e); }
});

// POST /api/payments/webhook  (optional; raw body is mounted in server.js)
router.post('/webhook', async (req, res) => {
  try {
    const raw = req.body; // Buffer
    if (!pay.verifyWebhookSignature(raw, req.headers['x-razorpay-signature'])) return res.status(400).json({ error: 'Invalid signature' });
    const evt = JSON.parse(raw.toString('utf8'));
    const p = evt.payload && evt.payload.payment && evt.payload.payment.entity;
    if ((evt.event === 'payment.captured' || evt.event === 'order.paid') && p) {
      const { data: row } = await supabase.from('payments').select('order_id').eq('provider_order_id', p.order_id).maybeSingle();
      if (row) {
        const first = await orderService.confirmPayment(row.order_id, p.order_id, p.id).catch(() => false);
        if (first) notifyLater(row.order_id, 'order_confirmation');
      }
    } else if (evt.event === 'payment.failed' && p) {
      await supabase.from('payments').update({ failure_reason: clean(p.error_description, 200) || 'Payment failed', updated_at: new Date().toISOString() }).eq('provider_order_id', p.order_id).eq('status', 'created');
    } else if (evt.event === 'refund.processed') {
      const r = evt.payload.refund.entity;
      const { data: o } = await supabase.from('orders').select('id').eq('razorpay_payment_id', r.payment_id).maybeSingle();
      if (o) {
        const { data: upd } = await supabase.from('orders').update({ payment_status: 'refunded', refund_id: r.id, refund_amount: r.amount / 100, refunded_at: new Date().toISOString() }).eq('id', o.id).neq('payment_status', 'refunded').select('id');
        if (upd && upd.length) notifyLater(o.id, 'refund_confirmed');
      }
    }
    res.json({ received: true });
  } catch (e) { console.error('[webhook]', e.message); res.status(500).json({ error: 'Webhook error' }); }
});

module.exports = router;
