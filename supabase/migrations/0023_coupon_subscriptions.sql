-- 0023: let a coupon also apply to the editing SUBSCRIPTION plans.
--
-- One-time products discount via the PaymentIntent (cents off, as before).
-- Subscriptions need a Stripe coupon object, so an admin opts a coupon in for
-- editing (sub_eligible) and picks how long the discount lasts on a recurring
-- plan (sub_duration). The matching Stripe coupon is created lazily from the
-- coupon's own percent/amount + duration and cached in stripe_coupon_id, so the
-- admin never touches Stripe. Existing coupons stay one-time-only until opted in.

alter table public.coupons
  add column if not exists sub_eligible boolean not null default false,
  add column if not exists sub_duration text,          -- once | forever | repeating
  add column if not exists sub_duration_months int,     -- set when repeating
  add column if not exists stripe_coupon_id text;        -- cached Stripe coupon (auto-managed)

alter table public.coupons drop constraint if exists coupons_sub_duration_ck;
alter table public.coupons add constraint coupons_sub_duration_ck
  check (sub_duration is null or sub_duration in ('once', 'forever', 'repeating'));
