/* Supabase Auth: signup, signin, Google OAuth, password reset, session + safe redirects. */
const Auth = {
  async session() { const { data } = await sb.auth.getSession(); return data.session; },
  // Only same-site relative .html paths are allowed as redirect targets (prevents open-redirect attacks)
  safeRedirect(r) { return typeof r === 'string' && /^[a-z0-9-]+\.html(\?[\w=&%.\-]*)?$/i.test(r) ? r : null; },
  redirectParam() { return this.safeRedirect(new URLSearchParams(location.search).get('redirect')); },
  pageUrl(name) { return new URL(name, location.href).href; },
  // Send a signed-out visitor to sign-in, then back to where they were going
  async requireLogin() {
    const s = await this.session();
    if (s) return s;
    const here = location.pathname.split('/').pop() + location.search;
    location.replace('signin.html?redirect=' + encodeURIComponent(here));
    return null;
  },
  async logout() { await sb.auth.signOut(); localStorage.removeItem('em_cart'); Cart.uid = null; Cart.updateBadge(); location.href = 'index.html'; },
};

function renderAccount(session) {
  const area = document.getElementById('account-area'); if (!area) return;
  if (!session) { area.innerHTML = `<a class="btn btn-primary btn-sm" href="signin.html?redirect=${encodeURIComponent(location.pathname.split('/').pop() + location.search)}"><i data-lucide="user"></i> Sign in</a>`; }
  else {
    const name = (session.user.user_metadata && (session.user.user_metadata.full_name || session.user.user_metadata.name)) || session.user.email.split('@')[0];
    area.innerHTML = `<div class="account" id="account"><button class="icon-btn" id="account-btn" aria-haspopup="true"><i data-lucide="user"></i> ${esc(name.split(' ')[0])}</button>
      <div class="account-menu"><a href="orders.html">My Orders</a><a href="ai.html">AI Assistant</a><button id="logout-btn">Sign out</button></div></div>`;
    document.getElementById('account-btn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('account').classList.toggle('open'); });
    document.addEventListener('click', () => document.getElementById('account')?.classList.remove('open'));
    document.getElementById('logout-btn').addEventListener('click', () => Auth.logout());
  }
  icons();
}

sb.auth.onAuthStateChange((event, session) => {
  if (typeof Cart !== 'undefined') { if (session) Cart.mergeUser(session.user.id); else Cart.uid = null; }
  renderAccount(session);
});
document.addEventListener('DOMContentLoaded', async () => { renderAccount(await Auth.session()); initAuthPage(); });

/* ---------- auth pages ---------- */
function fieldError(input, msg) { const f = input.closest('.field'); f.classList.toggle('invalid', !!msg); const e = f.querySelector('.err'); if (e) e.textContent = msg || ''; return !msg; }
function showAlert(box, msg, type = 'error') { box.className = 'alert alert-' + type; box.textContent = msg; box.style.display = 'block'; }
const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
function friendlyAuthError(e) {
  const m = (e && e.message) || '';
  if (/invalid login/i.test(m)) return 'Incorrect email or password.';
  if (/already registered|already been registered/i.test(m)) return 'An account with this email already exists. Try signing in.';
  if (/email not confirmed/i.test(m)) return 'Please confirm your email first - check your inbox.';
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Please wait a few minutes and try again.';
  if (/password/i.test(m) && /least|weak|short/i.test(m)) return 'Password is too weak. Use at least 8 characters.';
  return m || 'Something went wrong. Please try again.';
}
async function googleLogin(btn) {
  btn.disabled = true;
  const redirect = Auth.redirectParam();
  const to = Auth.pageUrl('signin.html') + (redirect ? '?redirect=' + encodeURIComponent(redirect) : '');
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: to } });
  if (error) { btn.disabled = false; toast(friendlyAuthError(error), 'error'); }
}

async function initAuthPage() {
  const page = document.body.dataset.page;
  if (!['signin', 'signup', 'forgot'].includes(page)) return;
  const box = document.getElementById('auth-alert');
  const g = document.getElementById('google-btn'); if (g) g.addEventListener('click', () => googleLogin(g));
  const target = Auth.redirectParam() || 'index.html';
  const keepRedirect = Auth.redirectParam() ? '?redirect=' + encodeURIComponent(Auth.redirectParam()) : '';
  document.querySelectorAll('[data-keep-redirect]').forEach((a) => { a.href = a.getAttribute('href').split('?')[0] + keepRedirect; });

  if (page === 'signin') {
    if (await Auth.session()) return location.replace(target);          // already signed in (or returned from Google)
    document.getElementById('signin-form').addEventListener('submit', async (e) => {
      e.preventDefault(); box.style.display = 'none';
      const em = e.target.elements.email, pw = e.target.elements.password;
      const ok = fieldError(em, emailOk(em.value.trim()) ? '' : 'Enter a valid email.') & fieldError(pw, pw.value ? '' : 'Enter your password.');
      if (!ok) return;
      const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Signing in…';
      const { error } = await sb.auth.signInWithPassword({ email: em.value.trim(), password: pw.value });
      if (error) { showAlert(box, friendlyAuthError(error)); btn.disabled = false; btn.textContent = 'Sign in'; return; }
      location.replace(target);
    });
  }

  if (page === 'signup') {
    document.getElementById('signup-form').addEventListener('submit', async (e) => {
      e.preventDefault(); box.style.display = 'none';
      const f = e.target; const name = f.elements.full_name.value.trim();
      const ok = fieldError(f.elements.full_name, name.length >= 2 ? '' : 'Enter your name.') & fieldError(f.elements.email, emailOk(f.elements.email.value.trim()) ? '' : 'Enter a valid email.')
        & fieldError(f.elements.password, f.elements.password.value.length >= 8 ? '' : 'Use at least 8 characters.') & fieldError(f.elements.confirm, f.elements.confirm.value === f.elements.password.value ? '' : 'Passwords do not match.');
      if (!ok) return;
      const btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Creating account…';
      const { data, error } = await sb.auth.signUp({ email: f.elements.email.value.trim(), password: f.elements.password.value, options: { data: { full_name: name }, emailRedirectTo: Auth.pageUrl('signin.html') + keepRedirect } });
      btn.disabled = false; btn.textContent = 'Create account';
      if (error) return showAlert(box, friendlyAuthError(error));
      if (data.session) return location.replace(target);
      showAlert(box, 'Account created! Check your email and click the confirmation link, then sign in.', 'ok'); f.reset();
    });
  }

  if (page === 'forgot') {
    const reqForm = document.getElementById('forgot-form'), newForm = document.getElementById('reset-form');
    sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') { reqForm.style.display = 'none'; newForm.style.display = 'block'; document.getElementById('forgot-title').textContent = 'Set a new password'; } });
    reqForm.addEventListener('submit', async (e) => {
      e.preventDefault(); box.style.display = 'none';
      if (!fieldError(e.target.elements.email, emailOk(e.target.elements.email.value.trim()) ? '' : 'Enter a valid email.')) return;
      const { error } = await sb.auth.resetPasswordForEmail(e.target.elements.email.value.trim(), { redirectTo: Auth.pageUrl('forgot-password.html') });
      if (error) return showAlert(box, friendlyAuthError(error));
      showAlert(box, 'If that email has an account, a reset link is on its way.', 'ok');
    });
    newForm.addEventListener('submit', async (e) => {
      e.preventDefault(); box.style.display = 'none'; const f = e.target;
      const ok = fieldError(f.elements.password, f.elements.password.value.length >= 8 ? '' : 'Use at least 8 characters.') & fieldError(f.elements.confirm, f.elements.confirm.value === f.elements.password.value ? '' : 'Passwords do not match.');
      if (!ok) return;
      const { error } = await sb.auth.updateUser({ password: f.elements.password.value });
      if (error) return showAlert(box, friendlyAuthError(error));
      showAlert(box, 'Password updated! Redirecting to sign in…', 'ok'); await sb.auth.signOut(); setTimeout(() => location.replace('signin.html'), 1500);
    });
  }
}
