-- Invoices grow up: many jobs on one bill, quantities, and a discount.
--
-- One invoice often covers two or three custom projects at once, and a line
-- is frequently "3 x reel" rather than a single lump. The existing
-- project_id stays as the primary job an invoice belongs to, so nothing
-- that reads it breaks; project_ids carries the full set.
--
-- Line items keep their existing shape, {description, amount_cents}, and
-- gain optional quantity and unit_cents. amount_cents remains the line
-- TOTAL, so every screen that already renders invoices keeps working
-- without knowing quantities exist.

alter table public.invoices
  add column if not exists project_ids uuid[] not null default '{}',
  add column if not exists subtotal_cents integer,
  add column if not exists discount_kind text
    check (discount_kind is null or discount_kind in ('percent', 'flat')),
  add column if not exists discount_value integer
    check (discount_value is null or discount_value >= 0);

comment on column public.invoices.project_ids is
  'Every custom project this invoice bills. project_id stays as the first of them.';
comment on column public.invoices.subtotal_cents is
  'The lines before any discount. total_cents stays the amount actually charged.';

-- an invoice written before this migration bills exactly the job it named
update public.invoices
   set project_ids = array[project_id]
 where project_id is not null
   and project_ids = '{}';

update public.invoices set subtotal_cents = total_cents where subtotal_cents is null;
