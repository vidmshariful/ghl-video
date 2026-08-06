import { NextResponse, type NextRequest } from "next/server";

/*
 * Region gate + team bypass. Next's request interceptor (the file formerly
 * called middleware.ts; renamed to proxy.ts in Next 16). Runs at the edge,
 * before any page or API route.
 *
 * Blocks visitors from configured countries (default: Bangladesh) and lets the
 * team through from anywhere via a secret unlock link that drops a long-lived
 * cookie, so a changing home / mobile / VPN IP never locks them out.
 *
 * Two non-negotiable safety rules for a live storefront:
 *  1. Fail SAFE: with no ACCESS_BYPASS_KEY set there is no escape hatch, so the
 *     block does not enforce at all. You can never lock the team out by
 *     forgetting the key; set the key in Vercel to turn the block ON.
 *  2. Fail OPEN: any unexpected error lets the request through rather than
 *     taking the site down.
 *
 * Environment (set in Vercel and .env.local):
 *  - ACCESS_BYPASS_KEY   secret for the unlock link:  /unlock?key=<value>
 *  - BLOCKED_COUNTRIES   comma-separated ISO codes (default "BD")
 */

const BYPASS_COOKIE = "ghlv_pass";
const ONE_YEAR = 60 * 60 * 24 * 365;

const BLOCK_PAGE = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Not available</title>
<style>
:root{color-scheme:dark}
html,body{margin:0;height:100%;background:#08090D;color:#EEF0F6;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{min-height:100%;display:flex;align-items:center;justify-content:center;padding:24px}
.card{max-width:420px;text-align:center}
.mark{font-weight:700;letter-spacing:-.02em;font-size:20px;background:linear-gradient(100deg,#FCC000,#00CC00);-webkit-background-clip:text;background-clip:text;color:transparent}
h1{font-size:22px;margin:20px 0 8px;font-weight:600}
p{color:#9096A8;line-height:1.6;margin:0;font-size:15px}
a{color:#FCC000;text-decoration:none}
</style></head>
<body><main><div class="card">
<div class="mark">GHL Video</div>
<h1>This site isn't available in your region.</h1>
<p>If you believe this is a mistake, contact <a href="mailto:hi@ghlvideo.com">hi@ghlvideo.com</a>.</p>
</div></main></body></html>`;

function blockedCountries(): Set<string> {
  return new Set(
    (process.env.BLOCKED_COUNTRIES ?? "BD")
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
  );
}

export function proxy(req: NextRequest) {
  try {
    const key = process.env.ACCESS_BYPASS_KEY;
    // No escape hatch configured -> never enforce (prevents a lockout).
    if (!key) return NextResponse.next();

    const { pathname, searchParams } = req.nextUrl;
    // trailingSlash:true normalizes /unlock -> /unlock/, so match either form
    const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

    // The unlock link: set the bypass cookie and send them home. Handled before
    // the country check so the team can unlock from inside a blocked region.
    if (path === "/unlock") {
      if (searchParams.get("key") === key) {
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
      // wrong key: fall through (blocked if in a blocked region, else normal)
    }

    // A valid bypass cookie is a global pass, regardless of country or IP.
    if (req.cookies.get(BYPASS_COOKIE)?.value === key) {
      return NextResponse.next();
    }

    const country = (req.headers.get("x-vercel-ip-country") ?? "").toUpperCase();
    if (country && blockedCountries().has(country)) {
      return new NextResponse(BLOCK_PAGE, {
        status: 403,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
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
