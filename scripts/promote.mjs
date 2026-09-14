import { readFileSync } from "node:fs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

/*
 * Move production to another Supabase project, once.
 *
 *   node scripts/promote.mjs --from .env.prod.local --to .env.newprod.local --dry-run
 *   node scripts/promote.mjs --from .env.prod.local --to .env.newprod.local
 *   node scripts/promote.mjs ... --data      only the logins and the tables
 *   node scripts/promote.mjs ... --files     only the uploaded files
 *
 * What moves, in order:
 *   1. the logins: auth.users and auth.identities, with their ids and their
 *      password hashes, so every client and teammate keeps their password.
 *      Sessions are not moved; everyone signs in once more.
 *   2. every public table, in foreign-key order, exactly as
 *      scripts/staging-refresh does it, profiles included this time because
 *      the logins they hang off were just copied. Triggers are off while the
 *      rows land, so nothing is queued for HighLevel by the copy itself; the
 *      first fill is a separate, deliberate step (npm run hl:sync -- --all).
 *   3. the uploaded files, bucket by bucket, same paths.
 *
 * The destination must already carry the schema (GHLV_ENV_FILE=<to> npm run
 * migrate) and must be a different project from the source. The public
 * tables on the destination are emptied before the copy, so the script is
 * safe to run twice; the logins and the files are added only where missing.
 */

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const dry = flag("--dry-run");
const doData = flag("--data") || !flag("--files");
const doFiles = flag("--files") || !flag("--data");

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
  return { user, password, host: hm[1], port: hm[2] ? Number(hm[2]) : 5432, database: hm[3].split("?")[0], ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 };
}

const fromFile = opt("--from", ".env.prod.local");
const toFile = opt("--to", null);
if (!toFile) {
  console.error("Say where to: --to .env.newprod.local");
  process.exit(1);
}
const from = readEnv(fromFile);
const to = readEnv(toFile);
for (const [label, e] of [[fromFile, from], [toFile, to]]) {
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL"]) {
    if (!e[k] || /PASTE_FROM/.test(e[k])) {
      console.error(`${label}: ${k} is not filled in.`);
      process.exit(1);
    }
  }
}
if (from.NEXT_PUBLIC_SUPABASE_URL === to.NEXT_PUBLIC_SUPABASE_URL) {
  console.error("Refusing: source and destination are the same project.");
  process.exit(1);
}
const ref = (e) => new URL(e.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
console.log(`\nPROMOTE  ${ref(from)}  ->  ${ref(to)}${dry ? "  (dry run)" : ""}\n`);

const src = new pg.Client(parseDbUrl(from.SUPABASE_DB_URL));
const dst = new pg.Client(parseDbUrl(to.SUPABASE_DB_URL));
await src.connect();
await dst.connect();

/* the destination must be migrated to what the source's code expects */
const { rows: mig } = await dst.query("select count(*)::int as n from public.schema_migrations").catch(() => ({ rows: [{ n: 0 }] }));
if (mig[0].n === 0) {
  console.error("The destination has no migrations. Run GHLV_ENV_FILE=<to> npm run migrate first.");
  process.exit(1);
}

/* ---- 1. the logins ---------------------------------------------------- */

async function copyAuthTable(table, conflict) {
  const q = (c) => c.query(
    "select column_name from information_schema.columns where table_schema='auth' and table_name=$1 and is_generated='NEVER' order by ordinal_position",
    [table],
  );
  const a = new Set((await q(src)).rows.map((r) => r.column_name));
  const b = new Set((await q(dst)).rows.map((r) => r.column_name));
  const cols = [...a].filter((c) => b.has(c));
  const list = cols.map((c) => `"${c}"`).join(", ");
  const { rows } = await src.query(`select ${list} from auth."${table}"`);
  if (dry) {
    console.log(`  auth.${table.padEnd(14)} ${rows.length} rows (${cols.length} columns)`);
    return rows.length;
  }
  let added = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const r = await dst.query(
      `insert into auth."${table}" (${list}) select ${list} from json_populate_recordset(null::auth."${table}", $1::json) on conflict ${conflict} do nothing`,
      [JSON.stringify(chunk)],
    );
    added += r.rowCount ?? 0;
  }
  console.log(`  auth.${table.padEnd(14)} ${rows.length} rows, ${added} added`);
  return rows.length;
}

/* ---- 2. the tables ---------------------------------------------------- */

async function copyPublic() {
  const { rows: tableRows } = await dst.query(
    "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name",
  );
  const tables = tableRows.map((r) => r.table_name);
  const { rows: srcTables } = await src.query(
    "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'",
  );
  const have = new Set(srcTables.map((r) => r.table_name));
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
    "select table_name, column_name, is_identity from information_schema.columns where table_schema='public'",
  );
  const hasCreatedAt = new Set(colRows.filter((c) => c.column_name === "created_at").map((c) => c.table_name));
  const identity = new Map();
  for (const c of colRows) if (c.is_identity === "YES") identity.set(c.table_name, c.column_name);

  if (dry) {
    let total = 0;
    for (const t of ordered) {
      if (t === "schema_migrations") continue;
      if (!have.has(t)) { console.log(`  ${t.padEnd(26)} new table, nothing to copy`); continue; }
      const { rows } = await src.query(`select count(*)::int as n from public."${t}"`);
      total += rows[0].n;
      console.log(`  ${t.padEnd(26)} ${rows[0].n}`);
    }
    console.log(`  ${ordered.length} tables, ${total} rows would move`);
    return;
  }

  let total = 0;
  await dst.query("begin");
  try {
    for (const t of [...ordered].reverse()) await dst.query(`alter table public."${t}" disable trigger user`);
    for (const t of [...ordered].reverse()) {
      if (t === "schema_migrations") continue;
      await dst.query(`delete from public."${t}"`);
    }
    for (const t of ordered) {
      if (t === "schema_migrations") continue;
      if (!have.has(t)) { console.log(`  ${t.padEnd(26)} new table, left empty`); continue; }
      const order = hasCreatedAt.has(t) ? ` order by created_at` : "";
      const { rows } = await src.query(`select * from public."${t}"${order}`);
      const overriding = identity.has(t) ? " overriding system value" : "";
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        await dst.query(
          `insert into public."${t}"${overriding} select * from json_populate_recordset(null::public."${t}", $1::json)`,
          [JSON.stringify(chunk)],
        );
      }
      total += rows.length;
      console.log(`  ${t.padEnd(26)} ${rows.length}`);
    }
    for (const t of ordered) await dst.query(`alter table public."${t}" enable trigger user`);
    for (const [t, col] of identity) {
      await dst.query(`select setval(pg_get_serial_sequence('public."${t}"', '${col}'), coalesce((select max("${col}") from public."${t}"), 0) + 1, false)`);
    }
    const { rows: inv } = await dst.query(`select coalesce(max(nullif(regexp_replace(number, '\\D', '', 'g'), '')::bigint), 1000) as n from public.invoices where number like 'INV-%'`);
    await dst.query(`select setval('public.invoice_number_seq', $1::bigint + 1, false)`, [inv[0].n]);
    await dst.query("commit");
    console.log(`  ${total} rows moved`);
  } catch (e) {
    await dst.query("rollback").catch(() => null);
    throw e;
  }
}

/* ---- 3. the files ----------------------------------------------------- */

async function copyFiles() {
  const a = createClient(from.NEXT_PUBLIC_SUPABASE_URL, from.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const b = createClient(to.NEXT_PUBLIC_SUPABASE_URL, to.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: buckets, error } = await a.storage.listBuckets();
  if (error) throw new Error(`listing buckets: ${error.message}`);
  const { data: dstBuckets } = await b.storage.listBuckets();
  const dstNames = new Set((dstBuckets ?? []).map((x) => x.name));
  for (const bucket of buckets) {
    if (!dstNames.has(bucket.name)) {
      const { error: mk } = await b.storage.createBucket(bucket.name, { public: bucket.public });
      if (mk && !dry) throw new Error(`making bucket ${bucket.name}: ${mk.message}`);
    }
    const files = [];
    const walk = async (prefix) => {
      const { data: objs, error: le } = await a.storage.from(bucket.name).list(prefix, { limit: 1000 });
      if (le) throw new Error(`listing ${bucket.name}/${prefix}: ${le.message}`);
      for (const o of objs ?? []) {
        const path = prefix ? `${prefix}/${o.name}` : o.name;
        if (o.id === null || o.metadata === null) await walk(path);
        else files.push({ path, type: o.metadata?.mimetype, size: Number(o.metadata?.size ?? 0) });
      }
    };
    await walk("");
    if (dry) {
      console.log(`  ${bucket.name.padEnd(16)} ${files.length} files, ${(files.reduce((n, f) => n + f.size, 0) / 1048576).toFixed(1)} MB`);
      continue;
    }
    let copied = 0;
    for (const f of files) {
      const { data: blob, error: de } = await a.storage.from(bucket.name).download(f.path);
      if (de) throw new Error(`downloading ${bucket.name}/${f.path}: ${de.message}`);
      const { error: ue } = await b.storage.from(bucket.name).upload(f.path, blob, { contentType: f.type, upsert: true });
      if (ue) throw new Error(`uploading ${bucket.name}/${f.path}: ${ue.message}`);
      copied += 1;
    }
    console.log(`  ${bucket.name.padEnd(16)} ${copied} of ${files.length} files copied`);
  }
}

/* ---- run ---------------------------------------------------------------- */

try {
  if (doData) {
    console.log("Logins");
    await copyAuthTable("users", "(id)");
    await copyAuthTable("identities", "do");
    console.log("Tables");
    await copyPublic();
  }
  if (doFiles) {
    console.log("Files");
    await copyFiles();
  }
  if (!dry && doData) {
    const [{ rows: u }, { rows: c }, { rows: o }] = await Promise.all([
      dst.query("select count(*)::int as n from auth.users"),
      dst.query("select count(*)::int as n from public.customers"),
      dst.query("select count(*)::int as n from public.orders"),
    ]);
    console.log(`\nOn ${ref(to)} now: ${u[0].n} logins, ${c[0].n} customers, ${o[0].n} orders.`);
  }
  console.log(dry ? "\nDry run, nothing changed." : "\nDone.");
} catch (e) {
  console.error(`\nPromote stopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  await src.end().catch(() => null);
  await dst.end().catch(() => null);
}
