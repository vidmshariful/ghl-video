-- Phase 3 of the products rebuild: one row per VIDEO inside an order.
--
-- Today an order points at a single product and carries a single delivery_url.
-- That works for a one video sale and falls apart for everything else: a nine
-- video pack has one link, and nobody can say which of the nine is finished.
-- This table is the missing middle. It is what Tanvir will drive from admin and
-- what the customer's My Videos tab will read.
--
-- Nothing reads it yet. This migration plus its backfill only build and prove
-- the foundation, the same way phase 1 did.

create table if not exists public.order_deliverables (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,

  -- Which catalog video this is. Null on purpose for a bundle slot that the
  -- customer has not filled in yet: the order is paid and the slot is owed,
  -- but the title is not chosen until intake.
  catalog_code text,

  -- Snapshotted at creation rather than joined. If we rename a video in the
  -- catalog next year, a customer's delivered list must keep the name they
  -- actually bought.
  title        text not null,
  category     text,

  -- Where it came from, so a pack can be shown in its advertised sections
  -- ("Master Explainer", "Feature set") rather than as a flat list.
  group_label  text,
  position     int not null default 0,

  -- Tanvir's board, in his words. queued -> in_production -> ready, then
  -- either revisions (client asked for a change) or approved (client signed
  -- off). revisions goes back to in_production and the round counter rises.
  status       text not null default 'queued'
    check (status in ('queued','in_production','ready','revisions','approved')),
  revision_round int not null default 0,

  -- The HighLevel mp4. Range requests work on those URLs, which is what makes
  -- scrubbing and timestamped comments possible later without another host.
  video_url    text,
  thumbnail_url text,
  note         text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  ready_at     timestamptz,
  approved_at  timestamptz
);

create index if not exists order_deliverables_order_idx
  on public.order_deliverables (order_id);
create index if not exists order_deliverables_status_idx
  on public.order_deliverables (status);

-- One slot per position within an order, so a re-run of the backfill or a
-- double webhook can never duplicate a customer's video list.
create unique index if not exists order_deliverables_order_position_idx
  on public.order_deliverables (order_id, position);

alter table public.order_deliverables enable row level security;

-- Money-adjacent, so default deny. Admins manage through the authenticated
-- client; customers read through the portal server routes on the service role,
-- filtered by their verified email, exactly like order_updates.
drop policy if exists order_deliverables_admin on public.order_deliverables;
create policy order_deliverables_admin on public.order_deliverables
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

comment on table public.order_deliverables is
  'One row per video owed on an order. Null catalog_code = a bundle slot the customer has not picked yet.';
