-- Two more kinds of journal entry, for the team to raise themselves:
--
--   bug     - something is broken. Reported in admin, worked through the
--             same open / planned / done / dropped lifecycle as an idea.
--   feature - a new feature request. Same lifecycle.
--
-- Both reuse the idea status vocabulary that already exists, so nothing about
-- the status column changes. Only the kind check widens.

alter table public.journal
  drop constraint if exists journal_kind_check;

alter table public.journal
  add constraint journal_kind_check
  check (kind in ('log', 'decision', 'idea', 'bug', 'feature'));
