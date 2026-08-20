-- What a client wants to be emailed about.
--
-- Every notification was on for everybody. The client who wants telling the
-- second a cut lands and the client who wants to be left alone until it
-- matters were the same client to us, and the only lever either of them had
-- was the spam button.
--
-- Two switches, not twelve. A preference screen with a row per template is a
-- screen nobody finishes reading, and it makes every new email a new decision
-- somebody has to make about a thing they have not seen yet.
--
-- Money and access are deliberately NOT optional. An invoice, a failed
-- payment, a price change and a login are things somebody must be told about
-- whatever they have switched off, so they are not offered as a choice at
-- all rather than offered and then quietly ignored.

begin;

alter table public.customers
  add column if not exists email_prefs jsonb not null default '{}'::jsonb;

comment on column public.customers.email_prefs is
  'Client email choices, by category. Absent key means on: a new category must never arrive switched off for everybody who signed up before it existed.';

commit;
