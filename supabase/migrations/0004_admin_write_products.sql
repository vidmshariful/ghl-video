-- Products management from /admin. Grants the authenticated (admin) role
-- INSERT and UPDATE on products so the Products & Pricing screen can add
-- and edit SKUs. No DELETE: products are deactivated (active=false), never
-- hard-deleted, because orders reference them. Same trust model as the rest
-- of the admin (Supabase Auth signups must be disabled).

drop policy if exists products_admin_insert on public.products;
create policy products_admin_insert on public.products
  for insert to authenticated with check (true);

drop policy if exists products_admin_update on public.products;
create policy products_admin_update on public.products
  for update to authenticated using (true) with check (true);
