"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  bundlePickPools,
  salesBundleBySku,
  type BundlePickKey,
  type BundleSelections,
} from "@/lib/sales/pages";

/*
 * The branding brief a buyer fills out right after paying (no login: the order
 * UUID in the URL is the key). It posts multipart to /api/intake/[orderId],
 * which uploads the logo/screenshots and saves the fields onto the order. If a
 * brief already exists, the text fields prefill and the buyer can update it.
 */
type Existing = {
  brandName: string;
  primaryColor: string;
  accentColor: string;
  brandPronunciation: string;
  notes: string;
  logoUrl: string | null;
  screenshotUrls: string[];
  videoSelections?: BundleSelections | null;
};
type Loaded = {
  productName: string | null;
  productCode: string | null;
  bundleSku: string | null;
  intakeCompleted: boolean;
  intake: Existing | null;
};

const PICK_LABEL: Record<BundlePickKey, string> = {
  master: "Master Explainer",
  demo: "Demo",
  feature: "Feature Explainer",
};
const emptySel = (): BundleSelections => ({ master: [], demo: [], feature: [] });

const inputCls =
  "w-full rounded-[4px] border border-hair bg-canvas px-4 py-3 text-body text-ink placeholder:text-dim/70 focus:border-gold focus:outline-none";
const labelCls =
  "mb-1.5 block font-mono text-label uppercase tracking-[0.08em] text-muted";
const fileCls =
  "block w-full text-body-sm text-muted file:mr-4 file:cursor-pointer file:rounded-[4px] file:border file:border-hair file:bg-surface file:px-4 file:py-2 file:font-mono file:text-label file:uppercase file:text-ink hover:file:border-gold/50";

export function IntakeClient({ orderId }: { orderId: string }) {
  const [phase, setPhase] = useState<"loading" | "ready" | "notfound" | "done">("loading");
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [brandName, setBrandName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0090FC");
  const [accentColor, setAccentColor] = useState("#00CC00");
  const [brandPronunciation, setBrandPronunciation] = useState("");
  const [notes, setNotes] = useState("");
  const [selections, setSelections] = useState<BundleSelections>(emptySel);
  const logoRef = useRef<HTMLInputElement>(null);
  const shotsRef = useRef<HTMLInputElement>(null);

  const pools = useMemo(() => bundlePickPools(), []);
  const bundle = data?.bundleSku ? salesBundleBySku(data.bundleSku) : undefined;
  const needsPick = !!(bundle?.pickAtIntake && bundle.pick);
  const pick = bundle?.pick;

  function toggle(key: BundlePickKey, code: string) {
    setSelections((prev) => {
      const has = prev[key].includes(code);
      const max = pick?.[key] ?? 0;
      let next = prev[key];
      if (has) next = prev[key].filter((c) => c !== code);
      else if (prev[key].length < max) next = [...prev[key], code];
      else return prev; // at the limit: ignore extra picks
      return { ...prev, [key]: next };
    });
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetch(`/api/intake/${orderId}/`, { cache: "no-store" });
        if (!active) return;
        if (!r.ok) return setPhase("notfound");
        const j: Loaded = await r.json();
        setData(j);
        if (j.intake) {
          setBrandName(j.intake.brandName || "");
          if (j.intake.primaryColor) setPrimaryColor(j.intake.primaryColor);
          if (j.intake.accentColor) setAccentColor(j.intake.accentColor);
          setBrandPronunciation(j.intake.brandPronunciation || "");
          setNotes(j.intake.notes || "");
          if (j.intake.videoSelections) {
            const s = j.intake.videoSelections;
            setSelections({
              master: s.master ?? [],
              demo: s.demo ?? [],
              feature: s.feature ?? [],
            });
          }
        }
        setPhase("ready");
      } catch {
        if (active) setPhase("notfound");
      }
    })();
    return () => {
      active = false;
    };
  }, [orderId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!brandName.trim()) return setError("Please add your brand or platform name.");
    if (needsPick && pick) {
      for (const key of ["master", "demo", "feature"] as BundlePickKey[]) {
        const need = pick[key] ?? 0;
        if (selections[key].length !== need) {
          return setError(
            `Please pick ${need} ${PICK_LABEL[key]} video${need === 1 ? "" : "s"} to continue.`,
          );
        }
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("brandName", brandName.trim());
      fd.set("primaryColor", primaryColor);
      fd.set("accentColor", accentColor);
      fd.set("brandPronunciation", brandPronunciation.trim());
      fd.set("notes", notes.trim());
      if (needsPick) fd.set("videoSelections", JSON.stringify(selections));
      const logo = logoRef.current?.files?.[0];
      if (logo) fd.set("logo", logo);
      for (const f of Array.from(shotsRef.current?.files ?? [])) fd.append("screenshots", f);

      const r = await fetch(`/api/intake/${orderId}/`, { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Could not save your brief.");
      setPhase("done");
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  if (phase === "loading") {
    return <p className="text-center text-body text-muted">Loading your brief...</p>;
  }

  if (phase === "notfound") {
    return (
      <div className="rounded-card border border-hair bg-surface px-6 py-12 text-center">
        <p className="font-display text-h3 text-ink">We could not find that order.</p>
        <p className="mt-2 text-body text-muted">
          Check the link in your confirmation email, or reach us at{" "}
          <a href="mailto:hi@ghlvideo.com" className="text-gold hover:underline">
            hi@ghlvideo.com
          </a>
          .
        </p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="rounded-card border border-hair card-glass px-6 py-14 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-canvas">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
            <path d="M5 13l4 4 10-11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h1 className="mt-6 font-display text-h2 text-ink">Brief received.</h1>
        <p className="mx-auto mt-3 max-w-[46ch] text-body leading-relaxed text-muted">
          Thank you. Production starts from here, and your delivery clock is now
          running. We will email you the moment the first cut is ready.
        </p>
        <div className="mt-8">
          <Link
            href="/portal/"
            className="inline-flex items-center gap-2 rounded-[4px] border border-hair px-6 py-3 font-mono text-label uppercase text-ink transition-colors hover:border-gold/60 hover:text-gold"
          >
            Go to my portal
          </Link>
        </div>
      </div>
    );
  }

  const alreadyDone = !!data?.intakeCompleted;

  return (
    <div>
      <header className="text-center">
        <p className="font-mono text-label uppercase tracking-[0.14em] text-gold/80">
          {data?.productCode ? `${data.productCode} / ` : ""}Branding brief
        </p>
        <h1 className="mt-3 font-display text-h2 text-ink">
          {alreadyDone ? "Update your branding brief." : "Now let us brand it."}
        </h1>
        <p className="mx-auto mt-3 max-w-[52ch] text-body leading-relaxed text-muted">
          This is what turns your order into your videos: your logo, colors,
          dashboard screens, and how your brand name is said. It takes about
          three minutes, and the delivery clock starts once it is in.
        </p>
      </header>

      <form onSubmit={submit} className="mt-10 grid gap-6 rounded-card border border-hair card-glass p-6 md:p-8">
        {needsPick && pick ? (
          <div className="grid gap-5">
            <div>
              <p className="font-display text-h4 text-ink">
                Choose your {bundle?.videoCount} videos
              </p>
              <p className="mt-1 text-body-sm leading-relaxed text-muted">
                This is your {bundle?.name} bundle. Pick the exact videos you want in
                each category, and we white-label every one to your brand.
              </p>
            </div>
            {(["master", "demo", "feature"] as BundlePickKey[]).map((key) => {
              const need = pick[key] ?? 0;
              if (need === 0) return null;
              const chosen = selections[key].length;
              const full = chosen >= need;
              return (
                <div
                  key={key}
                  role="group"
                  aria-label={`Choose ${need} ${PICK_LABEL[key]} video${need === 1 ? "" : "s"}`}
                  className="grid gap-2.5 rounded-[4px] border border-hair bg-canvas/40 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">
                      Choose {need} {PICK_LABEL[key]}
                      {need === 1 ? "" : "s"}
                    </span>
                    <span
                      className="font-mono text-label uppercase tabular-nums"
                      style={{ color: full ? "var(--green)" : "var(--gold)" }}
                    >
                      {chosen} / {need}
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {pools[key].map((v) => {
                      const checked = selections[key].includes(v.slug);
                      const disabled = !checked && full;
                      return (
                        <label
                          key={v.slug}
                          className={`flex cursor-pointer items-start gap-3 rounded-[4px] border p-3 transition-colors ${
                            checked
                              ? "border-gold/60 bg-gold/[0.06]"
                              : disabled
                                ? "cursor-not-allowed border-hair/50 opacity-45"
                                : "border-hair hover:border-gold/40"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggle(key, v.slug)}
                            className="mt-0.5 h-4 w-4 shrink-0"
                            style={{ accentColor: "var(--gold)" }}
                          />
                          <span className="min-w-0">
                            <span className="block text-body text-ink">
                              {v.title}
                              {v.comingSoon ? (
                                <span className="ml-2 font-mono text-label uppercase text-dim">
                                  In production
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block font-mono text-label uppercase text-dim">
                              {v.format}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div className="h-px bg-hair" />
          </div>
        ) : null}

        <label>
          <span className={labelCls}>Brand or platform name</span>
          <input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            required
            className={inputCls}
            placeholder="YourSaaS CRM"
          />
        </label>

        <label>
          <span className={labelCls}>Add your brand name pronunciation</span>
          <input
            value={brandPronunciation}
            onChange={(e) => setBrandPronunciation(e.target.value)}
            className={inputCls}
            placeholder="e.g. Vidiosa is said vih-dee-OH-sah"
          />
          <p className="mt-1.5 text-body-sm text-dim">
            So the voiceover says your brand name exactly right. Leave it blank
            if it reads the obvious way.
          </p>
        </label>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <span className={labelCls}>Primary brand color</span>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-11 w-14 shrink-0 cursor-pointer rounded-[4px] border border-hair bg-canvas"
                aria-label="Primary brand color"
              />
              <input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className={inputCls}
                placeholder="#0090FC"
              />
            </div>
          </div>
          <div>
            <span className={labelCls}>Accent color</span>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-11 w-14 shrink-0 cursor-pointer rounded-[4px] border border-hair bg-canvas"
                aria-label="Accent color"
              />
              <input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className={inputCls}
                placeholder="#00CC00"
              />
            </div>
          </div>
        </div>

        <div>
          <span className={labelCls}>Your logo</span>
          {data?.intake?.logoUrl ? (
            <p className="mb-2 text-body-sm text-muted">
              Uploaded.{" "}
              <a href={data.intake.logoUrl} target="_blank" rel="noopener" className="text-gold hover:underline">
                View
              </a>{" "}
              or choose a file to replace it.
            </p>
          ) : null}
          <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf" className={fileCls} />
          <p className="mt-1.5 text-body-sm text-dim">PNG, SVG, JPG or PDF, up to 10 MB.</p>
        </div>

        <div>
          <span className={labelCls}>Dashboard / platform screenshots</span>
          {data?.intake?.screenshotUrls?.length ? (
            <p className="mb-2 text-body-sm text-muted">
              {data.intake.screenshotUrls.length} on file. Choosing new files replaces them.
            </p>
          ) : null}
          <input ref={shotsRef} type="file" multiple accept="image/png,image/jpeg,image/webp" className={fileCls} />
          <p className="mt-1.5 text-body-sm text-dim">Up to 8 images. The screens you want featured in the video.</p>
        </div>

        <label>
          <span className={labelCls}>Anything else we should know</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className={`${inputCls} resize-y`}
            placeholder="Tone, must-say lines, things to avoid, a reference video you love."
          />
        </label>

        {error ? (
          <p role="alert" className="text-body-sm text-error">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="group inline-flex w-full items-center justify-center gap-2.5 rounded-[3px] bg-brand-gradient px-8 py-[15px] text-body font-semibold text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_28px_rgba(0,204,0,0.25)] transition-all duration-200 hover:brightness-[1.07] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Sending..." : alreadyDone ? "Update my brief" : "Submit my brief and start production"}
          {!submitting ? (
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
              &rarr;
            </span>
          ) : null}
        </button>
      </form>
    </div>
  );
}
