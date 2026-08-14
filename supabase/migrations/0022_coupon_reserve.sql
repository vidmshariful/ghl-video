-- Atomic coupon redemption cap.
--
-- Before this, increment_coupon_redemption (0014) bumped the counter unguarded
-- at SETTLE time (after payment), while the cap was only READ-checked at
-- finalize. A burst of checkouts inside the seconds-long pay->webhook window all
-- read the same stale count and passed, over-redeeming a capped code. We now
-- RESERVE a slot atomically at finalize (before charging) with a guarded
-- conditional update, and release it if that checkout loses the insert race.
-- (increment_coupon_redemption is left in place but no longer called.)

-- Reserve one redemption slot. Returns true if a slot was claimed (or the code
-- is uncapped), false if the cap is already reached. Atomic: the conditional
-- UPDATE either bumps the counter or matches no row, with no read/modify gap.
create or replace function public.reserve_coupon_redemption(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed int;
begin
  update public.coupons
     set redemption_count = redemption_count + 1
   where code = p_code
     and active
     and (max_redemptions is null or redemption_count < max_redemptions)
  returning 1 into claimed;
  return claimed is not null;
end;
$$;

-- Release a previously reserved slot (never below zero): used when a reserved
-- checkout loses the concurrent insert race for the same PaymentIntent.
create or replace function public.release_coupon_redemption(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.coupons
     set redemption_count = greatest(redemption_count - 1, 0)
   where code = p_code;
$$;
