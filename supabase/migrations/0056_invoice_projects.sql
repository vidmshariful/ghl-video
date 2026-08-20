-- Invoices point at the work, not at a product invented to carry them.
--
-- Today raising an invoice mints a throwaway one_time product so there is
-- something to charge against, which is why the catalogue holds rows like
-- "Custom Explainer, 60 sec" and "Video Niche Customization 9x". That product
-- is still how payment runs (checkout needs something to sell, and the money
-- path is not worth reopening for this), but it is bookkeeping rather than a
-- thing we sell. What was missing is the link to the actual work.
--
-- With project_id, "which invoice was for what" is answerable from either
-- end, a project with a deposit and a balance shows both against one agreed
-- price, and the customer record can group them under the job instead of
-- listing them as unrelated charges.
--
-- parent_order_id stays exactly as it is. The two are different statements:
-- parent_order_id means "extra work on that order we already delivered", and
-- project_id means "part of this custom job". An invoice can honestly carry
-- one, the other, or neither.

alter table public.invoices
  add column if not exists project_id uuid references public.projects (id) on delete set null;

comment on column public.invoices.project_id is
  'The custom job this invoice bills for. Distinct from parent_order_id, which means extra work on a delivered order.';

create index if not exists invoices_project_idx
  on public.invoices (project_id) where project_id is not null;
