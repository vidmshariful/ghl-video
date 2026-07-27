-- 0014: coupon codes for the native checkout.
--
-- A coupon is either percent_off or a flat amount_off_cents (exactly
-- one), optionally scoped to a single sku, with an optional validity
-- window and redemption cap, plus an active kill switch. Validation
-- and pricing happen ONLY server-side (lib/checkout/coupons.ts inside
-- /api/checkout/finalize); the client never computes a discount that
-- gets charged. The public can never read this table: guesses go
-- through the rate-limited validate endpoint.

create table if not exists public.coupons (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique
                   check (code = upper(code) and char_length(code) between 3 and 32),
  percent_off      int check (percent_off between 1 and 90),
  amount_off_cents int check (amount_off_cents > 0),
  sku              text,                       -- null = applies to any product
  valid_from       timestamptz,
  valid_until      timestamptz,
  max_redemptions  int check (max_redemptions > 0),
  redemption_count int not null default 0,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint coupons_one_discount_kind
    check (num_nonnulls(percent_off, amount_off_cents) = 1)
);

drop trigger if exists coupons_set_updated_at on public.coupons;
create trigger coupons_set_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

alter table public.coupons enable row level security;

-- admins manage coupons from /admin; checkout reads with the service
-- role (bypasses RLS). No anon policies on purpose.
drop policy if exists coupons_admin_all on public.coupons;
create policy coupons_admin_all
  on public.coupons
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- called once per paid order by the settle path (bookkeeping)
create or replace function public.increment_coupon_redemption(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.coupons
     set redemption_count = redemption_count + 1
   where code = p_code;
$$;
