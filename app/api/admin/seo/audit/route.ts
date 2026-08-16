import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { checkLinks, crawlPages } from "@/lib/seo-crawl";
import { computeFindings, type LinkStatus, type PageFacts } from "@/lib/seo-audit";
import { sitePages } from "@/lib/pages-list";

export const runtime = "nodejs";
export const maxDuration = 60;

/*
 * The site health check. The admin screen drives it in small steps so it can
 * show progress and never hits a serverless time limit:
 *
 *   GET                       the work list + the last stored result
 *   POST {mode:"crawl"}       measure a batch of pages
 *   POST {mode:"links"}       status-check a batch of link targets
 *   POST {mode:"finish"}      turn the measurements into findings and store them
 *
 * The rules themselves live in lib/seo-audit.ts.
 */

const MAX_BATCH = 12;

/** The public origin of THIS deployment, so the crawl checks the real site. */
function originOf(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

async function sitemapPaths(origin: string): Promise<string[]> {
  try {
    const res = await fetch(`${origin}/sitemap.xml`, {
      headers: process.env.ACCESS_BYPASS_KEY
        ? { cookie: `ghlv_pass=${process.env.ACCESS_BYPASS_KEY}` }
        : {},
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
      m[1].replace(/^https?:\/\/[^/]+/i, ""),
    );
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = supabaseAdmin();
  const [{ data: latest }, { data: posts }, { data: cats }] = await Promise.all([
    db.from("seo_audits").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("blog_posts").select("slug").eq("status", "published"),
    db.from("blog_categories").select("slug"),
  ]);

  /* Everything a search engine can reach: the page list, every published
   * post, and the category pages the blog links to. */
  const paths = [
    ...sitePages.map((p) => p.path),
    ...(posts ?? []).map((p) => `/blog/${p.slug}/`),
    ...(cats ?? []).map((c) => `/blog/category/${c.slug}/`),
  ];

  return NextResponse.json({ paths: [...new Set(paths)], latest: latest ?? null });
}

export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    mode?: string;
    paths?: string[];
    pages?: PageFacts[];
    links?: LinkStatus[];
  };
  const origin = originOf(req);

  if (body.mode === "crawl") {
    const paths = (body.paths ?? []).slice(0, MAX_BATCH).filter((p) => p.startsWith("/"));
    if (paths.length === 0) return NextResponse.json({ pages: [] });
    return NextResponse.json({ pages: await crawlPages(origin, paths) });
  }

  if (body.mode === "links") {
    const paths = (body.paths ?? []).slice(0, MAX_BATCH).filter((p) => p.startsWith("/"));
    if (paths.length === 0) return NextResponse.json({ links: [] });
    return NextResponse.json({ links: await checkLinks(origin, paths) });
  }

  if (body.mode === "finish") {
    const pages = body.pages ?? [];
    const links = body.links ?? [];
    if (pages.length === 0) {
      return NextResponse.json({ error: "Nothing was measured." }, { status: 400 });
    }
    const findings = computeFindings(pages, links, await sitemapPaths(origin));
    const errorCount = findings.filter((f) => f.severity === "error").length;
    const warnCount = findings.filter((f) => f.severity === "warn").length;

    const db = supabaseAdmin();
    const { data, error } = await db
      .from("seo_audits")
      .insert({
        finished_at: new Date().toISOString(),
        pages_checked: pages.length,
        error_count: errorCount,
        warn_count: warnCount,
        findings,
        pages,
        run_by: admin.email,
      })
      .select("id, started_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    /* keep the last 20 runs; the history is for spotting trends, not archaeology */
    const { data: old } = await db
      .from("seo_audits")
      .select("id")
      .order("started_at", { ascending: false })
      .range(20, 200);
    if (old?.length) await db.from("seo_audits").delete().in("id", old.map((o) => o.id));

    return NextResponse.json({
      ok: true,
      id: data.id,
      startedAt: data.started_at,
      pagesChecked: pages.length,
      errorCount,
      warnCount,
      findings,
    });
  }

  return NextResponse.json({ error: "Unknown mode." }, { status: 400 });
}
