-- What a client asked for, beside what we promised.
--
-- An editing client requests a video and names the date they want it. That is
-- their ask, not our commitment, and the two must not be the same column:
-- due_at is what the studio has promised and what the portal counts lateness
-- against, so writing a client's wish into it would make us late against a
-- date nobody agreed to.
--
-- requested_due_at is therefore separate and purely informational. The studio
-- sees it when scheduling and either meets it or sets a real date.

alter table public.order_deliverables
  add column if not exists requested_due_at timestamptz,
  add column if not exists requested_at     timestamptz;

comment on column public.order_deliverables.requested_due_at is
  'The date the client asked for. NOT a promise: due_at is what the studio committed to.';
comment on column public.order_deliverables.requested_at is
  'When the client asked. Set for subscription requests, null for work we created.';

-- Which plan a month''s allowance came from, so history explains itself after
-- somebody changes plan.
alter table public.subscription_cycles
  add column if not exists plan_sku text;

comment on column public.subscription_cycles.plan_sku is
  'The plan in force when this month opened. Allowances are copied, never read live, so a plan change cannot rewrite the past.';
