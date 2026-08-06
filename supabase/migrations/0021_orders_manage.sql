-- Orders "Manage" rework: an archive flag to keep the pipeline clean, and a
-- link from an invoice to a parent order so an "extra work" invoice nests under
-- the original order instead of appearing as a separate order.

alter table public.orders
  add column if not exists archived boolean not null default false;

create index if not exists orders_archived_idx on public.orders (archived)
  where archived = false;

-- An invoice can attach to a parent order (extra work on an existing project).
-- Its own payment still runs through the normal invoice -> product -> order
-- path; this link is only for grouping it under the parent in the admin.
alter table public.invoices
  add column if not exists parent_order_id uuid references public.orders(id) on delete set null;

create index if not exists invoices_parent_order_idx on public.invoices (parent_order_id)
  where parent_order_id is not null;
