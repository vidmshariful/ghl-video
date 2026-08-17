-- When something breaks, say so.
--
-- Until now a failure in the money path went to console.error, which lands in
-- the hosting logs and is read by nobody. The failure itself was handled well:
-- the webhook throws, Stripe re-delivers, and the retry usually lands. What
-- was missing is the case where it never lands, which looks identical from
-- the inside and is an emergency from the outside.
--
-- On grouping
-- -----------
-- `fingerprint` is unique, and a repeat increments `count` rather than
-- inserting a second row. That is the whole reason this table is readable: a
-- broken HighLevel token fails on every order for a day, and the owner should
-- see one line saying it happened 240 times, not 240 lines.
--
-- On resolution
-- -------------
-- Marking something resolved is a claim that it is fixed. If the same
-- fingerprint fires again the row re-opens, because a problem that comes back
-- is worse news than one that never left, and silently keeping it closed
-- would be the one failure this table exists to prevent.

create table if not exists public.alarms (
  id            uuid primary key default gen_random_uuid(),
  -- a stable slug for what broke: "webhook.fulfill_failed"
  kind          text not null check (length(btrim(kind)) > 0),
  severity      text not null default 'error'
                  check (severity in ('warn', 'error', 'critical')),
  -- one row per distinct problem; see the note on grouping above
  fingerprint   text not null unique,
  message       text not null,
  -- order id, intent id, whatever the handler knew at the time
  context       jsonb not null default '{}'::jsonb,
  count         int not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   text,
  -- when somebody was last told, so a storm cannot become 500 emails
  notified_at   timestamptz
);

-- The open list, newest trouble first. This is the query the admin screen runs.
create index if not exists alarms_open_idx
  on public.alarms (resolved_at, last_seen_at desc);

create index if not exists alarms_kind_idx on public.alarms (kind);

alter table public.alarms enable row level security;

-- Admin only. There is no anon policy and there must never be one: the context
-- column carries order ids, customer emails and failure detail.
drop policy if exists alarms_admin on public.alarms;
create policy alarms_admin on public.alarms
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

comment on table public.alarms is
  'Operational alarms. One row per distinct problem; repeats increment count. Written by lib/alarm.ts, read by admin -> Health.';
comment on column public.alarms.fingerprint is
  'Stable identity of a problem. Unique, so a repeat increments count instead of adding a row.';
comment on column public.alarms.notified_at is
  'Last time somebody was told. Used to throttle, so one broken thing cannot send an email per occurrence.';

-- Raise one alarm, atomically.
--
-- This is a function rather than a read-then-write in the application because
-- two webhook deliveries can land at the same instant. Both would read a count
-- of 3 and both would write 4, and the count is the number the owner uses to
-- decide whether something is a blip or an emergency. Incrementing from the
-- stored value inside one statement makes that impossible.
--
-- Deliberately NOT security definer: this is called with the service-role key
-- from server code, which does not need it, and granting it would let any
-- authenticated caller write rows the RLS policy above is meant to gate.
create or replace function public.raise_alarm(
  p_kind        text,
  p_severity    text,
  p_fingerprint text,
  p_message     text,
  p_context     jsonb
)
returns table (alarm_count int, last_notified timestamptz, was_reopened boolean)
language plpgsql
as $$
declare
  v_was_resolved boolean := false;
begin
  -- Read the prior state so the caller can be told this problem came back.
  -- Racy in theory: two callers can both see "resolved" and both report the
  -- reopening. That costs one duplicate notification and is the harmless
  -- direction to be wrong in.
  select (a.resolved_at is not null) into v_was_resolved
    from public.alarms a where a.fingerprint = p_fingerprint;

  insert into public.alarms (kind, severity, fingerprint, message, context)
  values (p_kind, p_severity, p_fingerprint, p_message, p_context)
  on conflict (fingerprint) do update set
    count        = alarms.count + 1,
    last_seen_at = now(),
    message      = excluded.message,
    context      = excluded.context,
    severity     = excluded.severity,
    -- a problem that came back is open again, whatever anybody claimed
    resolved_at  = null,
    resolved_by  = null,
    -- and it is allowed to speak immediately rather than wait out the throttle
    notified_at  = case when alarms.resolved_at is not null
                        then null else alarms.notified_at end;

  return query
    select a.count, a.notified_at, coalesce(v_was_resolved, false)
      from public.alarms a where a.fingerprint = p_fingerprint;
end;
$$;

comment on function public.raise_alarm is
  'Upsert an alarm by fingerprint, incrementing count atomically. Re-opens anything previously resolved. Called by lib/alarm.ts.';
