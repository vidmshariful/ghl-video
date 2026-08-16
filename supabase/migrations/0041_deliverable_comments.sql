-- Phase 6: feedback on a video, at the second it is about.
--
-- Until now a client asking for a change wrote it in chat or an email, and
-- somebody had to work out which of the nine videos they meant and roughly
-- where. A comment here belongs to one video and, optionally, to one moment in
-- it, which is the whole point of reviewing this way.
--
-- Comments are kept per revision round. When a client asks for changes the
-- round counter on the deliverable rises, so round one's notes stay readable
-- as history instead of being mixed into round two.

create table if not exists public.deliverable_comments (
  id              uuid primary key default gen_random_uuid(),
  deliverable_id  uuid not null references public.order_deliverables(id) on delete cascade,
  -- denormalised so every read can be scoped to the customer's own orders in
  -- one filter, without joining back through the deliverable each time
  order_id        uuid not null references public.orders(id) on delete cascade,

  author_side     text not null check (author_side in ('client', 'studio')),
  author_email    text not null,
  author_name     text,

  body            text not null check (length(btrim(body)) > 0),

  -- The moment in the video this is about. Null means a note on the whole
  -- video, which is a normal thing to write and must not be forced onto a
  -- timestamp.
  at_seconds      numeric(10, 2) check (at_seconds is null or at_seconds >= 0),

  -- which round of changes this note belongs to
  revision_round  int not null default 0,

  resolved_at     timestamptz,
  resolved_by     text,

  created_at      timestamptz not null default now()
);

create index if not exists deliverable_comments_deliverable_idx
  on public.deliverable_comments (deliverable_id, created_at);
create index if not exists deliverable_comments_order_idx
  on public.deliverable_comments (order_id);
create index if not exists deliverable_comments_open_idx
  on public.deliverable_comments (deliverable_id) where resolved_at is null;

alter table public.deliverable_comments enable row level security;

-- Default deny, like every table hanging off an order. Admins manage through
-- the authenticated client; clients read and write through the portal server
-- routes on the service role, scoped to their verified email.
drop policy if exists deliverable_comments_admin on public.deliverable_comments;
create policy deliverable_comments_admin on public.deliverable_comments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

comment on table public.deliverable_comments is
  'Feedback on one video, optionally pinned to a second in it. author_side says whether the client or the studio wrote it.';
comment on column public.deliverable_comments.at_seconds is
  'Null means a note on the whole video rather than a moment in it.';
