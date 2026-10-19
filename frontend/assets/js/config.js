// PUBLIC configuration only. Never put secret keys here.
// - SUPABASE_ANON_KEY is the public "anon / publishable" key (safe in the browser, protected by RLS).
// - The service-role key, Razorpay secret, Gemini key and email key live ONLY in the backend .env.
window.ELECTROMART_CONFIG = {
  API_BASE_URL: 'http://localhost:5000',               // Render backend URL in production, e.g. https://electromart-api.onrender.com
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',
};
