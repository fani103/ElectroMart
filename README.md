# ElectroMart — Online Electronics Store (College Project)

A complete full-stack e-commerce website: product catalogue, guest cart, secure checkout (Razorpay **test mode** + Cash on Delivery), order tracking, PDF order confirmations, emails, verified-purchase reviews, an admin dashboard with live analytics, and a Gemini-powered shopping assistant.

> **Payments run in Razorpay TEST mode only. No real money is ever charged.** The backend refuses any key that does not start with `rzp_test_`.

---
## 1. Abstract (for your project report)
ElectroMart is a three-tier web application. A static HTML/CSS/JavaScript frontend talks to a Node.js/Express REST API, which stores data in Supabase (PostgreSQL, Auth and Storage). Customers can browse and search products as guests, keep a cart in the browser, and sign in only at checkout. Orders are created atomically in the database so stock can never be oversold. Online payments use Razorpay's test environment with server-side signature verification; Cash on Delivery is also supported. Confirmed orders produce a PDF and a transactional email. Administrators manage products, orders, reviews and view live analytics. A Google Gemini assistant answers questions using only trusted catalogue data fetched by the backend.

## 2. Objectives & key features
- Browse/search/filter/sort products; product details with specs, stock and related items
- Guest cart (localStorage) → login required only at checkout; **Buy Now** on every product card
- Razorpay (test) + COD; backend recalculates every price; idempotent payment verification
- Atomic stock reservation (row locks) — no overselling; cancellation returns stock
- Order confirmation page, PDF (PDFKit), email (Resend) with retry & no duplicates
- My Orders with progress tracker, PDF re-download, cancellation
- Reviews only for **delivered** purchases, one per purchase, admin moderation
- Admin: products + image upload, orders, COD collection, refunds, review moderation, analytics (Realtime + polling)
- Gemini assistant (floating widget + `ai.html`), never sees secrets, never invents data

## 3. Technology stack
| Layer | Tech |
|---|---|
| Frontend | HTML5, CSS3, vanilla JavaScript, Poppins, Lucide icons |
| Backend | Node.js 18+, Express, dotenv, express-rate-limit, multer |
| Database/Auth/Storage | Supabase (PostgreSQL + RLS, Auth incl. Google OAuth, Storage) |
| Payments | Razorpay (test mode) |
| AI | Google Gemini (`@google/generative-ai`) |
| Email | Resend |
| PDF | PDFKit |
| Hosting | Netlify (frontend), Render (backend), Supabase |

## 4. Architecture overview
```
Browser (Netlify static site)
  │  Supabase JS (anon key): sign-in / sign-up / Google / password reset / Realtime
  │  fetch() + "Authorization: Bearer <access token>"
  ▼
Express API (Render) ── validates token with Supabase ── checks admin role in DB
  │  service-role key (server only)
  ├─► Supabase PostgreSQL (create_order_atomic / cancel_order_atomic / confirm_payment_atomic)
  ├─► Razorpay (create order, verify signature, refund)
  ├─► Gemini (answers built from DB data)
  └─► Resend (emails + PDF attachment)
```
Key idea for your viva: **the browser is never trusted** — prices, totals, payment status and admin rights are all decided on the server/database.

## 5. Folder structure
```
ElectroMart/
├── frontend/            12 HTML pages, assets/css (6), assets/js (10), netlify.toml
├── backend/             server.js, src/{config,routes,middleware,services,utils}, .env.example
├── supabase/            schema.sql (tables, RLS, functions), seed.sql (optional demo rows)
├── tests/               README.md (checklist) + automated/ (3 test scripts)
└── README.md
```
Files added beyond the suggested list (needed): `backend/src/config/settings.js` (store rules from env), `backend/src/services/productService.js` (discount/stock/rating logic), `supabase/seed.sql`, `tests/automated/*`.
No `home.html` was supplied, so none exists; the new homepage is `frontend/index.html`.

## 6. Prerequisites
Node.js 18+ (`node -v`), Git, a code editor, and free accounts for: Supabase, Razorpay (test keys), Google AI Studio (Gemini key), Resend, Netlify, Render, and Google Cloud (only for Google sign-in).

## 7. Installation
```powershell
# Windows PowerShell
cd ElectroMart\backend
npm install
copy .env.example .env      # then edit .env
```
```bash
# macOS / Linux
cd ElectroMart/backend && npm install && cp .env.example .env
```

## 8–9. Supabase project + SQL schema
1. supabase.com → **New project** (note the database password; region near you).
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**. It is safe to re-run.
3. (Optional) run `supabase/seed.sql` for six clearly-labelled **demo** products. Real products should be added in the admin dashboard.
4. **Verify RLS:** Table Editor → each table shows "RLS enabled". Try the checks in `tests/README.md` §Supabase.
5. **Storage:** the script creates a public-read bucket `product-images` (uploads happen only through the backend). Confirm it exists under Storage.
6. **Realtime:** the script adds `orders`, `products`, `payments` to the `supabase_realtime` publication (Database → Replication to confirm). If unavailable, the dashboard falls back to polling.

## 10. Auth & Google OAuth
- **Authentication → Providers → Email**: enabled. For easy demos you may switch off "Confirm email"; if on, new users must click the email link.
- **Google:** Google Cloud Console → APIs & Services → Credentials → *OAuth client ID (Web)*. Authorized redirect URI = the callback shown in Supabase (Authentication → Providers → Google, e.g. `https://<project>.supabase.co/auth/v1/callback`). Paste Client ID/Secret into Supabase and enable.
- **Authentication → URL Configuration:** *Site URL* = your Netlify URL (or `http://localhost:5500` locally). *Redirect URLs* — add `https://<your-site>.netlify.app/**` and `http://localhost:5500/**`.

## 11. Secure admin provisioning
Nobody can become admin through sign-up, Google, or the API (a database trigger blocks role changes from API users). To create the first admin:
1. Sign up normally on the site with the admin's email.
2. In Supabase **SQL Editor** run (replace the email):
```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```
3. Sign in and open `admin.html` (also linked at the bottom of the sign-in page). Opening the page alone grants nothing — every admin API call re-checks the role in the database.

## 12–13. Backend environment variables (`backend/.env`)
| Variable | Purpose | Secret? |
|---|---|---|
| `PORT` | server port (Render sets it) | no |
| `FRONTEND_URLS` | comma-separated allowed CORS origins | no |
| `FRONTEND_URL` | used for links in emails | no |
| `SUPABASE_URL` | project URL | no |
| `SUPABASE_SERVICE_ROLE_KEY` | full DB access | **YES** |
| `SUPABASE_STORAGE_BUCKET` | default `product-images` | no |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | **test** keys (`rzp_test_…`) | secret = **YES** |
| `RAZORPAY_WEBHOOK_SECRET` | optional webhook secret | **YES** |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | AI assistant | key = **YES** |
| `RESEND_API_KEY`, `EMAIL_FROM`, `SUPPORT_EMAIL` | email | key = **YES** |
| `COD_ENABLED`, `LOW_STOCK_THRESHOLD`, `SHIPPING_FLAT`, `FREE_SHIPPING_ABOVE`, `TAX_RATE_PERCENT`, `MAX_QTY_PER_ITEM` | store rules | no |

Never commit `.env` (it is in `.gitignore`).

## 14. Frontend API configuration
Edit `frontend/assets/js/config.js` (public values only):
```js
API_BASE_URL: 'http://localhost:5000',          // Render URL in production
SUPABASE_URL: 'https://xxxx.supabase.co',
SUPABASE_ANON_KEY: '<anon / publishable key>'   // safe in the browser; RLS protects data
```
**Never** put the service-role key or any other secret here.

## 15. Local development
```powershell
cd backend ; npm run dev            # API on http://localhost:5000  (check /api/health)
cd ..\frontend ; npx serve -l 5500 .   # or VS Code "Live Server" on port 5500
```
Open `http://localhost:5500`. Make sure `http://localhost:5500` is in `FRONTEND_URLS` and in Supabase redirect URLs.

## 16. Gemini setup
Get a key at aistudio.google.com → "Get API key" → put in `GEMINI_API_KEY`. Default model `gemini-2.0-flash` (change `GEMINI_MODEL` if Google retires it). Verify: ask the widget "phones under 30000"; `/api/health` shows `gemini: configured`.

## 17. Razorpay TEST-mode setup
1. Razorpay dashboard → toggle **Test Mode** → Settings → API Keys → use the Key Id/Secret you already have in `.env`.
2. Test card: any valid test number from Razorpay docs (e.g. 4111 1111 1111 1111, any future expiry, any CVV; on the bank test page choose *Success* or *Failure*). Test UPI: `success@razorpay` succeeds, `failure@razorpay` fails.
3. **Webhook (optional):** Dashboard → Webhooks → URL `https://<render-app>/api/payments/webhook`, secret → `RAZORPAY_WEBHOOK_SECRET`, events `payment.captured`, `payment.failed`, `refund.processed`. Not needed for the normal flow (the browser callback verifies), but it makes confirmation resilient if the tab closes after paying.
4. The server **refuses** live keys.

## 18. Email (Resend) setup
Create account → API Keys → `RESEND_API_KEY`. Without a verified domain you can only send from `onboarding@resend.dev` **to your own Resend account email** — fine for the demo. To email any customer, verify a domain under *Domains* and set `EMAIL_FROM="ElectroMart <orders@yourdomain.com>"`. Failed emails are stored in `notifications`; the admin **Emails** tab has *Retry*, and the server retries automatically every 15 minutes (max 5 attempts). A unique `(order_id, type)` row guarantees one email per event.

## 19. PDF generation
`GET /api/orders/:id/pdf` builds the PDF on demand from saved data (owner or admin only, `Cache-Control: private, no-store`, never public). Amounts print as "Rs." because PDFKit's built-in font has no ₹ glyph. It is titled *Order Confirmation* (not a tax invoice).

## 20. Images & storage
Admin → Products → upload JPG/PNG/WebP ≤ 5 MB → stored in Supabase Storage. A neutral SVG placeholder shows if an image is missing/broken. See `frontend/assets/images/README.txt` for licensing (Unsplash/Pexels/Lucide).

## 21. Deploy frontend → Netlify
Add new site → import Git repo. **Base directory:** `frontend` · **Build command:** *(empty)* · **Publish directory:** `.` Then edit `config.js` with the Render API URL and commit.

## 22. Deploy backend → Render
New **Web Service** → repo → **Root directory** `backend` · **Build** `npm install` · **Start** `npm start` · add every variable from §12 in *Environment*. Check `https://<app>.onrender.com/api/health`. The free tier sleeps after inactivity; the site shows a "server is waking up" banner on slow first requests.

## 23. CORS & redirects checklist
- Render `FRONTEND_URLS` = exact Netlify origin (no trailing slash) — add `http://localhost:5500` while developing.
- Supabase *Site URL* + *Redirect URLs* include the Netlify URL (`/**`).
- Google OAuth redirect URI = Supabase callback URL.

## 24. API reference
Auth column: **—** public · **User** Bearer token · **Admin** Bearer token + admin role. Errors are JSON `{ "error": "message" }` (400 invalid input, 401 not signed in, 403 forbidden, 404 not found, 409 conflict e.g. stock, 429 rate limit, 502/503 external service).

| Method & path | Auth | Input | Response / notes |
|---|---|---|---|
| GET `/api/health` | — | | status of DB/Razorpay/Gemini/email |
| GET `/api/config` | — | | public store settings + Razorpay **key id** |
| GET `/api/products` | — | `search,category,minPrice,maxPrice,availability=in_stock,sort,offers=true,page,limit` | `{products,total,page,limit}` |
| GET `/api/products/categories` | — | | categories |
| POST `/api/products/validate-cart` | — | `{items:[{product_id,quantity}]}` | trusted prices/stock |
| GET `/api/products/reviews/latest` | — | | 3 newest approved reviews |
| GET `/api/products/:id` | — | | product, related, reviews (404 if inactive) |
| POST `/api/ai/chat` | optional | `{message,history}` | `{answer,products}`; 15 req/min; order questions need sign-in |
| POST `/api/orders` | User | `{items,address,paymentMethod:"cod"}` | `{order}`; 403 if COD off; 409 stock |
| GET `/api/orders` | User | | own orders |
| GET `/api/orders/:id` | User (owner/admin) | | order + reviewable item ids |
| POST `/api/orders/:id/cancel` | User (owner) | | cancels before shipping, restocks |
| GET `/api/orders/:id/pdf` | User (owner/admin) | | PDF file |
| POST `/api/payments/create-order` | User | `{items,address}` | Razorpay order + keyId; reserves stock |
| POST `/api/payments/verify` | User (owner) | `{orderId,razorpay_order_id,razorpay_payment_id,razorpay_signature}` | verifies HMAC, idempotent |
| POST `/api/payments/failed` | User | `{orderId,reason}` | records failed attempt |
| POST `/api/payments/cancel` | User | `{orderId}` | popup closed: releases stock (or confirms if Razorpay says paid) |
| POST `/api/payments/webhook` | Razorpay signature | raw JSON | optional; idempotent |
| POST `/api/reviews` | User | `{productId,rating 1-5,comment}` | 403 unless delivered purchase; 409 duplicate |
| GET `/api/reviews/eligibility/:productId` | User | | `{eligible}` |
| GET `/api/admin/me` | Admin | | `{isAdmin}` |
| GET `/api/admin/analytics` | Admin | | overview, money, trend, best sellers, statuses |
| GET/POST `/api/admin/products`, PUT/DELETE `/api/admin/products/:id` | Admin | product fields | DELETE = deactivate; PUT `{is_active:true}` reactivates |
| POST `/api/admin/products/image` | Admin | multipart `image` ≤5 MB | `{url}` |
| GET `/api/admin/orders` | Admin | `?status=` | orders with customer |
| PATCH `/api/admin/orders/:id/status` | Admin | `{status}` | allowed: confirmed→processing→shipped→delivered |
| POST `/api/admin/orders/:id/cod-collected` | Admin | | COD → paid |
| POST `/api/admin/orders/:id/cancel` | Admin | | cancel + restock |
| POST `/api/admin/orders/:id/refund` | Admin | `{manual:true}` for COD | Razorpay refund; marked refunded only when Razorpay says *processed* |
| GET `/api/admin/reviews`, PATCH `/api/admin/reviews/:id` | Admin | `{status:approved|hidden}` | moderation |
| GET `/api/admin/notifications`, POST `/api/admin/notifications/retry` | Admin | | email status / retry |

## 25. Database tables
`profiles` (id→auth.users, email, name, phone, **role**) · `products` · `orders` (address snapshot, totals, payment_method, payment_status, order_status, Razorpay refs, refund fields) · `order_items` (name/price snapshots) · `payments` (provider refs, verification flag) · `reviews` (unique per `order_item_id`) · `notifications` (unique per order+type; status/attempts/error). Functions: `create_order_atomic`, `cancel_order_atomic`, `confirm_payment_atomic`, `is_admin`, plus triggers for profile creation and role-change protection.

**Order flow:** Razorpay → `pending/pending` → verified → `confirmed/paid`. COD → `confirmed/cod_due` → admin records cash → `paid`. Lifecycle: pending → confirmed → processing → shipped → delivered (or cancelled before shipping). Payment *method* and *status* are separate columns.

**Analytics rules:** *Collected revenue* = orders with payment_status `paid` (Razorpay verified server-side or COD cash recorded). Cancelled/refund-pending/refunded orders are excluded. *Order value* = all non-cancelled orders. *COD outstanding* = non-cancelled COD orders still `cod_due`. *Pending orders* = status pending or confirmed. Refunds show separately.

## 26. Security measures
Server-side validation everywhere · prices/totals only from DB · admin role checked per request in DB · RLS on every table · service-role key server-only · DB trigger blocks role escalation · Razorpay HMAC verified with constant-time compare + test-keys-only · idempotent confirm (row lock) · rate limiting (global, payments/reviews, AI) · CORS allow-list · ownership checks on orders & PDFs · open-redirect-safe sign-in redirects · output escaping in the UI · AI sees only product/policy data and the signed-in user's own orders · secrets only in `.env`.

## 27. Testing
See `tests/README.md`. Automated: `cd tests/automated && npm install && npm test` (backend smoke + UI), and `run-db-tests.sh` against a scratch PostgreSQL.

## 28. Troubleshooting
| Symptom | Fix |
|---|---|
| "Cannot reach the server" | backend not running / wrong `API_BASE_URL` / Render asleep (wait ~1 min) |
| CORS error / "Origin not allowed" | add the exact frontend origin to `FRONTEND_URLS` |
| "Online payment is not configured" | set `rzp_test_` keys in `.env`, restart |
| Payment OK but "verification failed" | wrong `RAZORPAY_KEY_SECRET` for that key id |
| No emails | check `/api/health`, Admin → Emails shows last error; Resend sandbox only sends to your own email |
| Google login loops back | missing Redirect URL in Supabase; check Site URL |
| Admin page says "Admin access required" | run the SQL in §11 with the same email you sign in with |
| Dashboard says "Polling" | Realtime not enabled for the tables (§9 step 6) — still works |
| Image upload fails | bucket `product-images` missing, or file >5 MB / wrong type |

## 29. Limitations & future work
Not covered: coupons, returns workflow UI, tax-invoice compliance (GST), address book, wishlist, product variants, multi-image galleries, and email-based order tracking for guests. Razorpay orders that are abandoned are cancelled automatically after ~30 minutes (stock released). Stock is reserved when a Razorpay order is created. The in-memory rate limiter resets on restart and is per-instance.

## 30. Demonstrating to an evaluator (suggested 10-minute script)
1. Architecture slide (§4) → show `/api/health`.
2. As a guest: browse, search/filter, add to cart, refresh (cart persists), click **Buy Now** → redirected to sign-in → returns to checkout.
3. Pay with Razorpay test card → confirmation page → download PDF → show email.
4. Place a COD order → shows **COD / due on delivery**.
5. Admin dashboard: add a product with image, change stock, watch analytics update live; mark COD collected; ship → deliver.
6. As customer: review the delivered product (rating appears). Try reviewing a non-delivered product (blocked).
7. Ask the AI assistant for "laptop under 60000"; ask for an order status while signed out (it asks you to sign in).
8. Security talking points: server-side totals, RLS, signature verification, role trigger — run `tests/automated/run-db-tests.sh` to show no overselling.
