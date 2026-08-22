-- A style guide can live somewhere else.
--
-- Most guides go to the HighLevel media library and reach the portal as a
-- link, which costs us no storage and is what the studio already does with
-- the rest of its collateral (owner decision, August 2026). Uploading is
-- kept for anything that should not sit on a public url, since a link from
-- that library is readable by anyone who has it, forever.
--
-- Either a stored file or a link, never neither.

alter table public.style_guide_docs
  add column if not exists external_url text;

-- checked when the link is saved and again when the studio opens the board,
-- so a guide quietly deleted at the far end is noticed by us and not by the
-- client
alter table public.style_guide_docs
  add column if not exists link_ok boolean;

alter table public.style_guide_docs
  add column if not exists link_checked_at timestamptz;

alter table public.style_guide_docs
  alter column path drop not null;

alter table public.style_guide_docs
  alter column filename drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'style_guide_docs_has_a_file'
  ) then
    alter table public.style_guide_docs
      add constraint style_guide_docs_has_a_file
      check (path is not null or external_url is not null);
  end if;
end $$;
