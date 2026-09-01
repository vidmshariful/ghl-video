-- The SEO screen's Google toggle could only ever hide a page, never show one.
--
-- `noindex` was `boolean not null default false`, and lib/seo.ts only acted on
-- it when true. So false did not mean "show this page", it meant "nobody has
-- said anything". There was no way to express "show this page even though its
-- code says otherwise", which is why /blog/ sat noindexed for months with a
-- comment promising this override could turn it back on. It could not.
--
-- Three states now:
--   null   nobody has said anything, use whatever the page itself says
--   true   hide from Google, whatever the page says
--   false  show to Google, whatever the page says
--
-- RUN THIS BEFORE THE CODE DEPLOYS. In this order it is safe both ways: the
-- old code reads null as falsy and treats it as "not set", exactly as it
-- treated false. The other order is not safe. Deployed against the old column,
-- every existing false row would read as "force index", which could reveal a
-- page that is meant to stay hidden.
--
-- The backfill is the important line. Every existing false means "not set",
-- so it becomes null. Existing trues keep meaning hide. No page changes its
-- behaviour when this runs.

alter table public.seo_pages alter column noindex drop default;
alter table public.seo_pages alter column noindex drop not null;

update public.seo_pages set noindex = null where noindex = false;

comment on column public.seo_pages.noindex is
  'Three-state index override. null = not set, use the page''s own metadata. true = force noindex. false = force index, even over a code-level noindex. Read by lib/seo.ts (pageMetadata) and the sitemap.';
