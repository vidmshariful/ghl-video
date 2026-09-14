-- A refund reaches HighLevel's ledger (audit, 15 September 2026).
--
-- The order trigger queued a sale for HighLevel only when the order became
-- paid, so an order refunded afterwards (Stripe's charge.refunded, the admin
-- refund, a lost dispute) changed nothing over there: the paid invoice
-- recorded on the contact stayed paid for good. The same trigger now also
-- queues the order when it becomes refunded. The sync's order handler reads
-- the live row: HighLevel's invoice API has no refund call, so it voids the
-- invoice if it was never paid there and writes one note on the contact
-- saying what went back and when, marked in orders.metadata so a retry
-- never writes a second one.
--
-- No new table; nothing here changes row security.

create or replace function public.hl_order_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    perform public.hl_enqueue('order', new.id, 'paid');
  elsif new.status = 'refunded' and (tg_op = 'INSERT' or old.status is distinct from 'refunded') then
    perform public.hl_enqueue('order', new.id, 'refunded');
  end if;
  return new;
end $$;

drop trigger if exists hl_order_paid on public.orders;
create trigger hl_order_paid
  after insert or update of status on public.orders
  for each row execute function public.hl_order_paid();
