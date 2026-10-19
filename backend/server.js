require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const supabase = require('./src/config/supabase');
const settings = require('./src/config/settings');
const pay = require('./src/services/paymentService');
const { retryFailed } = require('./src/services/emailService');

const app = express();
app.set('trust proxy', 1); // Render sits behind a proxy

// ---- CORS: only the configured frontend origins ----
const allowed = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:5500').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
app.use(cors({
  origin(origin, cb) { if (!origin || allowed.includes(origin)) return cb(null, true); return cb(new Error('Not allowed by CORS')); },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use((req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' }); next(); });

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please slow down.' } }));
const sensitive = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please try again later.' } });

// Webhook needs the RAW body for signature checking, so it is mounted BEFORE express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json', limit: '200kb' }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', async (req, res) => {
  const { error } = await supabase.from('products').select('id', { head: true, count: 'exact' }).limit(1);
  res.status(error ? 503 : 200).json({
    status: error ? 'degraded' : 'ok', database: error ? 'unreachable' : 'ok',
    razorpay: pay.isTestKey ? 'test-mode' : 'not configured', gemini: process.env.GEMINI_API_KEY ? 'configured' : 'not configured',
    email: process.env.RESEND_API_KEY ? 'configured' : 'not configured', time: new Date().toISOString(),
  });
});

// Public, non-secret settings the frontend needs
app.get('/api/config', (req, res) => res.json({
  codEnabled: settings.codEnabled, lowStockThreshold: settings.lowStockThreshold, shippingFlat: settings.shippingFlat,
  freeShippingAbove: settings.freeShippingAbove, taxRatePercent: settings.taxRatePercent, maxQtyPerItem: settings.maxQtyPerItem,
  razorpayKeyId: pay.publicKeyId(), supportEmail: settings.supportEmail, categories: settings.categories,
}));

app.use('/api/products', require('./src/routes/products'));
app.use('/api/ai', require('./src/routes/ai'));
app.use('/api/orders', require('./src/routes/orders'));
app.use('/api/payments', sensitive, require('./src/routes/payments'));
app.use('/api/reviews', sensitive, require('./src/routes/reviews'));
app.use('/api/admin', require('./src/routes/admin'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

// ---- Central error handler: safe messages, correct status codes ----
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') return res.status(403).json({ error: 'Origin not allowed.' });
  if (err.name === 'MulterError') return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller.' : 'Upload failed.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: status >= 500 && !err.status ? 'Something went wrong on our side. Please try again.' : err.message });
});

// ---- Background jobs (simple timers) ----
async function cancelStalePayments() {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data } = await supabase.from('orders').select('id').eq('payment_method', 'razorpay').eq('payment_status', 'pending').eq('order_status', 'pending').lt('created_at', cutoff).limit(20);
  for (const o of data || []) await pay.cancelUnpaidOrder(o.id).catch((e) => console.warn('[jobs] stale cancel failed:', e.message));
}

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`ElectroMart API running on port ${PORT}`));
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    setInterval(() => cancelStalePayments().catch(() => {}), 10 * 60 * 1000).unref();
    setInterval(() => retryFailed().catch(() => {}), 15 * 60 * 1000).unref();
  }
}
module.exports = app;
