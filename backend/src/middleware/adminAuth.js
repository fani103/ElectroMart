const supabase = require('../config/supabase');
const { requireAuth } = require('./auth');

// Admin check happens on EVERY admin request, against the database (never trusts the browser).
async function checkAdmin(req, res, next) {
  try {
    const { data, error } = await supabase.from('profiles').select('role').eq('id', req.user.id).single();
    if (error || !data || data.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
    next();
  } catch (e) { next(e); }
}

module.exports = [requireAuth, checkAdmin];
