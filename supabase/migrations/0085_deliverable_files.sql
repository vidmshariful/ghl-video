-- Attachments on an editing request, in the table that already holds them.
--
-- Custom projects have had a shared file list since 0082: the client hands us
-- a logo or a screenshot, we hand them a reference, and both sides see one
-- list. An editing request needed exactly the same thing and had nowhere to
-- put it, so a client with a logo to use in their video was emailing it.
--
-- A SECOND TABLE, OR THIS ONE
-- ---------------------------
-- A sibling deliverable_files table would have been the smaller migration and
-- the bigger mistake: two tables describing "a file somebody attached", with
-- two helpers, two sets of rules about what may be uploaded, and two places
-- to fix the next time the size limit or the allowed types change. This repo
-- has been bitten by exactly that shape before. So the owner column becomes
-- one of two, and the code above it keeps one set of rules.
--
-- project_id therefore stops being NOT NULL, and a check keeps every row
-- owned by exactly one thing. The bucket, the RLS posture and the 10 MB
-- ceiling are unchanged: still private, still default-deny, still only ever
-- read or written by server code holding the service-role key.
alter table public.project_files
  add column if not exists deliverable_id uuid
    references public.order_deliverables (id) on delete cascade;

alter table public.project_files
  alter column project_id drop not null;

-- exactly one owner, never both and never neither
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'project_files_one_owner'
  ) then
    alter table public.project_files
      add constraint project_files_one_owner
      check ((project_id is null) <> (deliverable_id is null));
  end if;
end $$;

create index if not exists project_files_deliverable_idx
  on public.project_files (deliverable_id, created_at desc);

comment on table public.project_files is
  'Attachments shared between the client and the studio, on a custom project OR an editing request. Exactly one owner column is set. Bytes live in the private project-files bucket; this row names one.';

comment on column public.project_files.deliverable_id is
  'Set when the file belongs to an editing request rather than a custom project.';
