"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, Trash2, Upload } from "lucide-react";
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Progress,
  Textarea,
} from "@/components/portal/ui";
import type { BrandKit, Completeness, GuidelineFile } from "@/lib/brand-kit";

/*
 * The brand, given once and used on everything after.
 *
 * This is the screen the blueprint hangs on. Before it, every order asked
 * for the same logo, colours and notes again, which is why a repeat order
 * took four minutes instead of twenty seconds.
 *
 * Two things it deliberately does not do. It does not demand everything: only
 * three fields are required, because a checklist asking for six gets
 * abandoned halfway and then the order stalls on a field nobody needed. And
 * it does not pretend an edit reaches work already in progress, which is the
 * next thing anybody wonders after pressing save.
 */

type Payload = {
  kit: BrandKit | null;
  completeness: Completeness;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  logoLightUrl: string | null;
  guidelines: (GuidelineFile & { url: string | null })[];
};

const kb = (n: number) =>
  n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export function BrandKitView({
  authedFetch,
  canEdit,
}: {
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  canEdit: boolean;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [form, setForm] = useState<Partial<BrandKit>>({});
  const [busy, setBusy] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    authedFetch("/api/portal/brand-kit")
      .then((j) => {
        const p = j as unknown as Payload;
        setData(p);
        setForm(p.kit ?? {});
      })
      .catch(() => setErr("Could not load your brand kit."));
  }, [authedFetch]);

  async function sendFile(kind: "logo_dark" | "logo_light" | "guideline", file: File) {
    setBusyFile(kind);
    setErr("");
    try {
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("file", file);
      const j = (await authedFetch("/api/portal/brand-kit/upload", {
        method: "POST",
        body: fd,
      })) as unknown as Payload & { error?: string };
      if (j.error) setErr(j.error);
      else setData(j);
    } catch {
      setErr("Could not upload that file. Please try again.");
    }
    setBusyFile(null);
  }

  async function removeFile(kind: "logo_dark" | "logo_light" | "guideline", path?: string) {
    setBusyFile(kind);
    setErr("");
    try {
      const j = (await authedFetch("/api/portal/brand-kit/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, path }),
      })) as unknown as Payload & { error?: string };
      if (j.error) setErr(j.error);
      else setData(j);
    } catch {
      setErr("Could not remove that file. Please try again.");
    }
    setBusyFile(null);
  }

  async function save() {
    setBusy(true);
    setErr("");
    setSaved(false);
    try {
      const j = (await authedFetch("/api/portal/brand-kit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })) as unknown as Payload & { error?: string };
      if (j.error) setErr(j.error);
      else {
        setData((d) => (d ? { ...d, kit: j.kit, completeness: j.completeness } : d));
        setSaved(true);
      }
    } catch {
      setErr("Could not save. Please try again.");
    }
    setBusy(false);
  }

  if (err && !data) return <p className="text-body text-error">{err}</p>;
  if (!data) return <p className="text-body text-muted">Loading...</p>;

  const c = data.completeness;
  const set = (k: keyof BrandKit) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setSaved(false);
  };

  return (
    <div>
      <PageHeader
        title="Brand Kit"
        description="Your logo, colours and how your name is said. Given once, and used on every video we make for you after."
        actions={
          canEdit ? (
            <Button variant="brand" disabled={busy} onClick={save}>
              {busy ? "Saving..." : saved ? "Saved" : "Save changes"}
            </Button>
          ) : undefined
        }
      />

      {/* The one nag in the portal, and it earns its place: an incomplete kit
          is the actual reason an order sits still. */}
      {!c.ready && (
        <div className="mb-4">
          <Card
            tone="dark"
            title="We cannot start without these"
            description={c.missing.join(", ")}
          >
            <p className="text-body-sm text-chrome-muted">
              Fill these in and every order you place from now on uses them
              automatically. You will not be asked again.
            </p>
          </Card>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_20rem] lg:items-start">
        <Card title="Your brand">
          <div className="grid gap-4">
            <Field
              label="Brand or product name"
              required
              hint="Exactly how it should appear on screen."
            >
              <Input
                value={form.brandName ?? ""}
                onChange={set("brandName")}
                disabled={!canEdit}
                placeholder="SpeedMobi"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Main colour" required hint="Hex, like #F25C1A.">
                <Input
                  value={form.primaryColor ?? ""}
                  onChange={set("primaryColor")}
                  disabled={!canEdit}
                  placeholder="#F25C1A"
                />
              </Field>
              <Field label="Second colour" hint="Optional. Used for accents.">
                <Input
                  value={form.accentColor ?? ""}
                  onChange={set("accentColor")}
                  disabled={!canEdit}
                  placeholder="#1F7A4D"
                />
              </Field>
            </div>

            <Field
              label="How your name is said out loud"
              hint="For the voiceover. Write it how it sounds, not how it is spelled."
            >
              <Input
                value={form.pronunciation ?? ""}
                onChange={set("pronunciation")}
                disabled={!canEdit}
                placeholder="SPEED-mo-bee"
              />
            </Field>

            <Field
              label="Anything else we should know"
              hint="Tone, words to avoid, competitors not to resemble."
            >
              <Textarea
                rows={4}
                value={form.notes ?? ""}
                onChange={set("notes")}
                disabled={!canEdit}
                placeholder="Keep it calm and factual. No hard sell."
              />
            </Field>

            {err && <p className="text-body-sm text-error">{err}</p>}
            {!canEdit && (
              <p className="text-body-sm text-dim">
                Your access does not include editing the brand. Whoever owns
                this account can change that under Settings, Team.
              </p>
            )}
          </div>
        </Card>

        <div className="grid gap-3">
          <Card title="How complete it is">
            <Progress percent={c.percent} label={c.ready ? "Ready to work from" : "Still needed"} />
            {c.ready ? (
              <p className="mt-3 flex items-start gap-2 text-body-sm text-muted">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-green" aria-hidden="true" />
                We have what we need. Anything you add below only makes the
                videos better.
              </p>
            ) : (
              <ul className="mt-3 grid gap-1.5">
                {c.missing.map((m) => (
                  <li key={m} className="text-body-sm text-ink">
                    {m}
                  </li>
                ))}
              </ul>
            )}
            {c.couldAdd.length > 0 && (
              <p className="mt-3 text-body-sm text-dim">
                Optional, and worth adding: {c.couldAdd.join(", ").toLowerCase()}.
              </p>
            )}
          </Card>

          <Card
            title="Your logos"
            description="Both faces of your mark, each shown on the ground it is made for."
          >
            <div className="grid gap-3">
              <LogoSlot
                label="Dark logo"
                hint="The dark artwork. We use it on light scenes."
                ground="light"
                url={data.logoDarkUrl}
                canEdit={canEdit}
                busy={busyFile === "logo_dark"}
                onPick={(f) => sendFile("logo_dark", f)}
                onRemove={() => removeFile("logo_dark")}
              />
              <LogoSlot
                label="White logo"
                hint="The white artwork. We use it on dark scenes."
                ground="dark"
                url={data.logoLightUrl}
                canEdit={canEdit}
                busy={busyFile === "logo_light"}
                onPick={(f) => sendFile("logo_light", f)}
                onRemove={() => removeFile("logo_light")}
              />
            </div>

            {/* the logo we already hold from an order brief, shown until the
                named slots take over so nobody's mark seems to vanish */}
            {data.logoUrl && !data.logoDarkUrl && !data.logoLightUrl && (
              <div className="mt-3 rounded-[8px] border border-hair bg-canvas p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={data.logoUrl}
                  alt="The logo we hold from your brief"
                  className="max-h-16 w-full object-contain"
                />
                <p className="mt-2 text-body-sm text-dim">
                  This came with an order brief. Upload the dark and white
                  versions above and we will use those instead.
                </p>
              </div>
            )}

            <p className="mt-3 text-body-sm text-dim">
              PNG with a transparent background is ideal. SVG, JPG and WebP
              work too, up to 10 MB.
            </p>
          </Card>

          <Card
            title="Brand guidelines"
            description="Anything that tells us how your brand should look and sound."
          >
            {data.guidelines.length === 0 ? (
              <p className="text-body-sm text-dim">
                Nothing here yet. A brand guide PDF, a fonts note, banned
                words: anything you would hand a new designer.
              </p>
            ) : (
              <ul className="grid gap-1.5">
                {data.guidelines.map((g) => (
                  <li
                    key={g.path}
                    className="flex items-center justify-between gap-2 rounded-[8px] border border-hair bg-canvas px-3 py-2"
                  >
                    <a
                      href={g.url ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="tap flex min-w-0 items-center gap-2 text-body-sm text-ink transition-colors hover:text-gold"
                    >
                      <FileText size={14} className="shrink-0 text-dim" aria-hidden="true" />
                      <span className="truncate">{g.name}</span>
                      <span className="shrink-0 font-mono text-label uppercase text-dim">
                        {kb(g.size)}
                      </span>
                    </a>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => removeFile("guideline", g.path)}
                        disabled={busyFile === "guideline"}
                        aria-label={`Remove ${g.name}`}
                        className="tap shrink-0 text-dim transition-colors hover:text-error"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canEdit && (
              <div className="mt-3">
                <FilePick
                  accept="application/pdf,application/zip,image/png,image/jpeg,image/webp,image/svg+xml"
                  busy={busyFile === "guideline"}
                  onPick={(f) => sendFile("guideline", f)}
                >
                  {busyFile === "guideline" ? "Uploading..." : "Upload a file"}
                </FilePick>
              </div>
            )}
          </Card>
        </div>
      </div>

      <p className="mt-6 max-w-[var(--measure-body)] text-body-sm text-dim">
        Changes here apply to future orders. Anything already in production
        keeps the brand it started with, so a video half finished does not
        change colour halfway through. Tell your producer if you need
        something in progress updated.
      </p>
    </div>
  );
}

/*
 * One face of the logo. The preview ground is the whole point: the dark
 * artwork sits on white and the white artwork sits on near-black, so a bad
 * export is visible the second it lands rather than in the first cut.
 */
function LogoSlot({
  label,
  hint,
  ground,
  url,
  canEdit,
  busy,
  onPick,
  onRemove,
}: {
  label: string;
  hint: string;
  ground: "light" | "dark";
  url: string | null;
  canEdit: boolean;
  busy: boolean;
  onPick: (f: File) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-[8px] border border-hair">
      <div
        className={`flex h-24 items-center justify-center rounded-t-[8px] p-3 ${
          ground === "light" ? "bg-white" : "bg-[#08090D]"
        }`}
      >
        {url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={url} alt={`${label} preview`} className="max-h-full max-w-full object-contain" />
        ) : (
          <span
            className={`font-mono text-label uppercase ${ground === "light" ? "text-[#9096A8]" : "text-dim"}`}
          >
            {busy ? "Uploading..." : "Nothing here yet"}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hair px-3 py-2">
        <div className="min-w-0">
          <p className="text-body-sm font-semibold text-ink">{label}</p>
          <p className="text-body-sm text-dim">{hint}</p>
        </div>
        {canEdit && (
          <span className="flex shrink-0 items-center gap-2">
            {url && (
              <button
                type="button"
                onClick={onRemove}
                disabled={busy}
                aria-label={`Remove the ${label.toLowerCase()}`}
                className="tap text-dim transition-colors hover:text-error"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            )}
            <FilePick accept="image/png,image/jpeg,image/webp,image/svg+xml" busy={busy} onPick={onPick}>
              {busy ? "Uploading..." : url ? "Replace" : "Upload"}
            </FilePick>
          </span>
        )}
      </div>
    </div>
  );
}

/* a Button that is secretly a file input, so picking a file IS the upload */
function FilePick({
  accept,
  busy,
  onPick,
  children,
}: {
  accept: string;
  busy: boolean;
  onPick: (f: File) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
      <Button
        size="sm"
        variant="secondary"
        icon={<Upload />}
        disabled={busy}
        onClick={() => ref.current?.click()}
      >
        {children}
      </Button>
    </>
  );
}
