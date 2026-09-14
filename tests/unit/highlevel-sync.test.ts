import { test } from "node:test";
import { invoiceSkipReason } from "../../lib/highlevel/money";
import assert from "node:assert/strict";
import {
  arrangementOf,
  contactPayload,
  fingerprint,
  planLine,
  projectPayload,
  syncAllowed,
  tagsFor,
  videoPayload,
  type CustomerShape,
} from "../../lib/highlevel/sync";
import { inboundContact } from "../../lib/highlevel/inbound";
import type { HlConfig } from "../../lib/highlevel/config";

/*
 * The HighLevel mappers, read without HighLevel: what a customer, a project
 * and a video become on the other side, and what comes back.
 */

const cfg: HlConfig = {
  locationId: "loc1",
  contactFields: {
    lines: "f_lines",
    arrangement: "f_arr",
    retainerFee: "f_fee",
    retainerVideos: "f_vid",
    source: "f_src",
    lastSeen: "f_seen",
    adminUrl: "f_url",
    customerId: "f_id",
    editingPlan: "f_plan",
    waitingOn: "f_wait",
    checkIn: "f_checkin",
    retainerAgreed: "f_agreed",
    partnerRef: "f_pref",
    partnerTier: "f_ptier",
  },
  pipelines: {
    leads: { id: "pl", stages: { new: "s1", contacted: "s2", quoted: "s3", won: "s4", lost: "s5" } },
    projects: {
      id: "pp",
      stages: {
        backlog: "st_backlog",
        planning: "st_planning",
        in_progress: "st_in_progress",
        review: "st_review",
        revision: "st_revision",
        approved: "st_approved",
        cutdowns: "st_cutdowns",
        closed: "st_closed",
      },
    },
  },
  objects: {
    project: { key: "custom_objects.ghlv_project", fields: {} },
    video: { key: "custom_objects.ghlv_video", fields: {} },
  },
  associations: { projectContact: "ap", videoContact: "av" },
};

const none: CustomerShape = {
  lines: { premade: false, custom: false, editing: false },
  retainer: null,
  directBrief: false,
  internal: false,
  plan: null,
  waitingOn: "",
};

const field = (body: Record<string, unknown>, id: string) =>
  (body.customFields as { id: string; field_value: string }[]).find((f) => f.id === id)?.field_value;

test("a retainer partner is tagged and described as one", () => {
  const shape: CustomerShape = {
    lines: { premade: false, custom: true, editing: false },
    retainer: {
      name: "Retainer partnership",
      monthlyCents: 1100000,
      videosMin: 8,
      videosMax: 12,
      activeMax: 2,
      turnaroundDays: 3,
      whiteLabel: true,
      startedOn: "2026-09-01",
      checkInOn: null,
      note: null,
      agreedOn: "2026-09-10T10:00:00Z",
      agreedBy: "Chase Buckner",
    },
    directBrief: true,
    internal: false,
    plan: null,
    waitingOn: "approval",
  };
  assert.equal(arrangementOf(shape), "Retainer partner");
  assert.deepEqual(tagsFor(shape), ["ghlv-custom", "ghlv-retainer", "ghlv-direct-brief", "ghlv-waiting-on-client"]);
  const { body, tags } = contactPayload(
    { id: "c1", email: "Chase@HighLevel.com", name: "Chase Buckner", company: "HighLevel", phone: "+1 (555) 010-0199" },
    shape,
    cfg,
  );
  assert.equal(body.email, "chase@highlevel.com");
  assert.equal(body.firstName, "Chase");
  assert.equal(body.lastName, "Buckner");
  assert.equal(body.companyName, "HighLevel");
  assert.equal(body.phone, "+1 (555) 010-0199");
  assert.equal(field(body, "f_lines"), "custom");
  assert.equal(field(body, "f_fee"), "$11,000 a month");
  assert.equal(field(body, "f_vid"), "8 to 12 videos a month");
  assert.equal(field(body, "f_url"), "https://www.ghlvideo.com/admin/customers/c1/");
  assert.equal(field(body, "f_id"), "c1");
  assert.equal(field(body, "f_wait"), "approval");
  assert.equal(field(body, "f_checkin"), "");
  assert.equal(field(body, "f_agreed"), "2026-09-10 by Chase Buckner");
  assert.ok(tags.includes("ghlv-retainer"));
});

test("an account with nothing yet is a lead", () => {
  assert.equal(arrangementOf(none), "Lead");
  assert.deepEqual(tagsFor(none), ["ghlv-lead"]);
  const { body } = contactPayload({ id: "c2", email: "new@example.com" }, none, cfg);
  assert.equal(field(body, "f_lines"), "none yet");
  assert.equal(field(body, "f_fee"), "");
  assert.equal(body.firstName, undefined);
});

test("a studio-owned account is marked, and each line earns its tag", () => {
  const shape: CustomerShape = {
    lines: { premade: true, custom: false, editing: true },
    retainer: null,
    directBrief: false,
    internal: true,
    plan: { name: "Editing: Growth", status: "active", renewsOn: "2026-10-02" },
    waitingOn: "",
  };
  assert.deepEqual(tagsFor(shape), ["ghlv-premade", "ghlv-editing", "ghlv-internal"]);
  assert.equal(arrangementOf(shape), "Editing plan");
  const { body } = contactPayload({ id: "c3", email: "demo@ghlvideo.com", name: "Demo" }, shape, cfg);
  assert.equal(field(body, "f_lines"), "premade, editing");
  assert.equal(field(body, "f_plan"), "Growth, active, renews 2026-10-02");
  assert.equal(planLine({ name: "Editing: Starter", status: "canceled", renewsOn: "2026-10-02" }), "Starter, canceled");
  assert.equal(planLine(null), "");
  assert.equal(body.firstName, "Demo");
  assert.equal(body.lastName, undefined);
});

test("a phone HighLevel cannot parse is left out rather than sent", () => {
  const { body } = contactPayload({ id: "c4", email: "x@example.com", phone: "call me after 5" }, none, cfg);
  assert.equal(body.phone, undefined);
});

test("the fingerprint changes only when the payload does", () => {
  const a = contactPayload({ id: "c5", email: "a@example.com", name: "A" }, none, cfg);
  const b = contactPayload({ id: "c5", email: "a@example.com", name: "A" }, none, cfg);
  const c = contactPayload({ id: "c5", email: "a@example.com", name: "A B" }, none, cfg);
  assert.equal(fingerprint(a), fingerprint(b));
  assert.notEqual(fingerprint(a), fingerprint(c));
});

test("a project becomes a deal in the stage of its status, at the agreed price", () => {
  const customer = { id: "c1", email: "chase@highlevel.com" };
  const open = projectPayload(
    { id: "p1", title: "G2 Momentum", status: "in_progress", agreed_cents: 150000, category: "Explainer", due_at: "2026-09-30T00:00:00Z" },
    customer,
    cfg,
  );
  assert.equal(open.opportunity.pipelineId, "pp");
  assert.equal(open.opportunity.pipelineStageId, "st_in_progress");
  assert.equal(open.opportunity.status, "open");
  assert.equal(open.opportunity.monetaryValue, 1500);
  assert.equal(open.record.status, "In progress");
  assert.equal(open.record.agreed, "$1,500");
  assert.equal(open.record.due, "2026-09-30");
  assert.equal(open.record.client_email, "chase@highlevel.com");

  const won = projectPayload({ id: "p2", title: "Done", status: "closed", quoted_cents: 99900 }, customer, cfg);
  assert.equal(won.opportunity.status, "won");
  assert.equal(won.opportunity.pipelineStageId, "st_closed");
  assert.equal(won.opportunity.monetaryValue, 999);

  const lost = projectPayload({ id: "p3", title: "Dropped", status: "cancelled" }, customer, cfg);
  assert.equal(lost.opportunity.status, "lost");
  assert.equal(lost.opportunity.pipelineStageId, "st_closed");
  assert.equal(lost.record.agreed, "");

  /* the pre-rename vocabulary still lands on a real stage */
  const legacy = projectPayload({ id: "p4", title: "Old", status: "in_production" }, customer, cfg);
  assert.equal(legacy.opportunity.pipelineStageId, "st_in_progress");
});

test("a video record carries its share link, its kind and its owner", () => {
  const rec = videoPayload(
    { id: "v1", title: "Launch reel", status: "ready", category: "Reel", position: 3, share_token: "abc123", ready_at: "2026-09-10T12:00:00Z" },
    "editing",
    { id: "c9", email: "Team@Extendly.com" },
  );
  assert.equal(rec.kind, "editing");
  assert.equal(rec.video_url, "https://www.ghlvideo.com/v/abc123");
  assert.equal(rec.position, "3");
  assert.equal(rec.ready, "2026-09-10");
  assert.equal(rec.approved, "");
  assert.equal(rec.client_email, "team@extendly.com");
  assert.equal(rec.admin_url, "https://www.ghlvideo.com/admin/customers/c9/");
});

test("the allowlist keeps a copy of production out of the sandbox", () => {
  const saved = { env: process.env.GHLV_ENV, allow: process.env.HIGHLEVEL_SYNC_ALLOW };
  try {
    process.env.GHLV_ENV = "staging";
    delete process.env.HIGHLEVEL_SYNC_ALLOW;
    assert.equal(syncAllowed("qa-custom@ghlvideo.test"), true);
    assert.equal(syncAllowed("shariful@ghlvideo.com"), true);
    assert.equal(syncAllowed("someone@gmail.com"), false);
    process.env.HIGHLEVEL_SYNC_ALLOW = ".*";
    assert.equal(syncAllowed("someone@gmail.com"), true);
    process.env.HIGHLEVEL_SYNC_ALLOW = "(";
    assert.equal(syncAllowed("someone@gmail.com"), false, "a broken pattern allows nobody");
    delete process.env.HIGHLEVEL_SYNC_ALLOW;
    process.env.GHLV_ENV = "prod";
    assert.equal(syncAllowed("someone@gmail.com"), true);
  } finally {
    if (saved.env === undefined) delete process.env.GHLV_ENV;
    else process.env.GHLV_ENV = saved.env;
    if (saved.allow === undefined) delete process.env.HIGHLEVEL_SYNC_ALLOW;
    else process.env.HIGHLEVEL_SYNC_ALLOW = saved.allow;
  }
});

test("an inbound payload is read whatever casing the workflow used", () => {
  const snake = inboundContact({
    contact_id: "hl1",
    email: "Chase@HighLevel.com",
    first_name: "Chase",
    last_name: "Buckner",
    phone: "+15550100199",
    company_name: "HighLevel",
    tags: "ghlv-custom, vip",
  });
  assert.equal(snake.contactId, "hl1");
  assert.equal(snake.email, "chase@highlevel.com");
  assert.equal(snake.name, "Chase Buckner");
  assert.equal(snake.company, "HighLevel");
  assert.deepEqual(snake.tags, ["ghlv-custom", "vip"]);

  const camel = inboundContact({ contactId: "hl2", full_name: "Ada Lovelace", companyName: "Analytical", tags: ["a"] });
  assert.equal(camel.contactId, "hl2");
  assert.equal(camel.name, "Ada Lovelace");
  assert.equal(camel.company, "Analytical");
  assert.equal(camel.phone, null);
  assert.deepEqual(camel.tags, ["a"]);

  const empty = inboundContact({ id: "hl3", first_name: "   " });
  assert.equal(empty.contactId, "hl3");
  assert.equal(empty.name, null);
});

test("a due date behind us becomes today, because HighLevel refuses the past", async () => {
  const { dueDay } = await import("../../lib/highlevel/money");
  assert.equal(dueDay("2026-09-01", "2026-09-14"), "2026-09-14");
  assert.equal(dueDay("2026-10-01", "2026-09-14"), "2026-10-01");
  assert.equal(dueDay("2026-09-14", "2026-09-14"), "2026-09-14");
  assert.equal(dueDay(null, "2026-09-14"), "2026-09-14");
});

test("a polled contact only applies when HighLevel spoke after we did", async () => {
  const { theirsIsNewer } = await import("../../lib/highlevel/inbound");
  assert.equal(theirsIsNewer("2026-09-14T12:00:00Z", "2026-09-14T11:59:00Z"), true);
  assert.equal(theirsIsNewer("2026-09-14T11:58:00Z", "2026-09-14T11:59:00Z"), false);
  assert.equal(theirsIsNewer("2026-09-14T11:59:00Z", "2026-09-14T11:59:00Z"), true, "a tie goes to HighLevel, the system of record");
  assert.equal(theirsIsNewer(undefined, "2026-09-14T11:59:00Z"), true, "no timestamp from them: apply, as a webhook would");
  assert.equal(theirsIsNewer("2026-09-14T11:58:00Z", null), true, "no timestamp of ours: nothing to protect");
});


test("a demo account's invoice and a zero-total invoice never go to HighLevel", () => {
  assert.equal(invoiceSkipReason({ total_cents: 0 }, { internal: true }), "the studio's own demo account is never billed");
  assert.equal(invoiceSkipReason({ total_cents: 0 }, { internal: false }), "nothing to bill: the total is zero");
  assert.equal(invoiceSkipReason({ total_cents: null }, { internal: false }), "nothing to bill: the total is zero");
  assert.equal(invoiceSkipReason({ total_cents: 44100 }, { internal: false }), null);
});
