/*
 * Logins for staging, and only staging.
 *
 *   node scripts/seed-qa-logins.mjs
 *
 * Makes an admin login for the agent and the team, and a login for the demo
 * client that production's copy already carries, so every portal screen can
 * be used rather than looked at. Refuses to run against anything but the
 * project .env.local marks as staging. Passwords are generated here and
 * printed once; nobody types them into a form, the agent signs in with a
 * one-time link minted from the same admin API.
 */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}
if (env.GHLV_ENV !== "staging") {
  console.error("Refusing: .env.local is not marked GHLV_ENV=staging.");
  process.exit(1);
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const LOGINS = [
  { email: "qa-admin@ghlvideo.test", name: "QA Admin", admin: true },
  /* the demo client seeded into production and copied here: every line, zero money */
  { email: "shariful@ghlvideo.com", name: "Demo client", admin: false },
];

const password = () => randomBytes(12).toString("base64url");
const { data: existing } = await db.auth.admin.listUsers({ perPage: 1000 });
const byEmail = new Map((existing?.users ?? []).map((u) => [String(u.email).toLowerCase(), u]));

for (const l of LOGINS) {
  const have = byEmail.get(l.email);
  const pw = password();
  if (have) {
    await db.auth.admin.updateUserById(have.id, { password: pw, email_confirm: true });
    console.log(`reset    ${l.email}  password: ${pw}`);
  } else {
    const { error } = await db.auth.admin.createUser({ email: l.email, password: pw, email_confirm: true });
    if (error) { console.error(`could not create ${l.email}: ${error.message}`); continue; }
    console.log(`created  ${l.email}  password: ${pw}`);
  }
  if (l.admin) {
    const { error } = await db.from("admins").upsert({ email: l.email, name: l.name }, { onConflict: "email" });
    if (error) console.error(`admins row for ${l.email}: ${error.message}`);
    else console.log(`         ${l.email} is on the admin allowlist`);
  }
}
console.log("Done. Store the passwords somewhere private; they are not saved anywhere.");
