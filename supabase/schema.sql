-- =====================================================================
-- ElectroMart - Supabase schema (run once in Supabase -> SQL Editor)
-- Order: this whole file top to bottom. Safe to re-run (uses IF NOT EXISTS / OR REPLACE).
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;   -- role is ALWAYS 'customer' here (column default)
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Block role changes coming through the API (only SQL editor / service role may change roles)
create or replace function public.prevent_role_change()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role
     and coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres','supabase_admin') then
    raise exception 'Changing roles is not allowed';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.prevent_role_change();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- products ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 200),
  description text not null default '',
  category text not null check (category in ('Smartphones','Laptops','Headphones & Audio','TVs & Monitors','Smartwatches','Accessories')),
  price numeric(10,2) not null check (price > 0),
  original_price numeric(10,2) check (original_price is null or original_price > 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  image_url text,
  specifications jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category);
create index if not exists products_active_idx on public.products(is_active);
create index if not exists products_created_idx on public.products(created_at desc);

-- ---------- orders ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references auth.users(id),
  shipping_address jsonb not null,               -- snapshot at order time
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,     -- coupon discount (no coupons in this version, stays 0)
  shipping_charge numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_method text not null check (payment_method in ('razorpay','cod')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending','paid','failed','cancelled','cod_due','refund_pending','refunded')),
  order_status text not null default 'pending'
    check (order_status in ('pending','confirmed','processing','shipped','delivered','cancelled')),
  razorpay_order_id text,
  razorpay_payment_id text,
  refund_id text,
  refund_amount numeric(12,2) not null default 0,
  refunded_at timestamptz,
  cod_collected_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders(user_id, created_at desc);
create index if not exists orders_status_idx on public.orders(order_status, payment_status);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10,2) not null,
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null
);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_items_product_idx on public.order_items(product_id);

-- ---------- payments ----------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'razorpay',
  provider_order_id text not null unique,
  provider_payment_id text,
  amount numeric(12,2) not null,
  currency text not null default 'INR',
  status text not null default 'created' check (status in ('created','paid','failed','cancelled')),
  signature_verified boolean not null default false,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_order_idx on public.payments(order_id);

-- ---------- reviews ----------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_item_id uuid not null unique references public.order_items(id) on delete cascade, -- one review per purchase
  rating integer not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  status text not null default 'approved' check (status in ('approved','hidden')),
  created_at timestamptz not null default now()
);
create index if not exists reviews_product_idx on public.reviews(product_id, status);

-- ---------- notifications (email delivery tracking + retries) ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  type text not null check (type in ('order_confirmation','shipped','delivered','cancelled','refund_confirmed')),
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, type)          -- guarantees ONE email per order per type
);

-- =====================================================================
-- Atomic functions (called only by the backend with the service-role key)
-- =====================================================================

-- Creates an order AND reserves stock in one transaction. Row locks prevent overselling.
create or replace function public.create_order_atomic(
  p_user uuid, p_items jsonb, p_address jsonb, p_method text,
  p_shipping_flat numeric, p_free_above numeric, p_tax_rate numeric
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_order uuid := gen_random_uuid();
  v_item jsonb; v_prod public.products%rowtype; v_qty integer;
  v_subtotal numeric(12,2) := 0; v_ship numeric(12,2); v_tax numeric(12,2); v_num text;
begin
  if p_method not in ('razorpay','cod') then raise exception 'INVALID_METHOD'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'EMPTY_CART'; end if;

  v_num := 'EM' || to_char(now(),'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

  insert into public.orders(id, order_number, user_id, shipping_address, payment_method, payment_status, order_status)
  values (v_order, v_num, p_user, p_address, p_method,
          case when p_method = 'cod' then 'cod_due' else 'pending' end,
          case when p_method = 'cod' then 'confirmed' else 'pending' end);

  -- lock products in a fixed order (by id) so two buyers cannot deadlock
  for v_item in select value from jsonb_array_elements(p_items) order by value->>'product_id' loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 then raise exception 'INVALID_QUANTITY'; end if;
    select * into v_prod from public.products
      where id = (v_item->>'product_id')::uuid and is_active for update;
    if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    if v_prod.stock_quantity < v_qty then raise exception 'INSUFFICIENT_STOCK:%', v_prod.name; end if;

    update public.products set stock_quantity = stock_quantity - v_qty, updated_at = now() where id = v_prod.id;
    insert into public.order_items(order_id, product_id, product_name, unit_price, quantity, line_total)
    values (v_order, v_prod.id, v_prod.name, v_prod.price, v_qty, v_prod.price * v_qty);
    v_subtotal := v_subtotal + v_prod.price * v_qty;
  end loop;

  v_ship := case when v_subtotal >= p_free_above then 0 else p_shipping_flat end;
  v_tax  := round(v_subtotal * p_tax_rate / 100, 2);
  update public.orders
     set subtotal = v_subtotal, shipping_charge = v_ship, tax = v_tax,
         total = v_subtotal + v_ship + v_tax
   where id = v_order;
  return v_order;
end $$;

-- Cancels an order and returns stock. Refuses shipped/delivered/already-cancelled orders.
create or replace function public.cancel_order_atomic(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_o public.orders%rowtype;
begin
  select * into v_o from public.orders where id = p_order for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_o.order_status = 'cancelled' then return; end if;                       -- idempotent
  if v_o.order_status in ('shipped','delivered') then raise exception 'CANNOT_CANCEL'; end if;

  update public.products p set stock_quantity = p.stock_quantity + oi.quantity, updated_at = now()
    from public.order_items oi where oi.order_id = p_order and oi.product_id = p.id;

  update public.orders set
    order_status = 'cancelled', cancelled_at = now(),
    payment_status = case when v_o.payment_status = 'paid' then 'refund_pending'
                          when v_o.payment_status in ('pending','cod_due') then 'cancelled'
                          else v_o.payment_status end
  where id = p_order;
  update public.payments set status = 'cancelled', updated_at = now()
   where order_id = p_order and status = 'created';
end $$;

-- Marks a Razorpay payment as paid exactly once (idempotent). Returns true only the first time.
create or replace function public.confirm_payment_atomic(p_order uuid, p_rzp_order text, p_rzp_payment text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_o public.orders%rowtype;
begin
  select * into v_o from public.orders where id = p_order for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_o.payment_status = 'paid' then return false; end if;                    -- already processed
  if v_o.order_status = 'cancelled' then raise exception 'ORDER_CANCELLED'; end if;
  update public.orders set payment_status = 'paid', order_status = 'confirmed',
         razorpay_order_id = p_rzp_order, razorpay_payment_id = p_rzp_payment where id = p_order;
  update public.payments set status = 'paid', provider_payment_id = p_rzp_payment,
         signature_verified = true, updated_at = now() where provider_order_id = p_rzp_order;
  return true;
end $$;

revoke all on function public.create_order_atomic(uuid,jsonb,jsonb,text,numeric,numeric,numeric) from public, anon, authenticated;
revoke all on function public.cancel_order_atomic(uuid) from public, anon, authenticated;
revoke all on function public.confirm_payment_atomic(uuid,text,text) from public, anon, authenticated;
grant execute on function public.create_order_atomic(uuid,jsonb,jsonb,text,numeric,numeric,numeric) to service_role;
grant execute on function public.cancel_order_atomic(uuid) to service_role;
grant execute on function public.confirm_payment_atomic(uuid,text,text) to service_role;

-- =====================================================================
-- Row Level Security  (the backend uses the service-role key and bypasses RLS;
-- these policies protect direct access with the public anon key)
-- =====================================================================
alter table public.profiles      enable row level security;
alter table public.products      enable row level security;
alter table public.orders        enable row level security;
alter table public.order_items   enable row level security;
alter table public.payments      enable row level security;
alter table public.reviews       enable row level security;
alter table public.notifications enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists products_select on public.products;
create policy products_select on public.products for select using (is_active or public.is_admin());
drop policy if exists products_admin_write on public.products;
create policy products_admin_write on public.products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));

drop policy if exists payments_admin_select on public.payments;
create policy payments_admin_select on public.payments for select using (public.is_admin());

drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews for select using (status = 'approved' or user_id = auth.uid() or public.is_admin());
drop policy if exists reviews_admin_update on public.reviews;
create policy reviews_admin_update on public.reviews for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists notifications_admin_select on public.notifications;
create policy notifications_admin_select on public.notifications for select using (public.is_admin());
-- No INSERT/UPDATE/DELETE policies for customers on orders, payments, order_items or notifications:
-- those writes happen only through the backend (service role).

-- =====================================================================
-- Storage bucket for product images (public read; uploads go through the backend)
-- =====================================================================
insert into storage.buckets (id, name, public) values ('product-images','product-images', true)
  on conflict (id) do nothing;
drop policy if exists "product images public read" on storage.objects;
create policy "product images public read" on storage.objects for select using (bucket_id = 'product-images');

-- =====================================================================
-- Realtime: lets the admin dashboard hear about changes (RLS still applies)
-- =====================================================================
do $$ begin
  begin alter publication supabase_realtime add table public.orders;   exception when others then null; end;
  begin alter publication supabase_realtime add table public.products; exception when others then null; end;
  begin alter publication supabase_realtime add table public.payments; exception when others then null; end;
end $$;

-- =====================================================================
-- FIRST ADMIN: sign up normally on the website, then run (replace the email):
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- Run it in the SQL Editor only. The API cannot change roles.
-- =====================================================================
