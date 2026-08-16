import { SB_ANON, SB_URL } from "@/lib/supabase-config";

/*
 * Admin-managed redirects, resolved at the edge (see proxy.ts).
 *
 * This file runs on EVERY request, so it is deliberately small and boring:
 * plain fetch, no SDK, no Node APIs. The rule set is cached per instance and
 * refreshed at most twice a minute, so a request costs a Map lookup rather
 * than a round trip. The flip side of that cache: a rule added in admin goes
 * live within the window, not the same millisecond, which is why the screen
 * says "within a minute" and offers a test link.
 *
 * SAFETY RULES, in the same spirit as the region gate above it:
 *  1. Fail open. Any error (or a cold start that cannot reach Supabase) means
 *     no redirect, never a broken request.
 *  2. Protected prefixes can never be redirected, whatever the database says.
 *     A typo in admin must not be able to swallow checkout, the portals, the
 *     admin itself, or the API.
 *  3. One hop only. Chains are rejected when the rule is created, and even if
 *     one slipped in, a single hop can never loop.
 */

export type RedirectRule = {
  source: string;
  destination: string;
  permanent: boolean;
};

/* Paths that must always reach the app, no matter what is in the table:
 * the money path, both portals, the admin, the API, the team unlock link,
 * and Next's own asset routes. */
export const PROTECTED_PREFIXES = [
  "/api",
  "/admin",
  "/portal",
  "/partners",
  "/checkout",
  "/unlock",
  "/_next",
] as const;

export function isProtectedPath(path: string): boolean {
  const p = path.toLowerCase();
  return PROTECTED_PREFIXES.some((pre) => p === pre || p.startsWith(`${pre}/`));
}

/** Redirect key: lowercase, leading slash, no trailing slash, no query. */
export function normalizeSource(input: string): string {
  let p = (input || "").trim().split("?")[0].split("#")[0].toLowerCase();
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/{2,}/g, "/");
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

/* ---------------------------------------------------------------- */
/* Per-instance cache                                                */
/* ---------------------------------------------------------------- */
const TTL_MS = 30_000;

let rules: Map<string, RedirectRule> | null = null;
let expiresAt = 0;
let inFlight: Promise<void> | null = null;

async function load(): Promise<void> {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/redirects?select=source,destination,permanent&active=eq.true`,
      {
        headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
        signal: AbortSignal.timeout(2500),
        cache: "no-store",
      },
    );
    if (!res.ok) return; // keep whatever we had; try again next window
    const rows = (await res.json()) as RedirectRule[];
    const next = new Map<string, RedirectRule>();
    for (const r of rows) {
      const source = normalizeSource(r.source);
      if (!source || source === "/" || isProtectedPath(source)) continue;
      next.set(source, { source, destination: r.destination, permanent: r.permanent });
    }
    rules = next;
  } catch {
    /* fail open: the previous map (or none) stands */
  }
}

function refresh(): Promise<void> {
  // Claim the window before awaiting so a burst of requests triggers one load.
  expiresAt = Date.now() + TTL_MS;
  inFlight ??= load().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * The redirect for this path, or null. Cold start awaits one short fetch;
 * afterwards it is a cache hit, and an expired cache is served immediately
 * while it refreshes in the background.
 */
export async function resolveRedirect(pathname: string): Promise<RedirectRule | null> {
  const source = normalizeSource(pathname);
  if (!source || source === "/" || isProtectedPath(source)) return null;

  if (rules === null) {
    await refresh();
  } else if (Date.now() > expiresAt) {
    void refresh();
  }
  if (!rules || rules.size === 0) return null;

  const hit = rules.get(source);
  if (!hit) return null;
  // One hop only: a destination that is itself a source would chain, and
  // rules like that are rejected at write time. Belt and braces.
  if (normalizeSource(hit.destination) === source) return null;
  return hit;
}

/** Best-effort usage counter. Never awaited, never allowed to throw. */
export function countRedirectHit(source: string): void {
  try {
    void fetch(`${SB_URL}/rest/v1/rpc/bump_redirect_hit`, {
      method: "POST",
      headers: {
        apikey: SB_ANON,
        Authorization: `Bearer ${SB_ANON}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_source: source }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* counting is a nicety; it must never affect the redirect */
  }
}
