-- Invoice numbers are GV-<8 hex chars> derived from the order UUID (32 bits
-- of entropy), display-only but shown on customer invoices. Enforce
-- uniqueness so a birthday collision surfaces as a loud insert error to fix,
-- instead of two customers silently holding the same invoice number.
--
-- Partial index: pending orders have no invoice number yet (null), and
-- Postgres unique indexes ignore nulls anyway; the predicate keeps that
-- explicit.
--
-- If this ever fails to apply, two orders already share a number: resolve by
-- updating one row's invoice_number to a fresh GV- value, then re-run.
--
-- Apply: npm run migrate (or paste into the Supabase SQL editor). Safe to
-- re-run.

create unique index if not exists orders_invoice_number_key
  on public.orders (invoice_number)
  where invoice_number is not null;
