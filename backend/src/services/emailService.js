const supabase = require('../config/supabase');
const settings = require('../config/settings');
const { resend, from } = require('../config/email');
const orderService = require('./orderService');
const { generateOrderPdf, paymentLabel } = require('./pdfService');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SUBJECTS = {
  order_confirmation: (o) => `ElectroMart Order Confirmation — ${o.order_number}`,
  shipped: (o) => `Your ElectroMart order ${o.order_number} has been shipped`,
  delivered: (o) => `Your ElectroMart order ${o.order_number} was delivered`,
  cancelled: (o) => `Your ElectroMart order ${o.order_number} was cancelled`,
  refund_confirmed: (o) => `Refund confirmed for order ${o.order_number}`,
};
const INTRO = {
  order_confirmation: 'Thank you for shopping with ElectroMart! Your order has been received. A PDF copy is attached.',
  shipped: 'Good news - your order is on its way.',
  delivered: 'Your order has been delivered. We hope you enjoy it! You can now review your products from My Orders.',
  cancelled: 'Your order has been cancelled. If you paid online, the refund will be processed separately and you will get another email once it is confirmed.',
  refund_confirmed: 'Your refund has been confirmed by the payment provider. It may take a few business days to appear in your account.',
};

function buildHtml(type, o) {
  const pay = paymentLabel(o);        // from the SAVED order: exactly one method is ever shown
  const a = o.shipping_address || {};
  const rows = (o.order_items || []).map((i) =>
    `<tr><td style="padding:6px 0">${esc(i.product_name)} × ${i.quantity}</td><td style="text-align:right">${money(i.line_total)}</td></tr>`).join('');
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111">
  <div style="background:#0B1F4B;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0"><h2 style="margin:0">ElectroMart</h2></div>
  <div style="border:1px solid #e2e8f0;border-top:0;padding:22px;border-radius:0 0 10px 10px">
    <p>${INTRO[type]}</p>
    <p><b>Order number:</b> ${esc(o.order_number)}<br><b>Payment method:</b> ${pay.method}<br><b>Payment status:</b> ${esc(pay.status)}<br><b>Order status:</b> ${esc(o.order_status)}</p>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #e2e8f0">${rows}
      <tr><td style="padding-top:8px;border-top:1px solid #e2e8f0">Shipping</td><td style="text-align:right;border-top:1px solid #e2e8f0">${Number(o.shipping_charge) > 0 ? money(o.shipping_charge) : 'Free'}</td></tr>
      <tr><td><b>Total</b></td><td style="text-align:right"><b>${money(o.total)}</b></td></tr></table>
    ${o.payment_method === 'cod' && o.payment_status === 'cod_due' ? `<p style="background:#FFF7E6;padding:10px;border-radius:6px">Cash on Delivery: please pay ${money(o.total)} at delivery.</p>` : ''}
    <p><b>Delivery to:</b><br>${esc(a.full_name)}<br>${esc(a.line1)} ${esc(a.line2)}<br>${esc(a.city)}, ${esc(a.state)} - ${esc(a.pincode)}<br>Phone: ${esc(a.phone)}</p>
    <p><a href="${settings.frontendUrl}/orders.html" style="background:#2563EB;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Track your order</a></p>
    <p style="color:#64748B;font-size:12px">Need help? ${esc(settings.supportEmail)}</p>
  </div></div>`;
}

// Sends one email per (order, type). Safe to call many times: only the first caller "claims" the row.
async function sendNotification(orderId, type) {
  await supabase.from('notifications').upsert({ order_id: orderId, type }, { onConflict: 'order_id,type', ignoreDuplicates: true });

  const { data: claimed, error: claimErr } = await supabase.from('notifications')
    .update({ status: 'sending', updated_at: new Date().toISOString() })
    .eq('order_id', orderId).eq('type', type).in('status', ['pending', 'failed'])
    .select('id, attempts').maybeSingle();
  if (claimErr) throw claimErr;
  if (!claimed) return { skipped: true };            // already sent or being sent

  const finish = (fields) => supabase.from('notifications').update({ ...fields, attempts: claimed.attempts + 1, updated_at: new Date().toISOString() }).eq('id', claimed.id);
  try {
    if (!resend) throw new Error('Email provider is not configured (RESEND_API_KEY missing).');
    const order = await orderService.getOrder(orderId);
    const { data: customer } = await supabase.from('profiles').select('email, full_name').eq('id', order.user_id).maybeSingle();
    if (!customer || !customer.email) throw new Error('Customer email not found.');

    const payload = { from, to: [customer.email], subject: SUBJECTS[type](order), html: buildHtml(type, order) };
    if (type === 'order_confirmation') {
      const pdf = await generateOrderPdf(order, customer);
      payload.attachments = [{ filename: `${order.order_number}.pdf`, content: pdf }];
    }
    const { error } = await resend.emails.send(payload);
    if (error) throw new Error(error.message || 'Email provider rejected the message.');
    await finish({ status: 'sent', sent_at: new Date().toISOString(), last_error: null });
    return { sent: true };
  } catch (e) {
    await finish({ status: 'failed', last_error: String(e.message || e).slice(0, 500) });   // order stays saved
    return { failed: true, error: e.message };
  }
}

// Fire-and-forget wrapper used by routes (never throws, never blocks the response).
function notifyLater(orderId, type) {
  sendNotification(orderId, type).catch((e) => console.error(`[email] ${type} for ${orderId}:`, e.message));
}

// Retries failed/pending emails (and ones stuck in "sending" for >10 minutes).
async function retryFailed() {
  const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await supabase.from('notifications').update({ status: 'failed' }).eq('status', 'sending').lt('updated_at', stale);
  const { data, error } = await supabase.from('notifications').select('order_id, type').in('status', ['failed', 'pending']).lt('attempts', 5).limit(20);
  if (error) throw error;
  const results = [];
  for (const n of data || []) results.push({ ...n, ...(await sendNotification(n.order_id, n.type)) });
  return results;
}

module.exports = { sendNotification, notifyLater, retryFailed };
