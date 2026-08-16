import "server-only";
import { createSign } from "node:crypto";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

/*
 * Google service-account auth, without pulling in the Google SDK: sign a
 * short-lived JWT with the account's private key and trade it for an access
 * token. Roughly forty lines against a very stable, well-documented endpoint,
 * versus a large dependency tree in the money-handling app.
 *
 * The key itself lives in the integrations table, which no browser client can
 * read (see migration 0035). It is loaded here, used here, and never returned
 * to the screen.
 */

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
].join(" ");

export type ServiceAccount = {
  type: string;
  project_id: string;
  client_email: string;
  private_key: string;
};

/** What the admin screen is allowed to see about the connection. */
export type GoogleConnection = {
  connected: boolean;
  clientEmail?: string;
  projectId?: string;
  property?: string | null;
  gaPropertyId?: string | null;
  connectedAt?: string;
  lastOkAt?: string | null;
  lastError?: string | null;
};

/** Validate a pasted key file. Returns the parsed account or a plain reason. */
export function parseServiceAccount(
  raw: string,
): { ok: true; account: ServiceAccount } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: "That does not look like the key file. Open the downloaded .json and copy all of it, including the outer braces.",
    };
  }
  const a = json as Partial<ServiceAccount>;
  if (a.type !== "service_account") {
    return {
      ok: false,
      error: "That JSON is not a service account key. In Google Cloud open the service account, then Keys, then Add key, then JSON.",
    };
  }
  if (!a.client_email || !a.private_key || !a.project_id) {
    return { ok: false, error: "The key file is missing its account email, project, or private key." };
  }
  if (!a.private_key.includes("BEGIN PRIVATE KEY")) {
    return { ok: false, error: "The private key inside the file looks damaged. Download a fresh key and paste it whole." };
  }
  return { ok: true, account: a as ServiceAccount };
}

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/* One access token per process until it is nearly expired. Google's tokens
 * last an hour; we retire ours a minute early to avoid edge-of-expiry calls. */
let cached: { token: string; expiresAt: number; email: string } | null = null;

export async function accessTokenFor(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.email === account.client_email && cached.expiresAt > now + 60) {
    return cached.token;
  }

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: GOOGLE_SCOPES,
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = b64url(signer.sign(account.private_key));
  const assertion = `${header}.${claims}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description ??
        data.error ??
        "Google refused the key. Check that the Search Console API is enabled for this project.",
    );
  }
  cached = {
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600),
    email: account.client_email,
  };
  return data.access_token;
}

/* ---------------------------------------------------------------- */
/* storage                                                           */
/* ---------------------------------------------------------------- */

type Row = {
  config: ServiceAccount;
  meta: { property?: string | null; gaPropertyId?: string | null };
  connected_at: string;
  last_ok_at: string | null;
  last_error: string | null;
};

async function row(): Promise<Row | null> {
  const { data } = await supabaseAdmin()
    .from("integrations")
    .select("config, meta, connected_at, last_ok_at, last_error")
    .eq("id", "google")
    .maybeSingle();
  return (data as Row | null) ?? null;
}

/** The stored account, or null when Google is not connected yet. */
export async function googleAccount(): Promise<ServiceAccount | null> {
  return (await row())?.config ?? null;
}

/** The chosen Search Console property and GA property, if picked. */
export async function googleTargets(): Promise<{ property: string | null; gaPropertyId: string | null }> {
  const r = await row();
  return { property: r?.meta?.property ?? null, gaPropertyId: r?.meta?.gaPropertyId ?? null };
}

/** Connection status for the screen. Never includes the key. */
export async function googleConnection(): Promise<GoogleConnection> {
  const r = await row();
  if (!r) return { connected: false };
  return {
    connected: true,
    clientEmail: r.config.client_email,
    projectId: r.config.project_id,
    property: r.meta?.property ?? null,
    gaPropertyId: r.meta?.gaPropertyId ?? null,
    connectedAt: r.connected_at,
    lastOkAt: r.last_ok_at,
    lastError: r.last_error,
  };
}

export async function saveGoogleAccount(account: ServiceAccount, by: string): Promise<void> {
  await supabaseAdmin()
    .from("integrations")
    .upsert(
      {
        id: "google",
        config: account,
        meta: {},
        connected_at: new Date().toISOString(),
        connected_by: by,
        last_ok_at: null,
        last_error: null,
      },
      { onConflict: "id" },
    );
  cached = null;
}

export async function setGoogleTargets(patch: {
  property?: string | null;
  gaPropertyId?: string | null;
}): Promise<void> {
  const r = await row();
  if (!r) return;
  await supabaseAdmin()
    .from("integrations")
    .update({ meta: { ...(r.meta ?? {}), ...patch } })
    .eq("id", "google");
}

export async function noteGoogleResult(ok: boolean, error?: string): Promise<void> {
  await supabaseAdmin()
    .from("integrations")
    .update(
      ok
        ? { last_ok_at: new Date().toISOString(), last_error: null }
        : { last_error: error ?? "The last call to Google failed." },
    )
    .eq("id", "google");
}

export async function disconnectGoogle(): Promise<void> {
  await supabaseAdmin().from("integrations").delete().eq("id", "google");
  cached = null;
}
