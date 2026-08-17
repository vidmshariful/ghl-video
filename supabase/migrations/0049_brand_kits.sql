-- The brand, given once instead of on every order.
--
-- Brand details have always lived on the ORDER, inside orders.metadata.intake.
-- That made a second order mean filling the same brief again: same logo, same
-- colours, same notes about how the name is said. It also meant the studio had
-- to open an order to find out what a client's brand even was, and that two
-- orders from the same client could quietly disagree about it.
--
-- So it moves onto the account. Given once, attached to everything after. That
-- is the whole reason a repeat order can become fast: with the brand already
-- known, ordering again is choose, confirm, pay.
--
-- ONE KIT PER ACCOUNT, ON PURPOSE
-- -------------------------------
-- The unique constraint on customer_id is the decision, not an accident. An
-- agency running three products under one login cannot keep them apart, and
-- that limit was written down when the portal blueprint was locked. Adding a
-- second brand later means teaching every order, video and brief which brand
-- it belongs to, which is a genuinely large retrofit. The constraint is here
-- so that day arrives as a migration somebody plans, rather than as duplicate
-- rows nobody notices.
--
-- What stays on the order: which videos a client picked for a bundle. That is
-- a fact about one purchase, not about the brand.

create table if not exists public.brand_kits (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null unique
                    references public.customers (id) on delete cascade,

  brand_name      text,
  primary_color   text,
  accent_color    text,
  -- how to say the name out loud, for voiceover
  pronunciation   text,
  notes           text,
  -- paths in the private `intake` bucket, same as the brief has always used
  logo_path       text,
  screenshot_paths text[] not null default '{}',

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.brand_kits is
  'One brand per customer account. Filled once, used on every order after. See migration notes on why it is one and not many.';

alter table public.brand_kits enable row level security;

-- Default deny, and served through the service role after a route has checked
-- the session email owns this customer. Same shape as order_deliverables:
-- there is no anon policy and there must never be one, because a logo path
-- plus a client list is a competitor's research done for them.
drop policy if exists brand_kits_admin on public.brand_kits;
create policy brand_kits_admin on public.brand_kits
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop trigger if exists brand_kits_set_updated_at on public.brand_kits;
create trigger brand_kits_set_updated_at
  before update on public.brand_kits
  for each row execute function public.set_updated_at();

-- ---- backfill from the briefs already collected ----
--
-- Every client who has ever submitted a brief already told us their brand. It
-- would be rude to ask again, and an empty kit on a client of two years would
-- read as the system forgetting them.
--
-- distinct on takes their MOST RECENT brief, because a brand that changed
-- should land on the newer answer. Runs once; the conflict clause makes a
-- re-run harmless.
insert into public.brand_kits (
  customer_id, brand_name, primary_color, accent_color,
  pronunciation, notes, logo_path, screenshot_paths
)
select distinct on (o.customer_id)
  o.customer_id,
  nullif(o.metadata->'intake'->>'brandName', ''),
  nullif(o.metadata->'intake'->>'primaryColor', ''),
  nullif(o.metadata->'intake'->>'accentColor', ''),
  nullif(o.metadata->'intake'->>'brandPronunciation', ''),
  nullif(o.metadata->'intake'->>'notes', ''),
  nullif(o.metadata->'intake'->>'logoPath', ''),
  case
    when jsonb_typeof(o.metadata->'intake'->'screenshotPaths') = 'array'
      then coalesce(
        array(select jsonb_array_elements_text(o.metadata->'intake'->'screenshotPaths')),
        '{}'::text[]
      )
    else '{}'::text[]
  end
from public.orders o
where o.customer_id is not null
  and jsonb_typeof(o.metadata->'intake') = 'object'
order by o.customer_id, o.created_at desc
on conflict (customer_id) do nothing;
