import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { QC_CHECKS } from "../../lib/editing-sop";
import { api, BASE, ensureLogin, env, signIn, staging, tokenFor, watchConsole } from "./helpers";

/*
 * The editing line, end to end, on staging: a client on a Growth plan asks
 * for a video with a short cut, the studio checks the footage, posts the
 * cut, runs QC and sends it for review, the client approves; then a batch
 * of shorts is made, notified as one, approved one by one until the batch
 * finishes on its own; a cancelled request hands its credits back; and the
 * batch tick refuses a finished video. Credits are checked at every step.
 *
 * The plan row is seeded directly: the Stripe subscription itself is
 * Stripe's, and its webhook cannot reach a laptop. Everything from the row
 * on is the platform's own logic.
 */
test.describe.configure({ mode: "serial" });

const client = { email: "qa-editing@ghlvideo.test", password: "walk-through-2026!" };
const admin = { email: env.QA_ADMIN_EMAIL ?? "", password: env.QA_ADMIN_PASSWORD ?? "" };
const canRun = staging && Boolean(admin.password);
const SLUG = "qa-editing";
const ASSETS = "https://drive.example.com/walkthrough-footage";
const qcAll = Object.fromEntries(QC_CHECKS.map((c) => [c.key, true]));

let parentId = "";
let batchId = "";
let shortIds: string[] = [];

async function planFor(token: string) {
  return api<{
    plan: {
      credits: { spent: number; allowed: number; left: number };
      videos: { id: string; parentId: string | null; title: string; status: string; creditCost: number; editType: string | null; canReview: boolean }[];
    } | null;
  }>("/api/portal/plan/", { token });
}

async function refuse(path: string, token: string, body: unknown): Promise<string> {
  const r = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(r.ok, `${path} was expected to refuse and answered ${r.status}`).toBeFalsy();
  return String(((await r.json()) as { error?: string }).error ?? "");
}

test.describe("editing, as the client and the studio", () => {
  test.skip(!canRun, "needs staging and the QA admin in .env.local");

  test("a Growth plan exists for the test client, clean", async () => {
    await ensureLogin(client);
    const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: product } = await db.from("products").select("id").eq("sku", "editing-growth").single();
    expect(product?.id).toBeTruthy();

    /* one account, by the one door's rules: lowercase email, a handle */
    const { data: existing } = await db.from("customers").select("id").ilike("email", client.email).maybeSingle();
    let customerId = existing?.id as string | undefined;
    if (!customerId) {
      const { data: made, error } = await db
        .from("customers")
        .insert({ email: client.email, name: "QA Editing Client", company: "QA Editing Co", slug: SLUG, source: "admin" })
        .select("id")
        .single();
      expect(error?.message ?? "").toBe("");
      customerId = made!.id as string;
    }

    /* wipe the previous run's plan and its work, then seed one live plan */
    const { data: subs } = await db.from("subscriptions").select("id").ilike("customer_email", client.email);
    const subIds = (subs ?? []).map((s) => String(s.id));
    if (subIds.length) {
      const { data: cycles } = await db.from("subscription_cycles").select("id").in("subscription_id", subIds);
      const cycleIds = (cycles ?? []).map((c) => String(c.id));
      if (cycleIds.length) {
        await db.from("order_deliverables").delete().in("cycle_id", cycleIds);
        await db.from("subscription_cycles").delete().in("id", cycleIds);
      }
      await db.from("editing_credit_grants").delete().in("subscription_id", subIds);
      await db.from("subscriptions").delete().in("id", subIds);
    }
    const periodEnd = new Date(Date.now() + 20 * 86_400_000).toISOString();
    const { error } = await db.from("subscriptions").insert({
      customer_id: customerId,
      customer_email: client.email,
      product_id: product!.id,
      stripe_subscription_id: `sub_qa_editing_${Date.now().toString(36)}`,
      stripe_customer_id: "cus_qa_editing",
      status: "active",
      plan_name: "Editing: Growth",
      amount_cents: 99500,
      currency: "usd",
      interval: "month",
      current_period_end: periodEnd,
      metadata: { sku: "editing-growth", seeded_by: "walkthrough" },
    });
    expect(error?.message ?? "").toBe("");

    const me = await tokenFor(client);
    const plan = await planFor(me);
    expect(plan.plan?.credits.allowed).toBe(20);
    expect(plan.plan?.credits.spent).toBe(0);
  });

  test("the client asks for a mid video with a short cut, and the month charges three credits", async () => {
    const me = await tokenFor(client);
    const made = await api<{ id: string; cuts: number; warning: string | null }>("/api/portal/plan/", {
      method: "POST",
      token: me,
      body: {
        title: "Walkthrough webinar",
        brief: "Cut the webinar down. Walkthrough, nothing real.",
        editType: "mid",
        aspect: "16:9",
        assetsUrl: ASSETS,
        cuts: ["The pricing part, around minute four"],
      },
    });
    parentId = made.id;
    expect(made.cuts).toBe(1);
    const plan = await planFor(me);
    expect(plan.plan?.credits.spent).toBe(3);
    expect(plan.plan?.credits.left).toBe(17);
  });

  test("the studio checks the footage, posts the cut, passes QC and sends it for review", async () => {
    const token = await tokenFor(admin);
    const patch = (body: Record<string, unknown>) => api("/api/admin/editing/", { method: "PATCH", token, body });
    const board = await api<{ requests: { id: string; title: string; status: string }[] }>(`/api/admin/editing/?client=${SLUG}`, {
      token,
    });
    expect(board.requests.some((r) => r.id === parentId)).toBeTruthy();

    await patch({ id: parentId, assetsReady: true });
    /* QC before the link: the checklist is enforced, not offered */
    const early = await refuse("/api/admin/editing/", token, { id: parentId, status: "ready" });
    expect(early).toMatch(/QC/i);
    await patch({ id: parentId, videoUrl: "https://example.com/walkthrough-webinar-v1.mp4" });
    await patch({ id: parentId, qc: qcAll });
    await patch({ id: parentId, status: "ready" });

    const me = await tokenFor(client);
    const plan = await planFor(me);
    const mine = plan.plan?.videos.find((v) => v.id === parentId);
    expect(mine?.status).toBe("ready");
    expect(mine?.canReview).toBeTruthy();
  });

  test("the client approves it", async () => {
    const me = await tokenFor(client);
    await api(`/api/portal/videos/${parentId}/review/`, { method: "POST", token: me, body: { action: "approve" } });
    const plan = await planFor(me);
    expect(plan.plan?.videos.find((v) => v.id === parentId)?.status).toBe("approved");
    expect(plan.plan?.credits.spent).toBe(3);
  });

  test("a batch of shorts costs only its shorts, is told as one, and finishes when they do", async () => {
    const me = await tokenFor(client);
    const token = await tokenFor(admin);
    const patch = (body: Record<string, unknown>) => api<Record<string, unknown>>("/api/admin/editing/", { method: "PATCH", token, body });

    const made = await api<{ id: string }>("/api/portal/plan/", {
      method: "POST",
      token: me,
      body: { title: "Shorts from the webinar", editType: "short", aspect: "9:16", assetsUrl: ASSETS },
    });
    batchId = made.id;
    await patch({ id: batchId, batch: true });
    const added = await patch({ id: batchId, addCuts: ["Short one", "Short two", "Short three"] });
    expect(added.cuts).toBe(3);

    let plan = await planFor(me);
    const batch = plan.plan?.videos.find((v) => v.id === batchId);
    expect(batch?.creditCost).toBe(0);
    expect(batch?.editType).toBe("batch");
    shortIds = (plan.plan?.videos ?? []).filter((v) => v.parentId === batchId).map((v) => v.id);
    expect(shortIds.length).toBe(3);
    expect(plan.plan?.credits.spent).toBe(6);

    /* the batch cannot be staged by hand */
    const refused = await refuse("/api/admin/editing/", token, { id: batchId, status: "ready" });
    expect(refused).toMatch(/batch/i);

    for (const id of shortIds) {
      await patch({ id, videoUrl: `https://example.com/short-${id.slice(0, 6)}.mp4` });
      await patch({ id, qc: qcAll });
      await patch({ id, status: "ready" });
    }
    const told = await patch({ id: batchId, notifyClient: true });
    expect(told.notified).toBe(3);

    plan = await planFor(me);
    expect(plan.plan?.videos.find((v) => v.id === batchId)?.status).toBe("ready");

    for (const id of shortIds)
      await api(`/api/portal/videos/${id}/review/`, { method: "POST", token: me, body: { action: "approve" } });
    plan = await planFor(me);
    expect(plan.plan?.videos.find((v) => v.id === batchId)?.status).toBe("approved");
    expect(plan.plan?.credits.spent).toBe(6);
  });

  test("a cancelled request hands its credit back, and a finished video cannot become a batch", async () => {
    const me = await tokenFor(client);
    const token = await tokenFor(admin);
    const made = await api<{ id: string }>("/api/portal/plan/", {
      method: "POST",
      token: me,
      body: { title: "Changed our mind", editType: "short", aspect: "9:16", assetsUrl: ASSETS },
    });
    expect((await planFor(me)).plan?.credits.spent).toBe(7);
    await api("/api/portal/plan/", { method: "POST", token: me, body: { cancel: made.id } });
    expect((await planFor(me)).plan?.credits.spent).toBe(6);

    const refused = await refuse("/api/admin/editing/", token, { id: parentId, batch: true });
    expect(refused).toMatch(/keeps its credits/i);
    expect((await planFor(me)).plan?.credits.spent).toBe(6);
  });

  test("the client's screen renders the month with no console errors", async ({ page }) => {
    const errors = watchConsole(page);
    await signIn(page, "/portal/", client, /welcome back/i);
    await page.goto("/portal/subscriptions/");
    await expect(page.getByRole("heading", { name: "Editing", exact: true })).toBeVisible();
    await expect(page.getByText(/6 of 20/).first()).toBeVisible();
    await expect(page.getByText("Shorts from the webinar").first()).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  /* a fresh page, so the client's session is not sitting under the studio's */
  test("the studio's board renders the month with no console errors", async ({ page }) => {
    const errors = watchConsole(page);
    await signIn(page, "/admin/", admin, /dashboard/i);
    await page.goto(`/admin/editing/${SLUG}/`);
    await expect(page.getByText(/6 of 20|month of/i).first()).toBeVisible();
    await expect(page.getByText("Walkthrough webinar").first()).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
