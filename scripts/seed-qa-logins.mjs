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
import { readFileSync, writeFileSync } from "node:fs";
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
  /* the owner's own staging login, on the allowlist the copy already carries;
     more can be added: node scripts/seed-qa-logins.mjs --admin someone@vidiosa.com */
  { email: "shariful@vidiosa.com", name: "Shariful Islam", admin: true },
  ...process.argv
    .filter((a, i, all) => all[i - 1] === "--admin")
    .map((email) => ({ email: email.toLowerCase(), name: email.split("@")[0], admin: true })),
];

const password = () => randomBytes(12).toString("base64url");
/* the walkthrough suite signs in with these, so they are written into the
   staging env file as well as printed; staging only, never production */
const made = {};
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
  /* only the two the walkthrough suite uses go into the env file */
  if (l.email === "qa-admin@ghlvideo.test") made.QA_ADMIN = { email: l.email, password: pw };
  if (l.email === "shariful@ghlvideo.com") made.QA_CLIENT = { email: l.email, password: pw };
  if (l.admin) {
    const { error } = await db.from("admins").upsert({ email: l.email, name: l.name }, { onConflict: "email" });
    if (error) console.error(`admins row for ${l.email}: ${error.message}`);
    else console.log(`         ${l.email} is on the admin allowlist`);
  }
}
/* into .env.local for the walkthrough suite: replace the lines if present */
{
  const path = new URL("../.env.local", import.meta.url);
  const keep = readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => !/^QA_(ADMIN|CLIENT)_(EMAIL|PASSWORD)=/.test(l));
  while (keep.length && keep[keep.length - 1] === "") keep.pop();
  for (const [k, v] of Object.entries(made)) keep.push(`${k}_EMAIL=${v.email}`, `${k}_PASSWORD=${v.password}`);
  writeFileSync(path, keep.join("\n") + "\n");
}
console.log("Done. The same logins are in .env.local for npm run test:walk. Staging only.");
