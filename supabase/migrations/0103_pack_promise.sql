-- A pack promises fourteen days from the brief (owner's decision, 16 September 2026).
--
-- The due date on every video is the brief's date plus the product's
-- delivery_days, seven when the product carries none. The AI First SaaS Pack
-- carried none, so nine videos were promised in the same seven days as one
-- and showed as late from day eight on every real order. The pack's own
-- number now lives in lib/content/premade.ts and reaches the products row
-- here, because packs are hand-created products the catalog sync never
-- rewrites. The catalog row carries the same number for the library page.
--
-- Idempotent: only a missing value is written. Nothing here changes row
-- security.

update public.products
set metadata = coalesce(metadata, '{}'::jsonb) || '{"delivery_days": 14}'::jsonb
where sku = 'pack-001'
  and (metadata ->> 'delivery_days') is null;

update public.catalog
set delivery_days = 14
where code = 'pack-001'
  and delivery_days is null;
