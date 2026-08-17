-- Offers, controlled from admin instead of from a deploy.
--
-- Until now, putting an offer in front of a signed-in client meant editing
-- copy in code and shipping it, which is slow enough that it never happens.
-- This makes an offer a row: write it, aim it, switch it on.
--
-- WHAT THIS TABLE IS NOT
-- ----------------------
-- It is not a second discount system. Coupons already own money: the percent
-- or amount off, which sku it applies to, when it is valid, how many times it
-- can be redeemed, and the atomic reservation that stops the cap being blown
-- by simultaneous checkouts. A campaign only ever NAMES a coupon code. Every
-- price question is still answered by the coupons table and re-derived on the
-- server at checkout, so an offer can never talk the money path into a
-- discount that does not exist.
--
-- So: a campaign is the message and the aim. The coupon is the money.
--
-- coupon_code is deliberately NOT a foreign key. An offer that names a coupon
-- somebody later deletes should go quiet, not block the delete or cascade a
-- surprise; the reader resolves the code and simply shows no discount when it
-- finds nothing. The admin screen flags that case rather than hiding it.
--
-- WHY AUDIENCE IS A COLUMN AND NOT A FILTER SOMEBODY REMEMBERS TO APPLY
-- --------------------------------------------------------------------
-- The point of the whole thing is specificity. A discount shown to everybody
-- is a price cut; the same discount shown to the twelve people who bought
-- once and never came back is a campaign. Making the aim part of the row
-- means an offer cannot be created without deciding who it is for.
--
--   all         everybody who logs in
--   customers   has at least one paid order
--   prospects   signed in, has never ordered
--   dormant     has ordered, but not within dormant_days
--
-- Audience is evaluated on the server from the caller's own account, never
-- sent by the browser, for the same reason prices are not.

create table if not exists public.campaigns (
  id            uuid primary key default gen_random_uuid(),

  title         text not null check (char_length(title) between 3 and 120),
  body          text check (char_length(body) <= 400),
  cta_label     text not null default 'See the offer'
                  check (char_length(cta_label) between 2 and 40),

  -- where the button goes. A sku sends them to /checkout/<sku>/; a bare path
  -- lets an offer point at the library or a sales page instead.
  target_sku    text,
  target_path   text,

  -- names a row in coupons. Not a foreign key, on purpose (see above).
  coupon_code   text,

  audience      text not null default 'all'
                  check (audience in ('all', 'customers', 'prospects', 'dormant')),
  -- only read when audience = 'dormant'
  dormant_days  int not null default 90 check (dormant_days between 7 and 730),

  starts_at     timestamptz,
  ends_at       timestamptz,
  -- highest wins when more than one offer fits the same person. One slot, one
  -- offer: showing three offers is showing none.
  priority      int not null default 0,
  active        boolean not null default false,

  -- deliberate actions only. Impressions would mean a write on every dashboard
  -- render for a number nobody acts on; the sales that came of it are counted
  -- already by the named coupon's redemption_count, which is the honest one.
  click_count   int not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint campaigns_window_makes_sense
    check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint campaigns_goes_somewhere
    check (target_sku is not null or target_path is not null)
);

comment on table public.campaigns is
  'Offers shown in the portal. The message and the aim; coupons own the money.';
comment on column public.campaigns.coupon_code is
  'Names a coupons.code. Not a foreign key: a deleted coupon should quiet the offer, not block the delete.';
comment on column public.campaigns.click_count is
  'Deliberate clicks only. Resulting sales are counted by the coupon redemption_count.';

-- The reader asks one question, every time: what is live for this person now.
create index if not exists campaigns_live_idx
  on public.campaigns (active, priority desc, starts_at, ends_at);

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

-- Default deny, like every table that touches selling. Reads go through the
-- portal API on the service role AFTER the caller's audience is worked out
-- server side; writes are admin only. No anon policy belongs here: the browser
-- must never be able to list offers it was not aimed at.
alter table public.campaigns enable row level security;

-- One atomic bump, so two clicks in the same moment both count. Runs as the
-- definer to stay reachable under default-deny RLS, and it can only ever add
-- one to a counter: there is nothing here worth attacking.
create or replace function public.campaign_clicked(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.campaigns set click_count = click_count + 1 where id = p_id;
$$;

revoke all on function public.campaign_clicked(uuid) from public;
