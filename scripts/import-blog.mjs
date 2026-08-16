#!/usr/bin/env node
/*
 * One-time import of the old WordPress blog posts (the scraped HTML dumps in
 * the ghl-video-old repo) into blog_posts. Idempotent: re-running updates the
 * same slugs. Images referenced by the posts are copied from the old repo's
 * public/assets into the public blog bucket, so nothing depends on the old
 * deployment staying alive.
 *
 *   node scripts/import-blog.mjs /path/to/ghl-video-old [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";

const OLD_REPO = process.argv[2];
const DRY = process.argv.includes("--dry-run");
if (!OLD_REPO || !existsSync(join(OLD_REPO, "content"))) {
  console.error("Usage: node scripts/import-blog.mjs /path/to/ghl-video-old [--dry-run]");
  process.exit(1);
}

const SLUGS = [
  "highlevel-saas-video-funnel",
  "highlevel-saas-video-mistakes",
  "highlevel-saas-growth-system-video",
  "who-ghl-video-is-not-for-and-why-that-matters",
  "the-only-video-editing-service-built-for-highlevel-creators-and-agencies",
  "what-is-ghl-video-a-complete-guide-for-highlevel-saas-and-agencies",
];

const dot = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  dot[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}
const sb = createClient(dot.NEXT_PUBLIC_SUPABASE_URL, dot.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* ---------------- extraction helpers ---------------- */

const meta = (html, pattern) => {
  const m = html.match(pattern);
  return m ? m[1] : null;
};

/** Inner HTML of the first <div class="...et_pb_post_content..."> (balanced). */
function extractBody(html) {
  const start = html.search(/<div[^>]*class="[^"]*et_pb_post_content[^"]*"[^>]*>/);
  if (start === -1) throw new Error("no et_pb_post_content container");
  const open = html.indexOf(">", start) + 1;
  let depth = 1;
  const tag = /<\/?div\b[^>]*>/g;
  tag.lastIndex = open;
  let m;
  while ((m = tag.exec(html))) {
    depth += m[0][1] === "/" ? -1 : 1;
    if (depth === 0) return html.slice(open, m.index);
  }
  throw new Error("unbalanced container");
}

/** WP dump -> clean article HTML on our type system. */
function cleanBody(body) {
  return (
    body
      // WP block comments and scripts/styles
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      // structural spans WP sprinkles in
      .replace(/<\/?span[^>]*>/gi, "")
      // class/id/style attributes: our pages restyle the plain tags
      .replace(/\s(?:class|id|style|dir|lang)="[^"]*"/gi, "")
      // srcset/sizes point at the old deployment; src is rewritten later
      .replace(/\s(?:srcset|sizes|decoding|loading|fetchpriority)="[^"]*"/gi, "")
      // old absolute links back onto this domain
      .replace(/href="https?:\/\/(?:www\.)?ghlvideo\.com(\/[^"]*)"/gi, 'href="$1"')
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/* Upload one image from the old repo into the blog bucket; cached per path. */
const uploaded = new Map();
async function uploadImage(assetPath) {
  if (uploaded.has(assetPath)) return uploaded.get(assetPath);
  const local = join(OLD_REPO, "public", assetPath.replace(/^\//, ""));
  let bytes = null;
  if (existsSync(local)) {
    bytes = readFileSync(local);
  } else {
    // the scrape missed a few originals; the old deployment still serves them
    const remote = `https://ghl-video-old.vercel.app${assetPath}`;
    const res = await fetch(remote).catch(() => null);
    if (res?.ok) bytes = Buffer.from(await res.arrayBuffer());
  }
  if (!bytes) {
    console.warn(`  image lost in the WP migration, dropping it: ${assetPath}`);
    uploaded.set(assetPath, null);
    return null;
  }
  const ext = extname(assetPath).toLowerCase().replace(".", "") || "png";
  const type =
    { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml" }[ext] ?? "image/png";
  const name = `imported/${basename(assetPath)}`;
  if (!DRY) {
    const { error } = await sb.storage
      .from("blog")
      .upload(name, bytes, { contentType: type, cacheControl: "31536000", upsert: true });
    if (error) throw new Error(`upload ${name}: ${error.message}`);
  }
  const { data } = sb.storage.from("blog").getPublicUrl(name);
  uploaded.set(assetPath, data.publicUrl);
  return data.publicUrl;
}

/* ---------------- the import ---------------- */

const { data: cat } = await sb
  .from("blog_categories")
  .select("id")
  .eq("slug", "highlevel-saas")
  .single();

for (const slug of SLUGS) {
  const file = join(OLD_REPO, "content", `${slug}.html`);
  const html = readFileSync(file, "utf8");

  const rawTitle =
    meta(html, /<meta property="og:title" content="([^"]+)"/) ??
    meta(html, /<title>([^<]+)<\/title>/);
  const title = rawTitle?.replace(/\s*[-|]\s*GHL Video\s*$/i, "").trim();
  const description = meta(html, /<meta name="description" content="([^"]+)"/);
  const published = meta(html, /<meta property="article:published_time" content="([^"]+)"/);
  const ogImage = meta(html, /<meta property="og:image" content="([^"]+)"/);

  let body = cleanBody(extractBody(html));

  // images inside the article: copy to our bucket and rewrite
  const srcs = [...body.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  for (const src of new Set(srcs)) {
    const path = src.replace(/^https?:\/\/(?:www\.)?ghlvideo\.com/, "");
    if (!path.startsWith("/assets/")) continue;
    const url = await uploadImage(path);
    if (url) body = body.replaceAll(`src="${src}"`, `src="${url}"`);
    else body = body.replace(new RegExp(`<img[^>]+src="${src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`, "g"), "");
  }
  // links to the other imported posts move under /blog/
  for (const s of SLUGS) body = body.replaceAll(`href="/${s}/"`, `href="/blog/${s}/"`);

  // the cover
  let coverUrl = null;
  if (ogImage) {
    const path = ogImage.replace(/^https?:\/\/(?:www\.)?ghlvideo\.com/, "");
    coverUrl = path.startsWith("/assets/") ? await uploadImage(path) : ogImage;
  }

  const decode = (s) =>
    s ? s.replaceAll("&amp;", "&").replaceAll("&#039;", "'").replaceAll("&quot;", '"').replaceAll("&#8217;", "'") : s;

  const row = {
    slug,
    title: decode(title),
    excerpt: decode(description),
    content_html: body,
    cover_url: coverUrl,
    category_id: cat?.id ?? null,
    author_email: null,
    author_name: "GHL Video",
    status: "published",
    published_at: published ?? new Date().toISOString(),
    seo_title: decode(title),
    seo_description: decode(description),
    updated_at: new Date().toISOString(),
  };

  console.log(`${DRY ? "[dry] " : ""}${slug}`);
  console.log(`  "${row.title}" / ${row.published_at?.slice(0, 10)} / cover ${coverUrl ? "yes" : "no"} / ${body.length} chars`);
  if (DRY) continue;

  const { error } = await sb.from("blog_posts").upsert(row, { onConflict: "slug" });
  if (error) throw new Error(`upsert ${slug}: ${error.message}`);
}

console.log(DRY ? "Dry run complete." : "Imported. The posts are live on /blog.");
