import { readFileSync } from "node:fs";
import pg from "pg";

/*
 * Carry the journal entries written on staging during the rebuild into the
 * new production database, once.
 *
 *   node scripts/journal-carry.mjs --from .env.local --to .env.newprod.local [--dry-run]
 *
 * Production's journal was copied across by scripts/promote.mjs, so the new
 * database holds every entry up to the one production had last. The build
 * log and the decisions of the rebuild (September 2026) were written on
 * staging and exist nowhere else; this copies every entry whose number is
 * above the destination's highest, keeping the numbers, and moves the
 * sequence past them.
 */

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
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
  const dec = (v) => { try { return decodeURIComponent(v); } catch { return v; } };
  const i = m[1].indexOf(":");
  const user = dec(i === -1 ? m[1] : m[1].slice(0, i));
  const password = i === -1 ? undefined : dec(m[1].slice(i + 1));
  const hm = m[2].match(/^([^:/]+)(?::(\d+))?\/(.+)$/);
  return { user, password, host: hm[1], port: hm[2] ? Number(hm[2]) : 5432, database: hm[3].split("?")[0], ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 };
}

const from = readEnv(opt("--from", ".env.local"));
const to = readEnv(opt("--to", ".env.newprod.local"));
if (from.NEXT_PUBLIC_SUPABASE_URL === to.NEXT_PUBLIC_SUPABASE_URL) {
  console.error("Refusing: source and destination are the same project.");
  process.exit(1);
}
const src = new pg.Client(parseDbUrl(from.SUPABASE_DB_URL));
const dst = new pg.Client(parseDbUrl(to.SUPABASE_DB_URL));
await src.connect();
await dst.connect();
try {
  const { rows: top } = await dst.query("select coalesce(max(seq), 0)::bigint as n from public.journal");
  const after = Number(top[0].n);
  const { rows: cols } = await dst.query(
    "select column_name from information_schema.columns where table_schema='public' and table_name='journal' and is_generated='NEVER' order by ordinal_position",
  );
  const list = cols.map((c) => `"${c.column_name}"`).join(", ");
  const { rows } = await src.query(`select ${list} from public.journal where seq > $1 order by seq`, [after]);
  console.log(`destination's last entry is #${after}; ${rows.length} newer entries on the source`);
  for (const r of rows) console.log(`  #${r.seq} ${String(r.kind).toUpperCase().padEnd(8)} ${r.title}`);
  if (dry || rows.length === 0) {
    console.log(dry ? "Dry run, nothing changed." : "Nothing to carry.");
  } else {
    await dst.query("begin");
    await dst.query(
      `insert into public.journal (${list}) overriding system value select ${list} from json_populate_recordset(null::public.journal, $1::json)`,
      [JSON.stringify(rows)],
    );
    await dst.query(`select setval(pg_get_serial_sequence('public.journal', 'seq'), (select max(seq) from public.journal) + 1, false)`);
    await dst.query("commit");
    console.log(`Carried ${rows.length} entries; the next entry is #${Number(rows[rows.length - 1].seq) + 1}.`);
  }
} catch (e) {
  await dst.query("rollback").catch(() => null);
  console.error(`Stopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  await src.end().catch(() => null);
  await dst.end().catch(() => null);
}
