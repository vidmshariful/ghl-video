import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,"")]}));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
const { data, error } = await db.from("alarms").select("*").is("resolved_at", null).order("last_seen_at",{ascending:false});
if (error) { console.log("ERR", error.message); process.exit(1); }
console.log("OPEN ALARMS:", (data??[]).length);
for (const a of data??[]) {
  console.log("\n---", a.kind, "| severity:", a.severity, "| count:", a.count);
  console.log("  title:", a.title);
  console.log("  message:", a.message);
  console.log("  first:", a.first_seen_at, " last:", a.last_seen_at);
  console.log("  context:", JSON.stringify(a.context));
}
