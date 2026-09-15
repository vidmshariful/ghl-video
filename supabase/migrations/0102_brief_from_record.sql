-- The brief flag follows the brief (Premade review, 16 September 2026).
--
-- orders.intake_completed was set by the intake route alongside the brief it
-- wrote into orders.metadata.intake. One production order (paid 28 July)
-- carries a full brief, logo and screenshots included, with the flag still
-- false: the studio saw "Waiting on brief", no due dates were stamped, and
-- the client was reminded about a brief he had already sent. Every reader of
-- the flag (the queue, the chase, the portal, the mirror) would need the same
-- fallback, so the flag is derived here instead: whenever a row carries a
-- submitted brief, the flag is true and the timestamp is the brief's own.
--
-- Idempotent. No new table; nothing here changes row security.

create or replace function public.orders_brief_from_record()
returns trigger
language plpgsql
as $$
declare
  submitted text := new.metadata #>> '{intake,submittedAt}';
begin
  if submitted is not null and submitted <> '' then
    new.intake_completed := true;
    if new.intake_completed_at is null then
      begin
        new.intake_completed_at := submitted::timestamptz;
      exception when others then
        new.intake_completed_at := now();
      end;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists orders_brief_from_record on public.orders;
create trigger orders_brief_from_record
  before insert or update of metadata, intake_completed, intake_completed_at on public.orders
  for each row execute function public.orders_brief_from_record();

-- The one order already in that state, and any other the same way.
update public.orders
set intake_completed = true,
    intake_completed_at = coalesce(
      intake_completed_at,
      nullif(metadata #>> '{intake,submittedAt}', '')::timestamptz
    )
where intake_completed = false
  and nullif(metadata #>> '{intake,submittedAt}', '') is not null;
