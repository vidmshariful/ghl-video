/*
 * Refresh staging from production.
 *
 *   node scripts/staging-refresh.mjs            copy every public table
 *   node scripts/staging-refresh.mjs --dry-run  say what would be copied
 *
 * Reads production from .env.prod.local and staging from .env.local, and
 * refuses to run if the two point at the same database. Staging ends up as a
 * snapshot of production's public schema: the same clients, orders, projects
 * and plans, so a screen can be checked against the real shapes of work. No
 * auth users are copied (staging logins are made by scripts/seed-qa-logins),
 * no uploaded files are copied, and the schema itself comes from
 * `npm run migrate` against staging first.
 *
 * How it copies: user triggers off, tables in foreign-key order, rows through
 * json_populate_recordset so every column type round-trips, identity columns
 * overridden, sequences advanced past what was copied, triggers back on.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const dry = process.argv.includes("--dry-run");

function readEnv(file) {
  const out = {};
  for (const line of readFileSync(new URL(`../${file}`, import.meta.url), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
function parseDbUrl(raw) {
  const m = raw.match(/^postgres(?:ql)?:\/\/(.*)@([^@]+)$/s);
  if (!m) throw new Error("SUPABASE_DB_URL is not a postgres URL");
  const dec = (v) => { try { return decodeURIComponent(v); } catch { return v; } };
  const i = m[1].indexOf(":");
  const user = dec(i === -1 ? m[1] : m[1].slice(0, i));
  const password = i === -1 ? undefined : dec(m[1].slice(i + 1));
  const hm = m[2].match(/^([^:/]+)(?::(\d+))?\/(.+)$/);
  return { user, password, host: hm[1], port: hm[2] ? Number(hm[2]) : 5432, database: hm[3].split("?")[0], ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 };
}

const prodEnv = readEnv(".env.prod.local");
const stagingEnv = readEnv(".env.local");
if (!prodEnv.SUPABASE_DB_URL || !stagingEnv.SUPABASE_DB_URL) {
  console.error("Both .env.prod.local and .env.local need SUPABASE_DB_URL.");
  process.exit(1);
}
if (prodEnv.NEXT_PUBLIC_SUPABASE_URL === stagingEnv.NEXT_PUBLIC_SUPABASE_URL) {
  console.error("Refusing: .env.local points at the production project. Staging must be its own project.");
  process.exit(1);
}
if (stagingEnv.GHLV_ENV !== "staging") {
  console.error("Refusing: .env.local is not marked GHLV_ENV=staging.");
  process.exit(1);
}

const src = new pg.Client(parseDbUrl(prodEnv.SUPABASE_DB_URL));
const dst = new pg.Client(parseDbUrl(stagingEnv.SUPABASE_DB_URL));
await src.connect();
await dst.connect();

/* the tables staging has (the schema is the migrations' job) and their
   foreign keys, so parents are copied before children */
const { rows: tableRows } = await dst.query(
  "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name",
);
const tables = tableRows.map((r) => r.table_name);
/* only keys between public tables: profiles points at auth.users, which is
   not copied (staging logins are made separately) */
const { rows: fkRows } = await dst.query(`
  select c.conrelid::regclass::text as child, c.confrelid::regclass::text as parent
  from pg_constraint c
  where c.contype = 'f' and c.connamespace = 'public'::regnamespace
    and c.confrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace)`);
const deps = new Map(tables.map((t) => [t, new Set()]));
for (const r of fkRows) {
  const child = r.child.replace(/^public\./, "").replace(/"/g, "");
  const parent = r.parent.replace(/^public\./, "").replace(/"/g, "");
  if (child !== parent && deps.has(child) && deps.has(parent)) deps.get(child).add(parent);
}
const ordered = [];
const seen = new Set();
const visit = (t, stack) => {
  if (seen.has(t)) return;
  if (stack.has(t)) throw new Error(`foreign key cycle through ${t}`);
  stack.add(t);
  for (const d of deps.get(t) ?? []) visit(d, stack);
  stack.delete(t);
  seen.add(t);
  ordered.push(t);
};
for (const t of tables) visit(t, new Set());

const { rows: colRows } = await dst.query(
  "select table_name, column_name, is_identity, column_default from information_schema.columns where table_schema='public'",
);
const hasCreatedAt = new Set(colRows.filter((c) => c.column_name === "created_at").map((c) => c.table_name));
const identity = new Map();
for (const c of colRows) if (c.is_identity === "YES") identity.set(c.table_name, c.column_name);

console.log(`${ordered.length} tables, in order: ${ordered.join(", ")}`);
if (dry) {
  for (const t of ordered) {
    const { rows } = await src.query(`select count(*)::int as n from public."${t}"`);
    console.log(`  ${t.padEnd(24)} ${rows[0].n} rows`);
  }
  await src.end(); await dst.end();
  process.exit(0);
}

const BATCH = 500;
let total = 0;
try {
  await dst.query("begin");
  /* children first on the way out */
  for (const t of [...ordered].reverse()) await dst.query(`alter table public."${t}" disable trigger user`);
  for (const t of [...ordered].reverse()) {
    if (t === "schema_migrations") continue;
    await dst.query(`delete from public."${t}"`);
  }
  for (const t of ordered) {
    /* profiles hang off auth.users, which staging does not copy */
    if (t === "profiles" || t === "schema_migrations") { console.log(`  ${t.padEnd(24)} skipped`); continue; }
    const order = hasCreatedAt.has(t) ? ` order by created_at` : "";
    const { rows } = await src.query(`select * from public."${t}"${order}`);
    const overriding = identity.has(t) ? " overriding system value" : "";
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      await dst.query(
        `insert into public."${t}"${overriding} select * from json_populate_recordset(null::public."${t}", $1::json)`,
        [JSON.stringify(chunk)],
      );
    }
    total += rows.length;
    console.log(`  ${t.padEnd(24)} ${rows.length}`);
  }
  for (const t of ordered) await dst.query(`alter table public."${t}" enable trigger user`);
  /* sequences past what was copied, so the next insert does not collide */
  for (const [t, col] of identity) {
    await dst.query(`select setval(pg_get_serial_sequence('public."${t}"', '${col}'), coalesce((select max("${col}") from public."${t}"), 0) + 1, false)`);
  }
  const { rows: inv } = await dst.query(`select coalesce(max(nullif(regexp_replace(number, '\\D', '', 'g'), '')::bigint), 1000) as n from public.invoices where number like 'INV-%'`);
  await dst.query(`select setval('public.invoice_number_seq', $1::bigint + 1, false)`, [inv[0].n]);
  await dst.query("commit");
  console.log(`Copied ${total} rows into staging.`);
} catch (e) {
  await dst.query("rollback").catch(() => null);
  console.error("Refresh failed, nothing changed:", e.message);
  process.exit(1);
} finally {
  await src.end();
  await dst.end();
}
