do $$ begin
  begin create role anon nologin; exception when duplicate_object then null; end;
  begin create role authenticated nologin; exception when duplicate_object then null; end;
  begin create role service_role nologin bypassrls; exception when duplicate_object then null; end;
end $$;
create schema auth; create schema storage;
create table auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
create table storage.buckets(id text primary key, name text, public boolean);
create table storage.objects(id uuid default gen_random_uuid(), bucket_id text); alter table storage.objects enable row level security;
create publication supabase_realtime;
-- Real Supabase grants these by default on the public schema:
-- (run AFTER schema.sql)  grant usage on schema public, auth to anon, authenticated, service_role;
--   grant all on all tables in schema public to anon, authenticated, service_role;
--   grant execute on function auth.uid(), auth.role(), public.is_admin() to anon, authenticated;
