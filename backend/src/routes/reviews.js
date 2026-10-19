const router = require('express').Router();
const supabase = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { isUuid, HttpError, clean } = require('../utils/validation');

// Finds a delivered purchase of this product by this user that has no review yet.
async function findEligibleItem(userId, productId) {
  const { data: items, error } = await supabase.from('order_items')
    .select('id, orders!inner(user_id, order_status)').eq('product_id', productId)
    .eq('orders.user_id', userId).eq('orders.order_status', 'delivered');
  if (error) throw error;
  if (!items || !items.length) return null;
  const { data: done } = await supabase.from('reviews').select('order_item_id').in('order_item_id', items.map((i) => i.id));
  const used = new Set((done || []).map((r) => r.order_item_id));
  const free = items.find((i) => !used.has(i.id));
  return free ? free.id : null;
}

router.get('/eligibility/:productId', requireAuth, async (req, res, next) => {
  try {
    if (!isUuid(req.params.productId)) throw new HttpError(404, 'Product not found.');
    res.json({ eligible: !!(await findEligibleItem(req.user.id, req.params.productId)) });
  } catch (e) { next(e); }
});

// POST /api/reviews { productId, rating, comment }
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { productId } = req.body;
    const rating = Number(req.body.rating);
    if (!isUuid(productId)) throw new HttpError(400, 'Invalid product.');
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Rating must be between 1 and 5.');
    const comment = clean(req.body.comment || '', 1000);
    const itemId = await findEligibleItem(req.user.id, productId);
    if (!itemId) throw new HttpError(403, 'Only customers with a delivered, not-yet-reviewed purchase can review this product.');
    const { data, error } = await supabase.from('reviews').insert({ product_id: productId, user_id: req.user.id, order_item_id: itemId, rating, comment: comment || null }).select().single();
    if (error) {
      if (error.code === '23505') throw new HttpError(409, 'You have already reviewed this purchase.');
      throw error;
    }
    res.status(201).json({ review: data });
  } catch (e) { next(e); }
});

module.exports = router;
