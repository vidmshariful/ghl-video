import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { PageHero } from "@/components/pages/PageHero";
import { CtaBand } from "@/components/CtaBand";
import { CategoryChips, PostCard } from "@/components/blog-parts";
import { getBlogCategories, getBlogPosts } from "@/lib/blog";
import { cta } from "@/lib/site";

/*
 * The blog index: every published post, newest first, with category
 * chips building the topic clusters. Content is written in admin (CMS,
 * Blog); this page is live within five minutes of a publish, or
 * instantly via the editor's revalidate call.
 */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/blog/", {
    title: "Blog",
    description:
      "Practical playbooks for HighLevel SaaS founders: video strategy, funnels, objection handling, and what actually moves signups. From the studio creating HighLevel videos since 2020.",
    /* NOT TRUE ANY MORE, AND LEFT FOR A DECISION.
       This was set while the blog was a stub with no real posts. There are
       published posts now, and the sitemap lists /blog/ because pages-list
       carries no noindex for it, so we currently tell Google to crawl the
       hub and then tell it not to index the hub.
       The old comment here claimed a seo_pages override could flip this on
       without a deploy. It cannot: pageMetadata only ever turns noindex ON
       (lib/seo.ts), so an override cannot switch indexing back on for a page
       whose code says index:false. Removing this line is the only way in,
       and that is an SEO call for Shariful, not a silent edit. */
    robots: { index: false, follow: true },
    alternates: { canonical: "/blog/" },
  });
}

export default async function Page() {
  const [posts, cats] = await Promise.all([getBlogPosts(), getBlogCategories()]);
  const counts: Record<string, number> = {};
  for (const p of posts) if (p.category_id) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;
  const catById = new Map(cats.map((c) => [c.id, c]));

  return (
    <>
      <PageHero
        chip="The Blog"
        headline="Playbooks for HighLevel"
        accent="SaaS growth"
        lede="Video strategy, funnels, and the objections that stall signups, answered in writing. Everything we learn making videos for 1000+ HighLevel SaaS clients."
      />

      <section data-bp-idx="2" className="section-pad">
        <div className="shell">
          <CategoryChips cats={cats} counts={counts} active={null} />
          {posts.length === 0 ? (
            <p className="mt-14 text-center text-body text-muted">
              The first posts are being written. Check back shortly.
            </p>
          ) : (
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} category={catById.get(p.category_id ?? "") ?? null} />
              ))}
            </div>
          )}
        </div>
      </section>

      <CtaBand
        bpIdx={3}
        headline="Rather talk it through than"
        accent="read about it?"
        sub="Bring your funnel and your questions. We will tell you which video belongs at each stage, whether you buy from us or not."
        cta={cta.bookACall}
      />
    </>
  );
}
