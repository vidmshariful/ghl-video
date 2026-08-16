import "server-only";
import type { LinkStatus, PageFacts } from "@/lib/seo-audit";
import vercelConfig from "@/vercel.json";

/*
 * The self-crawler behind the health check: fetch our own pages and measure
 * what search engines see. Deliberately dependency-free (a regex reader over
 * our own known-good HTML, not a general parser) and deliberately batched:
 * the admin screen drives the loop a few pages at a time, so a bigger site
 * never runs into a serverless time limit and the operator sees progress.
 *
 * The crawl carries the team bypass cookie when the region gate is armed,
 * otherwise the gate would answer our own requests with the blocked page and
 * every finding would be nonsense.
 */

const PAGE_TIMEOUT_MS = 12_000;
const CONCURRENCY = 5;

/* The 301s that live in vercel.json are served by the platform edge, ABOVE
 * the app, so they do not exist on a local dev server. Without this the
 * health check would call every retired WordPress URL dead while running
 * locally and clean in production. Reading the same file the platform reads
 * keeps the two honest. */
const STATIC_REDIRECTS = new Set(
  (vercelConfig.redirects ?? []).map((r: { source: string }) =>
    r.source.replace(/\/+$/, "").toLowerCase(),
  ),
);

const isStaticRedirect = (path: string) =>
  STATIC_REDIRECTS.has(path.replace(/\/+$/, "").toLowerCase());

function gateCookie(): Record<string, string> {
  const key = process.env.ACCESS_BYPASS_KEY;
  return key ? { cookie: `ghlv_pass=${key}` } : {};
}

/* ---------------------------------------------------------------- */
/* tiny HTML readers                                                 */
/* ---------------------------------------------------------------- */

/** Attributes of one tag string, lowercased keys. */
function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = m[3] ?? m[4] ?? "";
  return out;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

const stripTags = (s: string) => decode(s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));

/** Body text with scripts, styles, and JSON-LD removed. */
function textBody(html: string): string {
  const body = html.slice(html.indexOf("<body"));
  return stripTags(
    body
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " "),
  );
}

export function readPage(path: string, html: string, status: number): PageFacts {
  /* Scan the WHOLE document for the head tags, not just what precedes
   * <body>. React streams a page's metadata as it resolves, so on a server
   * render the description, canonical, and robots tags routinely arrive at
   * the END of the HTML even though the browser hoists them into the head.
   * Reading only the literal head made every page look like it had no
   * description at all. */
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decode(stripTags(titleMatch[1])) : null;

  let description: string | null = null;
  let noindex = false;
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const name = (a.name ?? a.property ?? "").toLowerCase();
    if (name === "description" && a.content && !description) description = decode(a.content);
    if (name === "robots" && /noindex/i.test(a.content ?? "")) noindex = true;
  }

  let canonical: string | null = null;
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if ((a.rel ?? "").toLowerCase() === "canonical" && a.href) canonical = a.href;
  }

  const bodyHtml = html
    .slice(html.indexOf("<body"))
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const h1s = [...bodyHtml.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean);

  const imgs = [...bodyHtml.matchAll(/<img\b[^>]*>/gi)].map((m) => attrs(m[0]));
  // an explicit alt="" is a deliberate "this image is decoration" and is
  // correct; only a missing alt attribute is a finding
  const imagesMissingAlt = imgs.filter((a) => a.alt === undefined).length;

  const internalLinks = [
    ...new Set(
      [...bodyHtml.matchAll(/<a\b[^>]*>/gi)]
        .map((m) => attrs(m[0]).href ?? "")
        .filter((h) => h.startsWith("/") && !h.startsWith("//"))
        .map((h) => h.split("?")[0].split("#")[0])
        .filter((h) => h && !/\.[a-z0-9]{2,5}$/i.test(h)),
    ),
  ];

  const text = textBody(html);
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

  return {
    path,
    status,
    title,
    description,
    canonical,
    noindex,
    h1s,
    imagesMissingAlt,
    imageCount: imgs.length,
    internalLinks,
    wordCount,
  };
}

/* ---------------------------------------------------------------- */
/* fetching                                                          */
/* ---------------------------------------------------------------- */

async function fetchOne(origin: string, path: string): Promise<PageFacts> {
  const url = `${origin}${path}`;
  try {
    const res = await fetch(url, {
      headers: { ...gateCookie(), "user-agent": "GHLVideo-SEO-Check" },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400) {
      return {
        path,
        status: res.status,
        redirectedTo: res.headers.get("location"),
        title: null,
        description: null,
        canonical: null,
        noindex: false,
        h1s: [],
        imagesMissingAlt: 0,
        imageCount: 0,
        internalLinks: [],
        wordCount: 0,
      };
    }
    if (res.status >= 400) {
      return {
        path,
        status: res.status,
        title: null,
        description: null,
        canonical: null,
        noindex: false,
        h1s: [],
        imagesMissingAlt: 0,
        imageCount: 0,
        internalLinks: [],
        wordCount: 0,
      };
    }
    return readPage(path, await res.text(), res.status);
  } catch (e) {
    return {
      path,
      status: 0,
      title: null,
      description: null,
      canonical: null,
      noindex: false,
      h1s: [],
      imagesMissingAlt: 0,
      imageCount: 0,
      internalLinks: [],
      wordCount: 0,
      error: e instanceof Error ? e.message : "request failed",
    };
  }
}

/** Run a small pool so a batch of pages finishes fast without stampeding. */
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

export function crawlPages(origin: string, paths: string[]): Promise<PageFacts[]> {
  return pool(paths, CONCURRENCY, (p) => fetchOne(origin, p));
}

/** Status-only check for link targets (cheap: no body read). */
export function checkLinks(origin: string, paths: string[]): Promise<LinkStatus[]> {
  return pool(paths, CONCURRENCY, async (path) => {
    // a platform-level redirect is a working URL; no need to ask the server
    if (isStaticRedirect(path)) return { path, status: 308 };
    const hit = async (method: "HEAD" | "GET") =>
      fetch(`${origin}${path}`, {
        method,
        headers: { ...gateCookie(), "user-agent": "GHLVideo-SEO-Check" },
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      });
    try {
      let res = await hit("HEAD");
      // some hosts answer HEAD with 405/501; that is not a broken link
      if (res.status === 405 || res.status === 501) res = await hit("GET");
      return { path, status: res.status };
    } catch {
      // a connection failure here is more often a blip than a dead page, and
      // computeFindings only flags >= 400, so this stays silent on purpose
      return { path, status: 0 };
    }
  });
}
