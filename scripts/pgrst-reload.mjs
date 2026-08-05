/* One-off: force PostgREST to reload its schema cache after a DDL migration
 * (Supabase auto-reload can lag). Same connection method as apply-migrations. */
import { existsSync, readFileSync } from "node:fs";
import pg from "pg";

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
const DB_URL = dotenv.SUPABASE_DB_URL ?? process.env.SUPABASE_DB_URL;

function parseDbUrl(raw) {
  const m = raw.match(/^postgres(?:ql)?:\/\/(.*)@([^@]+)$/s);
  if (!m) return { connectionString: raw };
  const dec = (v) => { try { return decodeURIComponent(v); } catch { return v; } };
  const i = m[1].indexOf(":");
  const user = dec(i === -1 ? m[1] : m[1].slice(0, i));
  const password = i === -1 ? undefined : dec(m[1].slice(i + 1));
  const hm = m[2].match(/^([^:/]+)(?::(\d+))?\/(.+)$/);
  if (!hm) return { connectionString: raw };
  return { user, password, host: hm[1], port: hm[2] ? Number(hm[2]) : 5432, database: hm[3].split("?")[0] };
}

const client = new pg.Client({ ...parseDbUrl(DB_URL), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 170000, query_timeout: 30000 });
await client.connect();
await client.query("NOTIFY pgrst, 'reload schema'");
await client.query("SELECT pg_notify('pgrst', 'reload config')");
console.log("PostgREST reload notified");
await client.end();
