-- Security foundation for the customer portal. Until now admin RLS was
-- `to authenticated using(true)`, which was safe only because just the team
-- could log in. The portal lets CUSTOMERS log in too, so "authenticated" can
-- no longer mean "admin". This migration ties admin access to an explicit
-- allowlist, so a logged-in customer gets nothing admin.
--
-- Model: an admins table + an is_admin() SECURITY DEFINER function (it reads
-- admins bypassing RLS). Every admin policy switches from using(true) to
-- using(is_admin()). Customers never read these tables directly; the portal
-- serves their own data through server routes (service role, filtered by the
-- customer's verified email). Public anon read on site_settings/site_links
-- stays (the build-time chrome fetch needs it).

create table if not exists public.admins (
  email      text primary key,
  name       text,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.admins where email = (auth.jwt() ->> 'email')
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- The admins list is readable/manageable only by admins.
drop policy if exists admins_admin_all on public.admins;
create policy admins_admin_all on public.admins
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.admins (email, name)
values ('shariful@vidiosa.com', 'Shariful Islam')
on conflict (email) do nothing;

-- orders / order_events / customers: admin read via is_admin()
drop policy if exists orders_admin_read on public.orders;
create policy orders_admin_read on public.orders
  for select to authenticated using (public.is_admin());

drop policy if exists order_events_admin_read on public.order_events;
create policy order_events_admin_read on public.order_events
  for select to authenticated using (public.is_admin());

drop policy if exists customers_admin_read on public.customers;
create policy customers_admin_read on public.customers
  for select to authenticated using (public.is_admin());

-- products: admin read + write via is_admin()
drop policy if exists products_admin_read on public.products;
create policy products_admin_read on public.products
  for select to authenticated using (public.is_admin());
drop policy if exists products_admin_insert on public.products;
create policy products_admin_insert on public.products
  for insert to authenticated with check (public.is_admin());
drop policy if exists products_admin_update on public.products;
create policy products_admin_update on public.products
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- videos: admin all via is_admin()
drop policy if exists "auth all videos" on public.videos;
create policy videos_admin_all on public.videos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- site_settings: keep anon read; admin read/write via is_admin()
drop policy if exists "auth read settings" on public.site_settings;
create policy site_settings_admin_read on public.site_settings
  for select to authenticated using (public.is_admin());
drop policy if exists "auth write settings" on public.site_settings;
create policy site_settings_admin_write on public.site_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- site_links: keep anon read; admin read/write via is_admin()
drop policy if exists "auth read links" on public.site_links;
create policy site_links_admin_read on public.site_links
  for select to authenticated using (public.is_admin());
drop policy if exists "auth write links" on public.site_links;
create policy site_links_admin_write on public.site_links
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
