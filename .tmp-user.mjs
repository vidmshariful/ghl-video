/* Throwaway portal account for screenshots. Creates or deletes on demand.
 * Never touches a real customer: the email is obviously fake. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(process.argv[3] || ".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = "claude-temp-preview@example.invalid";
const PASSWORD = "TempPreview!2026x";

async function findUser() {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  return (data?.users ?? []).find((u) => u.email === EMAIL) ?? null;
}

if (process.argv[2] === "create") {
  const existing = await findUser();
  if (existing) {
    console.log("already exists:", existing.id);
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    console.log("created:", data.user.id);
  }
  console.log("EMAIL=" + EMAIL);
  console.log("PASSWORD=" + PASSWORD);
} else if (process.argv[2] === "delete") {
  const u = await findUser();
  if (!u) console.log("nothing to delete");
  else {
    const { error } = await db.auth.admin.deleteUser(u.id);
    if (error) throw error;
    console.log("deleted:", u.id);
  }
} else {
  console.log("usage: temp-user.mjs create|delete");
}
