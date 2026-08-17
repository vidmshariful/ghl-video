"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { AdminModal } from "./Modal";
import { authHeader, supabase, when } from "./client";

/*
 * The blog manager (CMS group). WordPress-style writing without WordPress:
 * a visual editor (headings, bold, lists, quotes, links, inline images),
 * drafts, publish now or schedule, a cover image, per-post SEO fields, and
 * a category manager. Posts render on the main site at /blog; the site
 * reads only published, past-dated rows (RLS), so drafts are invisible.
 */

type Category = { id: string; slug: string; name: string; description: string | null; sort: number };
type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html: string;
  cover_url: string | null;
  category_id: string | null;
  author_email: string | null;
  author_name: string | null;
  status: "draft" | "published";
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  updated_at: string;
};

const field =
  "mt-1.5 w-full rounded-[8px] border border-hair bg-canvas px-3 py-2.5 text-body text-ink focus:border-gold focus:outline-none";
const lab = "font-mono text-label uppercase text-muted";
const btnGold =
  "tap rounded-[8px] bg-brand-gradient px-5 py-2.5 text-body-sm font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60";
const btnGhost =
  "tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-50";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/['".,:;!?()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/* Draft / Published / Scheduled, from status + date. */
function postState(p: Post): "draft" | "published" | "scheduled" {
  if (p.status !== "published") return "draft";
  if (p.published_at && new Date(p.published_at) > new Date()) return "scheduled";
  return "published";
}

export function BlogScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<Post | "new" | null>(null);
  const [managingCats, setManagingCats] = useState(false);
  const [filter, setFilter] = useState<"all" | "draft" | "published" | "scheduled">("all");

  const load = useCallback(async () => {
    setErr("");
    const [p, c] = await Promise.all([
      supabase.from("blog_posts").select("*").order("published_at", { ascending: false, nullsFirst: true }).order("updated_at", { ascending: false }),
      supabase.from("blog_categories").select("*").order("sort").order("name"),
    ]);
    if (p.error) setErr(p.error.message);
    else setPosts((p.data as Post[]) ?? []);
    if (!c.error) setCats((c.data as Category[]) ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? "No category";
  const shown = useMemo(
    () => (filter === "all" ? posts : posts.filter((p) => postState(p) === filter)),
    [posts, filter],
  );

  async function remove(p: Post) {
    if (!window.confirm(`Delete "${p.title}"? This removes it from the site immediately.`)) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", p.id);
    if (error) setErr(error.message);
    else {
      await fetch("/api/admin/blog/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ slug: p.slug }),
      }).catch(() => {});
      load();
    }
  }

  if (editing) {
    return (
      <PostEditor
        post={editing === "new" ? null : editing}
        cats={cats}
        onBack={() => {
          setEditing(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-h2 text-ink">Blog</h1>
          <p className="mt-1 max-w-xl text-body-sm text-muted">
            Posts that build SEO and answer objections before the sales call.
            Published posts appear on the site at /blog within a minute.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={() => setManagingCats(true)} className={btnGhost}>
            Categories
          </button>
          <button type="button" onClick={() => setEditing("new")} className={btnGold}>
            Write a post
          </button>
        </div>
      </div>

      {err ? <p className="mt-4 text-body-sm text-error">{err}</p> : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {(["all", "published", "scheduled", "draft"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`tap rounded-full border px-3.5 py-1.5 font-mono text-label uppercase transition-colors ${
              filter === f
                ? "border-gold/60 bg-gold/10 text-gold"
                : "border-hair text-muted hover:border-gold/40 hover:text-ink"
            }`}
          >
            {f === "all" ? `All (${posts.length})` : `${f} (${posts.filter((p) => postState(p) === f).length})`}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-[12px] border border-hair">
        {!loaded ? (
          <p className="p-6 text-body-sm text-muted">Loading posts...</p>
        ) : shown.length === 0 ? (
          <p className="p-6 text-body-sm text-muted">
            {posts.length === 0 ? "No posts yet. Write the first one." : "Nothing with this status."}
          </p>
        ) : (
          <ul className="divide-y divide-hair">
            {shown.map((p) => {
              const state = postState(p);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-surface/40 p-4">
                  <span
                    className={`w-24 shrink-0 rounded-full border px-2.5 py-0.5 text-center font-mono text-label uppercase ${
                      state === "published"
                        ? "border-green/40 bg-green/10 text-green"
                        : state === "scheduled"
                          ? "border-blue/40 bg-blue/10 text-blue"
                          : "border-hair bg-hair/30 text-muted"
                    }`}
                  >
                    {state}
                  </span>
                  <div className="min-w-[14rem] flex-1">
                    <p className="truncate font-semibold text-ink">{p.title}</p>
                    <p className="text-body-sm text-muted">
                      {catName(p.category_id)}
                      {p.author_name ? ` / ${p.author_name}` : ""}
                      {p.published_at ? ` / ${when(p.published_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {state === "published" ? (
                      <a
                        href={`/blog/${p.slug}/`}
                        target="_blank"
                        rel="noreferrer"
                        className={btnGhost}
                      >
                        View
                      </a>
                    ) : null}
                    <button type="button" onClick={() => setEditing(p)} className={btnGhost}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(p)}
                      className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-dim transition-colors hover:border-error/60 hover:text-error"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {managingCats ? (
        <CategoriesModal cats={cats} onClose={() => setManagingCats(false)} onChanged={load} />
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Category manager                                                  */
/* ---------------------------------------------------------------- */
function CategoriesModal({
  cats,
  onClose,
  onChanged,
}: {
  cats: Category[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr("");
    const { error } = await supabase
      .from("blog_categories")
      .insert({ name: name.trim(), slug: slugify(name), sort: cats.length });
    setBusy(false);
    if (error) setErr(error.code === "23505" ? "That category already exists." : error.message);
    else {
      setName("");
      onChanged();
    }
  }

  async function rename(c: Category) {
    const next = window.prompt("Rename category", c.name);
    if (!next || next.trim() === c.name) return;
    const { error } = await supabase
      .from("blog_categories")
      .update({ name: next.trim() })
      .eq("id", c.id);
    if (error) setErr(error.message);
    else onChanged();
  }

  async function remove(c: Category) {
    if (!window.confirm(`Delete "${c.name}"? Its posts keep living, just uncategorized.`)) return;
    const { error } = await supabase.from("blog_categories").delete().eq("id", c.id);
    if (error) setErr(error.message);
    else onChanged();
  }

  return (
    <AdminModal open onClose={onClose} title="Categories" subtitle="Topic clusters for SEO. Each one gets its own page.">
      <ul className="grid gap-2">
        {cats.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-[8px] border border-hair bg-canvas px-4 py-2.5">
            <span className="flex-1 text-body text-ink">{c.name}</span>
            <span className="font-mono text-label uppercase text-dim">/blog/category/{c.slug}</span>
            <button type="button" onClick={() => rename(c)} className={btnGhost}>
              Rename
            </button>
            <button
              type="button"
              onClick={() => remove(c)}
              className="tap rounded-[8px] border border-hair px-3 py-1.5 font-mono text-label uppercase text-dim transition-colors hover:border-error/60 hover:text-error"
            >
              Delete
            </button>
          </li>
        ))}
        {cats.length === 0 ? <p className="text-body-sm text-muted">No categories yet.</p> : null}
      </ul>
      {err ? <p className="mt-3 text-body-sm text-error">{err}</p> : null}
      <form onSubmit={add} className="mt-4 flex gap-2 border-t border-hair pt-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
          className={`${field} mt-0 flex-1`}
        />
        <button type="submit" disabled={busy || !name.trim()} className={btnGold}>
          Add
        </button>
      </form>
    </AdminModal>
  );
}

/* ---------------------------------------------------------------- */
/* The post editor                                                   */
/* ---------------------------------------------------------------- */
function PostEditor({
  post,
  cats,
  onBack,
}: {
  post: Post | null;
  cats: Category[];
  onBack: () => void;
}) {
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!post);
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [coverUrl, setCoverUrl] = useState(post?.cover_url ?? "");
  const [categoryId, setCategoryId] = useState(post?.category_id ?? cats[0]?.id ?? "");
  const [seoTitle, setSeoTitle] = useState(post?.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(post?.seo_description ?? "");
  const [schedule, setSchedule] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [busy, setBusy] = useState<"" | "draft" | "publish">("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [id, setId] = useState(post?.id ?? null);
  const [status, setStatus] = useState<Post["status"]>(post?.status ?? "draft");
  const [publishedAt, setPublishedAt] = useState(post?.published_at ?? null);
  const coverInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false,
      }),
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: "https" }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder: "Write the post..." }),
    ],
    content: post?.content_html ?? "",
    editorProps: {
      attributes: {
        class:
          "prose-editor min-h-[24rem] max-w-none rounded-[8px] border border-hair bg-canvas px-5 py-4 text-body text-ink focus:outline-none focus:border-gold",
      },
    },
  });

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title));
  }, [title, slugTouched]);

  async function uploadImage(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/admin/blog/image", {
      method: "POST",
      headers: await authHeader(),
      body: fd,
    });
    const j = await r.json();
    if (!r.ok) {
      setErr(j.error ?? "Upload failed.");
      return null;
    }
    return j.url as string;
  }

  async function onCoverPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const url = await uploadImage(f);
    if (url) setCoverUrl(url);
  }

  async function onImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !editor) return;
    const url = await uploadImage(f);
    if (url) editor.chain().focus().setImage({ src: url, alt: f.name.replace(/\.\w+$/, "") }).run();
  }

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link to", prev ?? "https://");
    if (url === null) return;
    if (!url.trim()) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  /* save. mode: keep current status (autosave/draft) or publish/schedule */
  async function save(mode: "draft" | "publish") {
    if (!title.trim()) return setErr("Give the post a title.");
    if (!slug.trim()) return setErr("The post needs a slug.");
    setBusy(mode);
    setErr("");
    setNotice("");

    let nextStatus = status;
    let nextPublishedAt = publishedAt;
    if (mode === "publish") {
      nextStatus = "published";
      nextPublishedAt =
        schedule && scheduleAt
          ? new Date(scheduleAt).toISOString()
          : publishedAt && status === "published"
            ? publishedAt // already live: keep the original publish date
            : new Date().toISOString();
    }

    const { data: session } = await supabase.auth.getUser();
    const payload = {
      slug: slugify(slug),
      title: title.trim(),
      excerpt: excerpt.trim() || null,
      content_html: editor?.getHTML() ?? "",
      cover_url: coverUrl || null,
      category_id: categoryId || null,
      author_email: post?.author_email ?? session.user?.email ?? null,
      author_name: post?.author_name ?? (session.user?.email?.split("@")[0] ?? null),
      status: nextStatus,
      published_at: nextPublishedAt,
      seo_title: seoTitle.trim() || null,
      seo_description: seoDescription.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const q = supabase.from("blog_posts");
    const res = id
      ? await q.update(payload).eq("id", id).select("id").single()
      : await q.insert(payload).select("id").single();
    setBusy("");
    if (res.error) {
      setErr(res.error.code === "23505" ? "That slug is already used by another post." : res.error.message);
      return;
    }
    setId(res.data.id);
    setStatus(nextStatus);
    setPublishedAt(nextPublishedAt);
    await fetch("/api/admin/blog/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ slug: slugify(slug) }),
    }).catch(() => {});
    setNotice(
      mode === "publish"
        ? schedule && scheduleAt
          ? `Scheduled for ${new Date(scheduleAt).toLocaleString()}.`
          : "Published. It is live on the site."
        : "Draft saved.",
    );
  }

  const state = { status, published_at: publishedAt } as Post;
  const live = postState({ ...state, id: "", slug, title, excerpt: null, content_html: "", cover_url: null, category_id: null, author_email: null, author_name: null, seo_title: null, seo_description: null, updated_at: "" }) === "published";

  const tbBtn = (active: boolean) =>
    `tap rounded-[6px] border px-2.5 py-1.5 font-mono text-label transition-colors ${
      active ? "border-gold/60 bg-gold/10 text-gold" : "border-hair text-muted hover:border-gold/40 hover:text-ink"
    }`;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button type="button" onClick={onBack} className={btnGhost}>
          &#8592; All posts
        </button>
        <div className="flex items-center gap-2.5">
          {live ? (
            <a href={`/blog/${slug}/`} target="_blank" rel="noreferrer" className={btnGhost}>
              View live
            </a>
          ) : null}
          <button type="button" disabled={!!busy} onClick={() => save("draft")} className={btnGhost}>
            {busy === "draft" ? "Saving..." : live ? "Save changes" : "Save draft"}
          </button>
          <button type="button" disabled={!!busy} onClick={() => save("publish")} className={btnGold}>
            {busy === "publish"
              ? "Publishing..."
              : schedule
                ? "Schedule"
                : live
                  ? "Update live post"
                  : "Publish"}
          </button>
        </div>
      </div>

      {err ? <p className="mt-4 text-body-sm text-error">{err}</p> : null}
      {notice ? <p className="mt-4 text-body-sm text-gold">{notice}</p> : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        {/* the writing column */}
        <div className="min-w-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title"
            className="w-full rounded-[8px] border border-hair bg-canvas px-5 py-4 font-display text-h3 font-semibold text-ink placeholder:text-dim focus:border-gold focus:outline-none"
          />

          {/* toolbar */}
          {editor ? (
            <div className="sticky top-16 z-10 mt-3 flex flex-wrap items-center gap-1.5 rounded-[8px] border border-hair bg-surface px-2.5 py-2">
              <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={tbBtn(editor.isActive("heading", { level: 2 }))}>
                H2
              </button>
              <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={tbBtn(editor.isActive("heading", { level: 3 }))}>
                H3
              </button>
              <span className="mx-1 h-5 w-px bg-hair" />
              <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={tbBtn(editor.isActive("bold"))}>
                B
              </button>
              <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`${tbBtn(editor.isActive("italic"))} italic`}>
                I
              </button>
              <span className="mx-1 h-5 w-px bg-hair" />
              <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={tbBtn(editor.isActive("bulletList"))}>
                List
              </button>
              <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={tbBtn(editor.isActive("orderedList"))}>
                1. List
              </button>
              <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={tbBtn(editor.isActive("blockquote"))}>
                Quote
              </button>
              <span className="mx-1 h-5 w-px bg-hair" />
              <button type="button" onClick={setLink} className={tbBtn(editor.isActive("link"))}>
                Link
              </button>
              <button type="button" onClick={() => imageInput.current?.click()} className={tbBtn(false)}>
                Image
              </button>
              <span className="mx-1 h-5 w-px bg-hair" />
              <button type="button" onClick={() => editor.chain().focus().undo().run()} className={tbBtn(false)}>
                Undo
              </button>
              <button type="button" onClick={() => editor.chain().focus().redo().run()} className={tbBtn(false)}>
                Redo
              </button>
            </div>
          ) : null}

          <div className="mt-3 [&_.prose-editor_h2]:font-display [&_.prose-editor_h2]:text-h3 [&_.prose-editor_h2]:font-semibold [&_.prose-editor_h2]:text-ink [&_.prose-editor_h2]:mt-6 [&_.prose-editor_h3]:font-display [&_.prose-editor_h3]:text-h4 [&_.prose-editor_h3]:font-semibold [&_.prose-editor_h3]:text-ink [&_.prose-editor_h3]:mt-5 [&_.prose-editor_p]:my-3 [&_.prose-editor_p]:leading-relaxed [&_.prose-editor_ul]:my-3 [&_.prose-editor_ul]:list-disc [&_.prose-editor_ul]:pl-6 [&_.prose-editor_ol]:my-3 [&_.prose-editor_ol]:list-decimal [&_.prose-editor_ol]:pl-6 [&_.prose-editor_blockquote]:border-l-2 [&_.prose-editor_blockquote]:border-gold/60 [&_.prose-editor_blockquote]:pl-4 [&_.prose-editor_blockquote]:text-muted [&_.prose-editor_a]:text-gold [&_.prose-editor_a]:underline [&_.prose-editor_img]:rounded-[4px] [&_.prose-editor_img]:my-4 [&_.prose-editor_img]:max-w-full [&_.prose-editor_.ProseMirror-selectednode]:outline [&_.prose-editor_.ProseMirror-selectednode]:outline-2 [&_.prose-editor_.ProseMirror-selectednode]:outline-gold [&_.prose-editor_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.prose-editor_p.is-editor-empty:first-child::before]:text-dim [&_.prose-editor_p.is-editor-empty:first-child::before]:float-left [&_.prose-editor_p.is-editor-empty:first-child::before]:h-0 [&_.prose-editor_p.is-editor-empty:first-child::before]:pointer-events-none">
            <EditorContent editor={editor} />
          </div>
          <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={onImagePicked} />
        </div>

        {/* the settings column */}
        <div className="grid content-start gap-5">
          <div className="rounded-[12px] border border-hair bg-surface p-4">
            <p className={lab}>Cover image</p>
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded asset
              <img src={coverUrl} alt="Cover" className="mt-2 w-full rounded-[4px] border border-hair" />
            ) : (
              <p className="mt-2 text-body-sm text-dim">Shown on the blog page and social shares.</p>
            )}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => coverInput.current?.click()} className={btnGhost}>
                {coverUrl ? "Replace" : "Upload"}
              </button>
              {coverUrl ? (
                <button type="button" onClick={() => setCoverUrl("")} className={btnGhost}>
                  Remove
                </button>
              ) : null}
            </div>
            <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={onCoverPicked} />
          </div>

          <div className="rounded-[12px] border border-hair bg-surface p-4">
            <label className="block">
              <span className={lab}>Category</span>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={field}>
                <option value="">No category</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block">
              <span className={lab}>Slug (the URL)</span>
              <input
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                className={field}
              />
              <span className="mt-1 block truncate text-body-sm text-dim">/blog/{slugify(slug) || "..."}/</span>
            </label>
            <label className="mt-4 block">
              <span className={lab}>Excerpt</span>
              <textarea
                rows={3}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                className={`${field} resize-y`}
                placeholder="One or two sentences shown on the blog page."
              />
            </label>
          </div>

          <div className="rounded-[12px] border border-hair bg-surface p-4">
            <p className={lab}>Search engines</p>
            <label className="mt-3 block">
              <span className="text-body-sm text-muted">SEO title (empty = post title)</span>
              <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className={field} />
            </label>
            <label className="mt-3 block">
              <span className="text-body-sm text-muted">Meta description (empty = excerpt)</span>
              <textarea
                rows={3}
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                className={`${field} resize-y`}
              />
              <span className="mt-1 block text-body-sm text-dim">{(seoDescription || excerpt).length} characters. Aim for 150 to 160.</span>
            </label>
          </div>

          <div className="rounded-[12px] border border-hair bg-surface p-4">
            <p className={lab}>Publishing</p>
            <label className="mt-3 flex items-center gap-2.5 text-body-sm text-ink">
              <input
                type="checkbox"
                checked={schedule}
                onChange={(e) => setSchedule(e.target.checked)}
                className="h-4 w-4 accent-[var(--gold)]"
              />
              Schedule for later
            </label>
            {schedule ? (
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className={field}
              />
            ) : null}
            {publishedAt ? (
              <p className="mt-3 text-body-sm text-dim">
                {new Date(publishedAt) > new Date() ? "Goes live" : "Published"} {when(publishedAt)}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
