const supabase = require('../config/supabase');
const settings = require('../config/settings');
const { client, modelName } = require('../config/gemini');
const { listProducts } = require('./productService');
const orderService = require('./orderService');
const { HttpError } = require('../utils/validation');

const STOP = new Set(['the','a','an','is','are','for','and','or','to','of','in','on','me','my','i','you','can','do','does','what','which','best','good','show','find','give','want','need','under','below','within','budget','price','buy','any','with','about','please','tell','compare','vs','between','available','availability','offers','offer','deals','explain','recommend','looking','get','have','stock','current','latest','new']);

function extractBudget(text) {
  const m = text.toLowerCase().replace(/,/g, '').match(/(?:under|below|within|upto|up to|less than|budget(?: of)?)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(k|000)?/);
  if (!m) return null;
  let n = Number(m[1]); if (m[2] === 'k') n *= 1000; return n;
}

function detectCategory(text) {
  const t = text.toLowerCase();
  const map = [['Smartphones', /phone|mobile|smartphone/], ['Laptops', /laptop|notebook/], ['Headphones & Audio', /headphone|earphone|earbud|speaker|audio|headset/], ['TVs & Monitors', /\btv\b|television|monitor|display/], ['Smartwatches', /watch|band/], ['Accessories', /charger|cable|case|accessor|adapter|power ?bank/]];
  const hit = map.find(([, re]) => re.test(t));
  return hit ? hit[0] : null;
}

const slim = (p) => ({ id: p.id, name: p.name, category: p.category, price_inr: p.price, original_price_inr: p.original_price, discount_percent: p.discount_percent, stock_status: p.stock_status, units_in_stock: p.stock_quantity, avg_rating: p.avg_rating, review_count: p.review_count, specifications: p.specifications });

async function chat({ message, history = [], user }) {
  const text = String(message || '').trim();
  if (!text) throw new HttpError(400, 'Please type a question.');
  if (text.length > 500) throw new HttpError(400, 'Please keep your question under 500 characters.');
  if (!client) throw new HttpError(503, 'The AI assistant is not configured yet.');

  const lower = text.toLowerCase();
  const wantsOrder = /\b(order|track|tracking|delivery status|shipment|refund)\b/.test(lower);

  // Private data: only for a signed-in customer, and only THEIR orders.
  let orders = null;
  if (wantsOrder) {
    if (!user) {
      return { answer: 'To check an order I need to verify who you are. Please sign in and ask again - I can then look up your own orders.', products: [] };
    }
    const mine = (await orderService.listOrdersForUser(user.id)).slice(0, 3);
    orders = mine.map((o) => ({ order_number: o.order_number, placed_on: o.created_at, order_status: o.order_status, payment_method: o.payment_method === 'cod' ? 'COD' : 'Razorpay', payment_status: o.payment_status, total_inr: o.total, items: (o.order_items || []).map((i) => `${i.product_name} x${i.quantity}`) }));
  }

  // Product data from the database (trusted)
  const budget = extractBudget(text);
  const category = detectCategory(text);
  const words = lower.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  const wantsOffers = /offer|deal|discount|sale/.test(lower);
  let products = await listProducts({ category: category || undefined, maxPrice: budget || undefined, offers: wantsOffers, sort: wantsOffers ? 'discount' : 'newest' });
  if (!category && words.length) {
    const scored = products.map((p) => ({ p, s: words.filter((w) => `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(w)).length })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    if (scored.length) products = scored.map((x) => x.p);
  }
  products = products.slice(0, 8);

  const data = { products: products.map(slim), orders, store_policies: settings.policies, low_stock_threshold: settings.lowStockThreshold };
  const system = [
    'You are the ElectroMart shopping assistant for an online electronics store in India.',
    'Answer ONLY using the JSON in STORE_DATA. Never invent prices, stock, discounts, ratings, specifications or policies.',
    'If the needed information is not in STORE_DATA, say you cannot verify it and suggest checking the product page or contacting support.',
    'Prices are in Indian rupees (₹). avg_rating null means there are no reviews yet - say so, do not guess.',
    'You cannot place orders, change stock, mark payments, approve refunds or change anything. Politely refuse such requests.',
    'Keep answers short and friendly (under 150 words). Mention product names exactly as given.',
  ].join('\n');

  const contents = [];
  for (const h of (Array.isArray(history) ? history : []).slice(-6)) {
    const t = String(h && h.text || '').slice(0, 500);
    if (t && (h.role === 'user' || h.role === 'model')) contents.push({ role: h.role, parts: [{ text: t }] });
  }
  contents.push({ role: 'user', parts: [{ text: `STORE_DATA:\n${JSON.stringify(data)}\n\nCUSTOMER QUESTION: ${text}` }] });
  while (contents.length && contents[0].role !== 'user') contents.shift();

  const model = client.getGenerativeModel({ model: modelName, systemInstruction: system });
  let timer;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new HttpError(504, 'The assistant took too long to answer. Please try again.')), 20000); });
  let result;
  try {
    result = await Promise.race([model.generateContent({ contents }), timeout]);
  } catch (e) {
    if (e instanceof HttpError) throw e;
    console.error('[gemini]', e.message);
    throw new HttpError(502, 'The assistant is unavailable right now. Please try again in a moment.');
  } finally { clearTimeout(timer); }

  const answer = result.response.text().trim() || 'Sorry, I could not find an answer. Please try rephrasing.';
  const mentioned = products.filter((p) => answer.toLowerCase().includes(p.name.toLowerCase())).slice(0, 4);
  return { answer, products: mentioned.map((p) => ({ id: p.id, name: p.name, price: p.price })) };
}

module.exports = { chat, extractBudget, detectCategory };
