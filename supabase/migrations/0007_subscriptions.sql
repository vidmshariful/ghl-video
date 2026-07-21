-- Subscriptions (editing plans). Mirrors the Stripe subscription so the
-- portal and admin can show status without hitting Stripe on every load;
-- the Stripe webhook keeps it in sync. Admin-only to the client (is_admin);
-- customers read their own via the portal server routes (service role).
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  customer_id            uuid references public.customers(id),
  customer_email         text not null,
  product_id             uuid references public.products(id),
  stripe_subscription_id text unique,
  stripe_customer_id     text,
  status                 text not null default 'incomplete',
  plan_name              text,
  amount_cents           integer,
  currency               text not null default 'usd',
  interval               text not null default 'month',
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  metadata               jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists subscriptions_email_idx on public.subscriptions (customer_email);
create index if not exists subscriptions_stripe_idx on public.subscriptions (stripe_subscription_id);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_admin_read on public.subscriptions;
create policy subscriptions_admin_read on public.subscriptions
  for select to authenticated using (public.is_admin());
