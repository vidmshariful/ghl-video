import { NextResponse, type NextRequest } from "next/server";

/*
 * Region gate + VPN/proxy gate + team bypass. Next's request interceptor (the
 * file formerly called middleware.ts; renamed to proxy.ts in Next 16). Runs at
 * the edge, before any page or API route.
 *
 * Blocks:
 *  - visitors from BLOCKED_COUNTRIES (default "BD,PK")
 *  - visitors on a VPN / proxy (via proxycheck.io), site-wide
 * Lets the team through from anywhere via a secret /unlock link (year-long
 * cookie) - that pass also exempts them from the VPN check, so the team can
 * work on a VPN.
 *
 * Safety rules for a live storefront:
 *  1. Fail SAFE: nothing enforces unless ACCESS_BYPASS_KEY is set, so a missing
 *     key can never lock the team out (ships dormant until the key exists).
 *  2. Fail OPEN: any error - including a slow/exhausted proxycheck - passes the
 *     request rather than taking the site down. The country block never needs
 *     the API, so it always holds.
 *
 * Environment (set in Vercel + .env.local):
 *  - ACCESS_BYPASS_KEY    secret for /unlock?key=... AND the cookie signing key
 *  - BLOCKED_COUNTRIES    comma-separated ISO codes (default "BD,PK")
 *  - PROXYCHECK_API_KEY   proxycheck.io key; omit to disable the VPN check
 */

const BYPASS_COOKIE = "ghlv_pass";
const CHECK_COOKIE = "ghlv_chk";
const ONE_YEAR = 60 * 60 * 24 * 365;
const CHECK_TTL = 60 * 60 * 6; // re-check a given IP at most every 6 hours

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
};

function page(heading: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Not available</title>
<style>
:root{color-scheme:dark}
html,body{margin:0;height:100%;background:#08090D;color:#EEF0F6;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{min-height:100%;display:flex;align-items:center;justify-content:center;padding:24px}
.card{max-width:440px;text-align:center}
.mark{font-weight:700;letter-spacing:-.02em;font-size:20px;background:linear-gradient(100deg,#FCC000,#00CC00);-webkit-background-clip:text;background-clip:text;color:transparent}
h1{font-size:22px;margin:20px 0 8px;font-weight:600}
p{color:#9096A8;line-height:1.6;margin:0;font-size:15px}
a{color:#FCC000;text-decoration:none}
</style></head>
<body><main><div class="card">
<div class="mark">GHL Video</div>
<h1>${heading}</h1>
<p>${body}</p>
</div></main></body></html>`;
}

const REGION_PAGE = page(
  "This site isn't available in your region.",
  'If you believe this is a mistake, contact <a href="mailto:hi@ghlvideo.com">hi@ghlvideo.com</a>.',
);
const VPN_PAGE = page(
  "Please turn off your VPN or proxy.",
  'This site can\'t be accessed over a VPN or proxy. Disable it and reload. Still stuck? Contact <a href="mailto:hi@ghlvideo.com">hi@ghlvideo.com</a>.',
);

function blockedCountries(): Set<string> {
  return new Set(
    (process.env.BLOCKED_COUNTRIES ?? "BD,PK")
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
  );
}

/* the visitor's IP, or null for private/local ranges (dev, internal) we can't
 * meaningfully check */
function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  const ip = (xff ? xff.split(",")[0] : (req.headers.get("x-real-ip") ?? "")).trim();
  if (!ip) return null;
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd|::ffff:127)/i.test(ip)) {
    return null;
  }
  return ip;
}

/* ---- signed, IP-bound verdict cookie (the VPN cache; reuses ACCESS_BYPASS_KEY
 * as the HMAC secret, so no extra secret to manage) ---- */
let keyPromise: Promise<CryptoKey> | null = null;
function hmacKey(secret: string): Promise<CryptoKey> {
  keyPromise ??= crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return keyPromise;
}
async function sign(secret: string, msg: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function issueCheck(secret: string, verdict: "ok" | "vpn", ip: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + CHECK_TTL;
  return `${verdict}.${exp}.${await sign(secret, `${verdict}.${exp}.${ip}`)}`;
}
async function readCheck(
  secret: string,
  cookie: string | undefined,
  ip: string,
): Promise<"ok" | "vpn" | null> {
  if (!cookie) return null;
  const [verdict, expStr, sig] = cookie.split(".");
  if ((verdict !== "ok" && verdict !== "vpn") || !expStr || !sig) return null;
  if (Number(expStr) < Math.floor(Date.now() / 1000)) return null;
  if ((await sign(secret, `${verdict}.${expStr}.${ip}`)) !== sig) return null;
  return verdict;
}

/* per-instance cache so cookie-less floods (bots) from one IP don't re-hit the
 * API every request */
const mem = new Map<string, { v: "ok" | "vpn"; exp: number }>();

/* proxycheck.io: true = proxy/vpn, false = clean, null = unknown -> fail open */
async function isProxy(ip: string, apiKey: string): Promise<boolean | null> {
  try {
    const signal =
      typeof AbortSignal !== "undefined" && AbortSignal.timeout
        ? AbortSignal.timeout(2500)
        : undefined;
    const r = await fetch(
      `https://proxycheck.io/v2/${ip}?key=${apiKey}&vpn=1&asn=0`,
      { signal },
    );
    if (!r.ok) return null;
    const data = (await r.json()) as Record<string, unknown>;
    if (data.status !== "ok") return null;
    const entry = data[ip] as { proxy?: string } | undefined;
    if (!entry) return null;
    return entry.proxy === "yes";
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  try {
    const key = process.env.ACCESS_BYPASS_KEY;
    if (!key) return NextResponse.next(); // dormant until the key is set

    const { pathname, searchParams } = req.nextUrl;
    // trailingSlash:true normalizes /unlock -> /unlock/, so match either form
    const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

    // Unlock link: set the bypass cookie and send them home. Before every check
    // so the team can unlock from inside a blocked region.
    if (path === "/unlock" && searchParams.get("key") === key) {
      const res = NextResponse.redirect(new URL("/", req.url));
      res.cookies.set(BYPASS_COOKIE, key, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: ONE_YEAR,
      });
      return res;
    }

    // The team bypass exempts the country block AND the VPN check.
    if (req.cookies.get(BYPASS_COOKIE)?.value === key) return NextResponse.next();

    // 1) Country block (never needs the API, so it always holds).
    const country = (req.headers.get("x-vercel-ip-country") ?? "").toUpperCase();
    if (country && blockedCountries().has(country)) {
      return new NextResponse(REGION_PAGE, { status: 403, headers: HTML_HEADERS });
    }

    // 2) VPN / proxy block (only when configured), cached per IP.
    const apiKey = process.env.PROXYCHECK_API_KEY;
    const ip = clientIp(req);
    if (apiKey && ip) {
      const nowSec = Math.floor(Date.now() / 1000);
      let verdict = await readCheck(key, req.cookies.get(CHECK_COOKIE)?.value, ip);
      if (!verdict) {
        const cached = mem.get(ip);
        if (cached && cached.exp > nowSec) verdict = cached.v;
      }
      let fresh = false;
      if (!verdict) {
        const proxied = await isProxy(ip, apiKey);
        if (proxied === true) verdict = "vpn";
        else if (proxied === false) verdict = "ok";
        // null -> unknown/quota/error -> leave null -> fail open below
        if (verdict) {
          if (mem.size > 5000) mem.clear();
          mem.set(ip, { v: verdict, exp: nowSec + CHECK_TTL });
          fresh = true;
        }
      }
      if (verdict === "vpn") {
        const res = new NextResponse(VPN_PAGE, { status: 403, headers: HTML_HEADERS });
        if (fresh) {
          res.cookies.set(CHECK_COOKIE, await issueCheck(key, "vpn", ip), {
            httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: CHECK_TTL,
          });
        }
        return res;
      }
      if (verdict === "ok" && fresh) {
        const res = NextResponse.next();
        res.cookies.set(CHECK_COOKIE, await issueCheck(key, "ok", ip), {
          httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: CHECK_TTL,
        });
        return res;
      }
    }

    return NextResponse.next();
  } catch {
    // Fail open: never take the whole site down over a gate error.
    return NextResponse.next();
  }
}

export const config = {
  // Pages + API routes only; skip Next internals and any file with an extension.
  matcher: ["/((?!_next|.*\\..*).*)"],
};
