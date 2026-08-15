-- 0026: the Journal, the platform's shared brain (admin -> Journal).
--
-- Three kinds of entry in one table:
--   log      - the build log: dated, plain-language records of what changed,
--              written at the end of every working session and on deploys.
--   decision - the decision register: what was decided, why, and its status.
--              Superseding a decision keeps the old card (status flips and
--              points at the newer seq), so the history of thinking survives.
--   idea     - the owner's inbox: thoughts jotted in admin the moment they
--              click; every Claude session reads the open ones first
--              (`node scripts/journal.mjs ideas`, see CLAUDE.md).
--
-- `seq` is the human-facing number (#42) used to reference and supersede.
-- Admins read/write via RLS from the Journal screen; Claude writes with the
-- service role through scripts/journal.mjs.
create table if not exists public.journal (
  id            uuid primary key default gen_random_uuid(),
  seq           bigint generated always as identity unique,
  kind          text not null check (kind in ('log', 'decision', 'idea')),
  title         text not null,
  body          text,
  -- decisions: active | superseded. ideas: open | planned | done | dropped.
  status        text check (status in ('active', 'superseded', 'open', 'planned', 'done', 'dropped')),
  superseded_by bigint references public.journal (seq),
  decided_on    date,
  author        text not null default 'claude',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists journal_kind_created_idx
  on public.journal (kind, created_at desc);

drop trigger if exists journal_set_updated_at on public.journal;
create trigger journal_set_updated_at
  before update on public.journal
  for each row execute function public.set_updated_at();

alter table public.journal enable row level security;

drop policy if exists journal_admin_all on public.journal;
create policy journal_admin_all
  on public.journal
  for all
  using (public.is_admin())
  with check (public.is_admin());
