"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Image as ImageIcon } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Progress,
  Textarea,
} from "@/components/portal/ui";
import type { BrandKit, Completeness } from "@/lib/brand-kit";

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

type Payload = { kit: BrandKit | null; completeness: Completeness; logoUrl: string | null };

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

          <Card title="Your logo">
            {data.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={data.logoUrl}
                alt="Your logo as we hold it"
                className="max-h-28 w-full rounded-[8px] bg-canvas object-contain p-3"
              />
            ) : (
              <EmptyState
                icon={<ImageIcon />}
                title="No logo yet"
                description="Send it with your next order brief and it lands here."
              />
            )}
            <p className="mt-3 text-body-sm text-dim">
              To change your logo, send the new one with an order brief or
              message your producer. We keep the original file, not a copy of
              a screenshot.
            </p>
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
