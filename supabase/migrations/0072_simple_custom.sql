-- The simple custom model (owner decision, 21 August 2026).
--
-- A project IS the video. The board becomes a list with the studio's own
-- categories, the six-station production line moves from per-video to the
-- project itself, and the rows under a project stop being "videos" and
-- become the extra formats cut after the main video is approved: the
-- reels, the shorts, the square crops.
--
-- One deliverable row per project stays special: category 'main' is the
-- invisible carrier for the main video's drafts, timestamped review notes
-- and revision count, so none of that machinery had to move tables.

-- 1. the list's categories replace the board's columns
alter table public.projects drop constraint if exists projects_status_check;
update public.projects set status = 'backlog'     where status = 'scoped';
update public.projects set status = 'in_progress' where status = 'in_production';
update public.projects set status = 'approved'    where status = 'delivered';
alter table public.projects add constraint projects_status_check
  check (status in ('backlog','planning','in_progress','review','revision','approved','cutdowns','closed','cancelled'));

-- 2. the production line and the tags live on the project now
alter table public.projects
  add column if not exists pipeline jsonb not null default '{}'::jsonb,
  add column if not exists tags text[] not null default '{}';

comment on column public.projects.pipeline is
  'The six-station production line for the main video. Shape owned by lib/pipeline.ts.';

-- 3. what each project video row now IS: the main carrier, or a format
update public.order_deliverables
   set category = case when position = 0 then 'main' else 'format' end
 where project_id is not null
   and (category is null or category not in ('main','format'));

-- 4. the line a video already carried becomes the project's line
update public.projects p
   set pipeline = d.pipeline
  from public.order_deliverables d
 where d.project_id = p.id
   and d.position = 0
   and d.pipeline is not null
   and p.pipeline = '{}'::jsonb;
