-- Two gaps the owner found in the review layer.
--
-- 1. Uploading a new cut overwrote the old link. The old cut was gone, and a
--    client's note about 0:12 then pointed at a different video where 0:12 is
--    something else. Every cut is now kept, and a note records which cut it was
--    written about. The team clears old cuts by hand once a video is approved
--    (owner's decision): nothing deletes itself.
--
-- 2. The studio could only reply to a video, not to a note. An answer to "the
--    logo at 0:12" read as a general remark. Notes can now carry replies.

create table if not exists public.deliverable_versions (
  id             uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.order_deliverables(id) on delete cascade,
  order_id       uuid not null references public.orders(id) on delete cascade,

  -- 1, 2, 3 as the client counts them, not a database id
  version        int not null check (version > 0),
  video_url      text not null,
  -- what changed in this cut, shown to the client
  note           text,
  created_by     text,
  created_at     timestamptz not null default now(),

  unique (deliverable_id, version)
);

create index if not exists deliverable_versions_deliverable_idx
  on public.deliverable_versions (deliverable_id, version desc);

alter table public.deliverable_versions enable row level security;

drop policy if exists deliverable_versions_admin on public.deliverable_versions;
create policy deliverable_versions_admin on public.deliverable_versions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Which cut a note was written about. Null for notes that predate versions.
alter table public.deliverable_comments
  add column if not exists version int,
  -- one level of nesting: a reply answers a note, and replies do not nest
  -- further. A studio that needs threads inside threads has a different
  -- problem than this screen can solve.
  add column if not exists parent_id uuid
    references public.deliverable_comments(id) on delete cascade;

create index if not exists deliverable_comments_parent_idx
  on public.deliverable_comments (parent_id);

-- Backfill: every video that already has a link becomes its own version 1, so
-- the history starts complete rather than starting empty for live orders.
insert into public.deliverable_versions (deliverable_id, order_id, version, video_url, created_at)
select d.id, d.order_id, 1, d.video_url, coalesce(d.ready_at, d.updated_at)
  from public.order_deliverables d
 where d.video_url is not null
   and not exists (
     select 1 from public.deliverable_versions v where v.deliverable_id = d.id
   );

comment on table public.deliverable_versions is
  'Every cut of a video, oldest first. order_deliverables.video_url stays the current one.';
comment on column public.deliverable_comments.parent_id is
  'Set when this note is a reply to another note. One level only.';
