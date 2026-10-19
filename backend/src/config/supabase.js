const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.warn('[config] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing - database calls will fail.');
}

// Service-role client: bypasses RLS, so it must ONLY be used in backend code.
module.exports = createClient(url || 'http://localhost:54321', key || 'missing-key', {
  auth: { persistSession: false, autoRefreshToken: false },
});
