import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/*
 * Shared by the walkthrough specs: the staging env, the sign-in that waits
 * for hydration, the console watcher, and the two ways the specs talk to
 * the API as a person would (a bearer token for a login, the service role
 * to set a test login's password).
 */

export const env: Record<string, string> = {};
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* no env file: every spec skips itself */
}
export const staging = env.GHLV_ENV === "staging";
export const BASE = "http://localhost:3200";

const ALLOWED_ERRORS = [/mode="md"/, /Download the React DevTools/];
export function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !ALLOWED_ERRORS.some((re) => re.test(msg.text()))) errors.push(msg.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** Sign in through the form, waiting for the signed-in screen rather than for the form to go. */
export async function signIn(
  page: Page,
  path: string,
  who: { email: string; password: string },
  signedIn: RegExp,
) {
  await page.goto(path);
  await page.waitForLoadState("networkidle", { timeout: 45_000 }).catch(() => null);
  const button = page.getByRole("button", { name: /^sign in$/i }).first();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByRole("textbox", { name: /email/i }).first().fill(who.email);
    await page.locator('input[type="password"]').first().fill(who.password);
    await button.click();
    const ok = await page
      .getByRole("heading", { name: signedIn })
      .waitFor({ timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (ok) return;
    await page.waitForTimeout(1500);
  }
  throw new Error(`could not sign in as ${who.email}: the sign-in form stayed`);
}

/** A bearer token for a login, the way the portal and admin fetch. */
export async function tokenFor(who: { email: string; password: string }): Promise<string> {
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await anon.auth.signInWithPassword(who);
  if (error || !data.session) throw new Error(`sign-in failed for ${who.email}: ${error?.message}`);
  return data.session.access_token;
}

/** Make sure a test login exists with this password. Staging only, service role. */
export async function ensureLogin(who: { email: string; password: string }) {
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const have = data?.users.find((u) => String(u.email).toLowerCase() === who.email.toLowerCase());
  if (have) await admin.auth.admin.updateUserById(have.id, { password: who.password, email_confirm: true });
  else await admin.auth.admin.createUser({ email: who.email, password: who.password, email_confirm: true });
}

/** JSON call with a bearer token; fails the test with the server's words on a non-2xx. */
export async function api<T = Record<string, unknown>>(
  path: string,
  init: { method?: string; token?: string; body?: unknown; form?: FormData } = {},
): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    redirect: "manual",
  });
  const text = await r.text();
  let json: T;
  try {
    json = JSON.parse(text) as T;
  } catch {
    throw new Error(`${init.method ?? "GET"} ${path} -> ${r.status}, not JSON: ${text.slice(0, 200)}`);
  }
  expect(r.ok, `${init.method ?? "GET"} ${path} -> ${r.status}: ${text.slice(0, 300)}`).toBeTruthy();
  return json;
}
