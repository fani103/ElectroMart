const PDFDocument = require('pdfkit');
const settings = require('../config/settings');

// NOTE: PDFKit's built-in Helvetica has no rupee glyph, so amounts are printed as "Rs."
const money = (n) => `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

function paymentLabel(o) {
  const method = o.payment_method === 'cod' ? 'COD' : 'Razorpay';
  const status = { paid: 'Paid', cod_due: 'Payment due on delivery', pending: 'Pending', failed: 'Failed', cancelled: 'Cancelled', refund_pending: 'Refund pending', refunded: 'Refunded' }[o.payment_status] || o.payment_status;
  return { method, status };
}

// Builds the order confirmation PDF from TRUSTED saved order data. Returns a Buffer.
function generateOrderPdf(order, customer) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true, info: { Title: `Order ${order.order_number}`, Author: 'ElectroMart' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const L = 50, R = 545, W = R - L;
    const navy = '#0B1F4B', blue = '#2563EB', grey = '#64748B';

    // Header band
    doc.rect(0, 0, 595, 90).fill(navy);
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(24).text('ElectroMart', L, 30);
    doc.font('Helvetica').fontSize(10).text('Order Confirmation', L, 60);
    doc.font('Helvetica-Bold').fontSize(11).text(`Order ${order.order_number}`, 300, 34, { width: R - 300, align: 'right' });
    doc.font('Helvetica').fontSize(9).text(fmtDate(order.created_at), 300, 52, { width: R - 300, align: 'right' });

    doc.fillColor('#000');
    let y = 115;
    const a = order.shipping_address || {};
    const pay = paymentLabel(order);

    doc.fillColor(blue).font('Helvetica-Bold').fontSize(10).text('CUSTOMER & DELIVERY', L, y).text('PAYMENT', 330, y);
    y += 16;
    doc.fillColor('#111').font('Helvetica').fontSize(10);
    const addr = [a.full_name, a.line1, a.line2, `${a.city || ''}, ${a.state || ''} - ${a.pincode || ''}`, `Phone: ${a.phone || ''}`, customer && customer.email ? `Email: ${customer.email}` : null].filter(Boolean).join('\n');
    doc.text(addr, L, y, { width: 260 });
    let pay2 = `Method: ${pay.method}\nStatus: ${pay.status}\nOrder status: ${order.order_status}`;
    if (order.payment_method === 'razorpay' && order.razorpay_payment_id) pay2 += `\nRazorpay ref: ${order.razorpay_payment_id}`;
    doc.text(pay2, 330, y, { width: R - 330 });
    y = Math.max(doc.y, y + 80) + 14;

    if (order.payment_method === 'cod' && order.payment_status === 'cod_due') {
      doc.roundedRect(L, y, W, 26, 4).fill('#FFF7E6');
      doc.fillColor('#92400E').font('Helvetica-Bold').fontSize(10).text(`Cash on Delivery: please pay ${money(order.total)} when the order is delivered.`, L + 10, y + 8, { width: W - 20 });
      y += 40;
    }

    // Items table
    const col = { name: L, qty: 300, unit: 360, total: 450 };
    const header = () => {
      doc.rect(L, y, W, 22).fill('#EEF2FF');
      doc.fillColor(navy).font('Helvetica-Bold').fontSize(9)
        .text('Item', col.name + 6, y + 7).text('Qty', col.qty, y + 7, { width: 40, align: 'right' })
        .text('Unit price', col.unit, y + 7, { width: 80, align: 'right' }).text('Line total', col.total, y + 7, { width: R - col.total - 6, align: 'right' });
      y += 28;
    };
    header();
    doc.font('Helvetica').fontSize(10).fillColor('#111');
    for (const it of order.order_items || []) {
      if (y > 740) { doc.addPage(); y = 50; header(); doc.font('Helvetica').fontSize(10).fillColor('#111'); }
      const h = doc.heightOfString(it.product_name, { width: 230 });
      doc.text(it.product_name, col.name + 6, y, { width: 230 });
      doc.text(String(it.quantity), col.qty, y, { width: 40, align: 'right' });
      doc.text(money(it.unit_price), col.unit, y, { width: 80, align: 'right' });
      doc.text(money(it.line_total), col.total, y, { width: R - col.total - 6, align: 'right' });
      y += Math.max(h, 14) + 8;
      doc.moveTo(L, y - 4).lineTo(R, y - 4).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
    }

    // Totals
    if (y > 650) { doc.addPage(); y = 50; }
    y += 8;
    const row = (label, val, bold) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10).fillColor(bold ? navy : '#111')
        .text(label, 330, y, { width: 100 }).text(val, 430, y, { width: R - 430, align: 'right' });
      y += bold ? 22 : 17;
    };
    row('Subtotal', money(order.subtotal));
    if (Number(order.discount) > 0) row('Discount', `- ${money(order.discount)}`);
    row('Shipping', Number(order.shipping_charge) > 0 ? money(order.shipping_charge) : 'Free');
    if (Number(order.tax) > 0) row('Tax', money(order.tax));
    doc.moveTo(330, y).lineTo(R, y).strokeColor(navy).lineWidth(1).stroke(); y += 6;
    row('Total', money(order.total), true);

    y += 20;
    if (y > 700) { doc.addPage(); y = 50; }
    doc.font('Helvetica-Bold').fontSize(10).fillColor(blue).text('SUPPORT & POLICIES', L, y); y += 14;
    doc.font('Helvetica').fontSize(9).fillColor(grey).text(
      `Support: ${settings.supportEmail}\nCancellation: ${settings.policies.cancellation}\nReturns: ${settings.policies.returns}\n` +
      'This document is an order confirmation, not a tax invoice. This demo store runs in payment TEST mode.', L, y, { width: W });

    // Page numbers
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;   // lets the footer sit near the page edge without creating a blank extra page
      doc.font('Helvetica').fontSize(8).fillColor(grey).text(`ElectroMart  |  ${order.order_number}  |  Page ${i + 1} of ${range.count}`, L, 805, { width: W, align: 'center', lineBreak: false });
    }
    doc.end();
  });
}

module.exports = { generateOrderPdf, paymentLabel };
