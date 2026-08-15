import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

/*
 * The Journal CLI: how Claude (and anyone at a terminal) reads and writes
 * the shared brain in the `journal` table. The admin Journal screen is the
 * human view of the same rows.
 *
 *   node scripts/journal.mjs ideas
 *       Open ideas from the owner's inbox. Run at the START of every
 *       working session (see CLAUDE.md, The Journal ritual).
 *
 *   node scripts/journal.mjs recent [n]
 *       The latest n entries of every kind (default 15), newest first.
 *
 *   node scripts/journal.mjs add --kind log|decision|idea --title "..."
 *        [--body "..."] [--status active|open|...] [--decided-on YYYY-MM-DD]
 *        [--author claude] [--supersedes N]
 *       Adds an entry. `--supersedes N` also flips decision #N to
 *       superseded and points it at the new entry.
 *
 *   node scripts/journal.mjs set-status N open|planned|done|dropped|active|superseded
 *       Updates one entry's status (ideas moving through their workflow).
 *
 * Uses the service-role key from .env.local, like the other scripts.
 */
const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");

const env = {};
const envPath = new URL("../.env.local", import.meta.url);
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  env.SUPABASE_SERVICE_ROLE_KEY ??
  env.SUPABASE_SERVICE_ROLE;
if (!url || !key) {
  console.error("journal: missing Supabase env (NEXT_PUBLIC_SUPABASE_URL + service role key)");
  process.exit(1);
}
const db = createClient(url, key);

const args = process.argv.slice(2);
const cmd = args[0];

/* --flag value parsing */
function flag(name) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : null;
}

const line = (e) => {
  const day = (e.decided_on ?? e.created_at ?? "").slice(0, 10);
  const status = e.status ? ` [${e.status}${e.superseded_by ? ` by #${e.superseded_by}` : ""}]` : "";
  return `#${e.seq} ${e.kind.toUpperCase()} ${day}${status} (${e.author})\n  ${e.title}${e.body ? `\n  ${e.body.replaceAll("\n", "\n  ")}` : ""}`;
};

if (cmd === "ideas") {
  const { data, error } = await db
    .from("journal")
    .select("*")
    .eq("kind", "idea")
    .in("status", ["open", "planned"])
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (!data.length) console.log("No open ideas.");
  for (const e of data) console.log(line(e), "\n");
} else if (cmd === "recent") {
  const n = Number(args[1]) || 15;
  const { data, error } = await db
    .from("journal")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(n);
  if (error) throw new Error(error.message);
  for (const e of data) console.log(line(e), "\n");
} else if (cmd === "add") {
  const kind = flag("kind");
  const title = flag("title");
  if (!["log", "decision", "idea"].includes(kind ?? "") || !title) {
    console.error('usage: add --kind log|decision|idea --title "..." [--body ...] [--status ...] [--decided-on YYYY-MM-DD] [--author name] [--supersedes N]');
    process.exit(1);
  }
  const status = flag("status") ?? (kind === "decision" ? "active" : kind === "idea" ? "open" : null);
  const { data, error } = await db
    .from("journal")
    .insert({
      kind,
      title,
      body: flag("body"),
      status,
      decided_on: flag("decided-on"),
      author: flag("author") ?? "claude",
    })
    .select("seq")
    .single();
  if (error) throw new Error(error.message);
  console.log(`added #${data.seq}`);
  const supersedes = Number(flag("supersedes"));
  if (supersedes) {
    const { error: e2 } = await db
      .from("journal")
      .update({ status: "superseded", superseded_by: data.seq })
      .eq("seq", supersedes);
    if (e2) throw new Error(e2.message);
    console.log(`#${supersedes} marked superseded by #${data.seq}`);
  }
} else if (cmd === "set-status") {
  const seq = Number(args[1]);
  const status = args[2];
  if (!seq || !status) {
    console.error("usage: set-status <seq> <status>");
    process.exit(1);
  }
  const { error } = await db.from("journal").update({ status }).eq("seq", seq);
  if (error) throw new Error(error.message);
  console.log(`#${seq} -> ${status}`);
} else {
  console.error("usage: journal.mjs ideas | recent [n] | add ... | set-status <seq> <status>");
  process.exit(1);
}
