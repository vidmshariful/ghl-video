import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
const dot = {};
for (const line of readFileSync(".env.local","utf8").split("\n")) {
  const t=line.trim(); if(!t||t.startsWith("#")||!t.includes("=")) continue;
  const i=t.indexOf("="); dot[t.slice(0,i).trim()]=t.slice(i+1).trim().replace(/^["']|["']$/g,"");
}
const sb = createClient(dot.NEXT_PUBLIC_SUPABASE_URL, dot.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: row } = await sb.from("integrations").select("config").eq("id","google").single();
const a = row.config;
const b64 = (x) => Buffer.from(x).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const now = Math.floor(Date.now()/1000);
const h = b64(JSON.stringify({alg:"RS256",typ:"JWT"}));
const c = b64(JSON.stringify({iss:a.client_email,scope:"https://www.googleapis.com/auth/webmasters.readonly",aud:"https://oauth2.googleapis.com/token",exp:now+3600,iat:now}));
const sg = createSign("RSA-SHA256"); sg.update(`${h}.${c}`);
const tok = (await (await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:`${h}.${c}.${b64(sg.sign(a.private_key))}`})})).json()).access_token;
const end=new Date(); end.setUTCDate(end.getUTCDate()-3); const st=new Date(end); st.setUTCDate(st.getUTCDate()-89);
const iso=(d)=>d.toISOString().slice(0,10);
const rows = (await (await fetch("https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Aghlvideo.com/searchAnalytics/query",{method:"POST",headers:{Authorization:`Bearer ${tok}`,"content-type":"application/json"},body:JSON.stringify({startDate:iso(st),endDate:iso(end),dimensions:["page"],rowLimit:80})})).json()).rows ?? [];
const paths = [...new Set(rows.map(r => r.keys[0].replace(/^https?:\/\/[^/]+/,"") || "/"))];
const imp = {}; for (const r of rows) { const p = r.keys[0].replace(/^https?:\/\/[^/]+/,"")||"/"; imp[p]=(imp[p]||0)+r.impressions; }
const KEY = dot.ACCESS_BYPASS_KEY;
console.log(`Testing ${paths.length} URLs Google has traffic for, against the LIVE site:\n`);
const dead = [];
for (const p of paths) {
  const r = await fetch(`https://www.ghlvideo.com${p}`, { headers: { Cookie:`ghlv_pass=${KEY}`, "User-Agent":"Mozilla/5.0" }, redirect:"manual" }).catch(()=>null);
  const code = r?.status ?? 0;
  if (code >= 400 || code === 0) { dead.push([p, code, imp[p]]); }
}
if (!dead.length) console.log("  every one resolves.");
else { console.log("  DEAD URLs that still earn impressions:\n");
  for (const [p,code,i] of dead.sort((x,y)=>y[2]-x[2])) console.log(`   ${String(code).padStart(3)}  ${String(i).padStart(6)} impressions   ${p}`); }
