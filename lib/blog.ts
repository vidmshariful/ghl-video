import { SB_ANON, SB_URL } from "@/lib/supabase-config";

/*
 * Blog data for the public site, read with the RLS-limited anon key: the
 * policies only expose published, past-dated posts, so drafts and scheduled
 * posts can never leak here no matter what the query says.
 *
 * FAILURE POLICY, same as the chrome and studio: if Supabase is unreachable
 * the fetchers return empty and the pages render their designed empty
 * states. The site never breaks because the backend had a bad day.
 */
export type BlogCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort: number;
};

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html: string;
  cover_url: string | null;
  category_id: string | null;
  author_name: string | null;
  published_at: string;
  seo_title: string | null;
  seo_description: string | null;
};

const LIST_COLS =
  "id,slug,title,excerpt,cover_url,category_id,author_name,published_at,seo_title,seo_description";

async function sb<T>(path: string): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
      signal: ctrl.signal,
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getBlogCategories(): Promise<BlogCategory[]> {
  const rows = await sb<BlogCategory[]>(
    "blog_categories?select=*&order=sort.asc,name.asc",
  );
  return rows ?? [];
}

/** Published posts, newest first (RLS already filters to published + past). */
export async function getBlogPosts(): Promise<Omit<BlogPost, "content_html">[]> {
  const rows = await sb<Omit<BlogPost, "content_html">[]>(
    `blog_posts?select=${LIST_COLS}&order=published_at.desc`,
  );
  return rows ?? [];
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const rows = await sb<BlogPost[]>(
    `blog_posts?select=${LIST_COLS},content_html&slug=eq.${encodeURIComponent(slug)}&limit=1`,
  );
  return rows?.[0] ?? null;
}

/** Up to `n` other posts, same category first, then newest anywhere. */
export async function getRelatedPosts(
  post: Pick<BlogPost, "id" | "category_id">,
  n = 3,
): Promise<Omit<BlogPost, "content_html">[]> {
  const all = await getBlogPosts();
  const others = all.filter((p) => p.id !== post.id);
  const same = others.filter((p) => p.category_id && p.category_id === post.category_id);
  const rest = others.filter((p) => !same.includes(p));
  return [...same, ...rest].slice(0, n);
}
