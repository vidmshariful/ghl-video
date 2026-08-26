-- Clients who brief us directly, with no quote in between.
--
-- Most custom work starts with a conversation about money: the client asks,
-- we scope it, we quote, they agree. That is the right shape for a one-off
-- and the wrong shape for a retainer. For a handful of accounts the deal is
-- already done and the rate is already agreed, so making them "request a
-- quote" for the eleventh video this quarter is friction we invented.
--
-- Off for everyone by default. It is turned on per client from their admin
-- record, because it is a commercial decision about that account and not a
-- feature anybody should be able to switch on for themselves.
alter table public.customers
  add column if not exists can_submit_projects boolean not null default false;

comment on column public.customers.can_submit_projects is
  'Retainer clients: they submit projects straight from the portal instead of requesting a quote. Off unless a deal is in place.';

-- The script, kept apart from the brief.
--
-- They are different documents doing different jobs: the brief says what the
-- video is for and who watches it, the script is the words that get recorded.
-- A client submitting their own work usually has the script written already,
-- and burying it inside the brief means an editor has to go hunting for the
-- one thing they actually need to read.
alter table public.projects
  add column if not exists script text;

comment on column public.projects.script is
  'The script for the video, as the client supplied it. Separate from brief, which is the context around it.';

-- Where a project came from, so the board can tell a client submission from
-- one the studio opened after a call. Only ever set at creation.
alter table public.projects
  add column if not exists source text
  check (source is null or source in ('studio', 'client'));

comment on column public.projects.source is
  'client = the client submitted it themselves from the portal. studio/null = we opened it.';
