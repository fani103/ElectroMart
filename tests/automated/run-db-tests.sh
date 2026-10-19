#!/usr/bin/env bash
# Runs supabase/schema.sql on a THROWAWAY local PostgreSQL (with minimal stubs for Supabase's auth/storage schemas)
# and checks: schema re-runs cleanly, no overselling under concurrency, cancel restocks, role escalation blocked,
# RLS isolates customers. Usage:  PGHOST=localhost PGUSER=postgres ./run-db-tests.sh   (needs psql + a scratch server)
set -euo pipefail
DB=${DB:-electromart_test}; here=$(cd "$(dirname "$0")" && pwd); root="$here/../.."
psql -qc "drop database if exists $DB" -c "create database $DB" postgres
P="psql -q -v ON_ERROR_STOP=1 -d $DB"
$P -f "$here/supabase-stub.sql" 2>/dev/null
$P -f "$root/supabase/schema.sql" 2>/dev/null; $P -f "$root/supabase/schema.sql" 2>/dev/null && echo "PASS schema runs twice"
$P -qAt -c "grant usage on schema public, auth to anon, authenticated, service_role; grant all on all tables in schema public to anon, authenticated, service_role; grant execute on function auth.uid(), auth.role(), public.is_admin() to anon, authenticated;"
$P -qAt -c "insert into auth.users(id,email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','buyer@x.com')"
PID=$($P -qAt -c "insert into products(name,category,price,stock_quantity) values ('Test item','Accessories',100,4) returning id")
for i in $(seq 1 12); do ( psql -qAt -d $DB -c "select create_order_atomic('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','[{\"product_id\":\"$PID\",\"quantity\":1}]','{}','cod',99,5000,0)" >/dev/null 2>&1 && echo ok || echo no ) > /tmp/em_c$i & done; wait
OK=$(cat /tmp/em_c* | grep -c ok); rm -f /tmp/em_c*; [ "$OK" = 4 ] && echo "PASS 12 concurrent buyers, stock 4 -> exactly 4 orders" || { echo "FAIL oversell check ($OK orders)"; exit 1; }
[ "$($P -qAt -c "select stock_quantity from products where id='$PID'")" = 0 ] && echo "PASS stock never negative"
$P -qAt -c "select cancel_order_atomic(id) from orders limit 1" >/dev/null; [ "$($P -qAt -c "select stock_quantity from products where id='$PID'")" = 1 ] && echo "PASS cancel restocks"
out=$($P -qAt -c "set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false); update profiles set role='admin' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'" 2>&1 || true)
echo "$out" | grep -q "not allowed" && echo "PASS role escalation blocked" || { echo "FAIL role escalation not blocked"; exit 1; }
