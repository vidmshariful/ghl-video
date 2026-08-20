/*
 * Is the demo client still worth testing against?
 *
 *   npm run check:demo
 *
 * Reads the demo account back through the same queries the screens run, and
 * checks the two things that make it useful: it holds no money, and every
 * board and portal tab has something in it. A demo account rots quietly, and
 * a rotted one is worse than none because it makes a broken screen look fine.
 *
 * Not in the prebuild gate: the demo is optional and a deploy must never
 * depend on it existing. Run it after seeding, or whenever a screen looks
 * emptier than it should.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
for (const l of readFileSync(".env.local","utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m) process.env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
const E = "shariful@ghlvideo.com";
let bad = 0; const need = (ok,msg)=>{ console.log((ok?"  ok   ":"  FAIL ")+msg); if(!ok) bad++; };

/* absent is not a failure: the demo is optional */
const { data: who } = await db.from("customers").select("id").ilike("email", E).maybeSingle();
if (!who) { console.log("The demo client is not seeded. Run: npm run seed:demo"); process.exit(0); }

console.log("MONEY (must be untouched by the demo)");
const { data: paid } = await db.from("orders").select("amount_cents, customer_email").eq("status","paid");
const demoMoney = paid.filter(o=>o.customer_email===E).reduce((s,o)=>s+o.amount_cents,0);
const realMoney = paid.filter(o=>o.customer_email!==E).reduce((s,o)=>s+o.amount_cents,0);
need(demoMoney===0, `demo orders total $${demoMoney/100}`);
console.log(`         real revenue still $${(realMoney/100).toLocaleString()}`);
const { data: sp } = await db.from("subscription_payments").select("amount_cents").eq("customer_email",E);
need(sp.every(p=>p.amount_cents===0), `${sp.length} demo charges, all zero`);
const { data: inv } = await db.from("invoices").select("total_cents").eq("customer_email",E);
need(inv.every(i=>i.total_cents===0), `${inv.length} demo invoices, all zero`);

console.log("\nWHAT THE PREMADE BOARD SEES");
const { data: board } = await db.from("orders")
  .select("invoice_number, fulfillment_stage, products(name)").eq("customer_email",E).eq("status","paid");
board.forEach(o=>console.log(`         ${o.invoice_number} ${o.products?.name} -> ${o.fulfillment_stage}`));
need(board.length===3, `3 orders on the board`);

console.log("\nWHAT MY VIDEOS SEES");
const { data: orders } = await db.from("orders").select("id").eq("customer_email",E);
const { data: projs }  = await db.from("projects").select("id").eq("customer_email",E);
const { data: subs }   = await db.from("subscriptions").select("id").eq("customer_email",E);
const { data: cycs }   = await db.from("subscription_cycles").select("id").in("subscription_id", subs.map(s=>s.id));
const groups = { order: orders.map(o=>o.id), project: projs.map(p=>p.id), cycle: cycs.map(c=>c.id) };
let total = 0;
for (const [k, ids] of Object.entries(groups)) {
  const { data } = await db.from("order_deliverables").select("status").in(`${k}_id`, ids);
  total += data.length;
  console.log(`         ${k}: ${data.length} videos [${[...new Set(data.map(d=>d.status))].join(", ")}]`);
  need(data.length>0, `${k} videos exist`);
}
console.log(`         ${total} videos in total`);

console.log("\nWHAT THE EDITING BOARD SEES (this month)");
const { data: cyc } = await db.from("subscription_cycles").select("id, long_form_allowed, short_form_allowed")
  .in("subscription_id", subs.map(s=>s.id)).order("period_start",{ascending:false}).limit(1).single();
const { data: reqs } = await db.from("order_deliverables")
  .select("title, status, form, assets_ready_at, cancelled_at, parent_id, qc").eq("cycle_id", cyc.id).order("position");
const col = r => r.status==="queued" && !r.assets_ready_at ? "waiting" : r.status;
const live = reqs.filter(r=>!r.cancelled_at);
for (const c of ["waiting","queued","in_production","ready","revisions","approved"]) {
  const n = live.filter(r=>col(r)===c).length;
  console.log(`         ${c.padEnd(14)} ${n}`);
}
need(new Set(live.map(col)).size >= 4, "at least four columns have something in them");
const used = { long: live.filter(r=>r.form==="long").length, short: live.filter(r=>r.form==="short").length };
console.log(`         slots: ${used.long} of ${cyc.long_form_allowed} long, ${used.short} of ${cyc.short_form_allowed} short`);
need(live.some(r=>r.parent_id), "a long form with short cuts exists");
need(reqs.some(r=>r.cancelled_at), "a cancelled request exists, with its slot returned");
const ready = live.find(r=>r.status==="ready");
need(ready && Object.values(ready.qc ?? {}).filter(Boolean).length===6, "the video in Review has passed all six QC checks");

console.log("\nOTHER SCREENS");
for (const [t, col2] of [["editing_style_guides","customer_email"],["brand_kits",null],["conversations","customer_email"]]) {
  if (t==="brand_kits") {
    const { data: c } = await db.from("customers").select("id").eq("email",E).single();
    const { count } = await db.from("brand_kits").select("id",{count:"exact",head:true}).eq("customer_id",c.id);
    need(count===1, "brand kit"); continue;
  }
  const { count } = await db.from(t).select("id",{count:"exact",head:true}).eq(col2,E);
  need(count>=1, t.replace(/_/g," "));
}
console.log(bad ? `\n--- ${bad} CHECK(S) FAILED ---` : "\n--- EVERYTHING THE SCREENS READ IS THERE ---");
process.exitCode = bad ? 1 : 0;
