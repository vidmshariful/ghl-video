-- Every recurring payment, so the money list is the whole story.
--
-- One-time sales are recorded as orders, and a subscription had only its
-- START recorded, which meant a plan billing month after month showed up
-- once and never again. The transactions list was therefore missing the one
-- stream that actually repeats.
--
-- WHY NOT invoice.paid
-- -------------------
-- The obvious source is Stripe's invoice.paid event, but subscribing to it
-- means a change in the Stripe dashboard, and one already-subscribed event
-- carries the same fact: a plan's monthly charge fires
-- payment_intent.succeeded exactly like any other payment. The webhook
-- already recognises those (it has to, or they raise a false "money with no
-- order" alarm), so the recognition simply writes a row now instead of only
-- logging. Nothing to configure, and no window where payments are missed
-- because a setting was not flipped.
--
-- stripe_payment_intent_id is unique, which makes the whole thing idempotent:
-- Stripe re-delivers events freely, and a redelivery must never double-count
-- revenue.

create table if not exists public.subscription_payments (
  id                       uuid primary key default gen_random_uuid(),
  subscription_id          uuid references public.subscriptions (id) on delete set null,
  customer_email           text not null,

  amount_cents             integer not null check (amount_cents >= 0),
  currency                 text not null default 'usd',
  stripe_payment_intent_id text not null unique,
  stripe_invoice_id        text,
  plan_name                text,

  paid_at                  timestamptz not null default now(),
  created_at               timestamptz not null default now()
);

comment on table public.subscription_payments is
  'One row per recurring charge that actually succeeded. Unique on the intent, so a redelivered webhook cannot double-count.';

create index if not exists subscription_payments_paid_idx
  on public.subscription_payments (paid_at desc);
create index if not exists subscription_payments_email_idx
  on public.subscription_payments (customer_email);

alter table public.subscription_payments enable row level security;

drop policy if exists subscription_payments_admin_read on public.subscription_payments;
create policy subscription_payments_admin_read on public.subscription_payments
  for select to authenticated using (public.is_admin());
