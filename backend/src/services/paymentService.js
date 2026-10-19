const crypto = require('crypto');
const Razorpay = require('razorpay');
const supabase = require('../config/supabase');
const orderService = require('./orderService');
const { HttpError } = require('../utils/validation');

const keyId = process.env.RAZORPAY_KEY_ID || '';
const keySecret = process.env.RAZORPAY_KEY_SECRET || '';

// TEST MODE ONLY: refuse to run with anything other than rzp_test_ keys.
const isTestKey = keyId.startsWith('rzp_test_');
if (keyId && !isTestKey) console.error('[razorpay] REFUSING live key. This project is TEST MODE ONLY (key must start with rzp_test_).');

let instance = null;
function client() {
  if (!keyId || !keySecret) throw new HttpError(503, 'Online payment is not configured on the server.');
  if (!isTestKey) throw new HttpError(503, 'Payments are limited to Razorpay TEST mode keys.');
  if (!instance) instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return instance;
}

const publicKeyId = () => (isTestKey ? keyId : null);

async function createRazorpayOrder(order) {
  const amount = Math.round(Number(order.total) * 100); // paise, from TRUSTED saved order total
  let rz;
  try {
    rz = await client().orders.create({ amount, currency: 'INR', receipt: order.order_number, notes: { order_id: order.id } });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, 'Could not start the payment. Please try again.');
  }
  const { error } = await supabase.from('payments').insert({
    order_id: order.id, provider: 'razorpay', provider_order_id: rz.id, amount: order.total, currency: 'INR', status: 'created',
  });
  if (error) throw error;
  await supabase.from('orders').update({ razorpay_order_id: rz.id }).eq('id', order.id);
  return rz;
}

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Official Razorpay checkout signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret)
function verifyCheckoutSignature(rzpOrderId, rzpPaymentId, signature) {
  if (!keySecret || !signature) return false;
  const expected = crypto.createHmac('sha256', keySecret).update(`${rzpOrderId}|${rzpPaymentId}`).digest('hex');
  return safeEqual(expected, signature);
}

// Webhook signature: HMAC_SHA256(raw_body, webhook_secret)
function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

// Cancels an unpaid Razorpay order (returns stock). If Razorpay says it WAS paid, confirms it instead.
// Returns 'cancelled' | 'paid' | 'noop'
async function cancelUnpaidOrder(orderId) {
  const order = await orderService.getOrder(orderId);
  if (!order || order.payment_method !== 'razorpay') return 'noop';
  if (order.payment_status === 'paid') return 'paid';
  if (order.order_status === 'cancelled') return 'noop';
  if (order.razorpay_order_id && keyId && keySecret && isTestKey) {
    try {
      const list = await client().orders.fetchPayments(order.razorpay_order_id);
      const ok = (list.items || []).find((p) => p.status === 'captured' || p.status === 'authorized');
      if (ok && ok.status === 'captured') {
        await orderService.confirmPayment(order.id, order.razorpay_order_id, ok.id);
        return 'paid';
      }
    } catch (e) { console.warn('[razorpay] could not double-check payment status:', e.message); }
  }
  await orderService.cancelOrder(orderId);
  await supabase.from('orders').update({ payment_status: 'failed' }).eq('id', orderId).eq('payment_status', 'cancelled');
  return 'cancelled';
}

async function refundPayment(order) {
  const rz = await client().payments.refund(order.razorpay_payment_id, {
    amount: Math.round(Number(order.total) * 100), notes: { order_number: order.order_number },
  });
  return rz; // rz.status: 'processed' | 'pending'
}

module.exports = {
  createRazorpayOrder, verifyCheckoutSignature, verifyWebhookSignature, cancelUnpaidOrder, refundPayment, publicKeyId, isTestKey,
};
