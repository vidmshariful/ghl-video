-- The production line inside one custom video.
--
-- A custom explainer moves through six stations: script, voiceover, concept
-- and design, animation, sound, final delivery. The coarse status column
-- kept saying "in production" for four of those, which is exactly the
-- silence that makes a client nervous. The line lives as jsonb because the
-- shape belongs to lib/pipeline.ts (pure, unit tested) and every write goes
-- through it; the database stores, the library owns.
--
-- Only project videos carry a line. Order and editing-plan work keeps its
-- existing flow; null here simply means "not pipeline work".

alter table public.order_deliverables
  add column if not exists pipeline jsonb;

comment on column public.order_deliverables.pipeline is
  'Custom video production line: six stations with state, gate, file and date. Shape owned by lib/pipeline.ts. Null on non-project work.';

-- every existing project video starts with a fresh line
update public.order_deliverables
   set pipeline = '{}'::jsonb
 where project_id is not null
   and pipeline is null;
