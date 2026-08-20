-- Editing plan work, run like production instead of like billing.
--
-- 0059 gave a plan client somewhere to ask for a video. It put the studio's
-- queue on the Subscriptions screen, which was wrong: a video request is
-- production work and belongs on a board with the rest of the production
-- work. This migration adds what a real editing SOP needs to run it there.
--
-- The rules it encodes, all owner decisions:
--
--  * A slot is spent when they ask, and handed back if the request is
--    cancelled. "2 of 4 left" always means "you can still ask for 2".
--  * A long form request may carry short form cuts taken from it. Each cut
--    is its own video with its own slot, review and approval, because that
--    is what it is: a separate job off the same footage. parent_id is how
--    a cut says which long form video it came from.
--  * The promise clock starts when the footage lands, not when they ask.
--    A client who requests on Monday and uploads on Thursday is not owed
--    from Monday, and without this every shop looks slow.

begin;

alter table public.order_deliverables
  -- the long form video a short cut was taken from
  add column if not exists parent_id uuid
    references public.order_deliverables (id) on delete cascade,

  -- what the editor actually needs, asked as fields rather than buried in
  -- a paragraph nobody can sort a queue by
  add column if not exists assets_url    text,
  add column if not exists reference_url text,
  add column if not exists aspect        text check (aspect in ('16:9','9:16','1:1')),
  add column if not exists target_seconds int check (target_seconds is null or target_seconds > 0),

  -- when usable footage actually arrived. Null means we are waiting, and
  -- the promised date is not owed yet.
  add column if not exists assets_ready_at timestamptz,

  -- who is cutting it
  add column if not exists assigned_admin_email text,

  -- the checklist that runs before a client ever sees a cut. Stored as
  -- keys rather than columns so the list can change without a migration.
  add column if not exists qc jsonb not null default '{}'::jsonb,

  -- Cancelled rather than deleted: the request stays readable and the slot
  -- goes back. Deliberately not a sixth status, because the five states are
  -- shared with premade and custom work and none of that can be cancelled
  -- by a client.
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_reason text;

comment on column public.order_deliverables.parent_id is
  'The long form video this short cut came from. Each cut still spends its own short form slot.';
comment on column public.order_deliverables.assets_ready_at is
  'When usable footage landed. The turnaround promise is measured from here, never from the request.';
comment on column public.order_deliverables.cancelled_at is
  'Set instead of deleting, so the request stays readable and its slot returns to the month.';

create index if not exists order_deliverables_parent_idx
  on public.order_deliverables (parent_id) where parent_id is not null;
create index if not exists order_deliverables_assigned_idx
  on public.order_deliverables (assigned_admin_email) where assigned_admin_email is not null;

-- A cut belongs to the same month as the video it came from, so it cannot
-- quietly count against a month the client never agreed to.
create or replace function public.deliverable_parent_same_cycle()
returns trigger language plpgsql as $$
declare parent_cycle uuid;
begin
  if new.parent_id is null then return new; end if;
  select cycle_id into parent_cycle from public.order_deliverables where id = new.parent_id;
  if parent_cycle is distinct from new.cycle_id then
    raise exception 'a cut must count against the same month as the video it came from';
  end if;
  return new;
end $$;

drop trigger if exists deliverable_parent_same_cycle on public.order_deliverables;
create trigger deliverable_parent_same_cycle
  before insert or update of parent_id, cycle_id on public.order_deliverables
  for each row execute function public.deliverable_parent_same_cycle();


-- How this client wants their footage cut. Not the Brand Kit, which is the
-- brand itself (logo, colours, how the name is said) and is shared with
-- premade work. This is the editing brief that stops being re-explained
-- every single month: intro and outro, captions, music, pacing, what never
-- to do, and the videos they want theirs to feel like.
create table if not exists public.editing_style_guides (
  id             uuid primary key default gen_random_uuid(),
  customer_email text not null unique,

  intro_outro    text,
  caption_style  text,
  music          text,
  pacing         text,
  broll          text,
  avoid          text,
  reference_urls text[] not null default '{}',
  asset_urls     text[] not null default '{}',
  default_aspect text check (default_aspect in ('16:9','9:16','1:1')),
  notes          text,

  updated_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.editing_style_guides is
  'One per editing client. Both sides read the same row: the client writes how they want it cut, the studio works to it.';

alter table public.editing_style_guides enable row level security;

-- Default deny, like every other table here. Both portals reach it through
-- the service role scoped to the acting account.
drop policy if exists editing_style_guides_admin on public.editing_style_guides;
create policy editing_style_guides_admin on public.editing_style_guides
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.touch_editing_style_guide()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists touch_editing_style_guide on public.editing_style_guides;
create trigger touch_editing_style_guide
  before update on public.editing_style_guides
  for each row execute function public.touch_editing_style_guide();

commit;
