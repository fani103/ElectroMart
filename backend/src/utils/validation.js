// Pure validation helpers (no database access) - easy to unit test and explain.
const settings = require('../config/settings');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const clean = (v, max = 200) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

// Merge duplicate products and check quantity limits. Returns [{product_id, quantity}]
function validateCartItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Your cart is empty.');
  if (items.length > 30) throw new HttpError(400, 'Too many different items in one order.');
  const merged = new Map();
  for (const it of items) {
    const id = it && (it.product_id || it.productId);
    const qty = Number(it && it.quantity);
    if (!isUuid(id)) throw new HttpError(400, 'Invalid product in cart.');
    if (!Number.isInteger(qty) || qty < 1) throw new HttpError(400, 'Invalid quantity.');
    merged.set(id, (merged.get(id) || 0) + qty);
  }
  const out = [];
  for (const [product_id, quantity] of merged) {
    if (quantity > settings.maxQtyPerItem) throw new HttpError(400, `You can buy at most ${settings.maxQtyPerItem} units of one product.`);
    out.push({ product_id, quantity });
  }
  return out;
}

function validateAddress(a) {
  if (!a || typeof a !== 'object') throw new HttpError(400, 'Delivery address is required.');
  const addr = {
    full_name: clean(a.full_name, 100),
    phone: clean(a.phone, 15).replace(/[^\d+]/g, ''),
    line1: clean(a.line1, 200),
    line2: clean(a.line2, 200),
    city: clean(a.city, 80),
    state: clean(a.state, 80),
    pincode: clean(a.pincode, 10),
  };
  if (addr.full_name.length < 2) throw new HttpError(400, 'Please enter the recipient name.');
  if (!/^(\+91)?[6-9]\d{9}$/.test(addr.phone)) throw new HttpError(400, 'Enter a valid 10-digit Indian mobile number.');
  if (addr.line1.length < 5) throw new HttpError(400, 'Please enter the address line.');
  if (addr.city.length < 2 || addr.state.length < 2) throw new HttpError(400, 'City and state are required.');
  if (!/^\d{6}$/.test(addr.pincode)) throw new HttpError(400, 'Enter a valid 6-digit PIN code.');
  return addr;
}

// discount % = floor((original - selling) / original * 100); only when original > selling
function discountPercent(price, originalPrice) {
  const p = Number(price), o = Number(originalPrice);
  if (!o || !(o > p)) return 0;
  return Math.floor(((o - p) / o) * 100);
}

function stockStatus(stock, threshold = settings.lowStockThreshold) {
  const s = Number(stock);
  if (s <= 0) return 'out_of_stock';
  if (s <= threshold) return 'low_stock';
  return 'in_stock';
}

function validateProductInput(b, { partial = false } = {}) {
  const out = {};
  const need = (k) => !partial || b[k] !== undefined;
  if (need('name')) {
    out.name = clean(b.name, 200);
    if (out.name.length < 2) throw new HttpError(400, 'Product name is required (min 2 characters).');
  }
  if (b.description !== undefined || !partial) out.description = clean(String(b.description ?? ''), 4000);
  if (need('category')) {
    if (!settings.categories.includes(b.category)) throw new HttpError(400, 'Choose a valid category.');
    out.category = b.category;
  }
  if (need('price')) {
    const p = Number(b.price);
    if (!(p > 0) || p > 10000000) throw new HttpError(400, 'Selling price must be greater than 0.');
    out.price = Math.round(p * 100) / 100;
  }
  if (b.original_price !== undefined) {
    if (b.original_price === null || b.original_price === '') out.original_price = null;
    else {
      const o = Number(b.original_price);
      if (!(o > 0)) throw new HttpError(400, 'Original price must be greater than 0.');
      out.original_price = Math.round(o * 100) / 100;
    }
  }
  if (need('stock_quantity')) {
    const s = Number(b.stock_quantity);
    if (!Number.isInteger(s) || s < 0) throw new HttpError(400, 'Stock must be a whole number (0 or more).');
    out.stock_quantity = s;
  }
  if (b.image_url !== undefined) out.image_url = b.image_url ? clean(b.image_url, 600) : null;
  if (b.specifications !== undefined) {
    let spec = b.specifications;
    if (typeof spec === 'string') { try { spec = JSON.parse(spec || '{}'); } catch { throw new HttpError(400, 'Specifications must be valid JSON.'); } }
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new HttpError(400, 'Specifications must be an object.');
    const safe = {};
    for (const [k, v] of Object.entries(spec).slice(0, 30)) safe[clean(k, 60)] = clean(String(v), 200);
    out.specifications = safe;
  }
  if (b.is_active !== undefined) out.is_active = Boolean(b.is_active);
  return out;
}

module.exports = { isUuid, HttpError, clean, validateCartItems, validateAddress, discountPercent, stockStatus, validateProductInput };
