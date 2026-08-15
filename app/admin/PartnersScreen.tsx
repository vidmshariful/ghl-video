"use client";

import { useEffect, useState } from "react";
import { supabase, authHeader, when } from "./client";

/*
 * Affiliate partner management: the partner list, the application queue
 * from /partners/apply, and the promo-asset library the partner portal
 * serves. Rows are read and written directly through RLS (admins only);
 * the one service-role step, creating a partner's login, goes through
 * /api/admin/partners/invite.
 *
 * NOTE: the checkout discount still reads the code registry
 * (lib/affiliates.ts), so for a NEW partner the discount fields here are
 * bookkeeping until the checkout bridge ships. Attribution (?ref= links,
 * the partner page, portal access) works from this table right away.
 */
type PartnerRow = {
  id: string;
  ref: string;
  name: string;
  email: string | null;
  status: "applied" | "invited" | "active" | "paused" | "rejected";
  photo_path: string | null;
  role_line: string;
  tagline: string | null;
  bio: string | null;
  coupon_code: string | null;
  discount_percent: number;
  discount_months: number;
  stripe_coupon_id: string | null;
  fp_ref: string | null;
  fp_promoter_id: string | null;
  application: Record<string, string> | null;
  notes: string | null;
  created_at: string;
};

type AssetRow = {
  id: string;
  kind: "banner" | "graphic" | "logo" | "video" | "copy" | "doc";
  title: string;
  description: string | null;
  file_path: string | null;
  body: string | null;
  partner_id: string | null;
  sort: number;
  active: boolean;
  created_at: string;
};

type Tab = "partners" | "applications" | "assets";

const field =
  "mt-1.5 w-full rounded-[3px] border border-hair bg-canvas px-3 py-2.5 text-body text-ink focus:border-gold focus:outline-none";
const lab = "font-mono text-label uppercase text-muted";
const btn =
  "tap rounded-[3px] border border-hair px-4 py-2 text-body-sm text-ink transition-colors hover:border-gold/60";
const btnGold =
  "tap rounded-[3px] bg-brand-gradient px-5 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60";

const STATUS_STYLE: Record<PartnerRow["status"], string> = {
  active: "border-green/40 text-green",
  invited: "border-gold/40 text-gold",
  applied: "border-blue/40 text-blue",
  paused: "border-hair text-dim",
  rejected: "border-error/40 text-error",
};

const KINDS: AssetRow["kind"][] = ["banner", "graphic", "logo", "video", "doc", "copy"];

/* ---------------- partner form ---------------- */
function PartnerForm({
  initial,
  onDone,
  onCancel,
}: {
  initial: Partial<PartnerRow>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isNew = !initial.id;
  const [f, setF] = useState({
    name: initial.name ?? "",
    email: initial.email ?? "",
    ref: initial.ref ?? "",
    status: initial.status ?? "invited",
    coupon_code: initial.coupon_code ?? "",
    discount_percent: String(initial.discount_percent ?? 10),
    discount_months: String(initial.discount_months ?? 3),
    stripe_coupon_id: initial.stripe_coupon_id ?? "",
    fp_ref: initial.fp_ref ?? "",
    fp_promoter_id: initial.fp_promoter_id ?? "",
    photo_path: initial.photo_path ?? "",
    tagline: initial.tagline ?? "",
    bio: initial.bio ?? "",
    notes: initial.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ref = f.ref.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(ref)) {
      setErr("The ref must be lowercase letters, numbers, dashes. It becomes ?ref=<this>.");
      return;
    }
    if (!f.name.trim()) {
      setErr("A name is required.");
      return;
    }
    setBusy(true);
    setErr("");
    const payload = {
      name: f.name.trim(),
      email: f.email.trim().toLowerCase() || null,
      ref,
      status: f.status,
      coupon_code: f.coupon_code.trim().toUpperCase() || null,
      discount_percent: Math.min(90, Math.max(0, Math.round(Number(f.discount_percent) || 0))),
      discount_months: Math.min(36, Math.max(0, Math.round(Number(f.discount_months) || 0))),
      stripe_coupon_id: f.stripe_coupon_id.trim() || null,
      fp_ref: f.fp_ref.trim() || null,
      fp_promoter_id: f.fp_promoter_id.trim() || null,
      photo_path: f.photo_path.trim() || null,
      tagline: f.tagline.trim() || null,
      bio: f.bio.trim() || null,
      notes: f.notes.trim() || null,
    };
    const q = supabase.from("partners");
    const { error } = isNew
      ? await q.insert(payload)
      : await q.update(payload).eq("id", initial.id!);
    if (error) {
      setErr(
        error.code === "23505"
          ? "That ref or email is already taken by another partner."
          : error.message,
      );
      setBusy(false);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={save} className="rounded-card border border-gold/40 bg-surface p-6">
      <p className="font-display text-h4 font-semibold text-ink">
        {isNew ? "Add a partner" : `Edit ${initial.name}`}
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label>
          <span className={lab}>Name</span>
          <input required value={f.name} onChange={(e) => set("name", e.target.value)} className={field} />
        </label>
        <label>
          <span className={lab}>Email (their portal login)</span>
          <input
            type="email"
            value={f.email}
            onChange={(e) => set("email", e.target.value)}
            className={field}
            placeholder="partner@example.com"
          />
        </label>
        <label>
          <span className={lab}>Ref slug (?ref=... on their links)</span>
          <input
            required
            value={f.ref}
            onChange={(e) => set("ref", e.target.value.toLowerCase())}
            className={`${field} font-mono lowercase`}
            placeholder="jonah"
          />
        </label>
        <label>
          <span className={lab}>Status</span>
          <select value={f.status} onChange={(e) => set("status", e.target.value)} className={field}>
            <option value="invited">Invited (can log in, activates on first sign-in)</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="applied">Applied (in review)</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label>
          <span className={lab}>Coupon code (their checkout backup)</span>
          <input
            value={f.coupon_code}
            onChange={(e) => set("coupon_code", e.target.value.toUpperCase())}
            className={`${field} font-mono uppercase`}
            placeholder="JONAH10"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label>
            <span className={lab}>% off</span>
            <input
              type="number"
              min={0}
              max={90}
              value={f.discount_percent}
              onChange={(e) => set("discount_percent", e.target.value)}
              className={field}
            />
          </label>
          <label>
            <span className={lab}>Months</span>
            <input
              type="number"
              min={0}
              max={36}
              value={f.discount_months}
              onChange={(e) => set("discount_months", e.target.value)}
              className={field}
            />
          </label>
        </div>
        <label>
          <span className={lab}>Stripe coupon id (editing plans)</span>
          <input
            value={f.stripe_coupon_id}
            onChange={(e) => set("stripe_coupon_id", e.target.value)}
            className={`${field} font-mono`}
            placeholder="bzD89jmL"
          />
        </label>
        <label>
          <span className={lab}>FirstPromoter ref (?fpr=... token)</span>
          <input
            value={f.fp_ref}
            onChange={(e) => set("fp_ref", e.target.value)}
            className={`${field} font-mono`}
            placeholder="their FP referral token"
          />
        </label>
        <label>
          <span className={lab}>FirstPromoter promoter id (for stats, later)</span>
          <input
            value={f.fp_promoter_id}
            onChange={(e) => set("fp_promoter_id", e.target.value)}
            className={`${field} font-mono`}
          />
        </label>
        <label>
          <span className={lab}>Photo path (/partners/name.jpg in the repo)</span>
          <input
            value={f.photo_path}
            onChange={(e) => set("photo_path", e.target.value)}
            className={`${field} font-mono`}
            placeholder="/partners/jonah-cockshaw.jpg"
          />
        </label>
        <label className="sm:col-span-2">
          <span className={lab}>Tagline (their partner page headline)</span>
          <input
            value={f.tagline}
            onChange={(e) => set("tagline", e.target.value)}
            className={field}
            placeholder="A friend of Jonah is a friend of GHL Video."
          />
        </label>
        <label className="sm:col-span-2">
          <span className={lab}>Bio</span>
          <textarea rows={3} value={f.bio} onChange={(e) => set("bio", e.target.value)} className={field} />
        </label>
        <label className="sm:col-span-2">
          <span className={lab}>Team notes (never shown to the partner)</span>
          <textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} className={field} />
        </label>
      </div>
      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}
      <div className="mt-6 flex gap-3">
        <button type="submit" disabled={busy} className={btnGold}>
          {busy ? "Saving" : "Save partner"}
        </button>
        <button type="button" onClick={onCancel} className={btn}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ---------------- asset form ---------------- */
function AssetForm({
  partners,
  onDone,
  onCancel,
}: {
  partners: PartnerRow[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    kind: "banner" as AssetRow["kind"],
    title: "",
    description: "",
    partner_id: "",
    sort: "0",
    source: "upload" as "upload" | "url" | "body",
    url: "",
    body: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const isCopy = f.kind === "copy";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return setErr("A title is required.");
    if (isCopy && !f.body.trim()) return setErr("Paste the swipe copy text.");
    if (!isCopy && f.source === "upload" && !file) return setErr("Pick a file to upload.");
    if (!isCopy && f.source === "url" && !/^https?:\/\//.test(f.url.trim()))
      return setErr("Enter a full URL starting with https://");
    setBusy(true);
    setErr("");

    let filePath: string | null = null;
    if (!isCopy && f.source === "upload" && file) {
      const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-80);
      const path = `${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("partner-assets").upload(path, file);
      if (upErr) {
        setErr(`Upload failed: ${upErr.message}`);
        setBusy(false);
        return;
      }
      filePath = path;
    } else if (!isCopy && f.source === "url") {
      filePath = f.url.trim();
    }

    const { error } = await supabase.from("partner_assets").insert({
      kind: f.kind,
      title: f.title.trim(),
      description: f.description.trim() || null,
      file_path: filePath,
      body: isCopy ? f.body : null,
      partner_id: f.partner_id || null,
      sort: Math.round(Number(f.sort) || 0),
      active: true,
    });
    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={save} className="rounded-card border border-gold/40 bg-surface p-6">
      <p className="font-display text-h4 font-semibold text-ink">Add an asset</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label>
          <span className={lab}>Type</span>
          <select
            value={f.kind}
            onChange={(e) => set("kind", e.target.value)}
            className={field}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k === "copy" ? "Swipe copy (text)" : k[0].toUpperCase() + k.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={lab}>Title</span>
          <input required value={f.title} onChange={(e) => set("title", e.target.value)} className={field} />
        </label>
        <label className="sm:col-span-2">
          <span className={lab}>Description (optional)</span>
          <input value={f.description} onChange={(e) => set("description", e.target.value)} className={field} />
        </label>
        <label>
          <span className={lab}>Who sees it</span>
          <select
            value={f.partner_id}
            onChange={(e) => set("partner_id", e.target.value)}
            className={field}
          >
            <option value="">Every partner (global)</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                Only {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={lab}>Sort (low shows first)</span>
          <input type="number" value={f.sort} onChange={(e) => set("sort", e.target.value)} className={field} />
        </label>
        {isCopy ? (
          <label className="sm:col-span-2">
            <span className={lab}>The copy. Use {"{{LINK}}"} where their tracked link goes</span>
            <textarea rows={6} value={f.body} onChange={(e) => set("body", e.target.value)} className={`${field} font-mono`} />
          </label>
        ) : (
          <>
            <label>
              <span className={lab}>File source</span>
              <select value={f.source} onChange={(e) => set("source", e.target.value)} className={field}>
                <option value="upload">Upload a file (up to 50 MB)</option>
                <option value="url">Link an external URL</option>
              </select>
            </label>
            {f.source === "upload" ? (
              <label>
                <span className={lab}>File</span>
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className={`${field} file:mr-3 file:rounded-[3px] file:border-0 file:bg-gold/15 file:px-3 file:py-1 file:text-gold`}
                />
              </label>
            ) : (
              <label>
                <span className={lab}>URL</span>
                <input value={f.url} onChange={(e) => set("url", e.target.value)} className={`${field} font-mono`} placeholder="https://..." />
              </label>
            )}
          </>
        )}
      </div>
      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}
      <div className="mt-6 flex gap-3">
        <button type="submit" disabled={busy} className={btnGold}>
          {busy ? "Saving" : "Add asset"}
        </button>
        <button type="button" onClick={onCancel} className={btn}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ---------------- the screen ---------------- */
export function PartnersScreen() {
  const [tab, setTab] = useState<Tab>("partners");
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [editing, setEditing] = useState<PartnerRow | "new" | null>(null);
  const [addingAsset, setAddingAsset] = useState(false);
  const [openApp, setOpenApp] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const [p, a] = await Promise.all([
      supabase.from("partners").select("*").order("created_at", { ascending: true }),
      supabase.from("partner_assets").select("*").order("sort", { ascending: true }),
    ]);
    if (p.error) setErr(p.error.message);
    else setRows((p.data ?? []) as PartnerRow[]);
    if (a.error) setErr(a.error.message);
    else setAssets((a.data ?? []) as AssetRow[]);
    setLoaded(true);
  }
  useEffect(() => {
    load();
  }, []);

  const partners = rows.filter((r) => !["applied", "rejected"].includes(r.status));
  const applications = rows.filter((r) => ["applied", "rejected"].includes(r.status));
  const pendingApps = applications.filter((r) => r.status === "applied").length;

  async function invite(p: PartnerRow) {
    setNotice("");
    setErr("");
    const r = await fetch("/api/admin/partners/invite/", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ id: p.id }),
    });
    const j = await r.json();
    if (!r.ok) {
      setErr(j.error ?? "Invite failed.");
      return;
    }
    setNotice(
      `${p.name} can now sign in. Send them to ghlvideo.com/partners, where they set a password with "${p.email}" via the email link.`,
    );
    load();
  }

  async function setStatus(p: PartnerRow, status: PartnerRow["status"]) {
    const { error } = await supabase.from("partners").update({ status }).eq("id", p.id);
    if (error) setErr(error.message);
    else load();
  }

  async function removePartner(p: PartnerRow) {
    if (!confirm(`Delete ${p.name}? Their portal access and scoped assets go with it.`)) return;
    const { error } = await supabase.from("partners").delete().eq("id", p.id);
    if (error) setErr(error.message);
    else load();
  }

  async function toggleAsset(a: AssetRow) {
    const { error } = await supabase
      .from("partner_assets")
      .update({ active: !a.active })
      .eq("id", a.id);
    if (error) setErr(error.message);
    else load();
  }

  async function removeAsset(a: AssetRow) {
    if (!confirm(`Delete asset "${a.title}"?`)) return;
    if (a.file_path && !/^https?:\/\//.test(a.file_path)) {
      await supabase.storage.from("partner-assets").remove([a.file_path]);
    }
    const { error } = await supabase.from("partner_assets").delete().eq("id", a.id);
    if (error) setErr(error.message);
    else load();
  }

  if (!loaded) return <p className="text-body text-muted">Loading partners...</p>;

  const tabs: { key: Tab; label: string }[] = [
    { key: "partners", label: `Partners (${partners.length})` },
    { key: "applications", label: `Applications (${pendingApps})` },
    { key: "assets", label: `Assets (${assets.length})` },
  ];

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-h3 text-ink">Partners</h1>
        {tab === "partners" && (
          <button type="button" onClick={() => setEditing("new")} className={btnGold}>
            Add partner
          </button>
        )}
        {tab === "assets" && (
          <button type="button" onClick={() => setAddingAsset(true)} className={btnGold}>
            Add asset
          </button>
        )}
      </div>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        The affiliate program: who is in it, who applied, and the promo material their
        portal serves. Partners sign in at /partners. Commissions and payouts run in
        FirstPromoter.
      </p>

      <div className="mt-6 flex gap-1 border-b border-hair">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`tap rounded-t-[6px] px-4 py-2.5 text-body-sm transition-colors ${
              tab === t.key
                ? "border border-b-0 border-hair bg-surface font-semibold text-gold"
                : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}
      {notice && <p className="mt-4 text-body-sm text-gold">{notice}</p>}

      {/* ---- partners tab ---- */}
      {tab === "partners" && (
        <>
          {editing && (
            <div className="mt-6">
              <PartnerForm
                initial={editing === "new" ? {} : editing}
                onDone={() => {
                  setEditing(null);
                  load();
                }}
                onCancel={() => setEditing(null)}
              />
            </div>
          )}
          <ul className="mt-6 overflow-hidden rounded-card border border-hair">
            {partners.length === 0 && (
              <li className="bg-canvas px-5 py-6 text-body text-muted">
                No partners yet. Add the first one.
              </li>
            )}
            {partners.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-hair bg-canvas px-5 py-4 first:border-t-0"
              >
                <div className="min-w-0">
                  <p className="text-body font-semibold text-ink">
                    {p.name}
                    <span
                      className={`ml-2 inline-flex rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${STATUS_STYLE[p.status]}`}
                    >
                      {p.status}
                    </span>
                  </p>
                  <p className="mt-0.5 font-mono text-label uppercase text-muted">
                    ?ref={p.ref}
                    {p.coupon_code ? ` / ${p.coupon_code}` : ""}
                    {` / ${p.discount_percent}% for ${p.discount_months} mo`}
                    {p.email ? ` / ${p.email}` : " / no email yet"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {p.email && p.status !== "paused" && (
                    <button type="button" onClick={() => invite(p)} className={btn}>
                      {p.status === "active" ? "Resend access" : "Invite"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setStatus(p, p.status === "paused" ? "active" : "paused")}
                    className={btn}
                  >
                    {p.status === "paused" ? "Reactivate" : "Pause"}
                  </button>
                  <button type="button" onClick={() => setEditing(p)} className={btn}>
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removePartner(p)}
                    className={`${btn} text-error hover:border-error/60`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-body-sm text-dim">
            Checkout discounts for NEW partners still need the code registry
            (lib/affiliates.ts) until the checkout bridge ships; links, pages, and the
            portal work from here right away.
          </p>
        </>
      )}

      {/* ---- applications tab ---- */}
      {tab === "applications" && (
        <>
          {editing && editing !== "new" && (
            <div className="mt-6">
              <PartnerForm
                initial={editing}
                onDone={() => {
                  setEditing(null);
                  load();
                }}
                onCancel={() => setEditing(null)}
              />
            </div>
          )}
          <ul className="mt-6 overflow-hidden rounded-card border border-hair">
            {applications.length === 0 && (
              <li className="bg-canvas px-5 py-6 text-body text-muted">
                No applications yet. The form lives at /partners/apply.
              </li>
            )}
            {applications.map((p) => (
              <li key={p.id} className="border-t border-hair bg-canvas px-5 py-4 first:border-t-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-body font-semibold text-ink">
                      {p.name}
                      <span
                        className={`ml-2 inline-flex rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${STATUS_STYLE[p.status]}`}
                      >
                        {p.status}
                      </span>
                    </p>
                    <p className="mt-0.5 font-mono text-label uppercase text-muted">
                      {p.email} / {when(p.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenApp(openApp === p.id ? null : p.id)}
                      className={btn}
                    >
                      {openApp === p.id ? "Hide answers" : "View answers"}
                    </button>
                    {p.status === "applied" && (
                      <>
                        <button type="button" onClick={() => setEditing(p)} className={btnGold}>
                          Approve and set up
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatus(p, "rejected")}
                          className={`${btn} text-error hover:border-error/60`}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {p.status === "rejected" && (
                      <button type="button" onClick={() => setEditing(p)} className={btn}>
                        Reconsider
                      </button>
                    )}
                  </div>
                </div>
                {openApp === p.id && p.application && (
                  <dl className="mt-4 grid gap-2 rounded-[3px] border border-hair bg-surface p-4 text-body-sm">
                    {Object.entries(p.application)
                      .filter(([k]) => k !== "submittedAt")
                      .map(([k, v]) => (
                        <div key={k}>
                          <dt className="font-mono text-label uppercase text-muted">{k}</dt>
                          <dd className="mt-0.5 whitespace-pre-wrap text-ink">{String(v) || "-"}</dd>
                        </div>
                      ))}
                  </dl>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-body-sm text-dim">
            Approve and set up opens the partner form: give them their ref, coupon, and
            terms, set the status to Invited, save, then hit Invite on the Partners tab
            so they can sign in.
          </p>
        </>
      )}

      {/* ---- assets tab ---- */}
      {tab === "assets" && (
        <>
          {addingAsset && (
            <div className="mt-6">
              <AssetForm
                partners={partners}
                onDone={() => {
                  setAddingAsset(false);
                  load();
                }}
                onCancel={() => setAddingAsset(false)}
              />
            </div>
          )}
          <ul className="mt-6 overflow-hidden rounded-card border border-hair">
            {assets.length === 0 && (
              <li className="bg-canvas px-5 py-6 text-body text-muted">
                No assets yet. Add banners, logos, and swipe copy; partners see them in
                their portal instantly.
              </li>
            )}
            {assets.map((a) => {
              const scope = a.partner_id
                ? rows.find((p) => p.id === a.partner_id)?.name ?? "one partner"
                : "all partners";
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-hair bg-canvas px-5 py-4 first:border-t-0"
                >
                  <div className="min-w-0">
                    <p className="text-body font-semibold text-ink">
                      {a.title}
                      {!a.active && (
                        <span className="ml-2 font-mono text-label uppercase text-error">[off]</span>
                      )}
                    </p>
                    <p className="mt-0.5 font-mono text-label uppercase text-muted">
                      {a.kind} / {scope}
                      {a.file_path ? " / file" : ""}
                      {a.body ? " / text" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => toggleAsset(a)} className={btn}>
                      {a.active ? "Turn off" : "Turn on"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAsset(a)}
                      className={`${btn} text-error hover:border-error/60`}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
