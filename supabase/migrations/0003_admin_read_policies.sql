-- Admin read access for the /admin panel. The admin is a client component
-- authenticated via Supabase Auth, so it reaches these tables with the
-- "authenticated" role. This grants it SELECT on the checkout tables,
-- matching the existing pattern used by videos/site_settings/site_links.
--
-- SECURITY NOTE: like the rest of the admin, this trusts that Supabase Auth
-- signups are DISABLED, so only invited admins can ever hold the
-- authenticated role. The public anon key still cannot read these tables
-- (no anon policy), and all writes to orders continue to run only through
-- the server-side service-role key in the webhook.

drop policy if exists orders_admin_read on public.orders;
create policy orders_admin_read on public.orders
  for select to authenticated using (true);

drop policy if exists order_events_admin_read on public.order_events;
create policy order_events_admin_read on public.order_events
  for select to authenticated using (true);

drop policy if exists customers_admin_read on public.customers;
create policy customers_admin_read on public.customers
  for select to authenticated using (true);

-- Products: admin needs to read them for the orders screen (product names)
-- and, next, to manage them. Read now; write policies land with the
-- products management screen.
drop policy if exists products_admin_read on public.products;
create policy products_admin_read on public.products
  for select to authenticated using (true);
