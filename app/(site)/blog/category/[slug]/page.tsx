import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/pages/PageHero";
import { CtaBand } from "@/components/CtaBand";
import { CategoryChips, PostCard } from "@/components/blog-parts";
import { getBlogCategories, getBlogPosts } from "@/lib/blog";
import { cta } from "@/lib/site";

/* One category's posts: a topic cluster page with its own canonical. */
export const revalidate = 300;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const cats = await getBlogCategories();
  const cat = cats.find((c) => c.slug === slug);
  if (!cat) return { title: "Category not found", robots: { index: false } };
  return {
    title: `${cat.name}, from the blog`,
    description:
      cat.description ??
      `Every post about ${cat.name} from the GHL Video blog: playbooks for HighLevel SaaS founders.`,
    alternates: { canonical: `/blog/category/${cat.slug}/` },
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const [posts, cats] = await Promise.all([getBlogPosts(), getBlogCategories()]);
  const cat = cats.find((c) => c.slug === slug);
  if (!cat) notFound();

  const counts: Record<string, number> = {};
  for (const p of posts) if (p.category_id) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;
  const shown = posts.filter((p) => p.category_id === cat.id);

  return (
    <>
      <PageHero
        chip="The Blog"
        headline={cat.name}
        accent="playbooks"
        lede={
          cat.description ??
          "Every post in this topic cluster, newest first. Written from real client work, not theory."
        }
      />

      <section data-bp-idx="2" className="section-pad">
        <div className="shell">
          <CategoryChips cats={cats} counts={counts} active={cat.slug} />
          {shown.length === 0 ? (
            <p className="mt-14 text-center text-body text-muted">
              Nothing in this category yet. The posts are coming.
            </p>
          ) : (
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {shown.map((p) => (
                <PostCard key={p.id} post={p} category={cat} />
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
