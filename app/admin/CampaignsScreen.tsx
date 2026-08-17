"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Plus, Send, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/portal/ui";
import { authHeader } from "./client";

/*
 * Offers, written and aimed from here instead of from a deploy.
 *
 * Two things this screen is built to make hard to get wrong.
 *
 * An offer must be aimed. Audience is a required choice with no neutral
 * default hiding at the top of the list, because the whole value is
 * specificity: twenty percent off to everybody is a price cut, the same
 * twenty percent to the eleven people who bought once and never came back is
 * a campaign.
 *
 * An offer must be able to keep its promise. It names a coupon rather than
 * restating a discount, and if that coupon has been deleted or switched off
 * the row says so loudly. The alternative is the quiet version of this
 * failure: an offer promising money off that checkout refuses, running for
 * weeks because nothing on screen ever mentioned it.
 */

type Campaign = {
  id: string;
  title: string;
  body: string | null;
  ctaLabel: string;
  targetSku: string | null;
  targetPath: string | null;
  couponCode: string | null;
  audience: "all" | "customers" | "prospects" | "dormant";
  dormantDays: number;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  active: boolean;
  clickCount: number;
  coupon: {
    code: string;
    label: string;
    active: boolean;
    redemptions: number;
    maxRedemptions: number | null;
  } | null;
  couponMissing: boolean;
};

type Draft = {
  id?: string;
  title: string;
  body: string;
  ctaLabel: string;
  targetSku: string;
  targetPath: string;
  couponCode: string;
  audience: Campaign["audience"];
  dormantDays: string;
  startsAt: string;
  endsAt: string;
  priority: string;
  active: boolean;
};

const EMPTY: Draft = {
  title: "",
  body: "",
  ctaLabel: "See the offer",
  targetSku: "",
  targetPath: "",
  couponCode: "",
  audience: "all",
  dormantDays: "90",
  startsAt: "",
  endsAt: "",
  priority: "0",
  active: false,
};

/** Plain words, because "segment" is not a thing anybody says out loud. */
const AUDIENCE_LABEL: Record<Campaign["audience"], string> = {
  all: "Everyone who logs in",
  customers: "People who have bought before",
  prospects: "People who have never bought",
  dormant: "People who have gone quiet",
};

/** A datetime-local value from an ISO string, and back. */
const toLocal = (iso: string | null) => (iso ? iso.slice(0, 16) : "");
const toIso = (local: string) => (local ? new Date(local).toISOString() : "");

export function CampaignsScreen() {
  const [rows, setRows] = useState<Campaign[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [mailBusy, setMailBusy] = useState<string | null>(null);
  const [mailNote, setMailNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch("/api/admin/campaigns", { headers: await authHeader() });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load the offers.");
      setRows(j.campaigns as Campaign[]);
    } catch {
      setErr("Could not load the offers.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!draft) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/campaigns", {
        method: draft.id ? "PATCH" : "POST",
        headers: { ...(await authHeader()), "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          dormantDays: Number(draft.dormantDays) || 90,
          priority: Number(draft.priority) || 0,
          startsAt: toIso(draft.startsAt),
          endsAt: toIso(draft.endsAt),
        }),
      });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not save it.");
      setDraft(null);
      await load();
    } catch {
      setErr("Could not save it.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(c: Campaign) {
    await fetch("/api/admin/campaigns", {
      method: "PATCH",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, active: !c.active }),
    });
    await load();
  }

  /*
   * Email the offer to its audience. Preview the count first, because "send
   * marketing to an unknown number of people" is not a button anybody should
   * press. campaign_sends makes repeat presses safe: only new matches go.
   */
  async function emailAudience(c: Campaign) {
    setMailBusy(c.id);
    setMailNote(null);
    setErr("");
    try {
      const preview = await fetch("/api/admin/campaigns/send", {
        method: "POST",
        headers: { ...(await authHeader()), "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, dryRun: true }),
      }).then((r) => r.json());
      if (preview.error) return setErr(preview.error);
      if (!preview.matched) {
        return setMailNote(
          preview.alreadySent
            ? `Nobody new to email. All ${preview.alreadySent} matching clients already got this one.`
            : "Nobody matches this audience right now.",
        );
      }
      const go = confirm(
        `Email "${c.title}" to ${preview.matched} client${preview.matched === 1 ? "" : "s"}?` +
          (preview.alreadySent ? ` ${preview.alreadySent} already got it and are skipped.` : ""),
      );
      if (!go) return;
      const res = await fetch("/api/admin/campaigns/send", {
        method: "POST",
        headers: { ...(await authHeader()), "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id }),
      }).then((r) => r.json());
      if (res.error) return setErr(res.error);
      setMailNote(
        `Sent to ${res.sent} client${res.sent === 1 ? "" : "s"}.` +
          (res.stoppedEarly ? ` Stopped early: ${res.stoppedEarly}` : ""),
      );
    } catch {
      setErr("Could not email this offer.");
    } finally {
      setMailBusy(null);
    }
  }

  async function remove(c: Campaign) {
    if (!confirm(`Delete "${c.title}"? This cannot be undone.`)) return;
    await fetch(`/api/admin/campaigns?id=${encodeURIComponent(c.id)}`, {
      method: "DELETE",
      headers: await authHeader(),
    });
    await load();
  }

  const edit = (c: Campaign) =>
    setDraft({
      id: c.id,
      title: c.title,
      body: c.body ?? "",
      ctaLabel: c.ctaLabel,
      targetSku: c.targetSku ?? "",
      targetPath: c.targetPath ?? "",
      couponCode: c.couponCode ?? "",
      audience: c.audience,
      dormantDays: String(c.dormantDays),
      startsAt: toLocal(c.startsAt),
      endsAt: toLocal(c.endsAt),
      priority: String(c.priority),
      active: c.active,
    });

  const set =
    <K extends keyof Draft>(k: K) =>
    (e: { target: { value: string } }) =>
      setDraft((d) => (d ? { ...d, [k]: e.target.value } : d));

  return (
    <div>
      <PageHeader
        title="Offers"
        description="What a client sees on their dashboard, and who sees it. One offer per person: the highest priority they match."
        actions={
          <Button variant="brand" icon={<Plus />} onClick={() => setDraft(EMPTY)}>
            New offer
          </Button>
        }
      />

      {err && <p className="mb-3 text-body-sm text-error">{err}</p>}
      {mailNote && <p className="mb-3 text-body-sm text-muted">{mailNote}</p>}

      {draft && (
        <Card
          className="mb-4"
          title={draft.id ? "Edit offer" : "New offer"}
          actions={
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button variant="brand" disabled={busy} onClick={save}>
                {busy ? "Saving..." : "Save"}
              </Button>
            </div>
          }
        >
          <div className="grid gap-4">
            <Field label="Headline" required hint="What the client reads first.">
              <Input
                value={draft.title}
                onChange={set("title")}
                placeholder="Three more explainers, 20 percent off"
              />
            </Field>

            <Field label="The line under it" hint="One or two sentences. Optional.">
              <Textarea
                rows={2}
                value={draft.body}
                onChange={set("body")}
                placeholder="You bought the AI pack in March. These three finish the set."
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Who sees it" required hint="An offer everyone sees is just a price cut.">
                <Select
                  value={draft.audience}
                  onChange={(e) =>
                    setDraft((d) =>
                      d ? { ...d, audience: e.target.value as Campaign["audience"] } : d,
                    )
                  }
                >
                  {(Object.keys(AUDIENCE_LABEL) as Campaign["audience"][]).map((a) => (
                    <option key={a} value={a}>
                      {AUDIENCE_LABEL[a]}
                    </option>
                  ))}
                </Select>
              </Field>

              {draft.audience === "dormant" ? (
                <Field label="Quiet for how long" hint="Days since their last order.">
                  <Input type="number" min={7} max={730} value={draft.dormantDays} onChange={set("dormantDays")} />
                </Field>
              ) : (
                <Field label="Button text" hint="What the button says.">
                  <Input value={draft.ctaLabel} onChange={set("ctaLabel")} />
                </Field>
              )}
            </div>

            {draft.audience === "dormant" && (
              <Field label="Button text" hint="What the button says.">
                <Input value={draft.ctaLabel} onChange={set("ctaLabel")} />
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Product code"
                hint="Sends them straight to checkout, e.g. FEXP-031. Leave empty to use a link instead."
              >
                <Input value={draft.targetSku} onChange={set("targetSku")} placeholder="FEXP-031" />
              </Field>
              <Field label="Or a link" hint="Where else it could go, e.g. /portal/library/">
                <Input value={draft.targetPath} onChange={set("targetPath")} placeholder="/portal/library/" />
              </Field>
            </div>

            <Field
              label="Discount code"
              hint="An existing coupon. The coupon decides the money; this only names it."
            >
              <Input
                value={draft.couponCode}
                onChange={set("couponCode")}
                placeholder="COMEBACK20"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Starts" hint="Optional. Live straight away if empty.">
                <Input type="datetime-local" value={draft.startsAt} onChange={set("startsAt")} />
              </Field>
              <Field label="Ends" hint="Optional. Runs until you stop it if empty.">
                <Input type="datetime-local" value={draft.endsAt} onChange={set("endsAt")} />
              </Field>
              <Field label="Priority" hint="Highest wins when somebody matches two.">
                <Input type="number" min={0} value={draft.priority} onChange={set("priority")} />
              </Field>
            </div>

            <label className="flex items-center gap-2.5 text-body-sm text-ink">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft((d) => (d ? { ...d, active: e.target.checked } : d))}
                className="h-4 w-4 rounded-[3px] border-hair"
              />
              Live now
            </label>
          </div>
        </Card>
      )}

      {rows === null ? (
        <p className="text-body text-muted">Loading...</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No offers yet"
          description="An offer appears on the dashboard of the clients you aim it at. Nothing shows until you make one and switch it on."
          action={
            <Button variant="brand" icon={<Plus />} onClick={() => setDraft(EMPTY)}>
              New offer
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {rows.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-body font-semibold text-ink">{c.title}</p>
                    <Chip tone={c.active ? "good" : "neutral"}>{c.active ? "Live" : "Off"}</Chip>
                    <Chip tone="info">{AUDIENCE_LABEL[c.audience]}</Chip>
                    {c.audience === "dormant" && (
                      <Chip tone="neutral">{c.dormantDays} days quiet</Chip>
                    )}
                  </div>
                  {c.body && <p className="mt-1 text-body-sm text-muted">{c.body}</p>}

                  <p className="mt-2 font-mono text-label uppercase text-dim">
                    {c.targetSku ? c.targetSku.toUpperCase() : c.targetPath} /{" "}
                    {c.clickCount} click{c.clickCount === 1 ? "" : "s"}
                    {c.coupon ? ` / ${c.coupon.redemptions} bought` : ""}
                  </p>

                  {/* The failure worth shouting about: a promise we cannot keep. */}
                  {c.couponMissing ? (
                    <p className="mt-2 flex items-center gap-2 text-body-sm text-error">
                      <AlertTriangle size={14} aria-hidden="true" />
                      Code {c.couponCode} does not exist. Nobody gets a discount from this offer.
                    </p>
                  ) : c.coupon && !c.coupon.active ? (
                    <p className="mt-2 flex items-center gap-2 text-body-sm text-error">
                      <AlertTriangle size={14} aria-hidden="true" />
                      Code {c.coupon.code} is switched off. Checkout will refuse it.
                    </p>
                  ) : c.coupon ? (
                    <p className="mt-2 text-body-sm text-muted">
                      {c.coupon.label} with {c.coupon.code}
                      {c.coupon.maxRedemptions
                        ? `, ${c.coupon.redemptions} of ${c.coupon.maxRedemptions} used`
                        : ""}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 gap-2">
                  {c.active && (c.audience === "customers" || c.audience === "dormant") && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Send />}
                      disabled={mailBusy === c.id}
                      onClick={() => emailAudience(c)}
                    >
                      {mailBusy === c.id ? "Checking..." : "Email the audience"}
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => toggle(c)}>
                    {c.active ? "Switch off" : "Switch on"}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => edit(c)}>
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 />}
                    onClick={() => remove(c)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
