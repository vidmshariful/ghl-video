# Production UX review, 16 September 2026

The studio side of Production (admin: Premade, Custom, Editing), reviewed as
the team uses it: every screen worked on staging at desktop and phone size,
the code behind it mapped, and the whole thing compared with the two tools
Shariful finds easy, ClickUp (the studio's own old workspace) and HighLevel.
The client side of the same work (the portal) was checked too, and it is not
the problem.

This is a review, not a build. Nothing in the product changed.

## 1. The short version

Production feels complex because it is three products, not one. Premade,
Custom and Editing each have their own screen shape, their own list of
stages, their own words for the same things, and their own way of moving
work along. A producer who works across all three carries three mental
models. ClickUp and HighLevel feel easy for the opposite reason: one kind of
card, one list of statuses, one way to move it, everywhere.

What the studio actually does is the same on all three lines: get the brief,
make the video, send it to the client, take the changes, get it approved.
The screens should say that once.

The fix is not a restyle. The look can stay, and so do the three parts:
Shariful's call on 16 September is that Premade manages only premade
orders, Custom all custom production, Editing all editing. What changes is
that the three screens start working the same way: one vocabulary, one
status ladder, one board shape, one card, built in four small steps, each
one usable on its own and each one reversible.

## 2. What the team meets today

### Three screens, three shapes

- **Premade** is a to-do list ("What needs us": Answer the client, Changes
  to make, Ready to start, With the client) plus a second tab, "The board",
  with five columns (Paid, Intake, In production, Review, Delivered). The
  card on the board is an order. The row on the list is a video. Opening
  either lands on a job page that lists every video in the order with its own
  status dropdown, link field and Save button. A nine video pack is nine
  rows of that.
- **Custom** is a long grouped table (Backlog, Planning, In progress, Review,
  Revision, Approved, Cutdowns, Finished) with columns for category, line,
  tags, PM, owed and due. No search, no board, no "what needs us". A project
  opens as a full record: status, due, client, producer, category, agreed,
  payment, quote, invoice, tags, two tabs, a six station production line,
  five pre-made "extra format" rows all sitting at Backlog, activity,
  messages, brief, attachments. It reads like a CRM record, not a job.
- **Editing** is the simplest and the closest to right: one card per client
  with three chips (footage to check, needs us, with client) and their
  credits, then a six column board you can drag on.

### Three ways to do the same thing

| The act | Premade | Custom | Editing |
|---|---|---|---|
| Move work along | arrow buttons on the card | a status dropdown, or six station buttons | drag the card |
| Send it to the client | pick "Ready to review" in a dropdown | button "Send to the client for approval" | button "Send to client", or the "Review" column, or a drag |
| Confirm something risky | browser confirm box | press the button twice | browser prompt box |
| Talk to the client | "Post update" or reply on a video note | "Send" in Messages, or "Add note" in the review room | reply on the note, plus private team notes |
| Who is on it | "Owner" | "Producer" on the page, "PM" in the table | "Producer" |

### Too many words for one thing

- One database row, a video, is called video, deliverable, request, edit
  request, short, format, main video and card depending on the screen.
- A new cut is a "cut" on Premade and Editing and a "draft" on Custom.
- The person on the job is Owner, PM or Producer.
- "Request" means an enquiry on Custom and a video on Editing.
- "Stage" means three unrelated things: an order's stage, a project's stage,
  and one station on the custom production line.
- The five per-video statuses are written three ways: "Queued, In
  production, Ready to review, Revisions requested, Approved" on Premade;
  "Backlog, In progress, Review, Revision, Done" on Custom's formats; "Edit
  request, In progress, Review, Changes, Approved" on Editing.

### Stages stacked on stages

Premade carries two status ladders at once: the order's stage (Paid, Intake,
In production, Review, Delivered) on top of each video's status. The order
stage is partly automatic and partly by hand, the two controls that set it
write different records, and "Delivered" can be reached by an arrow on the
board, is refused on the job page with the message "Use the deliver
button", and also happens by itself when the last video is approved. The
job page itself says there is no deliver button any more. Three stories
for one act.

Custom does the same with the project stage over the six stations, and a
"pin" that stops the stage following the line, with a link to un-pin it.

### A pack is twenty clicks

Moving a nine video pack through Premade takes about twenty two
interactions on one page: "Set all to In production", nine link pastes with
nine Saves, "Set all to Ready to review", two confirms. There is no way to
paste all the links at once and nothing stops a video going to "Ready to
review" with no link on it.

### Not usable on a phone

At 375px the Premade job page is a four screen tall stack of dropdown,
field, Save, per video. The Custom list is a six screen scroll of rows with
no search. ClickUp and HighLevel both have phone apps the team is used to.

### Things that are simply wrong (found while reading the code)

These are not design, they are defects, and they would be fixed in the
first step whatever direction is chosen.

- The client is shown the studio's internal words. Their order tracker says
  "Intake"; their custom project says "Backlog" and "Planning". A friendlier
  client wording exists in the code and is not wired to anything.
- "What needs us" was built to cover all three lines and is wired to only
  Premade, so Custom and Editing have no inbox of what needs a reply.
- The "Chat" button on a Premade board card opens Messages with nobody
  selected.
- The approval gate switch on Custom appears on the one station that should
  not gate (Concept and Design) and cannot be turned off on the two that do
  (Animation, Delivery). The station is called "Delivery" on our side and
  "Final delivery" on the client's.
- The list of order stages is written in six places, one of them the
  client's screen. The review room is written three times, one per line,
  and they have drifted (one lets you remove a cut, one says it is read
  only, one has no cut list).
- Two people's names are hardcoded as defaults (the default manager on a
  new order, the executive producer on editing).
- Chasing rules exist (three days, then three more, two nudges at most) and
  the nudge emails exist, but no Production screen shows or triggers them.

## 3. What ClickUp and HighLevel get right, in the studio's own terms

The studio's old ClickUp production list ("Template Production") had one
status ladder: backlog, redo, in production, in approval, approved,
presented, scheduled, complete. Every video was one task with a status, an
assignee, a due date and a comment thread. Editing clients each had a list
under a folder for their plan (Starter, Growth, Scale), and a Master View
showed everything at once. You could look at any of it as a board, a list
or a calendar, filter to "me", and drag.

HighLevel is the same idea for sales: one pipeline, cards you drag between
stages, one contact record behind every card, one inbox for every
conversation.

Neither tool has a different screen per product line. That is the whole
difference.

## 4. The direction: three screens, one way of working

Keep the look. Keep the three parts. Make them behave as one system.

**One vocabulary.** A piece of work is a Video. A new file is a Cut. What
the client can read is a Note; what only we can read is a Team note. The
person on it is the Producer. The client is the Client. Nothing else.

**One status ladder for every video, on every line:**

| Status | Meaning | Who moves it |
|---|---|---|
| Waiting on client | brief or footage not in yet | automatic |
| To do | ready to start, nobody has | producer |
| In progress | being made | producer, or drag |
| With client | sent, waiting for their word | "Send to client" button |
| Changes | they asked for changes | automatic, from their reply |
| Approved | they approved it | automatic, from their reply |
| Done | delivered, closed | automatic when everything is approved |

The order stage, the project stage and the editing columns all collapse
into this. The order's stage keeps existing underneath for the client's
tracker, the emails and the HighLevel mirror, but nobody on the team sets
it by hand any more. Delivered becomes automatic only.

**The same three tabs on each of the three screens**, each scoped to its
own line:

- **Needs us**: that line's inbox. Every video that needs a reply, a start,
  or a chase, oldest first. This is where the day starts. Premade has it
  today; Custom and Editing get the same one.
- **Board**: columns are the seven statuses. Drag moves a card. Filters for
  client, "mine", overdue. A search box. The Editing board already is this
  shape; Premade and Custom adopt it.
- **List**: the same cards as a table for scanning and sorting.

The Dashboard keeps the cross-line counts it has now ("needs you today"),
so the owner still sees the whole studio in one place without the three
parts merging.

**One card.** A video opens the same way on every screen: title, client,
status, producer, due date, the link and the cuts, the note thread with the
client, the team notes, one "Send to client" button. What is special to a
line lives inside its card, not as a separate machine: on Custom the six
stations become a checklist on the card (with their approval gates kept),
on Editing the QC boxes stay as the gate before "Send to client" and the
credits show on the card and the client filter, on Premade a pack is one
card per video with the order visible as a group.

**The client side does not change**, apart from the wording fixes. It is
already the simple version of this: Ready to watch, Waiting on you, In
progress.

## 5. Four small steps, each usable on its own

**Step 0. Words and defects, no behaviour change.** One vocabulary across
the three screens and the client's screens: Producer, Cut, Note, Video, one
set of status words. Fix the wrong client words, the deliver contradiction,
the inverted gates, the station name, the Chat button, the hardcoded names.
One shared list of stages instead of six. Small diff, one day, and the
screens already feel calmer.

**Step 1. An inbox on every screen.** Give Custom and Editing the "Needs
us" tab Premade has. The server side already gathers all three lines;
only the plumbing to open a custom project or an editing request from it
is missing, and each screen filters to its own line. Add the chase nudge
as a button on the row. One to two days.

**Step 2. One board shape.** The Editing board (drag and drop, one column
per status) becomes the board on Premade and Custom too, each on its own
screen with its own cards: on Premade one card per video, grouped by order;
on Custom one card per project at its derived status. Filters and search
above each. Three to four days. The old Premade board and the Custom table
stay reachable for two weeks, then go.

**Step 3. One card.** The three review rooms become one component. The
Premade job page, the Custom project page and the Editing request page
keep their own routes but open the same card, with a section specific to
the line. Bulk link paste for packs. Three to five days.

Each step ships on staging first, walked through by the suite, then live
when Shariful says so. If step 2 is not liked after a week of real use, the
old screens are still there.

## 6. Two other directions, and why not

**One board across the three lines.** The first draft of this review
proposed merging the three screens into one Production board with a line
filter. Shariful's call on 16 September: keep the three parts separate.
So the shape above applies the same system three times instead of once.
The complexity being removed is the same, because the cost was three
models, not three screens.

**Run production inside HighLevel pipelines.** Tempting, since the team
already loves the drag and the one record. But a HighLevel opportunity has
no video link, no cuts, no client review thread and no QC gate, and the
client portal reads all of those from our side. The work would split in
two places. The better version of the same wish is to make each of our three boards
feel like a HighLevel pipeline: cards you drag, one record behind each.
That is step 2.

## 7. What was checked

- Every Production screen used on staging as the QA admin, desktop and
  375px: the Premade list and board, a nine video pack job page, the Custom
  list and a live project, the Editing client list and the Extendly board,
  the new project form.
- The client portal as the premade buyer: dashboard, "Ready to watch" and
  the review popup.
- The code behind it: the three screens, the shared board component, the
  pipeline, projects and deliverables libraries, the admin APIs under
  deliverables, studio, work notes, orders, projects and editing. Every
  claim in section 2 has a file and line behind it in the working notes.
- The studio's own ClickUp workspaces (read only), for the status ladder
  and structure the team used before.

Screens: the published review page carries the screenshots.
