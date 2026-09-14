# The staging tour: what was built, how to try it, how it works

Written 14 September 2026 for Shariful. This covers everything on the
`design-update` branch since the last release (12 September, the retainer
partnership): 25 commits, none pushed. It is all running locally against
the staging database, Stripe in test mode and the HighLevel sandbox
sub-account "Video Storage". The phase 6 look and restructure were reverted
today at your request, so every screen looks the way it does on main.

The short version: a client, their projects, their videos, their invoices,
their messages and their quotes now exist in HighLevel as well as here, kept
in step within a minute in both directions, and nothing is managed inside
HighLevel. Everything is done on our portal and admin, and HighLevel mirrors
it.

---

## 1. Opening it

**The site.** Run the dev server and open the portal or admin:

```bash
npm run dev
```

Then http://localhost:3200/admin/ and http://localhost:3200/portal/.

**What it talks to.** `.env.local` points at the staging Supabase project (a
copy of production's tables with none of its keys), Stripe test keys, and the
HighLevel sandbox. Nothing run locally can charge or mail a real person. On
staging the HighLevel sync only touches test accounts, meaning emails ending
in `@ghlvideo.test` or `@ghlvideo.com`; the copy of production's clients
never lands in the sandbox.

**Logins.** This prints fresh passwords for the QA admin
(`qa-admin@ghlvideo.test`), the demo client (`shariful@ghlvideo.com`) and
your own admin login (`shariful@vidiosa.com`):

```bash
npm run staging:logins
```

To see any other client's portal without their password, open their record
in admin and press "View their portal". The editing walkthrough's client is
`qa-editing@ghlvideo.test` (a Growth plan with a month of work on its board);
the premade walkthrough's buyer is "QA Premade Buyer"; the custom and money
walkthroughs use the "HighLevel Inc." record and a test client of their own.

**The HighLevel side.** Open the "Video Storage" sub-account. The places to
look: Contacts (search `ghlvideo.test`), Opportunities with the two pipelines
"GHL Video: Custom projects" and "GHL Video: Leads", the "GHLV Projects" and
"GHLV Videos" objects on a contact, Payments then Invoices, Conversations,
and a contact's Notes.

**Stripe.** Test card 4242 4242 4242 4242, any future date, any CVC.

---

## 2. What was built, in order, and how to try each piece

### A. One door for every customer, and a portal that follows the account

Every path that creates a customer (checkout, the Stripe webhook, admin, the
quote form, an invoice, a manual order) now goes through one function. It
finds or makes the row, gives it a handle, makes sure the portal login
exists, and sends the welcome once and only where no other email covers it.
The portal shows a section because the account has that line: the store
shows for people who buy from it, never for a custom or editing client and
never for a partner; Billing is one screen; lines the account does not have
collapse into "Get more"; the offers vanish for a retainer partner. The
client record is Overview, then Premade, Custom and Editing (only the lines
they have), then Billing and Portal. Leads sit in the client list one stage
before clients.

Try it: Admin, Customers, "Add client" asks what they are here for. Open
"HighLevel Inc." and walk the tabs. Press "View their portal" and see that a
retainer partner gets no store and no offers. Open the demo client's portal
and compare.

### B. An invoice payment is money, not premade work

A paid invoice used to create a phantom video and a brief request. Invoices
now expand to nothing, settle straight to delivered, stay off the premade
board, read as payments in the portal with the bill they settled, and are
refused by the intake form.

Try it: the premade board (Admin, Production) lists premade work only; the
demo client's Billing screen lists paid invoices as receipts.

### C. Staging, the nightly self-check and the walkthroughs (phase 0 and 1)

Seventeen invariants run against the live rows every night at 03:00: a video
with no owner, a paid bill with a video, a batch in the wrong stage, a cut
outside its month, a request with the wrong credits, a video in Review with
no cut, a paid order with no videos, an account with no handle or login, work
with no account, a project unlinked from its client, a partnership job with
no month, a bell pointing at a section the portal does not have, a portal
switch naming a section that does not exist, a voided invoice marked paid,
and an invoice that never reached HighLevel. Each failure raises an alarm on
the Health screen.

Try it: Admin, Health, for the alarms. By hand:

```bash
npm run check:invariants
```

Nine walkthroughs (51 steps) sign in as the studio and as the clients and use
the screens: buy and pay in Stripe test mode, brief, produce, review,
approve, deliver; open a client and a project, raise and pay an invoice, run
the production line; ask for an edit, check footage, QC, review, approve,
batch shorts, cancel; and every HighLevel step below. They take about 26
minutes and need the dev server and the sandbox:

```bash
npm run test:walk
```

The editing walk found why Beant could not ask for a video (a request's
position in the month collided after shorts were added). Fixed, with a test
that replays his month.

### D. HighLevel holds the client, the project and the video (phase 2)

Every client becomes a contact with tags for the lines they have (premade,
custom, editing, retainer, direct brief, lead, partner) and the GHLV fields:
lines, arrangement, retainer fee and videos, source, last seen, a link to
their admin record, our id, their editing plan, what they are waiting on,
the retainer check-in date and the agreed-on date. Every custom project is a
deal card in "GHL Video: Custom projects" at the stage matching our status,
valued at the agreed price, plus a "GHLV Project" record on the contact.
Every video is a "GHLV Video" record on the contact, whichever line it came
from. A change here lands in HighLevel within a minute. An edit to a contact
inside HighLevel (name, phone, company) comes back within a minute, and only
when HighLevel's edit is newer than ours.

Try it:

1. Open a test client's record and press "In HighLevel". Read the fields and
   tags on the contact.
2. Open one of their custom projects; the deal card sits in the pipeline at
   the same stage. Change the project's status in admin and watch the card
   move within a minute.
3. On the contact, open GHLV Projects and GHLV Videos.
4. Change the phone number on the contact in HighLevel. Within a minute the
   record in admin shows it.

To watch the sync work, or force a full pass:

```bash
npm run hl:sync -- --watch
```

```bash
npm run hl:sync -- --all
```

One switch in the sub-account is still off: Settings, Business Profile,
"Allow duplicate opportunity". Until it is on, HighLevel refuses a second
open deal per contact, so a client's open card carries their latest project.
Records are still one per project either way.

### E. Money lives in HighLevel (phase 3)

Every invoice is raised and paid in HighLevel through the studio's Stripe
connection, and our table mirrors it. Paid is one column every screen reads:
the project, the client record, the dashboard, sales, the portal and the
public invoice page. A premade sale paid on the site is recorded in HighLevel
as a paid invoice on the contact with its Stripe reference. Retainer terms
become a monthly HighLevel schedule on the 1st, updated when the terms change
and cancelled when they go. The catalogue is mirrored into HighLevel
products, all 90. The throwaway product per invoice is gone for new invoices;
a script moves the old ones across at go-live, paid ones as paid records.

Try it:

1. Admin, Invoices, raise one for a test client. It appears marked "made in
   HighLevel" with HighLevel's pay link. Press "Send from HighLevel" (on
   staging it is marked sent and nothing is mailed).
2. Pay it in the sandbox: Payments, Invoices, record a payment; or open the
   pay link and use the test card. Within a minute it reads paid on the
   project, the record, the dashboard and the client's Billing screen, and
   no order row appears.
3. Buy a premade video on the site with the test card. The contact gets a
   paid invoice with the Stripe reference.
4. On "HighLevel Inc.", Custom tab, the partnership terms. The contact's
   schedule in HighLevel bills on the 1st. Change the fee and the schedule
   updates.
5. Void an open invoice here; it is void there.

To mirror the catalogue by hand:

```bash
npm run hl:sync -- --products
```

### F. Conversations and email in HighLevel (phase 4)

The portal's Messages and the client's HighLevel thread are one
conversation. What a client types in the portal shows in HighLevel's inbox;
what the studio answers there shows in the portal, marked chat, email or
text. Every email to a client, a lead or a partner leaves through HighLevel,
so it sits on the same thread, and the email log records HighLevel's id and
the delivery verdict. Team alerts stay on Brevo, because a teammate is not a
CRM contact.

Try it:

1. Sign in to the portal as the demo client, open Messages, send a line. In
   the sandbox, Conversations shows it on the contact's thread.
2. Reply from inside HighLevel. The portal shows the reply within a minute,
   marked as where it came from.
3. Admin, Emails, shows every send with its provider and, for HighLevel, the
   delivery verdict.

On staging, mail through HighLevel is off by default so nothing is mailed
while testing. To watch an email leave through HighLevel, set
`HIGHLEVEL_EMAIL=on` in `.env.local`, restart the dev server, and send a
welcome from admin to a test account.

### G. The follow-ups are ours, not HighLevel workflows

The morning sweep runs at 09:00 UTC and sends the brief reminder (paid, no
brief), the review nudge (a video sitting in Ready), the retainer's
quarterly check-in, and the review request (two days after a client's first
finished job, once, and again only after six months). At most twice, three
days apart; the email log is the record of what went. The emails leave
through HighLevel so they sit on the client's thread. No HighLevel workflow
is needed anywhere, because edits made in HighLevel come back by polling
every minute.

Try it: the chase walkthrough stages an unbriefed order, a video in Ready
and a check-in due today, runs the sweep and proves the second run sends
nothing again:

```bash
npx playwright test tests/e2e/chase.spec.ts
```

### H. Quotes, the agreement, reviews, leads and partners (phase 5)

Nothing in this phase is managed inside HighLevel; every act happens here
and HighLevel mirrors it.

**Leads.** An enquiry from the site's quote form becomes a deal card in
"GHL Video: Leads" within the minute and follows the status set in admin.
Try it: submit /quote/ with a `@ghlvideo.test` email, find the card, change
the enquiry's status on the Custom screen and watch the card follow.

**Quotes.** A quote is raised on the Custom screen for an enquiry or a
project, sent through HighLevel's email, and accepted or declined by the
client on our quote page or in their portal by typing their name. Accepting
opens the project (or prices it) at the agreed price, marks the enquiry won,
puts the price on the deal card, adds a note on the contact and tells the
team. Declining tells the team why. Try it: Custom screen, an enquiry,
"Quote", fill the lines, send. The quote's link is on the screen; open it,
accept with a typed name, and see the project appear on both sides. Raise a
second one and decline it from the client's portal.

**The agreement.** The retainer terms are accepted in the portal with a typed
name, kept with the time and address. A change to the fee, the video count
or the turnaround clears the acceptance and asks again. Try it: on the
record, Custom tab, "Send the agreement". In the client's portal the
partnership card asks for a typed name. The contact then shows "GHLV
retainer agreed" and a note.

**Partners.** A partner appears in HighLevel as a tagged contact with their
handle and tier. Affixo keeps running commissions and payouts for now. Try
it: Admin, Partners, open one, then find the contact.

**Reviews.** The review request goes from the morning sweep, as above.

### I. Phase 6, reverted today

The six-section portal, the seven-item admin menu, the one status language
and the rows-instead-of-cards look were built and reverted the same day.
Every screen is as it is on main. The work is parked on the
`phase-6-blueprint` branch for when you pick the design up.

---

## 3. How it works underneath, in plain language

**The outbox.** Every change to a client, project, video, invoice, order,
lead or partner writes one row to an outbox, by a database trigger, so no
screen has to remember to tell HighLevel. A cron every minute drains it in
order (the client before their work), builds the payload from the live row
and calls HighLevel. A fingerprint of the payload means nothing is sent twice
for the same state. A failure keeps the row with its error and retries with a
growing wait, up to six hours. A links table records what each row is in
HighLevel (the contact, the deal, the record, the invoice, the schedule).

**The nightly reconcile** at 04:00 queues anything missing or stale, checks a
rotating slice against HighLevel, and raises an alarm on anything stuck.

**Inbound.** The minute cron also asks HighLevel for contacts edited in the
last few minutes, reads each by id (HighLevel's search lags a write by
seconds and can list a deleted contact), and applies name, phone and company
only when HighLevel's edit is newer than ours. Inbound runs before the drain
so our copy never overwrites a fresh edit. The webhook endpoint exists and is
optional.

**Money.** HighLevel is the ledger and our invoices table mirrors it:
HighLevel's number, status and pay link on each row, and one paid-at column
that every screen reads. Premade checkout stays native on the site (fast,
on-domain, proven) and each sale is recorded into HighLevel after it
settles. Editing plans stay Stripe subscriptions, because the credits depend
on their events, and show on the contact.

**Email.** Client, lead and partner templates go out through HighLevel's
conversations when the switch is on and the address is allowed; team
templates stay on Brevo. The log carries the provider, HighLevel's message id
and the delivery verdict, refreshed each minute.

**Follow-ups.** The sweep reads the email log as its ledger, so a reminder
is never sent twice and the second nudge waits three days. The rules live in
one small file and have unit tests.

**Safety on staging.** Only test accounts sync; invoices are marked sent
rather than mailed; HighLevel mail is off; Stripe is in test mode;
production is reached only on purpose with `GHLV_ENV=prod`.

---

## 4. Proof

The unit tests (338) and the gates (type check, lint, drift, owners, portal
UI) pass on today's tree. The nine walkthroughs and what each proves:

| Walkthrough | Steps | Proves |
|---|---|---|
| walkthrough | 4 | the studio signs in, opens a record on every tab, the boards; the client's sections render |
| premade | 4 | buy and pay, brief, produce and review, approve and deliver |
| custom | 5 | open the client, project and invoice; pay in HighLevel; the portal reads it; the production line runs; a direct brief |
| editing | 8 | a Growth plan, a request with a cut and credits, footage, QC, review, approval, a batch of shorts, a cancel |
| highlevel | 8 | provisioning, the contact, the deal card and record, the move, the video record, an edit coming back both ways, a wrong key refused |
| money | 7 | an invoice made in HighLevel with its pay link, sent, paid, a premade sale recorded, the retainer schedule, a void |
| messages | 5 | the thread on both sides, a portal message in HighLevel, a HighLevel reply in the portal, an email through HighLevel, the waiting-on field |
| chase | 4 | the sweep sends the three follow-ups once and not twice |
| quotes | 6 | a lead card, a quote sent, accepted on our page, declined in the portal, the agreement, a partner contact |

The last full run on the code before phase 6 was green. A fresh run on
today's reverted tree was started as this doc was written; its verdict is in
the journal.

---

## 5. What is left

- **The design.** Phase 6 is yours to lead, later. Until then new screens
  are built in the current look.
- **One switch in the sandbox and the live sub-account:** "Allow duplicate
  opportunity", so each project gets its own deal card.
- **Before go-live (phase 7, from the plan):** in the live sub-account, a
  Private Integration token with the sandbox's scopes plus locations.write,
  Payments connected to Stripe in live mode, the switch above, and the
  ghlvideo.com sending domain verified. In Vercel: the HighLevel token and
  location, `HIGHLEVEL_USER_ID` (the teammate invoices go out as),
  `HIGHLEVEL_SEND_ACTION=email`, `HIGHLEVEL_LIVE_MODE=true`,
  `HIGHLEVEL_EMAIL=on`, the from address, a webhook secret, `CRON_SECRET`,
  Brevo kept for team alerts, and `HIGHLEVEL_SYNC_ALLOW` unset so everyone
  syncs. After the deploy, in order: the migrations, `hl:provision`,
  `hl:sync --all --products` (the first fill), `hl:migrate-invoices --email`
  (history across, open invoices re-sent with HighLevel's pay link), then a
  day watching the Health screen.

---

## 6. Commands

| Command | What it does |
|---|---|
| `npm run dev` | the site on http://localhost:3200 against staging |
| `npm run staging:logins` | fresh QA admin, demo client and owner passwords |
| `npm run staging:refresh` | recopy production's tables into staging |
| `npm run test:walk` | the nine walkthroughs, about 26 minutes |
| `npm test` | the unit tests |
| `npm run check:live` | drift, deliverables, composition, demo account, invariants |
| `npm run check:invariants` | the nightly facts, by hand |
| `npm run hl:provision` | make or verify the fields, pipelines and objects in the sub-account |
| `npm run hl:sync -- --watch` | drain the outbox every few seconds and print what moved |
| `npm run hl:sync -- --all` | queue every client, project, video and invoice |
| `npm run hl:sync -- --reconcile` | the nightly reconcile, by hand |
| `npm run hl:sync -- --products` | mirror the catalogue into HighLevel products |
| `npm run hl:migrate-invoices` | go-live only: move invoice history into HighLevel |
| `node scripts/journal.mjs recent 20` | the journal, newest first |

---

## 7. Going live: how the merge works, and what happens to the data

**The merge is a fast-forward.** Production's `main` is an ancestor of
`design-update`, so there is nothing to merge and nothing can conflict. The
release is one push, `git push origin design-update:main`, and Vercel builds
it. Rolling back is Vercel's "promote previous deployment", which is
instant.

**Nothing is deleted or rewritten.** Production today holds 12 customers,
13 projects, 9 invoices, 14 orders, 2 editing plans and 8 message threads.
Four migrations are pending there (0095 to 0098). They add tables, columns
and triggers; the only backfill stamps the paid date on invoices that were
already paid, and the only loosened rule lets an invoice exist without a
throwaway product. No table or column is dropped, so the old code keeps
running against the new schema, which is what makes the rollback safe.

**HighLevel's live sub-account is added to, not replaced.** Contacts are
matched by email through HighLevel's own upsert, so the 8 customers who
already have a contact are enriched with the GHLV fields and tags, not
duplicated, and the other 4 are made. The two new pipelines and the two
objects are created beside what is there; existing pipelines, deals, tags
and conversations are untouched, and checkout keeps filing paid orders where
it does today. Test accounts never reach it: staging's sandbox is a separate
sub-account.

**Past messages stay here.** A client's existing thread joins HighLevel from
its next message; what was said before stays in the portal only.

**Stripe is unchanged.** Premade checkout charges the website's Stripe
account as today, editing plans keep their subscriptions, and HighLevel
invoices charge through HighLevel's own Stripe connection.

**The day, in order:**

1. You set the live sub-account and Vercel as listed under "What is left".
   The rollback note is written before anything is pushed.
2. `GHLV_ENV=prod npm run migrate` applies 0095 to 0098. The old code keeps
   running meanwhile.
3. `git push origin design-update:main`, then confirm the deployment is
   green before going further.
4. `GHLV_ENV=prod npm run hl:provision` makes the fields, pipelines and
   objects in the live sub-account and prints the lead pipeline ids to set
   in Vercel.
5. `GHLV_ENV=prod npm run hl:sync -- --all --products` is the first fill:
   the 12 contacts, the 13 projects as deal cards (the cancelled one lands
   in Closed as lost), every video as a record, and the 90 products.
6. `GHLV_ENV=prod npm run hl:migrate-invoices` moves the 7 legacy invoices
   across, paid ones as paid records. With `--email`, HighLevel also emails
   the open ones their new pay link. That flag is your call on the day,
   after a look at which of the 8 open invoices are still owed.
7. A day watching the Health screen. The reconcile runs at 04:00 and the
   invariants at 03:00 from then on.

**Two calls that are yours:** whether the open legacy invoices are re-sent
with the new pay link (step 6), and whether every past project should get a
deal card or only the open ones (step 5 sends all 13; trimming it is a
one-line change).

**The one rollback caveat:** an invoice paid in HighLevel between the push
and a rollback reads as open on the old screens until the new code is back.
The money itself is safe in HighLevel and Stripe.

