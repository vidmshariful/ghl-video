-- The brief asks for what the studio asked for by email (Premade review,
-- 16 September 2026).
--
-- On every real pack the producer wrote to the client to confirm which
-- website the videos were for, and the site has promised a choice of
-- voiceover accent and niche tailoring that the brief never collected. The
-- three now live on the account's kit like the rest of the brand, so a
-- second order starts with them filled in. The per-order brief keeps its
-- own copy in orders.metadata.intake, as it does for every other field.
--
-- Idempotent. No new table; nothing here changes row security.

alter table public.brand_kits
  add column if not exists website text,
  add column if not exists voice_accent text,
  add column if not exists niche text;

comment on column public.brand_kits.website is
  'The client''s website, normalised to an https address.';
comment on column public.brand_kits.voice_accent is
  'The voiceover accent they chose: American, British, Australian or No preference.';
comment on column public.brand_kits.niche is
  'Who they sell to, and what to swap, when niche customisation was bought.';
