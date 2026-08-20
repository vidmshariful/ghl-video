"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, Plus, Scissors, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  Chip,
  Field,
  Input,
  PageHeader,
  Progress,
  Select,
  Tabs,
  Textarea,
} from "@/components/portal/ui";
import { VideoReview } from "./VideoReview";
import { StyleGuideView } from "./StyleGuideView";

/*
 * An editing client's own screen.
 *
 * This is the screen the spine was built for. A subscription creates no
 * order, so a client paying every month opened their portal and saw nothing
 * at all while we were editing for them.
 *
 * The counter is the point of it. "3 of 4 long form used" answers the only
 * question somebody on a monthly plan actually has, and answering it plainly
 * is what stops the email asking how many they have left.
 *
 * Asking for more than the month covers is allowed on purpose. The warning
 * appears before they submit, says what the plan holds, and offers the
 * upgrade; the request goes through either way. A door that closes on a
 * paying client is worse than a queue that runs long.
 */

type Video = {
  id: string;
  parentId: string | null;
  title: string;
  status: string;
  state: string;
  column: string;
  form: "long" | "short" | null;
  aspect: string | null;
  brief: string | null;
  dueAt: string | null;
  requestedDueAt: string | null;
  assetsReadyAt: string | null;
  videoUrl: string | null;
  canReview: boolean;
  revisionsUsed: number;
  cancelledAt: string | null;
  cancelledReason: string | null;
  canCancel: boolean;
  createdAt: string;
};

type Plan = {
  planName: string;
  includes: string[];
  status: string;
  amountCents: number;
  renewsAt: string | null;
  endingAtPeriodEnd: boolean;
  aspects: { key: string; label: string; note: string }[];
  cycle: { id: string; startsAt: string; endsAt: string };
  slots: {
    longUsed: number;
    shortUsed: number;
    longLeft: number;
    shortLeft: number;
    longAllowed: number;
    shortAllowed: number;
    overPlan: boolean;
    summary: string;
  };
  warnings: { long: string | null; short: string | null };
  videos: Video[];
  history: {
    id: string;
    startsAt: string;
    endsAt: string;
    longUsed: number;
    shortUsed: number;
    longAllowed: number;
    shortAllowed: number;
  }[];
};

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

const TONE: Record<string, "neutral" | "info" | "good" | "warn" | "bad"> = {
  waiting: "warn",
  queued: "neutral",
  in_production: "info",
  ready: "good",
  revisions: "bad",
  approved: "good",
};

type Tab = "month" | "guide" | "plan";

/** A slot counter that reads at a glance, per form. */
function Slots({ label, used, allowed }: { label: string; used: number; allowed: number }) {
  if (!allowed) return null;
  const left = Math.max(0, allowed - used);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body-sm text-muted">{label}</span>
        <span className="font-mono text-body-sm tabular-nums text-ink">
          {used} of {allowed}
        </span>
      </div>
      <div className="mt-1.5">
        <Progress
          percent={Math.min(100, Math.round((used / allowed) * 100))}
          label={left ? `${left} left this month` : "None left this month"}
        />
      </div>
    </div>
  );
}

export function EditingView({
  authedFetch,
}: {
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
}) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("month");
  const [asking, setAsking] = useState(false);
  const [reviewing, setReviewing] = useState<Video | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    brief: "",
    form: "short",
    aspect: "",
    targetMinutes: "",
    assetsUrl: "",
    referenceUrl: "",
    requestedDueAt: "",
  });
  const [cuts, setCuts] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const j = await authedFetch("/api/portal/plan").catch(() => null);
    setPlan((j?.plan as Plan | null) ?? null);
    setLoaded(true);
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetDraft() {
    setDraft({
      title: "",
      brief: "",
      form: "short",
      aspect: "",
      targetMinutes: "",
      assetsUrl: "",
      referenceUrl: "",
      requestedDueAt: "",
    });
    setCuts([]);
  }

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      const j = (await authedFetch("/api/portal/plan", {
        method: "POST",
        body: JSON.stringify({ ...draft, cuts }),
      })) as { ok?: boolean; error?: string; warning?: string | null; cuts?: number };
      if (j.error) return setErr(j.error);
      const extra = j.cuts ? ` Plus ${j.cuts} short ${j.cuts === 1 ? "cut" : "cuts"}.` : "";
      setSent(
        (j.warning ?? "Got it. It is in the queue and your producer will confirm the date.") + extra,
      );
      resetDraft();
      setAsking(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function cancelRequest(v: Video) {
    if (!window.confirm(`Pull "${v.title}" back? The slot goes straight back to this month.`)) return;
    setBusy(true);
    try {
      await authedFetch("/api/portal/plan", {
        method: "POST",
        body: JSON.stringify({ cancel: v.id }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <p className="text-body text-muted">Loading your plan...</p>;

  if (!plan) {
    return (
      <div>
        <PageHeader
          title="Editing"
          description="Monthly editing, with your videos cut by a HighLevel-fluent team."
        />
        <Card title="No active plan">
          <p className="text-body-sm text-muted">
            You are not on an editing plan right now. If you publish regularly,
            a plan is the cheaper way to keep it going.
          </p>
          <div className="mt-3">
            <Button variant="brand" href="/editing/">
              See the plans
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  /* reviewing one video takes over, the same way it does in My Videos */
  if (reviewing && reviewing.videoUrl) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setReviewing(null)}
          className="tap font-mono text-label uppercase text-muted transition-colors hover:text-gold"
        >
          Back to your videos
        </button>
        <div className="mt-4">
          <VideoReview
            videoId={reviewing.id}
            title={reviewing.title}
            videoUrl={reviewing.videoUrl}
            status={reviewing.status}
            canRequestChanges={reviewing.status !== "approved"}
            revisionsIncluded={0}
            revisionsUsed={reviewing.revisionsUsed}
            unlimitedRevisions
            authedFetch={authedFetch}
            onChanged={() => {
              void load();
              setReviewing(null);
            }}
          />
        </div>
      </div>
    );
  }

  const s = plan.slots;
  const warning = draft.form === "long" ? plan.warnings.long : plan.warnings.short;
  const live = plan.videos.filter((v) => !v.cancelledAt);
  const parents = live.filter((v) => !v.parentId);

  return (
    <div>
      <PageHeader
        title="Editing"
        description={`${plan.planName}, ${money(plan.amountCents)} a month. ${
          plan.endingAtPeriodEnd ? `Ends ${day(plan.renewsAt)}.` : `Renews ${day(plan.renewsAt)}.`
        }`}
        actions={
          <Button variant="brand" icon={<Plus />} onClick={() => setAsking((v) => !v)}>
            Request a video
          </Button>
        }
      />

      {sent && (
        <div className="mb-3">
          <Card tone="dark" title="Request received">
            <p className="text-body-sm text-chrome-muted">{sent}</p>
            {s.overPlan && (
              <div className="mt-3">
                <Button variant="brand" size="sm" href="/editing/">
                  See bigger plans
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      <div className="mb-3">
        <Tabs
          tabs={[
            { key: "month" as Tab, label: "This month", count: live.length },
            { key: "guide" as Tab, label: "How we cut for you" },
            { key: "plan" as Tab, label: "Your plan" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "guide" ? (
        <StyleGuideView authedFetch={authedFetch} aspects={plan.aspects} />
      ) : tab === "plan" ? (
        <div className="grid gap-3 lg:grid-cols-[1fr_20rem] lg:items-start">
          <Card title={plan.planName} description="What your plan covers every month.">
            <ul className="grid gap-1.5">
              {plan.includes.map((f) => (
                <li key={f} className="flex items-start gap-2 text-body-sm text-muted">
                  <Check size={14} className="mt-1 shrink-0 text-green" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-body-sm text-dim">
              Standard turnaround is two to three business days per video,
              counted from when your footage reaches us.
            </p>
          </Card>

          <div className="grid gap-3">
            {plan.history.length > 0 && (
              <Card title="Earlier months">
                <ul className="grid gap-2">
                  {plan.history.map((h) => (
                    <li key={h.id} className="flex items-baseline justify-between gap-3 text-body-sm">
                      <span className="text-muted">{day(h.startsAt)}</span>
                      <span className="font-mono tabular-nums text-ink">
                        {h.longUsed}/{h.longAllowed} long, {h.shortUsed}/{h.shortAllowed} short
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Card title="Billing">
              <p className="text-body-sm text-muted">
                Payments, invoices and card changes are under Orders and
                Invoices.
              </p>
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1fr_20rem] lg:items-start">
          <div className="grid min-w-0 gap-3">
            {asking && (
              <Card
                title="Request a video"
                description="Tell us what to cut and where the footage is. We work through requests in order."
              >
                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="What is it" required hint="Something you will recognize later.">
                      <Input
                        value={draft.title}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        placeholder="March webinar, cut for YouTube"
                      />
                    </Field>
                    <Field label="Which kind" hint="Long form is up to 15 minutes.">
                      <Select
                        value={draft.form}
                        onChange={(e) => {
                          const form = e.target.value;
                          setDraft({ ...draft, form });
                          if (form !== "long") setCuts([]);
                        }}
                      >
                        <option value="short">Short form</option>
                        <option value="long">Long form</option>
                      </Select>
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Where is it going" hint="So we cut it the right shape.">
                      <Select
                        value={draft.aspect}
                        onChange={(e) => setDraft({ ...draft, aspect: e.target.value })}
                      >
                        <option value="">Not sure, you choose</option>
                        {plan.aspects.map((a) => (
                          <option key={a.key} value={a.key}>
                            {a.label}, {a.note}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="How long should it be" hint="In minutes. Leave it blank if you do not mind.">
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={draft.targetMinutes}
                        onChange={(e) => setDraft({ ...draft, targetMinutes: e.target.value })}
                        placeholder="8"
                      />
                    </Field>
                  </div>

                  <Field
                    label="Link to your footage"
                    required
                    hint="Drive, Dropbox, Frame.io, WeTransfer. Make sure we can open it."
                  >
                    <Input
                      value={draft.assetsUrl}
                      onChange={(e) => setDraft({ ...draft, assetsUrl: e.target.value })}
                      placeholder="https://drive.google.com/..."
                    />
                  </Field>

                  <Field label="What do you want done" required hint="How you want it cut, in your words.">
                    <Textarea
                      rows={4}
                      value={draft.brief}
                      onChange={(e) => setDraft({ ...draft, brief: e.target.value })}
                      placeholder="Trim the first 90 seconds, captions throughout, our intro on the front, cut the long pause around 12 minutes."
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="A video you want it to feel like" hint="Optional, and it saves a round of changes.">
                      <Input
                        value={draft.referenceUrl}
                        onChange={(e) => setDraft({ ...draft, referenceUrl: e.target.value })}
                        placeholder="https://youtube.com/..."
                      />
                    </Field>
                    <Field label="When would you like it" hint="Your producer confirms what is possible.">
                      <Input
                        type="date"
                        value={draft.requestedDueAt}
                        onChange={(e) => setDraft({ ...draft, requestedDueAt: e.target.value })}
                      />
                    </Field>
                  </div>

                  {/* short cuts off a long form. Each is a video in its own
                      right, so each spends a short form slot, and they are
                      told that here rather than discovering it. */}
                  {draft.form === "long" && (
                    <div className="rounded-[8px] border border-hair bg-canvas/40 p-4">
                      <p className="flex items-center gap-2 text-body-sm font-semibold text-ink">
                        <Scissors size={14} className="text-gold" aria-hidden="true" />
                        Want short cuts from this one?
                      </p>
                      <p className="mt-1 text-body-sm text-muted">
                        Say which part each one comes from. Every cut is its own
                        video, so each uses one of your {s.shortAllowed} short
                        form slots. You have {s.shortLeft} left this month.
                      </p>
                      <div className="mt-3 grid gap-2">
                        {cuts.map((c, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <Input
                                value={c}
                                aria-label={`Short cut ${i + 1}`}
                                onChange={(e) => {
                                  const next = [...cuts];
                                  next[i] = e.target.value;
                                  setCuts(next);
                                }}
                                placeholder="The bit about pricing, around 4 to 6 minutes"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Trash2 />}
                              aria-label={`Remove short cut ${i + 1}`}
                              onClick={() => setCuts(cuts.filter((_, j) => j !== i))}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Plus />}
                          disabled={cuts.length >= 10}
                          onClick={() => setCuts([...cuts, ""])}
                        >
                          {cuts.length ? "Add another cut" : "Add a short cut"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* said before they commit, and it never blocks the button */}
                  {warning && (
                    <div className="rounded-[8px] border border-gold/40 bg-gold/[0.06] px-4 py-3">
                      <p className="text-body-sm text-ink">{warning}</p>
                      <div className="mt-2">
                        <Button variant="secondary" size="sm" href="/editing/">
                          See bigger plans
                        </Button>
                      </div>
                    </div>
                  )}

                  {err && <p className="text-body-sm text-error">{err}</p>}

                  <div className="flex gap-2">
                    <Button
                      variant="brand"
                      disabled={
                        busy ||
                        !draft.title.trim() ||
                        !draft.brief.trim() ||
                        !draft.assetsUrl.trim() ||
                        cuts.some((c) => !c.trim())
                      }
                      onClick={submit}
                    >
                      {busy ? "Sending..." : "Send the request"}
                    </Button>
                    <Button variant="ghost" onClick={() => setAsking(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            <Card
              title="This month"
              description={`${day(plan.cycle.startsAt)} to ${day(plan.cycle.endsAt)}`}
            >
              {parents.length === 0 ? (
                <p className="text-body-sm text-muted">
                  Nothing asked for yet this month. Your slots reset on{" "}
                  {day(plan.cycle.endsAt)}, and they do not carry over, so it is
                  worth using them.
                </p>
              ) : (
                <ul className="grid gap-3">
                  {parents.map((v) => (
                    <li key={v.id} className="border-t border-hair pt-3 first:border-t-0 first:pt-0">
                      <VideoRow v={v} onReview={setReviewing} onCancel={cancelRequest} busy={busy} />
                      {live.filter((c) => c.parentId === v.id).length > 0 && (
                        <ul className="mt-2 grid gap-2 border-l border-hair pl-4">
                          {live
                            .filter((c) => c.parentId === v.id)
                            .map((c) => (
                              <li key={c.id}>
                                <VideoRow
                                  v={c}
                                  onReview={setReviewing}
                                  onCancel={cancelRequest}
                                  busy={busy}
                                />
                              </li>
                            ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-3">
            <Card title="What is left this month">
              <div className="grid gap-4">
                <Slots label="Long form" used={s.longUsed} allowed={s.longAllowed} />
                <Slots label="Short form" used={s.shortUsed} allowed={s.shortAllowed} />
              </div>
              <p className="mt-4 flex items-start gap-2 text-body-sm text-dim">
                <CalendarClock size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                Resets {day(plan.cycle.endsAt)}. Unused videos do not carry over.
              </p>
            </Card>

            {s.overPlan && (
              <Card tone="dark" title="You are asking for more than the plan covers">
                <p className="text-body-sm text-chrome-muted">
                  That is fine, we will keep working through them. If this is your
                  normal month, a bigger plan costs less than paying the overflow.
                </p>
                <div className="mt-3">
                  <Button variant="brand" size="sm" href="/editing/">
                    Compare plans
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** One video, in the client's words. */
function VideoRow({
  v,
  onReview,
  onCancel,
  busy,
}: {
  v: Video;
  onReview: (v: Video) => void;
  onCancel: (v: Video) => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-body-sm font-semibold text-ink">{v.title}</p>
        <p className="mt-0.5 font-mono text-label uppercase text-dim">
          {v.form === "long" ? "Long form" : "Short form"}
          {v.aspect ? ` / ${v.aspect}` : ""}
          {v.dueAt
            ? ` / due ${day(v.dueAt)}`
            : v.requestedDueAt
              ? ` / you asked for ${day(v.requestedDueAt)}`
              : ""}
        </p>
        {v.column === "waiting" && (
          <p className="mt-1 text-body-sm text-gold">
            We have not been able to open your footage yet. Nothing is promised
            until it is in.
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Chip tone={TONE[v.column] ?? "neutral"}>{v.state}</Chip>
        {v.canReview && v.videoUrl && (
          <Button variant="brand" size="sm" onClick={() => onReview(v)}>
            {v.status === "revisions" ? "See it" : "Review it"}
          </Button>
        )}
        {v.canCancel && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => onCancel(v)}>
            Pull it back
          </Button>
        )}
      </div>
    </div>
  );
}
