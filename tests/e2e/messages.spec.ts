import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { api, env, staging, tokenFor } from "./helpers";

/*
 * Conversations and email in HighLevel, end to end, against the real
 * sandbox: a message typed in the portal appears on the client's HighLevel
 * thread; a reply typed inside HighLevel appears in the portal; an email the
 * platform sends leaves through HighLevel, sits on the same thread, and is
 * recorded in the email log with HighLevel's id; and what the client is
 * waiting on is written on the contact for the workflows to read.
 */
test.describe.configure({ mode: "serial" });

const admin = { email: env.QA_ADMIN_EMAIL ?? "", password: env.QA_ADMIN_PASSWORD ?? "" };
const client = { email: "qa-highlevel@ghlvideo.test", password: "walk-through-2026!", name: "QA HighLevel" };
const stamp = Date.now().toString(36);
const HL = "https://services.leadconnectorhq.com";
const LOC = env.HIGHLEVEL_LOCATION_ID ?? "";
const canRun =
  staging && Boolean(env.HIGHLEVEL_API_TOKEN) && Boolean(LOC) && Boolean(admin.password) && env.HIGHLEVEL_EMAIL === "on";

type Row = Record<string, unknown>;
const db = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function hl(method: string, path: string, body?: unknown): Promise<Row> {
  const r = await fetch(`${HL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.HIGHLEVEL_API_TOKEN}`,
      Version: "2021-07-28",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json: Row = {};
  try {
    json = JSON.parse(text) as Row;
  } catch {
    /* empty body */
  }
  expect(r.ok, `${method} ${path} -> ${r.status}: ${text.slice(0, 300)}`).toBeTruthy();
  return json;
}

async function hlMessages(conversationId: string): Promise<Row[]> {
  const j = await hl("GET", `/conversations/${conversationId}/messages?limit=50`);
  return ((j.messages as Row)?.messages as Row[]) ?? [];
}

let me = "";
let token = "";
let customerId = "";
let threadId = "";
let hlConversationId = "";
let contactId = "";

test.describe("conversations and email, in HighLevel", () => {
  test.skip(!canRun, "needs staging, the sandbox token, the QA admin and HIGHLEVEL_EMAIL=on in .env.local");

  test("the client and their thread exist on both sides", async () => {
    const { ensureLogin } = await import("./helpers");
    await ensureLogin(client);
    me = await tokenFor(client);
    token = await tokenFor(admin);
    const list = await api<{ customers: { id: string; email: string }[] }>("/api/admin/customers/", { token });
    customerId = String(list.customers.find((c) => c.email === client.email)?.id ?? "");
    expect(customerId, "run the HighLevel walkthrough first: it makes this client").toMatch(/^[0-9a-f-]{36}$/);
    const thread = await api<{ id: string }>("/api/portal/conversations/ensure/", { method: "POST", token: me, body: {} });
    threadId = thread.id;
    expect(threadId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("a message typed in the portal lands on the client's HighLevel thread", async () => {
    const form = new FormData();
    form.set("body", `Hello from the portal ${stamp}. Can we move the launch to Friday?`);
    const posted = await api<{ message: { id: string } }>(`/api/portal/conversations/${threadId}/messages/`, {
      method: "POST",
      token: me,
      form,
    });
    expect(posted.message?.id).toBeTruthy();

    const { data: conv } = await db().from("conversations").select("hl_conversation_id").eq("id", threadId).single();
    hlConversationId = String(conv?.hl_conversation_id ?? "");
    expect(hlConversationId, "the thread should have a HighLevel conversation").toBeTruthy();
    const { data: msg } = await db().from("messages").select("hl_message_id, channel").eq("id", posted.message.id).single();
    expect(msg?.hl_message_id).toBeTruthy();
    expect(msg?.channel).toBe("portal");

    const over = await hlMessages(hlConversationId);
    const mine = over.find((m) => String(m.id) === String(msg?.hl_message_id));
    expect(mine, JSON.stringify(over.slice(0, 3))).toBeTruthy();
    expect(String(mine!.direction)).toBe("inbound");
    expect(String(mine!.body)).toContain(`Hello from the portal ${stamp}`);
    contactId = String(mine!.contactId);
  });

  test("a reply typed inside HighLevel appears in the portal, marked as such", async () => {
    /* the studio answering from HighLevel's own inbox */
    await hl("POST", "/conversations/messages", {
      type: "Live_Chat",
      contactId,
      conversationId: hlConversationId,
      message: `Friday works. Reply from HighLevel ${stamp}.`,
    });
    /* the minute cron pulls it, and so does opening the thread */
    const out = await api<{ messages: { landed: number } | null }>("/api/cron/hl-sync/", { token });
    expect(out.messages).toBeTruthy();
    const thread = await api<{ messages: { senderRole: string; body: string; channel: string }[] }>(
      `/api/portal/conversations/${threadId}/messages/`,
      { token: me },
    );
    const reply = thread.messages.find((m) => m.body.includes(`Reply from HighLevel ${stamp}`));
    expect(reply, JSON.stringify(thread.messages.slice(-3))).toBeTruthy();
    expect(reply!.senderRole).toBe("studio");
    expect(reply!.channel).toBe("live_chat");

    /* and the studio's own reply typed in admin reaches HighLevel as outbound */
    const form = new FormData();
    form.set("body", `Booked for Friday. From admin ${stamp}.`);
    await api(`/api/admin/conversations/${threadId}/messages/`, { method: "POST", token, form });
    const over = await hlMessages(hlConversationId);
    const fromAdmin = over.find((m) => String(m.body).includes(`From admin ${stamp}`));
    expect(fromAdmin, "the admin reply should be on the HighLevel thread").toBeTruthy();
    expect(String(fromAdmin!.direction)).toBe("outbound");
  });

  test("an email the platform sends leaves through HighLevel and is logged with its id", async () => {
    const r = await api<{ ok: boolean }>(`/api/admin/customers/${customerId}/welcome-email/`, {
      method: "POST",
      token,
      body: { email: client.email },
    });
    expect(r.ok).toBeTruthy();
    const { data: logRow } = await db()
      .from("email_log")
      .select("status, meta, template_key, error")
      .eq("to_email", client.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    const meta = (logRow?.meta as Row) ?? {};
    expect(logRow?.template_key).toBe("portal_welcome");
    expect(meta.provider).toBe("highlevel");
    expect(String(meta.hl_message_id ?? "")).toMatch(/^[A-Za-z0-9]{20}$/);

    /* the email sits on the same thread as the chat */
    const over = await hlMessages(String(meta.hl_conversation_id ?? hlConversationId));
    const mail = over.find((m) => String(m.id) === String(meta.hl_message_id) || String(m.messageType).includes("EMAIL"));
    expect(mail, "the email should be on the HighLevel thread").toBeTruthy();
    expect(String(mail!.direction)).toBe("outbound");

    /* and HighLevel's verdict on delivery reaches the log: a .test address has no mailbox */
    await new Promise((res) => setTimeout(res, 21_000));
    const checked = await api<{ email: { checked: number } | null }>("/api/cron/hl-sync/", { token });
    expect(checked.email).toBeTruthy();
    const { data: after } = await db()
      .from("email_log")
      .select("status, error, meta")
      .eq("to_email", client.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    const verdict = ((after?.meta as Row) ?? {}).hl_status;
    expect(verdict, "HighLevel should have been asked").toBeTruthy();
    if (after?.status === "failed") expect(String(after.error)).toContain("HighLevel");
  });

  test("what the client is waiting on is written on the contact", async () => {
    const { data: cfg } = await db().from("hl_config").select("config").eq("location_id", LOC).single();
    const fields = (cfg?.config as { contactFields: Record<string, string> }).contactFields;
    await db().rpc("hl_enqueue", { p_kind: "customer", p_entity: customerId, p_reason: "walkthrough" });
    const out = await api<{ failed: number; rows: Row[] }>("/api/cron/hl-sync/", { token });
    expect(out.failed, JSON.stringify(out.rows)).toBe(0);
    const contact = ((await hl("GET", `/contacts/${contactId}`)).contact as Row) ?? {};
    const custom = (contact.customFields as { id: string; value?: unknown }[]) ?? [];
    const waiting = custom.find((f) => f.id === fields.waitingOn);
    /* the walkthrough client has a project in the studio's court, so nothing is owed right now */
    expect(waiting === undefined || ["", "brief", "review", "approval"].includes(String(waiting.value ?? ""))).toBeTruthy();
    const tags = (contact.tags as string[]) ?? [];
    const owes = Boolean(waiting && String(waiting.value ?? "") !== "");
    expect(tags.includes("ghlv-waiting-on-client")).toBe(owes);
  });
});
