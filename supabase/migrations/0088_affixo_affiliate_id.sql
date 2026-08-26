-- Affixo replaces FirstPromoter as the affiliate platform.
--
-- One column: the partner's affiliate id over there, the same job fp_promoter_id
-- did for FirstPromoter. Resolved from their email on first read and stored, so
-- every later call goes straight to the record instead of listing the whole
-- program to find one row.
--
-- The fp_* columns stay for now on purpose. They are the only record of who was
-- who in FirstPromoter, and until Affixo has run a full payout cycle they are
-- what we would reconcile against if a partner disputes a number. Drop them in a
-- later migration once nobody needs to look back.

alter table public.partners
  add column if not exists affixo_affiliate_id text;

comment on column public.partners.affixo_affiliate_id is
  'Affixo affiliate uuid. Auto-linked by email on first portal read.';
