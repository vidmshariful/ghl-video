-- Quotes get their own numbers. They had been drawing from the invoice
-- sequence (0098), so every quote left a gap in the invoice numbering
-- (audit, 15 September 2026). The new sequence starts past any quote
-- number already issued, so numbers never repeat.
create sequence if not exists public.quote_number_seq start with 1001;
select setval(
  'public.quote_number_seq',
  greatest(1000, coalesce((select max(nullif(regexp_replace(number, '\D', '', 'g'), '')::bigint) from public.quotes where number like 'Q-%'), 1000)) + 1,
  false
);
alter table public.quotes alter column number set default ('Q-' || nextval('public.quote_number_seq'));
