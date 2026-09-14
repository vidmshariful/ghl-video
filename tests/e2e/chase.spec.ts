import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { api, env, staging, tokenFor } from "./helpers";

/*
 * The platform's own follow-ups, run from the morning sweep and sent
 * through HighLevel: a paid order three days without its brief gets the
 * brief reminder, a video three days in Ready gets the review nudge, and a
 * retainer partnership on its check-in date gets the check-in, after which
 * the date moves a quarter on. A second sweep sends none of them again.
 * The rows are backdated by hand, which is the only honest way to test a
 * rule about days without waiting for them.
 */
test.describe.configure({ mode: "serial" });

const admin = { email: env.QA_ADMIN_EMAIL ?? "", password: env.QA_ADMIN_PASSWORD ?? "" };
const buyer = "qa-premade@ghlvideo.test";
const partner = "qa-highlevel@ghlvideo.test";
const canRun = staging && Boolean(admin.password);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const today = new Date().toISOString().slice(0, 10);

type Row = Record<string, unknown>;
const db = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let token = "";
let orderId = "";
let videoId = "";
let partnerId = "";
let logBefore = 0;

async function reminderRows(): Promise<Row[]> {
  const { data } = await db()
    .from("email_log")
    .select("template_key, to_email, status, meta, created_at")
    .in("template_key", ["intake_reminder", "approval_reminder", "retainer_check_in", "review_request"])
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as Row[];
}

test.describe("the morning sweep, our own follow-ups", () => {
  test.skip(!canRun, "needs staging and the QA admin in .env.local");

  test("the fixtures: an unbriefed order, a video in Ready, a check-in due today", async () => {
    token = await tokenFor(admin);
    const d = db();
    /* the oldest paid shelf order of the premade test buyer, from an earlier walkthrough */
    const { data: orders } = await d
      .from("orders")
      .select("id, product:products(metadata)")
      .ilike("customer_email", buyer)
      .eq("status", "paid")
      .order("created_at", { ascending: true })
      .limit(10);
    const shelf = ((orders ?? []) as Row[]).filter((o) => !((o.product as { metadata?: Row } | null)?.metadata?.invoice));
    test.skip(shelf.length < 2, "needs two paid premade test orders: run the premade walkthrough twice first");
    orderId = String(shelf[0].id);
    await d.from("orders").update({ intake_completed: false, paid_at: daysAgo(4), archived: false }).eq("id", orderId);

    /* a video on a different order, sitting in Ready for four days */
    const { data: vids } = await d
      .from("order_deliverables")
      .select("id")
      .eq("order_id", String(shelf[1].id))
      .is("parent_id", null)
      .limit(1);
    test.skip(!vids?.length, "the second order carries no video row");
    videoId = String(vids![0].id);
    await d.from("order_deliverables").update({ status: "ready", ready_at: daysAgo(4) }).eq("id", videoId);

    /* the ledger forgets these, so the sweep has to send; a retried run
       starts from here again, so today's check-in is forgotten too */
    const rows = await reminderRows();
    for (const r of rows) {
      const m = (r.meta ?? {}) as Row;
      if (m.orderId === orderId || m.deliverableId === videoId || (m.checkInOn === today && String(r.to_email) === partner))
        await d.from("email_log").delete().eq("template_key", String(r.template_key)).eq("created_at", String(r.created_at));
    }

    /* the partner: retainer terms with the check-in due today */
    const list = await api<{ customers: { id: string; email: string }[] }>("/api/admin/customers/", { token });
    partnerId = String(list.customers.find((c) => c.email === partner)?.id ?? "");
    expect(partnerId, "run the HighLevel walkthrough first: it makes this client").toMatch(/^[0-9a-f-]{36}$/);
    await api(`/api/admin/customers/${partnerId}/`, {
      method: "PATCH",
      token,
      body: {
        retainer: { name: "Retainer partnership", monthlyCents: 1100000, videosMin: 8, videosMax: 12, activeMax: 2, turnaroundDays: 3, whiteLabel: true, startedOn: "2026-09-01", checkInOn: today },
      },
    });
    logBefore = (await reminderRows()).length;

    /* the review ask: the buyer's first delivered order, four days ago, never asked */
    const { data: delivered } = await d
      .from("orders")
      .select("id")
      .ilike("customer_email", buyer)
      .eq("status", "paid")
      .eq("fulfillment_stage", "delivered")
      .limit(1);
    if (delivered?.length) {
      await d.from("orders").update({ stage_changed_at: daysAgo(4) }).eq("id", String(delivered[0].id));
      const { data: buyerRow } = await d.from("customers").select("id").ilike("email", buyer).single();
      await d.from("email_log").delete().eq("template_key", "review_request").eq("to_email", buyer);
      await d.from("customers").update({ email_prefs: {} }).eq("id", String(buyerRow?.id));
    }
  });

  test("one sweep sends the brief reminder, the review nudge and the check-in, through HighLevel", async () => {
    /* the sweep walks every open project and, on a Monday, every digest; on
       staging that is a copy of production's clients, most of them skipped
       one by one. A minute is not enough for it. */
    test.slow();
    const out = await api<{ chased: string[]; briefs: string[]; checkIns: string[]; reviews: string[] }>("/api/cron/chase/", { token });
    expect(out.briefs, JSON.stringify(out)).toContain(orderId);
    expect(out.checkIns, JSON.stringify(out)).toContain(partner);
    expect(out.chased.some((c) => c.endsWith("/ review")), JSON.stringify(out)).toBeTruthy();
    /* the review ask, two days after the buyer's first finished job */
    expect(out.reviews, JSON.stringify(out)).toContain(buyer);

    const rows = await reminderRows();
    const brief = rows.find((r) => ((r.meta ?? {}) as Row).orderId === orderId);
    const review = rows.find((r) => ((r.meta ?? {}) as Row).deliverableId === videoId);
    const checkIn = rows.find((r) => ((r.meta ?? {}) as Row).customerId === partnerId && ((r.meta ?? {}) as Row).checkInOn === today);
    expect(brief, "the brief reminder should be in the log").toBeTruthy();
    expect(review, "the review nudge should be in the log").toBeTruthy();
    expect(checkIn, "the check-in should be in the log").toBeTruthy();
    for (const r of [brief!, review!, checkIn!]) {
      expect(String(r.status)).toBe("sent");
      /* through HighLevel's thread, like every client email since phase 4 */
      if (env.HIGHLEVEL_EMAIL === "on") expect(((r.meta ?? {}) as Row).provider).toBe("highlevel");
    }
    expect(String(brief!.to_email)).toBe(buyer);
    expect(String(checkIn!.to_email)).toBe(partner);
  });

  test("the check-in date moved a quarter on, and a second sweep sends nothing again", async () => {
    test.slow();
    const record = await api<{ customer: { retainer: { checkInOn: string | null } | null } }>(`/api/admin/customers/${partnerId}/`, { token });
    const [y, m, d] = today.split("-").map(Number);
    const expected = new Date(Date.UTC(y, m - 1 + 3, d)).toISOString().slice(0, 10);
    expect(record.customer.retainer?.checkInOn).toBe(expected);

    const before = (await reminderRows()).length;
    const again = await api<{ chased: string[]; briefs: string[]; checkIns: string[]; reviews: string[] }>("/api/cron/chase/", { token });
    expect(again.briefs).not.toContain(orderId);
    expect(again.checkIns).not.toContain(partner);
    expect(again.reviews).not.toContain(buyer);
    const after = (await reminderRows()).length;
    const rows = await reminderRows();
    expect(rows.filter((r) => ((r.meta ?? {}) as Row).orderId === orderId).length).toBe(1);
    expect(rows.filter((r) => ((r.meta ?? {}) as Row).deliverableId === videoId).length).toBe(1);
    expect(after).toBeGreaterThanOrEqual(before);
    expect(logBefore).toBeLessThanOrEqual(after);
  });

  test("the fixtures are put back", async () => {
    const d = db();
    await d.from("orders").update({ intake_completed: true }).eq("id", orderId);
    await d.from("order_deliverables").update({ status: "approved" }).eq("id", videoId);
    await api(`/api/admin/customers/${partnerId}/`, { method: "PATCH", token, body: { retainer: null } });
  });
});
