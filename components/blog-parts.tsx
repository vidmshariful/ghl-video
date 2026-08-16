import Link from "next/link";
import type { BlogCategory, BlogPost } from "@/lib/blog";

/*
 * Shared pieces for the public blog (main-site skin): the post card the
 * index and category pages grid with, the category chip row, and the
 * article body styling. Server components only; no client JS.
 */

/* deterministic date rendering (server + client agree) */
export function postDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function PostCard({
  post,
  category,
}: {
  post: Omit<BlogPost, "content_html">;
  category: BlogCategory | null;
}) {
  return (
    <Link
      href={`/blog/${post.slug}/`}
      className="group flex flex-col overflow-hidden rounded-card border border-hair bg-surface transition-colors hover:border-gold/50"
    >
      <div className="relative aspect-[16/9] overflow-hidden border-b border-hair bg-canvas">
        {post.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote CMS asset, dimensions unknown
          <img
            src={post.cover_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-display text-h3 font-semibold text-hair">GHL Video</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="font-mono text-label uppercase tracking-[0.1em] text-gold">
          {category?.name ?? "Article"}
        </p>
        <h3 className="mt-2.5 font-display text-h4 font-semibold leading-snug text-ink transition-colors group-hover:text-gold">
          {post.title}
        </h3>
        {post.excerpt ? (
          <p className="mt-2.5 line-clamp-3 text-body-sm leading-relaxed text-muted">{post.excerpt}</p>
        ) : null}
        <p className="mt-auto pt-4 font-mono text-label uppercase text-dim">
          {postDate(post.published_at)}
          {post.author_name ? ` / ${post.author_name}` : ""}
        </p>
      </div>
    </Link>
  );
}

export function CategoryChips({
  cats,
  counts,
  active,
}: {
  cats: BlogCategory[];
  counts: Record<string, number>;
  active: string | null;
}) {
  const chip = (isActive: boolean) =>
    `inline-flex items-center rounded-full border px-4 py-2 font-mono text-label uppercase transition-colors ${
      isActive
        ? "border-gold/60 bg-gold/10 text-gold"
        : "border-hair text-muted hover:border-gold/40 hover:text-ink"
    }`;
  return (
    <div className="flex flex-wrap justify-center gap-2.5">
      <Link href="/blog/" className={chip(active === null)}>
        All posts
      </Link>
      {cats
        .filter((c) => (counts[c.id] ?? 0) > 0)
        .map((c) => (
          <Link key={c.id} href={`/blog/category/${c.slug}/`} className={chip(active === c.slug)}>
            {c.name} ({counts[c.id]})
          </Link>
        ))}
    </div>
  );
}

/* The article body: editor/imported HTML styled onto the site's type
 * system. Content is written by admins only (RLS), so rendering it is a
 * same-trust operation, like the email templates. */
export function ArticleBody({ html }: { html: string }) {
  return (
    <div
      className="article-body mx-auto max-w-[var(--measure-body)] text-body leading-relaxed text-muted [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-h3 [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mt-8 [&_h3]:font-display [&_h3]:text-h4 [&_h3]:font-semibold [&_h3]:text-ink [&_p]:mt-5 [&_ul]:mt-5 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mt-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mt-2 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-ink [&_a]:text-gold [&_a]:underline [&_a]:decoration-gold/40 [&_a]:underline-offset-4 hover:[&_a]:decoration-gold [&_blockquote]:mt-6 [&_blockquote]:border-l-2 [&_blockquote]:border-gold/60 [&_blockquote]:pl-5 [&_blockquote]:text-ink [&_img]:mt-8 [&_img]:w-full [&_img]:rounded-media [&_img]:border [&_img]:border-hair [&_figure]:mt-8 [&_figcaption]:mt-2 [&_figcaption]:text-center [&_figcaption]:font-mono [&_figcaption]:text-label [&_figcaption]:uppercase [&_figcaption]:text-dim [&_hr]:my-10 [&_hr]:border-hair"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
