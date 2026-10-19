const router = require('express').Router();
const supabase = require('../config/supabase');
const settings = require('../config/settings');
const { listProducts, getRatingsMap, decorate } = require('../services/productService');
const { isUuid, HttpError, validateCartItems } = require('../utils/validation');

// GET /api/products?search=&category=&minPrice=&maxPrice=&availability=in_stock&sort=&offers=true&limit=&page=
router.get('/', async (req, res, next) => {
  try {
    const q = req.query;
    const num = (v) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : undefined);
    let list = await listProducts({
      search: q.search, category: settings.categories.includes(q.category) ? q.category : undefined,
      minPrice: num(q.minPrice), maxPrice: num(q.maxPrice), availability: q.availability,
      sort: q.sort, offers: q.offers === 'true',
    });
    const total = list.length;
    const limit = Math.min(Math.max(parseInt(q.limit, 10) || 24, 1), 100);
    const page = Math.max(parseInt(q.page, 10) || 1, 1);
    list = list.slice((page - 1) * limit, page * limit);
    res.json({ products: list, total, page, limit });
  } catch (e) { next(e); }
});

router.get('/categories', (req, res) => res.json({ categories: settings.categories }));

// POST /api/products/validate-cart  { items:[{product_id, quantity}] } -> trusted prices & stock for the cart page
router.post('/validate-cart', async (req, res, next) => {
  try {
    const items = validateCartItems(req.body.items);
    const { data, error } = await supabase.from('products').select('*').in('id', items.map((i) => i.product_id));
    if (error) throw error;
    const ratings = await getRatingsMap([]);
    const byId = new Map((data || []).map((p) => [p.id, decorate(p, ratings)]));
    res.json({
      items: items.map((i) => {
        const p = byId.get(i.product_id);
        if (!p || !p.is_active) return { product_id: i.product_id, available: false };
        return { product_id: i.product_id, available: p.stock_quantity > 0, product: p, requested: i.quantity, max_quantity: Math.min(p.stock_quantity, settings.maxQtyPerItem) };
      }),
    });
  } catch (e) { next(e); }
});

// GET /api/products/reviews/latest - newest approved (genuine) reviews for the homepage
router.get('/reviews/latest', async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('reviews').select('rating, comment, created_at, user_id, products(name)').eq('status', 'approved').order('created_at', { ascending: false }).limit(3);
    if (error) throw error;
    const ids = [...new Set((data || []).map((r) => r.user_id))];
    const { data: profs } = ids.length ? await supabase.from('profiles').select('id, full_name').in('id', ids) : { data: [] };
    const names = new Map((profs || []).map((p) => [p.id, (p.full_name || 'Customer').split(' ')[0]]));
    res.json({ reviews: (data || []).map((r) => ({ rating: r.rating, comment: r.comment, product: r.products && r.products.name, author: names.get(r.user_id) || 'Customer' })) });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) throw new HttpError(404, 'Product not found.');
    const { data, error } = await supabase.from('products').select('*').eq('id', req.params.id).eq('is_active', true).maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Product not found.');
    const ratings = await getRatingsMap([data.id]);
    const related = (await listProducts({ category: data.category })).filter((p) => p.id !== data.id).slice(0, 4);
    const { data: revs } = await supabase.from('reviews').select('id, rating, comment, created_at, user_id').eq('product_id', data.id).eq('status', 'approved').order('created_at', { ascending: false }).limit(50);
    const ids = [...new Set((revs || []).map((r) => r.user_id))];
    const { data: profs } = ids.length ? await supabase.from('profiles').select('id, full_name').in('id', ids) : { data: [] };
    const names = new Map((profs || []).map((p) => [p.id, (p.full_name || 'Customer').split(' ')[0]]));
    res.json({
      product: decorate(data, ratings), related,
      reviews: (revs || []).map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, created_at: r.created_at, author: names.get(r.user_id) || 'Customer' })),
    });
  } catch (e) { next(e); }
});

module.exports = router;
