# GHL Video Rebuild Plan

Written 13 September 2026, after a month of finding the same three faults in
every part of the platform. This is the plan the owner asked for: where we
are, what HighLevel should host instead of Supabase, and the build in phases.
Nothing goes live until every phase is done and walked through on staging.

The journal (admin, Journal) carries the day-to-day record. This document
carries the direction. Read it before any session that touches the platform.

---

## 1. Where we are

**What exists.** One Next.js application on Vercel with four surfaces
(marketing site, checkout, customer portal, admin), three service lines
(premade videos bought off the shelf, custom video by project, editing on a
monthly plan), one retainer partner (HighLevel, custom work at a flat monthly
fee), a Supabase database of 65 tables, Stripe for money, Brevo for email,
Affixo for affiliates, and HighLevel used for exactly four things: a contact,
its tags, an opportunity per sale, and the booking calendars.

**What was found this month.** Credits zeroed by a tick. Ready emails linking
to a page that did not exist. Replies mailed only to premade buyers. Six code
paths creating a customer six different ways. A portal tuned by hand per
client with thirteen switches. A paid invoice turning into a premade order
that asked the client for a branding brief. A retainer with no model at all.
The invoice form offering jobs already paid for. Custom notes showing on the
premade board. None were typos.

**The three faults behind all of it.**

1. One model built for premade, reused for the other two lines. Orders came
   first; projects and plans were bolted on. Every feature that forgot the
   other two owners became a bug.
2. The same fact decided in several places. Paid, kind, visibility, credits:
   each computed in three or four screens with slightly different rules.
3. Nothing was used before it shipped. Dev shared the live database with live
   keys, so no flow could be clicked through safely. Every screen shipped
   "not seen rendered".

**What changed this week.** A staging database mirrored from production with
no live keys, logins for it, and a first rendered check. One door for every
customer. A portal that shows what the account has. A client record tabbed by
service line. A retainer model. Invoice payments read as payments. Migrations
that replay from scratch. Five commits are waiting locally and stay there.

---

## 2. HighLevel: what it can host, and what it should

The owner's direction: everything HighLevel's API can hold should live there,
and every way of using HighLevel is wanted. The honest answer has two halves.

**HighLevel is built to own the customer relationship.** Contacts, custom
fields, tags, pipelines, calendars, conversations (SMS, email, WhatsApp,
chat), invoices, estimates, recurring billing, payments through its own
Stripe connection, products and prices, documents and contracts, forms,
workflows, media, blog, social planner, reputation, an affiliate manager, and
webhooks that tell us when any of it changes. Every one of those replaces
something we built by hand or pay a third party for.

**HighLevel is not a database for a studio's production work.** Its API is a
CRM API: no transactions, no joins, no row security for a client login, a
rate limit (HighLevel's published limits are one hundred requests per ten
seconds and two hundred thousand a day per location, to be checked against
the account's current plan), and objects that are searched, not queried. The
review room (a client's note pinned to second 12 of version 3), the credit
arithmetic of an editing month, a batch of shorts and its roll-up, QC
checklists, and the portal login itself need a real database with rules that
hold under two people clicking at once. That stays in Supabase.

**So the boundary is:** HighLevel is the system of record for who the client
is, what they pay, what we say to them, when we meet, and what happens
automatically. Supabase is the system of record for the work itself and for
the site. A sync keeps HighLevel a live mirror of the work, so HighLevel's
workflows can act on it (a video reaching Review triggers the review message
from HighLevel, not from our code).

### Capability map

| HighLevel capability | Replaces | Fit | Phase |
|---|---|---|---|
| Contacts, custom fields, tags | The customer record's facts: lines, arrangement, retainer terms, source, last seen | Move. Supabase keeps a mirror row for login and RLS | 2 |
| Pipelines and opportunities | Leads (quote enquiries), custom projects as deals, editing plans as deals | Move for leads and deals. Stage follows the production line | 2 |
| Custom objects | A CRM-visible Project and Video record per job | Mirror, pushed from Supabase. Read-only in HighLevel | 2 |
| Notes, tasks | Internal notes on a client, follow-ups | Move | 2 |
| Calendars, appointments | Booking (already HighLevel), the quarterly check-in | Already there; add appointments by API | 2 |
| Invoices, estimates, recurring schedules | Our invoices table, the invoice product hack, the retainer's monthly bill, quotes | Move. Migrate open invoices | 3 |
| Payments (Stripe through HighLevel) | Invoice payment through our checkout | Move for custom and retainer money. Premade checkout stays native, decision below | 3 |
| Products and prices | The catalogue as HighLevel products, so invoices and order forms pick from it | Mirror from site.ts | 3 |
| Conversations (SMS, email, WhatsApp, chat) | Portal Messages, the studio inbox | Move. Portal shows the thread by API; inbound arrives by webhook | 4 |
| Email sending and templates | Brevo and our template table for every client email | Move. Deliverability and template control to be checked on the account | 4 |
| Workflows | Chase reminders, welcome sequences, review nudges, digests, review requests | Move. Triggered by tags, fields and the mirrored objects | 4 |
| Webhooks (events out) | Nothing today. Keeps Supabase in step when a contact, invoice, payment or message changes | Add. Workflow webhooks first, a marketplace app if needed | 2 |
| Forms and surveys | The quote form, the intake brief | Move the quote form. The intake brief only if file uploads fit | 5 |
| Documents and contracts | Proposals for custom work, the retainer agreement | Add, if the account's plan includes it | 5 |
| Media library | Client brand assets and references | Mirror. Uploads stay where the studio works | 5 |
| Reputation and reviews | Nothing today | Add: a review request after final approval | 5 |
| Affiliate manager | Affixo | Move, once payments run through HighLevel | 5 |
| Social planner, email campaigns | The Offers screen, campaign sends | Move the marketing side. The site's own offer banner stays | 5 |
| Blog, funnels, websites | The site, the blog, the sales pages | Keep. They are Next.js on the domain and their SEO depends on it | never |
| Client portal (memberships, communities) | Our portal | Keep ours. The review room, credits and batches have no home in it | never |

**What stays in Supabase, and why.** Portal and admin login (HighLevel has
no login for an outside app). Every deliverable, version, comment, QC check,
batch and cycle (the review room). Credits and top-ups (arithmetic that must
add up under concurrency). Brand kits and style guides (used by editors, not
by the CRM). The catalogue, products, coupons, bumps, SEO pages, redirects,
blog, sales pages, journal (the site). A mirror of each customer keyed by
their HighLevel contact id.

---

## 3. Target architecture

```
Marketing site + checkout + portal + admin  (Next.js on Vercel)
        |                          |
        | reads/writes             | reads/writes by API
        v                          v
   Supabase (the work)  <--sync-->  HighLevel (the customer)
   deliverables, versions,          contacts, fields, tags, pipelines,
   comments, QC, credits,           invoices, payments, conversations,
   cycles, catalogue, site          calendars, workflows, documents,
   content, portal login            custom objects (Project, Video mirror)
        ^                          |
        | events (outbox)          | webhooks (contact, invoice, payment,
        +--------------------------+  message, appointment)
   Stripe: premade checkout native on the site; custom and retainer money through HighLevel Payments
```

The sync is one module with an outbox: every change to a customer, project
or video in Supabase writes a row to a queue, a worker pushes it to HighLevel
with retries and idempotency keys, and a nightly reconciliation compares both
sides and raises an alarm on drift. Inbound, HighLevel calls one signed
endpoint. No screen talks to HighLevel directly.

---

## 4. The build, in phases

Each phase is built on staging, walked through end to end as a client and as
the studio, and closed with its checks green. Nothing is pushed until phase 7.
Days are working days of build, with the owner reviewing at the end of each
phase.

### Phase 0. Safe ground (2 days)
Done: staging database, logins, replayable migrations, Stripe test keys.
To do: a nightly invariant check that raises alarms (a video with no owner, a
paid invoice with a video row, a batch in the wrong stage, credits that do
not add up, an account with no handle or login, a bell pointing at a section
that does not exist); a Playwright walkthrough suite skeleton with the QA
logins; a HighLevel test sub-account and token so staging never writes to
the real CRM.
Needs from the owner: the HighLevel test sub-account (or permission to create
one), and the list of HighLevel features enabled on the plan (Payments,
Email, Documents, Affiliate Manager).

### Phase 1. Every line walked and fixed, and the look decided (6 days)
Premade, custom, editing and billing, each walked on staging as a client and
as the studio, every button pressed twice. Bugs fixed with a test or a check
that would have caught them. This is what was done for custom on 12
September, done for the rest.
Alongside: the three blueprint screens (portal home, client record, editing
board) designed and agreed, so every screen touched from phase 2 on is built
in the new look and nothing is built twice. Phase 6 then finishes the rest.
Done when: the walkthrough suite passes on all four lines, the invariants
are green, and the three blueprints are agreed.

### Phase 2. HighLevel owns the customer (6 days)
The contact model: custom fields for lines, arrangement, retainer terms,
source, last seen; tags derived from the lines. Pipelines: Leads (quotes),
Custom projects (stage mirrors the production line), Editing plans. Custom
objects: Project and Video, mirrored from Supabase. The sync module with its
outbox, retries, idempotency and nightly reconciliation. Inbound webhooks
from HighLevel workflows to one signed endpoint. Every admin screen links to
the contact, the deal and the record. Notes and tasks move.
Done when: every client, project and video in staging appears in the test
sub-account, a change on either side lands on the other within a minute, and
the reconciliation reports zero drift.

### Phase 3. Money in HighLevel (5 days)
Invoices and estimates for custom work, a recurring schedule for the
retainer, payment through HighLevel's Stripe connection. Our invoices table
retires; open invoices migrate. The invoice product hack is deleted. The
catalogue mirrors into HighLevel products. Premade checkout stays native on
the site (fast, on-domain, proven) and records its sale to HighLevel as an
order; editing plans stay Stripe subscriptions (the credits depend on their
webhooks) and mirror their status to the contact.
Done when: a custom invoice raised in HighLevel is paid in test mode and the
project reads paid in both places, with no order row created.
Needs from the owner: HighLevel Payments connected to Stripe on the test
sub-account.

### Phase 4. Conversations and email in HighLevel (4 days)
Portal Messages backed by HighLevel conversations. Every client email sent
from HighLevel templates: welcome, ready to review, replies, reminders,
digests, invoice sent. Workflows for the chase sweep, the review nudge and
the quarterly check-in. Brevo retires. SMS for review nudges once A2P is
registered under Vidiosa.
Done when: every email the platform sends today has a HighLevel equivalent,
the email log shows the sends, and a client reply in a conversation appears
in the portal.

### Phase 5. Documents, forms, reviews, affiliates (4 days)
Proposals and the retainer agreement through Documents. The quote form as a
HighLevel form. A review request after final approval. The affiliate program
on HighLevel's Affiliate Manager, with Affixo retired. The marketing side of
Offers through HighLevel campaigns.
Done when: a quote becomes a signed document, a paid job asks for a review,
and a partner link tracks a sale end to end in the test sub-account.

### Phase 6. One vocabulary, fewer screens (5 days)
One status language across the three lines. One work card and one detail
view shared by the three boards. The portal cut to Home, My work, Billing,
Brand, Messages, Settings. The blueprints from phase 1 rolled through every
screen not already rebuilt in phases 2 to 5.
Done when: every screen uses the shared components and the blueprint look,
and the walkthrough suite still passes.

### Phase 7. Go live (2 days)
One release: migrations, data migration for invoices, webhook and workflow
configuration on the live sub-account, keys in Vercel, DNS unchanged. A
rollback plan written before the push. The first week after, invariants and
reconciliation run daily and every alarm is read.

Total: about 34 working days, roughly seven weeks with review time.

---

## 5. Rules until go-live

- Build on staging. Production is reached only on purpose, with GHLV_ENV=prod.
- Nothing is pushed. The owner says when, and then it is one release.
- Every bug fix ships with a test or a check that would have caught it.
- Every phase closes with a walkthrough, not a screenshot.
- The invariants run nightly on staging and read-only on production.
- No screen talks to HighLevel directly; everything goes through the sync
  module and its outbox.
- The journal records every decision and every phase closed.

---

## 6. Decisions and what the owner provides

Decided 13 September 2026: the boundary is confirmed as written; premade
checkout stays native; editing plans stay on Stripe for now; a HighLevel
private integration token and location were supplied for staging, and
staging's writes to HighLevel are limited to test accounts by code. The
webhook approach and the plan's enabled features are still open.

Decided 13 September 2026, for phase 3: phase 3 is proven with Stripe
connected to the sandbox in test mode (the owner connects it); a premade
sale paid on the site is recorded in HighLevel as a paid invoice on the
contact, with its Stripe reference; the retainer's monthly bill is a
HighLevel recurring schedule on the 1st, sent by HighLevel; at go-live
every existing invoice moves to HighLevel, the paid ones as paid records,
so a client's whole billing history lives there and the invoice products
retire. Verified on the sandbox: a client's pay page is
https://link.msgsndr.com/invoice/{id}; HighLevel amounts are dollars with
decimals; an invoice is sent as a named user of the sub-account
(HIGHLEVEL_USER_ID); one open deal per contact per pipeline until
"Allow duplicate opportunity" is switched on.

1. **The boundary.** Work stays in Supabase, the customer moves to HighLevel,
   with a live mirror of the work in HighLevel custom objects. Confirm.
2. **Premade checkout.** Stays native on the site (recommended), or moves to
   HighLevel order forms. Native keeps conversion and the on-domain flow;
   HighLevel forms would put every payment in one place at the cost of the
   checkout we have tuned.
3. **A HighLevel test sub-account** with its own private integration token,
   scoped for contacts, opportunities, calendars, conversations, invoices,
   payments, products, objects, media, forms, workflows and documents.
4. **Webhooks.** Workflow webhooks first (no marketplace app). If the events
   we need are not reachable that way, a marketplace app is the next step and
   needs an account on the developer marketplace.
5. **Features on the plan.** Which of Payments, Email (LC Email), Documents
   and Contracts, Affiliate Manager and SMS (A2P under Vidiosa) are enabled.
6. **Editing plans.** Stay on Stripe subscriptions for now (recommended), or
   move to HighLevel recurring payments in a later phase once the credit
   webhooks exist there.
