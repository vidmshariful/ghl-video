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

/* The owner's rating, drawn so a scan of the list ranks itself. Unrated is
 * shown as "not rated yet" rather than as zero stars: not looked at and
 * looked at but not keen are different answers and must not read alike. */
const stars = (r) => (r ? `${"*".repeat(r)}${"-".repeat(5 - r)} ${r}/5` : "not rated yet");

const line = (e) => {
  const day = (e.decided_on ?? e.created_at ?? "").slice(0, 10);
  const status = e.status ? ` [${e.status}${e.superseded_by ? ` by #${e.superseded_by}` : ""}]` : "";
  const rated = e.rating != null ? `  ${stars(e.rating)}` : "";
  /* Shariful's note last, indented and marked, because it is the newest
   * information on the entry and usually the part that changes what to do. */
  const note = e.feedback
    ? `\n\n  >> SHARIFUL SAYS: ${e.feedback.replaceAll("\n", "\n     ")}`
    : "";
  return `#${e.seq} ${e.kind.toUpperCase()} ${day}${status} (${e.author})${rated}\n  ${e.title}${e.body ? `\n  ${e.body.replaceAll("\n", "\n  ")}` : ""}${note}`;
};

if (cmd === "ideas") {
  const { data, error } = await db
    .from("journal")
    .select("*")
    .eq("kind", "idea")
    .in("status", ["open", "planned"])
    /* Best rated first so the ones he wants lead the list. Unrated fall to
     * the bottom rather than disappearing: an idea he has not seen yet is
     * still worth raising, just after the ones he has already asked for. */
    .order("rating", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (!data.length) console.log("No open ideas.");

  const rated = data.filter((e) => e.rating != null);
  const withNotes = data.filter((e) => e.feedback);
  if (rated.length || withNotes.length) {
    console.log(
      `${rated.length} of ${data.length} rated, ${withNotes.length} with a note from Shariful. Best rated first.\n`,
    );
  }
  for (const e of data) console.log(line(e), "\n");
} else if (cmd === "queue" || cmd === "bugs" || cmd === "features") {
  /* what the team has raised and is waiting on: open bug reports and feature
     requests. `queue` shows both, `bugs`/`features` narrow to one. */
  const kinds = cmd === "bugs" ? ["bug"] : cmd === "features" ? ["feature"] : ["bug", "feature"];
  const { data, error } = await db
    .from("journal")
    .select("*")
    .in("kind", kinds)
    .in("status", ["open", "planned"])
    .order("kind", { ascending: true })
    .order("rating", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (!data.length) console.log(`No open ${kinds.join(" or ")} entries.`);
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
  if (!["log", "decision", "idea", "bug", "feature"].includes(kind ?? "") || !title) {
    console.error('usage: add --kind log|decision|idea|bug|feature --title "..." [--body ...] [--status ...] [--decided-on YYYY-MM-DD] [--author name] [--supersedes N]');
    process.exit(1);
  }
  /* bugs and feature requests share the idea lifecycle, so they open the
     same way; decisions are active; a log is undated status-less prose */
  const status =
    flag("status") ??
    (kind === "decision" ? "active" : ["idea", "bug", "feature"].includes(kind) ? "open" : null);
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
  console.error("usage: journal.mjs ideas | queue | bugs | features | recent [n] | add ... | set-status <seq> <status>");
  process.exit(1);
}
