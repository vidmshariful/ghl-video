import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/CtaBand";
import { ArticleBody, PostCard, postDate } from "@/components/blog-parts";
import { getBlogCategories, getBlogPost, getRelatedPosts } from "@/lib/blog";
import { cta, site } from "@/lib/site";

/*
 * One article. The SEO surface the blog exists for: canonical URL,
 * per-post title and description (admin-editable), OG image from the
 * cover, and Article structured data.
 */
export const revalidate = 300;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return { title: "Post not found", robots: { index: false } };
  const description = post.seo_description ?? post.excerpt ?? undefined;
  return {
    title: post.seo_title ?? post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}/` },
    openGraph: {
      title: post.seo_title ?? post.title,
      description,
      type: "article",
      publishedTime: post.published_at,
      url: `${site.url}/blog/${post.slug}/`,
      images: post.cover_url ? [{ url: post.cover_url }] : undefined,
    },
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const [cats, related] = await Promise.all([
    getBlogCategories(),
    getRelatedPosts(post),
  ]);
  const category = cats.find((c) => c.id === post.category_id) ?? null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.seo_description ?? post.excerpt ?? undefined,
    image: post.cover_url ?? undefined,
    datePublished: post.published_at,
    author: {
      "@type": "Organization",
      name: "GHL Video",
      url: site.url,
    },
    publisher: {
      "@type": "Organization",
      name: "GHL Video",
      url: site.url,
    },
    mainEntityOfPage: `${site.url}/blog/${post.slug}/`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article data-bp-idx="1" className="hero-pad">
        <div className="shell">
          <header className="mx-auto max-w-[var(--measure-body)] text-center">
            <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-label uppercase tracking-[0.1em]">
              {category ? (
                <Link
                  href={`/blog/category/${category.slug}/`}
                  className="text-gold transition-colors hover:brightness-110"
                >
                  {category.name}
                </Link>
              ) : (
                <span className="text-gold">Article</span>
              )}
              <span className="text-dim">
                {postDate(post.published_at)}
                {post.author_name ? ` / ${post.author_name}` : ""}
              </span>
            </div>
            <h1 className="mt-6 font-display text-h2 text-ink">{post.title}</h1>
            {post.excerpt ? (
              <p className="mx-auto mt-5 max-w-[var(--measure-lede)] text-lede text-muted">
                {post.excerpt}
              </p>
            ) : null}
          </header>

          {post.cover_url ? (
            <div className="mx-auto mt-12 max-w-[56rem]">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote CMS asset, dimensions unknown */}
              <img
                src={post.cover_url}
                alt=""
                className="w-full rounded-media border border-hair"
              />
            </div>
          ) : null}

          <div className="mt-12">
            <ArticleBody html={post.content_html} />
          </div>

          <p className="mx-auto mt-14 max-w-[var(--measure-body)] border-t border-hair pt-6 text-center">
            <Link
              href="/blog/"
              className="font-mono text-label uppercase tracking-[0.1em] text-muted transition-colors hover:text-gold"
            >
              All posts
            </Link>
          </p>
        </div>
      </article>

      {related.length > 0 ? (
        <section data-bp-idx="2" className="border-t border-hair section-pad">
          <div className="shell">
            <h2 className="text-center font-display text-h3 text-ink">Keep reading</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  category={cats.find((c) => c.id === p.category_id) ?? null}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <CtaBand
        bpIdx={3}
        headline="See where video fits in"
        accent="your funnel"
        sub="Twenty minutes, your screen share, no pitch until you ask. We map the video plan for your HighLevel SaaS together."
        cta={cta.bookACall}
      />
    </>
  );
}
