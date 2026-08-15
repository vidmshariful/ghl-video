-- 0030: the three-tier partnership program (per the August 2026 program
-- document, the source of truth).
--
-- `tier` separates partners by how they sell: 'affiliate' (open signup,
-- instant approval, 10/5), 'vip' (invitation only, 20/10, audience
-- discount, dedicated page), 'partnership' (contracted, 30/15, co-branded
-- page). Rates and cookie windows live in FirstPromoter campaigns and in
-- lib/partner-program.ts; this column only says which tier a partner is.
--
-- `review_at` is the VIP performance-review date (every six months per
-- the program rules); admin surfaces it when due.

alter table public.partners
  add column if not exists tier text not null default 'affiliate'
  check (tier in ('affiliate', 'vip', 'partnership'));

alter table public.partners
  add column if not exists review_at date;

-- Backfill: Jonah is the founding VIP (dedicated page + coupon); the demo
-- account mirrors him so the team previews the VIP experience. Everyone
-- else imported from FirstPromoter starts as an Affiliate Partner.
update public.partners set tier = 'vip' where ref in ('jonah', 'demo');
