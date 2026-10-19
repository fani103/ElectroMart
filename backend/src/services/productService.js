const supabase = require('../config/supabase');
const settings = require('../config/settings');
const { discountPercent, stockStatus } = require('../utils/validation');

// Average rating + count per product from APPROVED reviews only.
async function getRatingsMap(productIds) {
  let q = supabase.from('reviews').select('product_id, rating').eq('status', 'approved');
  if (productIds && productIds.length) q = q.in('product_id', productIds);
  const { data, error } = await q;
  if (error) throw error;
  const map = {};
  for (const r of data || []) {
    const m = (map[r.product_id] = map[r.product_id] || { sum: 0, count: 0 });
    m.sum += r.rating; m.count += 1;
  }
  const out = {};
  for (const [id, m] of Object.entries(map)) out[id] = { avg_rating: Math.round((m.sum / m.count) * 10) / 10, review_count: m.count };
  return out;
}

function decorate(p, ratings) {
  const r = ratings && ratings[p.id];
  const pct = discountPercent(p.price, p.original_price);
  return {
    id: p.id, name: p.name, description: p.description, category: p.category,
    price: Number(p.price),
    original_price: pct > 0 ? Number(p.original_price) : null,   // only when valid
    discount_percent: pct,
    stock_quantity: p.stock_quantity,
    stock_status: stockStatus(p.stock_quantity, settings.lowStockThreshold),
    image_url: p.image_url, specifications: p.specifications || {},
    is_active: p.is_active, created_at: p.created_at,
    avg_rating: r ? r.avg_rating : null,       // null => hide rating in the UI
    review_count: r ? r.review_count : 0,
  };
}

async function listProducts(opts = {}) {
  let q = supabase.from('products').select('*').eq('is_active', true).limit(500);
  if (opts.category) q = q.eq('category', opts.category);
  if (opts.search) q = q.ilike('name', `%${String(opts.search).replace(/[%_]/g, ' ').slice(0, 80)}%`);
  if (opts.minPrice !== undefined) q = q.gte('price', opts.minPrice);
  if (opts.maxPrice !== undefined) q = q.lte('price', opts.maxPrice);
  if (opts.availability === 'in_stock') q = q.gt('stock_quantity', 0);
  const { data, error } = await q;
  if (error) throw error;
  const ratings = await getRatingsMap((data || []).map((p) => p.id));
  let list = (data || []).map((p) => decorate(p, ratings));
  if (opts.offers) list = list.filter((p) => p.discount_percent > 0);
  switch (opts.sort) {
    case 'price_asc': list.sort((a, b) => a.price - b.price); break;
    case 'price_desc': list.sort((a, b) => b.price - a.price); break;
    case 'rating': list = list.filter((p) => p.avg_rating !== null).sort((a, b) => b.avg_rating - a.avg_rating || b.review_count - a.review_count).concat(list.filter((p) => p.avg_rating === null)); break;
    case 'discount': list.sort((a, b) => b.discount_percent - a.discount_percent); break;
    default: list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  return list;
}

module.exports = { getRatingsMap, decorate, listProducts };
