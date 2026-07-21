-- Tighten products RLS. The original public-read policy granted anon SELECT
-- on EVERY column of active products, which exposed the metadata JSONB
-- (hl_tags, upsell_sku, bump config, delivery_days) to any holder of the
-- public anon key via direct PostgREST access. Nothing client-side reads
-- the products table: the checkout reads it server-side with the
-- service-role key (which bypasses RLS), and the marketing pages use the
-- static lib/site.ts data. So drop the public policy and leave products
-- default-deny to anon, like orders and customers.
drop policy if exists products_public_read on public.products;
