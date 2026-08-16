import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
async function main() {
  const { data: o } = await db.from("orders").select("id, fulfillment_stage").eq("invoice_number", "QA-REVIEW").maybeSingle();
  const { data: d } = await db.from("order_deliverables").select("id,title,status,revision_round").eq("order_id", o!.id).order("position").limit(2);
  const { data: c } = await db.from("deliverable_comments").select("author_side, author_name, body, at_seconds, revision_round, resolved_at").eq("order_id", o!.id);
  const { data: n } = await db.from("notifications").select("audience, recipient_email, kind, title, body").in("kind", ["video_feedback","video_changes","video_approved","video_reply"]).order("created_at", { ascending: false }).limit(5);
  const { data: ev } = await db.from("order_events").select("event_type").eq("order_id", o!.id).order("created_at", { ascending: false }).limit(4);
  console.log("order stage:", o!.fulfillment_stage);
  console.log("first video:", { status: d![0].status, round: d![0].revision_round });
  console.log("comments:", c);
  console.log("events:", ev?.map(e => e.event_type));
  console.log("notifications:");
  for (const x of n ?? []) console.log(`   -> ${x.audience} ${x.recipient_email} [${x.kind}] ${x.title} :: ${x.body}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
