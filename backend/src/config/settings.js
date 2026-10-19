// Central place for store rules read from environment variables.
const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

module.exports = {
  categories: [
    'Smartphones',
    'Laptops',
    'Headphones & Audio',
    'TVs & Monitors',
    'Smartwatches',
    'Accessories',
  ],
  lowStockThreshold: num(process.env.LOW_STOCK_THRESHOLD, 5),
  codEnabled: String(process.env.COD_ENABLED ?? 'true').toLowerCase() === 'true',
  shippingFlat: num(process.env.SHIPPING_FLAT, 99),
  freeShippingAbove: num(process.env.FREE_SHIPPING_ABOVE, 5000),
  taxRatePercent: num(process.env.TAX_RATE_PERCENT, 0),
  maxQtyPerItem: num(process.env.MAX_QTY_PER_ITEM, 10),
  supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com',
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5500').replace(/\/$/, ''),
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'product-images',
  // Store policies. The AI assistant may ONLY quote these. Edit to match your store.
  policies: {
    shipping: 'A flat shipping charge applies to each order; shipping is free when the order subtotal is above the free-shipping threshold shown at checkout.',
    returns: 'Returns and replacements are handled through support. Email the support address in the footer with your order number.',
    payment: 'We accept Razorpay (cards, UPI, netbanking via Razorpay Checkout) and Cash on Delivery where enabled. This demo uses Razorpay TEST mode, so no real money is charged.',
    cancellation: 'Orders can be cancelled from the My Orders page before they are shipped.',
  },
};
