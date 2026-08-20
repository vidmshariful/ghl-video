-- Every email the platform tries to send, recorded.
--
-- Every send is fail-soft on purpose: a broken email must never break the
-- order or the action that triggered it. The cost of that design was that
-- failures went to a server console nobody reads, so "did the client get
-- the video-ready email" had no answer, and a missing BREVO_API_KEY could
-- silently no-op every email on the platform with nothing visible anywhere.
-- This table is where that silence becomes a screen.
--
-- One row per ATTEMPT, including the ones that never reached Brevo:
--   sent     accepted by Brevo
--   failed   tried and refused (the error says why)
--   skipped  never tried: no API key, or the template is disabled
--   held     the client's own email preferences held it back

begin;

create table if not exists public.email_log (
  id           uuid primary key default gen_random_uuid(),
  to_email     text not null,
  to_name      text,
  subject      text not null,
  -- which template, when one was used (video_ready, order_confirmation...)
  template_key text,
  -- which door it left through: template, campaign, order-update, test...
  source       text not null default 'direct',
  status       text not null check (status in ('sent','failed','skipped','held')),
  error        text,
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

comment on table public.email_log is
  'One row per email attempt, sent or not. The log exists because sends are fail-soft: without it a failure is invisible by design.';

create index if not exists email_log_created_idx on public.email_log (created_at desc);
create index if not exists email_log_status_idx on public.email_log (status, created_at desc);
create index if not exists email_log_to_idx on public.email_log (to_email);

alter table public.email_log enable row level security;

drop policy if exists email_log_admin on public.email_log;
create policy email_log_admin on public.email_log
  for all using (public.is_admin()) with check (public.is_admin());

commit;
