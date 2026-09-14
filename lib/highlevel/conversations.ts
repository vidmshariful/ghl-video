/*
 * Portal Messages, backed by HighLevel conversations (phase 4).
 *
 * One thread per client on both sides. A message typed in the portal is
 * written to the contact's conversation in HighLevel as an inbound live
 * chat message; a studio reply typed in admin goes over as an outbound one;
 * and whatever the client says on that thread by any channel, plus the
 * studio's live chat replies from inside HighLevel, is pulled back into the
 * portal thread here, so the client never has to know where it was typed.
 *
 * Our tables stay the record the portal reads: HighLevel's copy is the
 * studio's inbox. Fail-soft throughout: a HighLevel hiccup never loses a
 * portal message, the cron catches up on anything unmirrored.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { HighLevelError } from "@/lib/checkout/highlevel-errors";
import { hlFetch, locationId } from "./client";
import { loadHlConfig, type HlConfig } from "./config";
import { syncAllowed, syncCustomer } from "./sync";
import { likeLiteral } from "@/lib/pg-pattern";

type Db = SupabaseClient;
type Row = Record<string, unknown>;

const PULL_EVERY_MS = 15_000;

/** HighLevel's message types, in our words for the chat bubble. */
export function channelOf(messageType: unknown): string {
  const t = String(messageType ?? "").replace(/^TYPE_/, "").toLowerCase();
  if (!t) return "live_chat";
  if (t.includes("live_chat")) return "live_chat";
  if (t.includes("email")) return "email";
  if (t.includes("sms")) return "sms";
  if (t.includes("whatsapp")) return "whatsapp";
  if (t.includes("call")) return "call";
  if (t.includes("activity")) return "note";
  return t;
}

/** An email's body as chat text: tags gone, whitespace calm, capped. Pure. */
export function textOf(body: unknown, contentType?: unknown): string {
  const raw = String(body ?? "");
  const html = String(contentType ?? "").includes("html") || /<[a-z][\s\S]*>/i.test(raw);
  const text = html
    ? raw
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
    : raw;
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim().slice(0, 4000);
}

/**
 * Which HighLevel messages belong on the portal thread. Pure.
 *
 * Everything the client said, whatever channel they used; from the studio,
 * only what was typed as live chat. An outbound email or SMS is not chat:
 * the platform's own transactional mail leaves through HighLevel too, and
 * every one of them was landing in the client's Messages as a studio bubble
 * (audit, 15 September 2026). Calls and activity rows are bookkeeping in
 * either direction, not something anybody said.
 */
export function keepPulledMessage(m: { direction?: unknown; messageType?: unknown }): boolean {
  const channel = channelOf(m.messageType);
  if (channel === "call" || channel === "note") return false;
  if (String(m.direction ?? "") === "inbound") return true;
  return channel === "live_chat";
}

async function contactIdFor(db: Db, cfg: HlConfig, customer: Row): Promise<string | null> {
  const id = String(customer.id);
  const { data: link } = await db
    .from("hl_links")
    .select("hl_id")
    .eq("kind", "customer")
    .eq("entity_id", id)
    .eq("hl_kind", "contact")
    .eq("location_id", cfg.locationId)
    .maybeSingle();
  if (link) return String(link.hl_id);
  const out = await syncCustomer(db, cfg, id);
  if (out.status === "skipped") return null;
  const { data: again } = await db
    .from("hl_links")
    .select("hl_id")
    .eq("kind", "customer")
    .eq("entity_id", id)
    .eq("hl_kind", "contact")
    .eq("location_id", cfg.locationId)
    .maybeSingle();
  return again ? String(again.hl_id) : null;
}

/**
 * The HighLevel conversation behind one of our threads, found or made. Null
 * when the client is outside the allowlist or has no contact yet.
 */
export async function ensureHlConversation(
  db: Db,
  cfg: HlConfig,
  conv: Row,
  opts: { fresh?: boolean } = {},
): Promise<{ conversationId: string; contactId: string } | null> {
  const email = String(conv.customer_email ?? "").toLowerCase();
  if (!email || !syncAllowed(email)) return null;
  const { data: customer } = await db.from("customers").select("*").ilike("email", likeLiteral(email)).maybeSingle();
  if (!customer) return null;
  const contactId = await contactIdFor(db, cfg, customer);
  if (!contactId) return null;

  if (typeof conv.hl_conversation_id === "string" && conv.hl_conversation_id && !opts.fresh)
    return { conversationId: conv.hl_conversation_id, contactId };

  /* HighLevel keeps one thread per contact: reuse it before making another */
  const found = await hlFetch(
    `/conversations/search?locationId=${encodeURIComponent(cfg.locationId)}&contactId=${encodeURIComponent(contactId)}`,
    { method: "GET" },
  );
  let conversationId = String(((found.conversations as Row[]) ?? [])[0]?.id ?? "");
  if (!conversationId) {
    const made = await hlFetch("/conversations/", { method: "POST", body: JSON.stringify({ locationId: cfg.locationId, contactId }) });
    conversationId = String(((made.conversation as Row) ?? made).id ?? "");
  }
  if (!conversationId) return null;
  await db.from("conversations").update({ hl_conversation_id: conversationId }).eq("id", String(conv.id));
  return { conversationId, contactId };
}

/**
 * Write one portal message onto the HighLevel thread. Customer messages
 * arrive there as inbound live chat, studio messages as outbound, so the
 * studio's inbox reads exactly like the portal does.
 */
export async function mirrorMessage(
  db: Db,
  message: { id: string; conversationId: string; senderRole: "customer" | "studio"; senderName: string | null; body: string; attachments: { name: string }[] },
): Promise<string | null> {
  if (!process.env.HIGHLEVEL_API_TOKEN || !process.env.HIGHLEVEL_LOCATION_ID) return null;
  const cfg = await loadHlConfig(db, locationId());
  if (!cfg) return null;
  const { data: conv } = await db.from("conversations").select("*").eq("id", message.conversationId).maybeSingle();
  if (!conv) return null;

  const files = message.attachments.map((a) => a.name).filter(Boolean);
  const text = [message.body.trim(), files.length ? `(${files.length === 1 ? "attachment" : "attachments"} in the portal: ${files.join(", ")})` : ""]
    .filter(Boolean)
    .join("\n") || "(empty message)";
  const signed = message.senderRole === "studio" && message.senderName ? `${message.senderName}: ${text}` : text;

  const post = async (hl: { conversationId: string; contactId: string }): Promise<string> => {
    if (message.senderRole === "customer") {
      const j = await hlFetch("/conversations/messages/inbound", {
        method: "POST",
        body: JSON.stringify({ type: "Live_Chat", conversationId: hl.conversationId, message: signed, direction: "inbound" }),
      });
      return String(j.messageId ?? "");
    }
    const j = await hlFetch("/conversations/messages", {
      method: "POST",
      body: JSON.stringify({ type: "Live_Chat", contactId: hl.contactId, conversationId: hl.conversationId, message: signed }),
    });
    return String(j.messageId ?? "");
  };

  let hl = await ensureHlConversation(db, cfg, conv);
  if (!hl) return null;
  let hlMessageId = "";
  try {
    hlMessageId = await post(hl);
  } catch (e) {
    /* the thread we remembered is gone over there (a contact deleted or
       merged in HighLevel takes its conversation with it): find or make the
       contact's current one and say it there */
    if (!(e instanceof HighLevelError) || (e.status !== 404 && e.status !== 400)) throw e;
    hl = await ensureHlConversation(db, cfg, conv, { fresh: true });
    if (!hl) return null;
    hlMessageId = await post(hl);
  }
  if (hlMessageId) {
    await db.from("messages").update({ hl_message_id: hlMessageId }).eq("id", message.id);
    await db.from("conversations").update({ hl_last_message_at: new Date().toISOString() }).eq("id", String(conv.id));
  }
  return hlMessageId || null;
}

/**
 * Bring across what was said on the HighLevel thread since we last looked:
 * the studio's live chat replies from inside HighLevel, and the client's
 * replies by any channel. Messages we wrote ourselves carry their HighLevel
 * id, on the message row or in the email log, and are skipped. Returns how
 * many landed.
 */
export async function pullConversation(db: Db, cfg: HlConfig, conv: Row, opts: { force?: boolean } = {}): Promise<number> {
  const hlId = typeof conv.hl_conversation_id === "string" ? conv.hl_conversation_id : "";
  if (!hlId) return 0;
  const pulledAt = typeof conv.hl_pulled_at === "string" ? Date.parse(conv.hl_pulled_at) : 0;
  if (!opts.force && Date.now() - pulledAt < PULL_EVERY_MS) return 0;
  await db.from("conversations").update({ hl_pulled_at: new Date().toISOString() }).eq("id", String(conv.id));

  let j: Row;
  try {
    j = await hlFetch(`/conversations/${hlId}/messages?limit=50`, { method: "GET" });
  } catch (e) {
    /* a thread deleted over there: forget the link; the next message finds the contact's current one */
    if (e instanceof HighLevelError && (e.status === 404 || e.status === 400)) {
      await db.from("conversations").update({ hl_conversation_id: null }).eq("id", String(conv.id));
      return 0;
    }
    throw e;
  }
  const list = (((j.messages as Row)?.messages as Row[]) ?? []).slice().reverse();
  if (!list.length) return 0;
  const ids = list.map((m) => String(m.id));
  const [{ data: have }, { data: sent }] = await Promise.all([
    db.from("messages").select("hl_message_id").in("hl_message_id", ids),
    /* the platform's own sends: every email that left through HighLevel is
       logged with its message id */
    db.from("email_log").select("meta").in("meta->>hl_message_id", ids),
  ]);
  const known = new Set(((have ?? []) as Row[]).map((r) => String(r.hl_message_id)));
  for (const r of (sent ?? []) as Row[]) {
    const id = (r.meta as Row | null)?.hl_message_id;
    if (typeof id === "string" && id) known.add(id);
  }

  let landed = 0;
  let last: string | null = null;
  for (const m of list) {
    const id = String(m.id);
    if (known.has(id) || !keepPulledMessage(m)) continue;
    const channel = channelOf(m.messageType);
    const inbound = String(m.direction) === "inbound";
    const subject = typeof m.subject === "string" && m.subject.trim() ? m.subject.trim() : "";
    const text = textOf(m.body, m.contentType);
    const body = channel === "email" && subject ? `${subject}\n\n${text}` : text;
    if (!body) continue;
    const createdAt = typeof m.dateAdded === "string" ? m.dateAdded : new Date().toISOString();
    const { error } = await db.from("messages").insert({
      conversation_id: String(conv.id),
      sender_role: inbound ? "customer" : "studio",
      sender_name: inbound ? null : "The studio",
      body,
      attachments: [],
      channel,
      hl_message_id: id,
      created_at: createdAt,
    });
    if (error) continue;
    landed += 1;
    last = createdAt;
    await db
      .from("conversations")
      .update({
        last_message_at: createdAt,
        last_message_preview: body.slice(0, 140),
        last_sender_role: inbound ? "customer" : "studio",
        hl_last_message_at: createdAt,
      })
      .eq("id", String(conv.id));
  }
  return last ? landed : landed;
}

/** Every thread with a HighLevel conversation whose thread moved since we last looked. */
export async function pullRecentConversations(
  db: Db,
  cfg: HlConfig,
  opts: { until?: number } = {},
): Promise<{ checked: number; landed: number; outOfTime: boolean }> {
  const j = await hlFetch(
    `/conversations/search?locationId=${encodeURIComponent(cfg.locationId)}&sortBy=last_message_date&sort=desc&limit=50`,
    { method: "GET" },
  );
  const recent = ((j.conversations as Row[]) ?? []).map((c) => ({ id: String(c.id), at: Number(c.lastMessageDate ?? 0) }));
  if (!recent.length) return { checked: 0, landed: 0, outOfTime: false };
  const { data: ours } = await db
    .from("conversations")
    .select("*")
    .in("hl_conversation_id", recent.map((r) => r.id));
  let checked = 0;
  let landed = 0;
  let outOfTime = false;
  for (const conv of (ours ?? []) as Row[]) {
    const hl = recent.find((r) => r.id === conv.hl_conversation_id);
    const seen = typeof conv.hl_last_message_at === "string" ? Date.parse(conv.hl_last_message_at) : 0;
    if (!hl || hl.at <= seen + 1000) continue;
    /* the caller's deadline: a thread left here is picked up next minute */
    if (opts.until && Date.now() > opts.until) {
      outOfTime = true;
      break;
    }
    checked += 1;
    landed += await pullConversation(db, cfg, conv, { force: true });
    await db.from("conversations").update({ hl_last_message_at: new Date(hl.at).toISOString() }).eq("id", String(conv.id));
  }
  return { checked, landed, outOfTime };
}

/** Portal messages that never reached HighLevel (a hiccup at the time): send them now. */
export async function mirrorMissing(db: Db, limit = 20): Promise<number> {
  const { data } = await db
    .from("messages")
    .select("id, conversation_id, sender_role, sender_name, body, attachments, channel")
    .is("hl_message_id", null)
    .eq("channel", "portal")
    .order("created_at", { ascending: true })
    .limit(limit);
  let sent = 0;
  for (const m of (data ?? []) as Row[]) {
    const id = await mirrorMessage(db, {
      id: String(m.id),
      conversationId: String(m.conversation_id),
      senderRole: m.sender_role === "studio" ? "studio" : "customer",
      senderName: (m.sender_name as string | null) ?? null,
      body: String(m.body ?? ""),
      attachments: ((m.attachments as { name: string }[] | null) ?? []).map((a) => ({ name: String(a.name ?? "") })),
    }).catch(() => null);
    if (id) sent += 1;
    else {
      /* an account outside the allowlist, or no contact: mark it so it is not retried every minute */
      await db.from("messages").update({ channel: "portal_only" }).eq("id", String(m.id));
    }
  }
  return sent;
}
