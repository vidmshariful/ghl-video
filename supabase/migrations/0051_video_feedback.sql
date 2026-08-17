-- One question after a video has been out in the world: did it do anything.
--
-- Idea #133, rated five stars. Three reasons this table earns its keep. It is
-- the only way we find out whether the product works, which nothing else
-- tells us. The good answers are testimonials, which are hard to collect any
-- other way. And asking at all is a mark of a studio that cares what happened
-- after the invoice cleared.
--
-- One row per VIDEO, not per order: a pack buyer approved nine videos and may
-- have nine different answers. The unique constraint is the no-nagging rule
-- made structural: a video that has been answered is never asked about again,
-- with one deliberate exception handled in code, "too early to tell" lets the
-- question come back a month later, because that answer is a rain check, not
-- an answer.
--
-- video_title and customer_email are denormalised on purpose. The whole point
-- of the harvest is reading it later without a three-table join, and a
-- testimonial must survive the deliverable it came from being renamed.

create table if not exists public.video_feedback (
  id              uuid primary key default gen_random_uuid(),
  deliverable_id  uuid not null unique
                    references public.order_deliverables (id) on delete cascade,
  order_id        uuid not null,
  customer_email  text not null,
  video_title     text not null,

  verdict         text not null
                    check (verdict in ('working', 'too_early', 'not_really', 'skipped')),
  note            text,

  created_at      timestamptz not null default now()
);

comment on table public.video_feedback is
  'The one-question ask after approval: did the video do anything for you. Good answers are testimonial candidates.';
comment on column public.video_feedback.verdict is
  'working | too_early (re-asked after 30 days) | not_really | skipped (never asked again)';

create index if not exists video_feedback_recent_idx
  on public.video_feedback (created_at desc);

-- Default deny. Clients write through the portal API on the service role,
-- after the route has proved the video is theirs. Admins read it directly
-- from the admin SPA, same as orders.
alter table public.video_feedback enable row level security;

drop policy if exists video_feedback_admin_read on public.video_feedback;
create policy video_feedback_admin_read on public.video_feedback
  for select to authenticated using (public.is_admin());
