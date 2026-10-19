# ElectroMart — Testing checklist

Legend: ✅ **verified by an executed automated test** (how to re-run is given) · 🔑 **needs your external credentials/accounts — run manually** · ⬜ tick when you have tested it.

## How to run the automated tests
```bash
cd tests/automated && npm install        # installs jsdom
npm run test:backend                      # validation, discount maths, Razorpay signature, PDF, API guards
npm run test:ui                           # loads every page against a mocked API (jsdom)
PGHOST=localhost PGUSER=postgres ./run-db-tests.sh   # real PostgreSQL: schema, concurrency, RLS, roles
```
(`run-db-tests.sh` creates a throw-away database named `electromart_test` and stubs Supabase's `auth`/`storage` schemas. Never point it at your real Supabase project.)

## Results of the runs performed while building (honest status)
| Area | Result |
|---|---|
| Backend smoke test (`backend-smoke.test.js`) | ✅ all assertions passed |
| Frontend UI test (`frontend-ui.test.js`) | ✅ 40 / 40 checks passed (jsdom + mocked API; not a real browser) |
| `schema.sql` on PostgreSQL 16 | ✅ runs cleanly and re-runs cleanly; `seed.sql` loads |
| Concurrency | ✅ 12 simultaneous buyers for 4 units → exactly 4 orders, stock 0, 8 rejected |
| RLS / roles | ✅ customer cannot read others' orders or set `role='admin'`; anon sees only active products; payments hidden from customers; RPCs not callable by `authenticated` |
| Live Supabase project, Google OAuth, Razorpay, Resend, Gemini, Netlify, Render | 🔑 **not tested** — need your accounts. Use the manual list below. |

## Frontend
- ✅ Every page opens without script errors (UI test) · ✅ product cards show API data, Buy Now CTA, discount badge, low-stock label, disabled when out of stock · ✅ cart removes unavailable items and totals use server prices · ✅ empty states
- ⬜ Real browser: navigation links, search/filters/sort/pagination, cart persists across refresh, mobile layout (resize to 375 px), loading skeletons, error + retry (stop the backend and reload)

## Authentication
- ✅ Safe-redirect function rejects `https://evil.com`, `//evil.com`, `javascript:` · ✅ signed-out visitors to checkout/admin are redirected to sign-in · ✅ admin link text on sign-in page
- 🔑 ⬜ Sign up, sign in, sign out, password reset email → new password, Google OAuth, session persists on refresh
- 🔑 ⬜ Guest cart → Buy Now → sign-in → lands on checkout with the item
- 🔑 ⬜ Non-admin token calling `/api/admin/analytics` gets 403 (e.g. `curl -H "Authorization: Bearer <customer token>" …`)

## Products & stock
- ✅ discount % = floor((orig−price)/orig×100) (51%, 1%, none when equal/lower) · ✅ stock labels (0 → Out, ≤5 → Only few left, else In Stock)
- ✅ Concurrent purchases cannot oversell (DB test) · ✅ cancel returns stock and is idempotent · ✅ shipped orders cannot be cancelled
- 🔑 ⬜ Admin add/edit/deactivate product, image upload (Storage), storefront shows changes

## Payments & orders
- ✅ Valid signature accepted; wrong payment id or garbage signature rejected · ✅ `confirm_payment_atomic` returns true once, then false (no duplicate confirmation) · ✅ totals computed in SQL from DB prices (subtotal + shipping)
- 🔑 ⬜ Razorpay test: success → order `confirmed/paid`; failure → not paid; close popup → order cancelled + stock restored; repeat `/verify` call → no duplicate email; network drop during verify → "Retry confirmation" works; double-click Place order → only one order
- 🔑 ⬜ COD: shows `COD` and "due on delivery"; admin "COD collected" → paid; cancelling releases stock
- 🔑 ⬜ Refund: cancel a paid Razorpay order → "refund pending" → admin refund → marked refunded only after Razorpay says processed

## Email & PDF
- ✅ PDF generated from order data, valid `%PDF`, page numbers, COD due notice (`/tmp/em-sample.pdf` is written by the backend test — open it and inspect)
- 🔑 ⬜ Confirmation email has the right number/method/status/total/address + PDF; failed email (wrong key) leaves the order intact; Admin → Emails → Retry delivers it; shipped/delivered/cancelled/refund emails
- 🔑 ⬜ Customer B cannot download customer A's PDF (expect 404)

## Reviews & analytics
- ✅ One review per purchase is enforced by a DB unique constraint · ⬜ ineligible customer gets 403; rating appears only after approved reviews exist
- ⬜ Admin analytics update within ~1–2 s of an order/stock change (Realtime) or ≤45 s (polling); revenue excludes cancelled/unpaid; COD outstanding and refunds shown separately

## AI assistant
- ✅ Empty/too-long question → 400 · ✅ budget/category extraction ("under 50,000", "below 20k")
- 🔑 ⬜ With `GEMINI_API_KEY`: answers quote real prices; asks "unknown product" → says it cannot verify; order question while signed out → asked to sign in; 16th message in a minute → rate-limited; stop network → friendly error + Retry

## Deployment
- 🔑 ⬜ Netlify pages load · ⬜ Render `/api/health` is `ok` · ⬜ CORS accepts only your Netlify origin · ⬜ `git grep -i "service_role\|rzp_test_\|sk-\|re_"` finds no real secrets · ⬜ Supabase RLS enabled on all 7 tables
