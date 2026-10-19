const supabase = require('../config/supabase');
const settings = require('../config/settings');
const { HttpError } = require('../utils/validation');

// Allowed order-status transitions (admin). Cancel has its own function (it restocks).
const TRANSITIONS = {
  pending: [],                                 // Razorpay order waiting for payment: moves on only when payment is verified
  confirmed: ['processing'],
  processing: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

// Turns database errors raised by our SQL functions into friendly HTTP errors.
function mapDbError(e) {
  const m = (e && e.message) || '';
  if (m.startsWith('INSUFFICIENT_STOCK')) return new HttpError(409, `Sorry, "${m.split(':')[1]}" does not have enough stock.`);
  if (m.startsWith('PRODUCT_UNAVAILABLE')) return new HttpError(409, 'One of the products is no longer available.');
  if (m.startsWith('CANNOT_CANCEL')) return new HttpError(409, 'This order has already been shipped and cannot be cancelled.');
  if (m.startsWith('ORDER_NOT_FOUND')) return new HttpError(404, 'Order not found.');
  if (m.startsWith('ORDER_CANCELLED')) return new HttpError(409, 'This order was cancelled.');
  return e;
}

async function createOrder(userId, items, address, method) {
  const { data, error } = await supabase.rpc('create_order_atomic', {
    p_user: userId, p_items: items, p_address: address, p_method: method,
    p_shipping_flat: settings.shippingFlat, p_free_above: settings.freeShippingAbove, p_tax_rate: settings.taxRatePercent,
  });
  if (error) throw mapDbError(error);
  return data; // order id (uuid)
}

async function cancelOrder(orderId) {
  const { error } = await supabase.rpc('cancel_order_atomic', { p_order: orderId });
  if (error) throw mapDbError(error);
}

async function confirmPayment(orderId, rzpOrderId, rzpPaymentId) {
  const { data, error } = await supabase.rpc('confirm_payment_atomic', {
    p_order: orderId, p_rzp_order: rzpOrderId, p_rzp_payment: rzpPaymentId,
  });
  if (error) throw mapDbError(error);
  return data === true; // true only the first time
}

async function getOrder(orderId) {
  const { data, error } = await supabase.from('orders').select('*, order_items(*)').eq('id', orderId).maybeSingle();
  if (error) throw error;
  return data;
}

// Customer view: own order only
async function getOrderForUser(orderId, userId, isAdmin = false) {
  const o = await getOrder(orderId);
  if (!o || (!isAdmin && o.user_id !== userId)) throw new HttpError(404, 'Order not found.');
  return o;
}

async function listOrdersForUser(userId) {
  const { data, error } = await supabase.from('orders').select('*, order_items(*)').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function isAdminUser(userId) {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  return !!data && data.role === 'admin';
}

async function updateStatus(orderId, next) {
  const o = await getOrder(orderId);
  if (!o) throw new HttpError(404, 'Order not found.');
  if (!(TRANSITIONS[o.order_status] || []).includes(next)) {
    throw new HttpError(409, `Cannot move an order from "${o.order_status}" to "${next}".`);
  }
  if (o.payment_method === 'razorpay' && o.payment_status !== 'paid') {
    throw new HttpError(409, 'A Razorpay order can only be fulfilled after its payment is verified.');
  }
  const { error } = await supabase.from('orders').update({ order_status: next, updated_at: new Date().toISOString() })
    .eq('id', orderId).eq('order_status', o.order_status);   // guard against concurrent edits
  if (error) throw error;
  return getOrder(orderId);
}

async function recordCodCollection(orderId) {
  const o = await getOrder(orderId);
  if (!o) throw new HttpError(404, 'Order not found.');
  if (o.payment_method !== 'cod') throw new HttpError(400, 'Only COD orders can be marked as collected.');
  if (o.order_status === 'cancelled') throw new HttpError(409, 'This order is cancelled.');
  if (o.payment_status !== 'cod_due') throw new HttpError(409, 'COD payment is not due for this order.');
  const { error } = await supabase.from('orders').update({
    payment_status: 'paid', cod_collected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', orderId).eq('payment_status', 'cod_due');
  if (error) throw error;
  return getOrder(orderId);
}

module.exports = {
  createOrder, cancelOrder, confirmPayment, getOrder, getOrderForUser, listOrdersForUser,
  isAdminUser, updateStatus, recordCodCollection, TRANSITIONS,
};
