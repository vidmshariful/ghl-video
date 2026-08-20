-- A third state for a client's portal sections: disabled.
--
-- Hidden removes a section from the menu entirely. Disabled keeps it
-- visible but locked: greyed out, not clickable, with a line on hover
-- saying it is switched off for this account. The difference matters
-- commercially: hidden says this does not exist, disabled says this
-- exists and you do not have it, which is a doorway, not a wall.
--
-- A key in both lists behaves as hidden; the admin control keeps the two
-- exclusive so that case should not arise.

begin;

alter table public.customers
  add column if not exists disabled_sections text[] not null default '{}';

comment on column public.customers.disabled_sections is
  'Portal sections shown but locked for this client. Distinct from hidden_sections, which removes them from the menu entirely.';

commit;
