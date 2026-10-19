/* Home page, product catalog and product details. */
const CAT_ICONS = { 'Smartphones': 'smartphone', 'Laptops': 'laptop', 'Headphones & Audio': 'headphones', 'TVs & Monitors': 'monitor', 'Smartwatches': 'watch', 'Accessories': 'plug' };
const CATEGORIES = Object.keys(CAT_ICONS);

function qs(obj) { return Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined && v !== null && v !== false).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&'); }

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'home') initHome();
  if (page === 'catalog') initCatalog();
  if (page === 'details') initDetails();
});

/* ---------------- Home ---------------- */
async function loadGrid(el, query, emptyMsg) {
  el.innerHTML = skeletonCards(4);
  try {
    const { products } = await api('/api/products?' + qs(query));
    el.innerHTML = products.length ? products.map(productCard).join('') : emptyState('package-open', 'Nothing here yet', emptyMsg);
  } catch (e) { el.innerHTML = errorState(e.message, 'retry-' + el.id); document.getElementById('retry-' + el.id).onclick = () => loadGrid(el, query, emptyMsg); }
  icons();
}

function initHome() {
  document.getElementById('cat-grid').innerHTML = CATEGORIES.map((c) => `<a class="cat" href="products.html?category=${encodeURIComponent(c)}"><i data-lucide="${CAT_ICONS[c]}"></i><span>${esc(c)}</span></a>`).join('');
  loadGrid(document.getElementById('featured-grid'), { sort: 'rating', availability: 'in_stock', limit: 4 }, 'Products will appear here once the admin adds them.');
  loadGrid(document.getElementById('latest-grid'), { sort: 'newest', limit: 8 }, 'No products yet.');
  loadGrid(document.getElementById('offers-grid'), { offers: true, sort: 'discount', limit: 4 }, 'No offers right now. Check back soon!');
  api('/api/products/reviews/latest').then(({ reviews }) => {
    if (!reviews.length) return;                                    // never show fake reviews: hide the section instead
    document.getElementById('reviews-section').style.display = 'block';
    document.getElementById('reviews-list').innerHTML = reviews.map((r) => `<div class="review"><div class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div><p>${esc(r.comment || '')}</p><div class="who">${esc(r.author)} <small style="color:var(--muted);font-weight:400">on ${esc(r.product || 'a product')}</small></div></div>`).join('');
  }).catch(() => {});
  icons();
}

/* ---------------- Catalog ---------------- */
function initCatalog() {
  const p = new URLSearchParams(location.search);
  const st = { search: p.get('search') || '', category: p.get('category') || '', minPrice: p.get('minPrice') || '', maxPrice: p.get('maxPrice') || '', availability: p.get('availability') || '', sort: p.get('sort') || 'newest', offers: p.get('offers') === 'true', page: Number(p.get('page') || 1) };
  const f = document.getElementById('filter-form');
  document.getElementById('f-category').innerHTML = '<option value="">All categories</option>' + CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join('');
  const fill = () => { f.elements.search.value = st.search; f.elements.category.value = st.category; f.elements.minPrice.value = st.minPrice; f.elements.maxPrice.value = st.maxPrice; f.elements.instock.checked = st.availability === 'in_stock'; f.elements.offers.checked = st.offers; document.getElementById('sort').value = st.sort; };
  fill();
  const grid = document.getElementById('product-grid'), count = document.getElementById('result-count'), pager = document.getElementById('pager');

  async function load() {
    const keep = qs({ search: st.search, category: st.category, minPrice: st.minPrice, maxPrice: st.maxPrice, availability: st.availability, sort: st.sort !== 'newest' ? st.sort : '', offers: st.offers, page: st.page > 1 ? st.page : '' });
    history.replaceState(null, '', 'products.html' + (keep ? '?' + keep : ''));
    document.getElementById('offer-banner').style.display = st.offers ? 'block' : 'none';
    grid.innerHTML = skeletonCards(8); count.textContent = 'Loading…';
    try {
      const { products, total, limit } = await api('/api/products?' + qs({ ...st, limit: 12 }));
      count.textContent = `${total} product${total === 1 ? '' : 's'} found`;
      grid.innerHTML = products.length ? products.map(productCard).join('') : emptyState('search-x', 'No products match your filters', 'Try a different search or clear the filters.', '<button class="btn btn-primary" id="empty-clear">Clear filters</button>');
      const eb = document.getElementById('empty-clear'); if (eb) eb.onclick = clear;
      const pages = Math.ceil(total / limit);
      pager.innerHTML = pages > 1 ? Array.from({ length: pages }, (_, i) => `<button class="btn btn-sm ${i + 1 === st.page ? 'btn-primary' : 'btn-ghost'}" data-page="${i + 1}">${i + 1}</button>`).join('') : '';
    } catch (e) { count.textContent = ''; grid.innerHTML = errorState(e.message); document.getElementById('retry-btn').onclick = load; }
    icons();
  }
  const clear = () => { Object.assign(st, { search: '', category: '', minPrice: '', maxPrice: '', availability: '', sort: 'newest', offers: false, page: 1 }); fill(); const si = document.getElementById('search-input'); if (si) si.value = ''; load(); };
  f.addEventListener('submit', (e) => { e.preventDefault(); Object.assign(st, { search: f.elements.search.value.trim(), category: f.elements.category.value, minPrice: f.elements.minPrice.value, maxPrice: f.elements.maxPrice.value, availability: f.elements.instock.checked ? 'in_stock' : '', offers: f.elements.offers.checked, page: 1 }); if (st.minPrice && st.maxPrice && Number(st.minPrice) > Number(st.maxPrice)) return toast('Minimum price cannot exceed maximum price.', 'error'); load(); });
  document.getElementById('clear-filters').addEventListener('click', clear);
  document.getElementById('sort').addEventListener('change', (e) => { st.sort = e.target.value; st.page = 1; load(); });
  pager.addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (b) { st.page = Number(b.dataset.page); load(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
  load();
}

/* ---------------- Details ---------------- */
async function initDetails() {
  const id = new URLSearchParams(location.search).get('id');
  const root = document.getElementById('details-root');
  const load = async () => {
    root.innerHTML = '<div class="details"><div class="skeleton" style="aspect-ratio:1"></div><div><div class="skeleton" style="height:34px;margin-bottom:12px"></div><div class="skeleton" style="height:24px;width:50%"></div></div></div>';
    try {
      const { product: p, related, reviews } = await api('/api/products/' + encodeURIComponent(id));
      document.title = p.name + ' · ElectroMart';
      const out = p.stock_status === 'out_of_stock';
      const max = Math.min(p.stock_quantity, 10);
      const specs = Object.entries(p.specifications || {});
      root.innerHTML = `<div class="container"><div class="crumbs"><a href="index.html">Home</a> / <a href="products.html?category=${encodeURIComponent(p.category)}">${esc(p.category)}</a> / ${esc(p.name)}</div>
        <div class="details"><div class="d-img">${imgTag(p.image_url, p.name, false)}</div>
        <div class="d-info"><h1>${esc(p.name)}</h1>${starsHtml(p)}
          <div class="price-row" style="margin:10px 0"><span class="price">${inr(p.price)}</span>${p.original_price ? `<span class="mrp">${inr(p.original_price)}</span>` : ''}${discBadge(p)}</div>
          <p>${stockBadge(p)}${p.stock_status === 'low_stock' ? ` <small style="color:var(--muted)">(${p.stock_quantity} left)</small>` : ''}</p>
          <p style="margin:14px 0;color:#334155">${esc(p.description) || 'No description provided.'}</p>
          <div class="actions"><div class="qty"><button type="button" id="q-minus" aria-label="Decrease">−</button><input id="q-input" type="number" min="1" max="${max}" value="1" aria-label="Quantity" ${out ? 'disabled' : ''}><button type="button" id="q-plus" aria-label="Increase">+</button></div>
            <button class="btn btn-outline" id="add-btn" ${out ? 'disabled' : ''}><i data-lucide="shopping-cart"></i> Add to Cart</button>
            <button class="btn btn-primary" id="buy-btn" data-buy="${p.id}" data-qty="1" ${out ? 'disabled' : ''}>${out ? 'Out of Stock' : 'Buy Now'}</button></div>
          ${specs.length ? `<h3 style="margin:18px 0 8px">Specifications</h3><table class="spec-table">${specs.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>` : ''}
        </div></div>
        <section class="section" id="rev-sec"><h2>Customer reviews</h2><div id="review-form-box"></div>
          ${reviews.length ? reviews.map((r) => `<div class="review"><div class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>${r.comment ? `<p>${esc(r.comment)}</p>` : ''}<div class="who">${esc(r.author)} <small style="color:var(--muted);font-weight:400">· ${new Date(r.created_at).toLocaleDateString('en-IN')}</small></div></div>`).join('') : '<p style="color:var(--muted)">No reviews yet. Only customers with a delivered purchase can review.</p>'}</section>
        ${related.length ? `<section class="section"><h2>Related products</h2><div class="grid">${related.map(productCard).join('')}</div></section>` : ''}</div>`;
      const qi = document.getElementById('q-input');
      const setQ = (v) => { v = Math.max(1, Math.min(max, Number(v) || 1)); qi.value = v; document.getElementById('buy-btn').dataset.qty = v; };
      document.getElementById('q-minus').onclick = () => setQ(Number(qi.value) - 1);
      document.getElementById('q-plus').onclick = () => setQ(Number(qi.value) + 1);
      qi.onchange = () => setQ(qi.value);
      document.getElementById('add-btn').onclick = () => Cart.add(p, Number(qi.value));
      initReviewForm(p.id);
    } catch (e) {
      root.innerHTML = e.status === 404 ? `<div class="container">${emptyState('package-x', 'Product not found', 'It may have been removed.', '<a class="btn btn-primary" href="products.html">Browse products</a>')}</div>` : `<div class="container">${errorState(e.message)}</div>`;
      const rb = document.getElementById('retry-btn'); if (rb) rb.onclick = load;
    }
    icons();
  };
  load();
}

async function initReviewForm(productId) {
  const box = document.getElementById('review-form-box');
  if (!(await Auth.session())) return;
  try { if (!(await api('/api/reviews/eligibility/' + productId, { auth: true })).eligible) return; } catch { return; }
  let rating = 0;
  box.innerHTML = `<div class="panel"><h3>Write a review</h3><div class="star-input" id="stars">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-r="${n}" aria-label="${n} stars">★</button>`).join('')}</div>
    <div class="field" style="margin-top:10px"><textarea id="rev-text" rows="3" maxlength="1000" placeholder="Share your experience (optional)"></textarea></div><button class="btn btn-primary" id="rev-submit">Submit review</button></div>`;
  document.getElementById('stars').addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (!b) return; rating = Number(b.dataset.r); [...document.querySelectorAll('#stars button')].forEach((x, i) => x.classList.toggle('on', i < rating)); });
  document.getElementById('rev-submit').onclick = async (e) => {
    if (!rating) return toast('Please choose a star rating.', 'error');
    e.target.disabled = true;
    try { await api('/api/reviews', { method: 'POST', auth: true, body: { productId, rating, comment: document.getElementById('rev-text').value } }); toast('Thanks for your review!', 'success'); setTimeout(() => location.reload(), 900); }
    catch (err) { toast(err.message, 'error'); e.target.disabled = false; }
  };
}
