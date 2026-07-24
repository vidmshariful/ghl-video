/*
 * Apply supabase/migrations/*.sql in filename order and record what ran, so
 * "which migrations are live in prod" is a table, not a memory.
 *
 *   node scripts/apply-migrations.mjs            apply everything pending
 *   node scripts/apply-migrations.mjs --dry-run  list pending, change nothing
 *   node scripts/apply-migrations.mjs --baseline 0010_intake_files.sql
 *       record files up to and including that one as applied WITHOUT
 *       executing them (bootstrap for a database that already has them)
 *
 * State lives in public.schema_migrations (created on first run). Every
 * migration in this repo is idempotent, so the simplest bootstrap is to just
 * run the script: already-applied files re-run harmlessly and get recorded.
 *
 * Connection: SUPABASE_DB_URL from .env.local or the environment (the
 * Session-mode Postgres string; see .env.example). Never read by the app at
 * runtime; this is a trusted-shell tool.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

// dev convenience: load .env.local if present; production sets real env vars.
const dotenv = {};
const envPath = new URL("../.env.local", import.meta.url);
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    dotenv[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}
const env = (k) => dotenv[k] ?? process.env[k];

const DB_URL = env("SUPABASE_DB_URL");
if (!DB_URL || DB_URL.includes("PASSWORD")) {
  console.error("SUPABASE_DB_URL is unset (or still the .env.example placeholder).");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const baselineIdx = args.indexOf("--baseline");
const baselineUpTo = baselineIdx >= 0 ? args[baselineIdx + 1] : null;
if (baselineIdx >= 0 && !baselineUpTo) {
  console.error("--baseline needs a filename, e.g. --baseline 0010_intake_files.sql");
  process.exit(1);
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
if (!files.length) {
  console.error(`No .sql files found in ${dir}`);
  process.exit(1);
}

// Supabase's pooler terminates TLS with a cert node's default CA set may not
// chain; the transport stays encrypted.
const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  await client.query(`
    create table if not exists public.schema_migrations (
      filename    text primary key,
      applied_at  timestamptz not null default now()
    );
  `);

  const { rows } = await client.query("select filename from public.schema_migrations");
  const applied = new Set(rows.map((r) => r.filename));
  const pending = files.filter((f) => !applied.has(f));

  if (baselineUpTo) {
    if (!files.includes(baselineUpTo)) {
      console.error(`--baseline ${baselineUpTo} is not a file in supabase/migrations/`);
      process.exit(1);
    }
    const upTo = files.filter((f) => f <= baselineUpTo && !applied.has(f));
    for (const f of upTo) {
      await client.query("insert into public.schema_migrations (filename) values ($1)", [f]);
      console.log(`baselined  ${f}`);
    }
    console.log(`Recorded ${upTo.length} file(s) as applied without executing.`);
    process.exit(0);
  }

  if (!pending.length) {
    console.log(`Up to date: all ${files.length} migrations recorded as applied.`);
    process.exit(0);
  }
  console.log(`${pending.length} pending: ${pending.join(", ")}`);
  if (dryRun) process.exit(0);

  for (const f of pending) {
    const sql = readFileSync(path.join(dir, f), "utf8");
    process.stdout.write(`applying   ${f} ... `);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into public.schema_migrations (filename) values ($1)", [f]);
      await client.query("commit");
      console.log("ok");
    } catch (err) {
      await client.query("rollback");
      console.log("FAILED");
      console.error(`\n${f}: ${err.message}\nNothing after it was run.`);
      process.exit(1);
    }
  }
  console.log("Done.");
} finally {
  await client.end();
}
