-- 0025: link coupons to affiliate partners.
--
-- The coupon is now the ONE discount rail for the partner program: partner
-- landing-page buy buttons carry ?code=<their coupon> (auto-applied at
-- checkout), and everyone else types it. A coupon row with partner_id set
-- belongs to that partner and is managed from the admin Coupons screen's
-- Partner tab; deleting the partner leaves the coupon standing (set null)
-- so past orders and stats keep their context.
alter table public.coupons
  add column if not exists partner_id uuid references public.partners (id) on delete set null;

create index if not exists coupons_partner_id_idx
  on public.coupons (partner_id)
  where partner_id is not null;

-- Jonah's existing JONAH10 belongs to his partner row.
update public.coupons c
   set partner_id = p.id
  from public.partners p
 where c.code = 'JONAH10'
   and p.ref = 'jonah'
   and c.partner_id is null;
