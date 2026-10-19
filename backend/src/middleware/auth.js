const supabase = require('../config/supabase');

// Reads "Authorization: Bearer <supabase access token>" and asks Supabase who the user is.
async function getUserFromReq(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return data.user;
}

async function requireAuth(req, res, next) {
  try {
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Please sign in to continue.' });
    req.user = user;
    next();
  } catch (e) { next(e); }
}

async function optionalAuth(req, res, next) {
  try { req.user = await getUserFromReq(req); next(); } catch (e) { next(e); }
}

module.exports = { requireAuth, optionalAuth };
