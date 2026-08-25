"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, ChevronRight, Play, Plus, Scissors, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  Chip,
  Field,
  Input,
  Modal,
  PageHeader,
  Progress,
  Select,
  Tabs,
  Textarea,
} from "@/components/portal/ui";
import { VideoReviewModal } from "./VideoReviewModal";
import { StyleGuideView } from "./StyleGuideView";
import { DownloadAll } from "@/components/portal/DownloadAll";
import { stageFor } from "@/lib/editing-sop";
import { Drawer, StageTimeline, WorkCard } from "@/components/portal/board";

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

type Tier = {
  key: string;
  kind: "video" | "podcast";
  label: string;
  credits?: number;
  perHour?: number;
  perHalfHour?: number;
  maxMinutes?: number;
  lengthNote: string;
  blurb: string;
  idealFor: string[];
};

type Video = {
  id: string;
  parentId: string | null;
  title: string;
  status: string;
  state: string;
  column: string;
  editType: string | null;
  typeLabel: string | null;
  creditCost: number;
  runtimeMinutes: number | null;
  aspect: string | null;
  brief: string | null;
  dueAt: string | null;
  requestedDueAt: string | null;
  assetsReadyAt: string | null;
  assetsUrl: string | null;
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
  credits: {
    spent: number;
    allowed: number;
    planLeft: number;
    topupLeft: number;
    left: number;
    overPlan: boolean;
    summary: string;
  };
  /* the price list, so a shape's cost is visible before it is picked */
  tiers: Tier[];
  videos: Video[];
  history: {
    id: string;
    startsAt: string;
    endsAt: string;
    creditsUsed: number;
    creditsAllowed: number;
    /* everything we made them that month */
    videos: Video[];
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

/*
 * The tint each stage carries on its row.
 *
 * A flat list of requests all painted the same is the thing this replaces:
 * you had to read every line to find the one that needed you. The two stages
 * that need the client lead in gold, work in hand is blue, finished is green,
 * and the eye lands on the right row before it reads a word.
 */
const ROW: Record<string, string> = {
  waiting: "border-gold/40 bg-gold/[0.07]",
  queued: "border-hair bg-surface",
  in_production: "border-blue/35 bg-blue/[0.06]",
  ready: "border-gold/50 bg-gold/[0.09]",
  revisions: "border-error/35 bg-error/[0.06]",
  approved: "border-green/30 bg-green/[0.05]",
};

type Tab = "month" | "past" | "guide" | "plan";

/* the line a request travels, in the client's words. Revisions is not a
 * station of its own: a line that doubles back reads as a mistake, so
 * changes-in-hand shows as the editing station wearing its own label. */
const JOURNEY = [
  { key: "queued", label: "Requested", tone: "neutral" as const },
  { key: "in_production", label: "Being edited", tone: "info" as const },
  { key: "ready", label: "Your review", tone: "warn" as const },
  { key: "approved", label: "Done", tone: "good" as const },
];

const journeyKey = (column: string) =>
  column === "waiting" ? "queued" : column === "revisions" ? "in_production" : column;

const creditWord = (n: number) => `${n} ${n === 1 ? "credit" : "credits"}`;

/**
 * What a shape costs, worked out on the client exactly as the server does.
 *
 * Duplicated deliberately rather than fetched: the number has to move as they
 * type a runtime, and a round trip per keystroke to learn the price of a
 * dropdown is a worse trade than one small function kept honest by the tests
 * that cover its server twin.
 */
function costOf(tier: Tier | null, runtimeMinutes: number | null): number {
  if (!tier) return 0;
  if (tier.kind === "video") return tier.credits ?? 0;
  const mins = Math.max(1, Math.round(runtimeMinutes ?? 0));
  const blocks = Math.max(1, Math.ceil(mins / 30));
  return (
    Math.floor(blocks / 2) * (tier.perHour ?? 0) + (blocks % 2) * (tier.perHalfHour ?? 0)
  );
}

/** The month's balance, as one bar rather than two competing ones. */
function CreditMeter({ credits }: { credits: Plan["credits"] }) {
  const { spent, allowed, planLeft, topupLeft } = credits;
  if (!allowed && !topupLeft) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body-sm text-muted">This month</span>
        <span className="font-mono text-body-sm tabular-nums text-ink">
          {spent} of {allowed}
        </span>
      </div>
      <div className="mt-1.5">
        <Progress
          percent={allowed ? Math.min(100, Math.round((spent / allowed) * 100)) : 100}
          label={planLeft ? `${creditWord(planLeft)} left this month` : "None left this month"}
        />
      </div>
      {topupLeft > 0 && (
        <p className="mt-2 text-body-sm text-muted">
          Plus {creditWord(topupLeft)} you topped up with. Those stay until you use them.
        </p>
      )}
    </div>
  );
}

export function EditingView({
  authedFetch,
  onMessageStudio,
  focusVideoId,
  onFocused,
}: {
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onMessageStudio?: () => void;
  /* a video to open on arrival, sent by the dashboard's Watch it */
  focusVideoId?: string | null;
  onFocused?: () => void;
}) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("month");
  const [asking, setAsking] = useState(false);
  const [reviewing, setReviewing] = useState<Video | null>(null);
  /* which request is open. The list is a set of cards you open, not a set of
   * lines with a small button on the end of each. */
  const [openRequest, setOpenRequest] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    brief: "",
    editType: "mid",
    aspect: "",
    targetMinutes: "",
    runtimeMinutes: "",
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

  /* opened from the dashboard: straight to the request, and into the player
   * when there is something to watch */
  useEffect(() => {
    if (!focusVideoId || !plan) return;
    const v = plan.videos.find((x) => x.id === focusVideoId);
    if (v) {
      setOpenRequest(v.id);
      if (v.canReview && v.videoUrl) setReviewing(v);
    }
    onFocused?.();
  }, [focusVideoId, plan, onFocused]);

  function resetDraft() {
    setDraft({
      title: "",
      brief: "",
      editType: "mid",
      aspect: "",
      targetMinutes: "",
      runtimeMinutes: "",
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
        body: JSON.stringify({
          ...draft,
          runtimeMinutes: draft.runtimeMinutes ? Number(draft.runtimeMinutes) : null,
          cuts,
        }),
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
    if (
      !window.confirm(
        `Pull "${v.title}" back? Its ${creditWord(v.creditCost)} go straight back to this month.`,
      )
    )
      return;
    setBusy(true);
    setErr("");
    try {
      /* the server refuses once an editor has started. Throwing that answer
         away left the client staring at a card that did not disappear, with
         nothing on screen saying why. */
      const j = (await authedFetch("/api/portal/plan", {
        method: "POST",
        body: JSON.stringify({ cancel: v.id }),
      })) as { ok?: boolean; error?: string };
      if (j?.error) setErr(j.error);
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

  /* reviewing opens over the page as a full-screen popup, never inline
     (owner rule, final): the same review the pre-made videos use */
  const reviewModal =
    reviewing && reviewing.videoUrl ? (
      <VideoReviewModal
        video={{
          id: reviewing.id,
          title: reviewing.title,
          videoUrl: reviewing.videoUrl,
          status: reviewing.status,
          canRequestChanges: reviewing.status !== "approved",
          revisionsIncluded: 0,
          revisionsUsed: reviewing.revisionsUsed,
          unlimitedRevisions: true,
        }}
        onClose={() => setReviewing(null)}
        onChanged={() => void load()}
        authedFetch={authedFetch}
        onMessageStudio={onMessageStudio}
      />
    ) : null;

  const s = plan.credits;
  const tier = plan.tiers.find((t) => t.key === draft.editType) ?? null;
  const runtime = draft.runtimeMinutes ? Number(draft.runtimeMinutes) : null;
  /* what this submission spends: the request itself plus a credit for every
     short cut hung off it */
  const thisCost = costOf(tier, runtime);
  const cutsCost = cuts.length * 1;
  const totalCost = thisCost + cutsCost;
  const warning =
    totalCost > s.left
      ? `This one costs ${creditWord(totalCost)} and your ${plan.planName} plan has ` +
        `${s.left === 0 ? "no credits" : creditWord(s.left)} left this month, so it is ` +
        `${totalCost - s.left} over. We will still take it and work through your requests in ` +
        `order. To have it sooner, top up your credits or move up a plan.`
      : null;
  const live = plan.videos.filter((v) => !v.cancelledAt);
  const parents = live.filter((v) => !v.parentId);

  /* finished months still hold real videos, so a past edit opens into the
     same panel a current one does */
  const pastVideos = plan.history.flatMap((h) => h.videos ?? []);
  const pastCount = pastVideos.filter((v) => !v.cancelledAt).length;

  /* one request, opened over the list rather than instead of it */
  const opened = openRequest
    ? ([...plan.videos, ...pastVideos].find((v) => v.id === openRequest) ?? null)
    : null;

  return (
    <div>
      {reviewModal}
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
            { key: "past" as Tab, label: "Past Edits", count: pastCount },
            { key: "guide" as Tab, label: "How we cut for you" },
            { key: "plan" as Tab, label: "Your plan" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "past" ? (
        <PastEdits months={plan.history} onOpen={setOpenRequest} />
      ) : tab === "guide" ? (
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
                        {h.creditsUsed}/{h.creditsAllowed} credits
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
            <Modal open={asking} onClose={() => setAsking(false)} title="Request a video">
              {asking && (
                <div className="grid gap-4">
                  <p className="text-body-sm text-muted">
                    Tell us what to cut and where the footage is. We work
                    through requests in order.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="What is it" required hint="Something you will recognize later.">
                      <Input
                        value={draft.title}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        placeholder="March webinar, cut for YouTube"
                      />
                    </Field>
                    <Field
                      label="What kind of edit"
                      hint={tier ? tier.lengthNote : "Pick the shape and we price it."}
                    >
                      <Select
                        value={draft.editType}
                        onChange={(e) => {
                          const editType = e.target.value;
                          setDraft({ ...draft, editType });
                          if (editType === "short") setCuts([]);
                        }}
                      >
                        {plan.tiers.map((t) => (
                          <option key={t.key} value={t.key}>
                            {t.label}
                            {t.kind === "video"
                              ? `, ${creditWord(t.credits ?? 0)}`
                              : `, from ${creditWord(t.perHalfHour ?? 0)}`}
                          </option>
                        ))}
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
                    {tier?.kind === "podcast" ? (
                      <Field
                        label="Finished runtime"
                        required
                        hint="In minutes, roughly. We price podcasts on the length of the finished episode."
                      >
                        <Input
                          type="number"
                          min="1"
                          step="5"
                          value={draft.runtimeMinutes}
                          onChange={(e) =>
                            setDraft({ ...draft, runtimeMinutes: e.target.value })
                          }
                          placeholder="60"
                        />
                      </Field>
                    ) : (
                      <Field
                        label="How long should it be"
                        hint="In minutes. Leave it blank if you do not mind."
                      >
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={draft.targetMinutes}
                          onChange={(e) => setDraft({ ...draft, targetMinutes: e.target.value })}
                          placeholder="8"
                        />
                      </Field>
                    )}
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

                  {/* short cuts off a longer edit. Each is a video in its own
                      right, so each spends a credit, and they are told that
                      here rather than discovering it. */}
                  {draft.editType !== "short" && (
                    <div className="rounded-[8px] border border-hair bg-canvas/40 p-4">
                      <p className="flex items-center gap-2 text-body-sm font-semibold text-ink">
                        <Scissors size={14} className="text-gold" aria-hidden="true" />
                        Want short cuts from this one?
                      </p>
                      <p className="mt-1 text-body-sm text-muted">
                        Say which part each one comes from. Every cut is its own
                        short form video, so each one costs 1 credit on top.
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

                  {/* the price, before they commit to it. The whole reason
                      credits exist is that a client should never learn what
                      something cost after they spent it. */}
                  <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-[8px] border border-hair bg-canvas px-4 py-3">
                    <span className="text-body-sm text-muted">
                      This request costs
                      {cutsCost > 0
                        ? ` ${creditWord(thisCost)} plus ${creditWord(cutsCost)} for the ${
                            cuts.length === 1 ? "cut" : "cuts"
                          }`
                        : ""}
                    </span>
                    <span className="font-mono text-body-sm tabular-nums text-ink">
                      <span className="text-gold">{creditWord(totalCost)}</span>
                      {" of "}
                      {s.left} left
                    </span>
                  </div>

                  {err && <p className="text-body-sm text-error">{err}</p>}

                  <div className="flex gap-2">
                    <Button
                      variant="brand"
                      disabled={
                        busy ||
                        !draft.title.trim() ||
                        !draft.brief.trim() ||
                        !draft.assetsUrl.trim() ||
                        (tier?.kind === "podcast" && !draft.runtimeMinutes) ||
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
              )}
            </Modal>

            <Card
              title="This month"
              description={`${day(plan.cycle.startsAt)} to ${day(plan.cycle.endsAt)}`}
              actions={
                <DownloadAll
                  videoIds={live
                    .filter((v) => v.videoUrl && v.status === "approved")
                    .map((v) => v.id)}
                />
              }
            >
              {parents.length === 0 ? (
                <p className="text-body-sm text-muted">
                  Nothing asked for yet this month. Your credits reset on{" "}
                  {day(plan.cycle.endsAt)}, and they do not carry over, so it is
                  worth using them.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {parents.map((v) => {
                    const cuts = live.filter((c) => c.parentId === v.id);
                    return (
                      <li key={v.id}>
                        <WorkCard
                          item={{
                            id: v.id,
                            column: v.column,
                            title: v.title,
                            meta: [
                              v.typeLabel ?? null,
                              v.creditCost ? creditWord(v.creditCost) : null,
                              v.aspect,
                            ]
                              .filter(Boolean)
                              .join(" / "),
                            warn:
                              v.column === "waiting"
                                ? v.assetsUrl
                                  ? "we are checking your footage"
                                  : "we need your footage"
                                : null,
                            due: v.dueAt
                              ? `due ${day(v.dueAt)}`
                              : v.requestedDueAt
                                ? `you asked ${day(v.requestedDueAt)}`
                                : null,
                            dueTone: v.dueAt ? "neutral" : "warn",
                            progress: cuts.length
                              ? `${cuts.filter((c) => c.status === "approved").length + (v.status === "approved" ? 1 : 0)}/${cuts.length + 1}`
                              : null,
                            progressPct: cuts.length
                              ? ((cuts.filter((c) => c.status === "approved").length +
                                  (v.status === "approved" ? 1 : 0)) /
                                  (cuts.length + 1)) *
                                100
                              : null,
                          }}
                          tone={stageFor(v.column).tone}
                          onOpen={() => setOpenRequest(v.id)}
                        />
                        {cuts.length > 0 && (
                          <ul className="mt-1.5 grid gap-1.5 border-l border-hair pl-4">
                            {cuts.map((c) => (
                              <li key={c.id}>
                                <WorkCard
                                  item={{
                                    id: c.id,
                                    column: c.column,
                                    title: c.title,
                                    meta: ["cut", c.aspect].filter(Boolean).join(" / "),
                                  }}
                                  tone={stageFor(c.column).tone}
                                  onOpen={() => setOpenRequest(c.id)}
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {/* Cancelled requests stay visible with the reason on them. A
                request that quietly disappears is the thing a client emails
                about, and if we cancelled it they are owed the why. */}
            {plan.videos.some((v) => v.cancelledAt && !v.parentId) && (
              <Card title="Cancelled this month" description="Their credits went back to your month.">
                <ul className="grid gap-2">
                  {plan.videos
                    .filter((v) => v.cancelledAt && !v.parentId)
                    .map((v) => (
                      <li
                        key={v.id}
                        className="border-t border-hair pt-2 first:border-t-0 first:pt-0"
                      >
                        <p className="text-body-sm font-semibold text-dim line-through">
                          {v.title}
                        </p>
                        <p className="mt-0.5 text-body-sm text-muted">
                          {v.cancelledReason || "Cancelled."}
                        </p>
                      </li>
                    ))}
                </ul>
              </Card>
            )}
          </div>

          <div className="grid gap-3">
            <Card title="What is left this month">
              <div className="grid gap-4">
                <CreditMeter credits={s} />
              </div>
              <p className="mt-4 flex items-start gap-2 text-body-sm text-dim">
                <CalendarClock size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                Resets {day(plan.cycle.endsAt)}. Unused plan credits do not carry over.
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

      <Drawer open={!!opened} onClose={() => setOpenRequest(null)} title={opened?.title ?? ""}>
        {opened && (
          <div className="grid gap-5">
            <StageTimeline
              steps={JOURNEY}
              currentKey={journeyKey(opened.column)}
              currentLabel={
                opened.column === "revisions"
                  ? "Changes in hand"
                  : opened.column === "waiting"
                    ? opened.assetsUrl
                      ? "Checking your footage"
                      : "Needs your footage"
                    : undefined
              }
            />
            <RequestDetail
              v={opened}
              cuts={live.filter((c) => c.parentId === opened.id)}
              busy={busy}
              onReview={(x) => (x.canReview && x.videoUrl ? setReviewing(x) : setOpenRequest(x.id))}
              onCancel={async (x) => {
                await cancelRequest(x);
                setOpenRequest(null);
              }}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}

/*
 * One request, as a card you can open.
 *
 * The whole row is the control. The old version put a small Review button on
 * the right of a plain line, so the thing worth doing was the smallest thing
 * on it; now the card carries its stage as a colour, and opening it is how
 * you get to the video, the brief, and everything we know about it.
 */
/* ---------------- past edits ---------------- */

/* "July 2026", the way somebody says which month they mean */
const monthName = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });

/*
 * Everything from the months that have closed.
 *
 * A plan renews and the counters reset, which is right, but the work does
 * not stop existing: a cut we made in March is still the client's video and
 * still the answer to "send me that one again". This is where it lives,
 * newest month first, filtered down to one month when they know which one
 * they want.
 */
function PastEdits({
  months,
  onOpen,
}: {
  months: Plan["history"];
  onOpen: (id: string) => void;
}) {
  const [pick, setPick] = useState("all");

  /* only months that actually produced something: an empty month is a row
     of nothing to read */
  const withWork = months
    .map((m) => ({ ...m, kept: (m.videos ?? []).filter((v) => !v.cancelledAt) }))
    .filter((m) => m.kept.length > 0);

  const shown = pick === "all" ? withWork : withWork.filter((m) => m.id === pick);
  const total = withWork.reduce((n, m) => n + m.kept.length, 0);

  if (!withWork.length)
    return (
      <Card title="Past edits">
        <p className="text-body-sm text-muted">
          Nothing here yet. When this month closes, everything we made you moves
          here and stays, so you can always come back for it.
        </p>
      </Card>
    );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-muted">
          <span className="font-mono tabular-nums text-ink">{total}</span>{" "}
          {total === 1 ? "video" : "videos"} across{" "}
          <span className="font-mono tabular-nums text-ink">{withWork.length}</span>{" "}
          {withWork.length === 1 ? "month" : "months"}. They stay here for good.
        </p>
        <label className="flex items-center gap-2">
          <span className="font-mono text-label uppercase tracking-[0.08em] text-muted">
            Month
          </span>
          <Select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            aria-label="Filter by month"
            className="w-auto"
          >
            <option value="all">All months</option>
            {withWork.map((m) => (
              <option key={m.id} value={m.id}>
                {monthName(m.startsAt)} ({m.kept.length})
              </option>
            ))}
          </Select>
        </label>
      </div>

      {shown.map((m) => {
        const parents = m.kept.filter((v) => !v.parentId);
        return (
          <Card
            key={m.id}
            title={monthName(m.startsAt)}
            description={`${day(m.startsAt)} to ${day(m.endsAt)} / ${m.creditsUsed} of ${m.creditsAllowed} credits`}
            actions={
              <DownloadAll
                videoIds={m.kept
                  .filter((v) => v.videoUrl && v.status === "approved")
                  .map((v) => v.id)}
              />
            }
          >
            <ul className="grid gap-2">
              {parents.map((v) => {
                const cuts = m.kept.filter((c) => c.parentId === v.id);
                return (
                  <li key={v.id}>
                    <VideoRow v={v} cuts={cuts.length} onOpen={() => onOpen(v.id)} />
                    {cuts.length > 0 && (
                      <ul className="mt-1.5 grid gap-1.5 border-l border-hair pl-4">
                        {cuts.map((c) => (
                          <li key={c.id}>
                            <VideoRow v={c} onOpen={() => onOpen(c.id)} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

function VideoRow({
  v,
  onOpen,
  cuts = 0,
}: {
  v: Video;
  onOpen: (v: Video) => void;
  cuts?: number;
}) {
  const stage = stageFor(v.column);
  return (
    <button
      type="button"
      onClick={() => onOpen(v)}
      className={`tap w-full rounded-[8px] border p-3.5 text-left transition-colors hover:border-gold/60 ${ROW[v.column] ?? ROW.queued}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body-sm font-semibold text-ink">{v.title}</p>
          <p className="mt-0.5 font-mono text-label uppercase text-dim">
            {v.typeLabel ?? "Edit"}
            {v.creditCost ? ` / ${creditWord(v.creditCost)}` : ""}
            {v.runtimeMinutes ? ` / ${v.runtimeMinutes} min` : ""}
            {v.aspect ? ` / ${v.aspect}` : ""}
            {cuts ? ` / ${cuts} short ${cuts === 1 ? "cut" : "cuts"}` : ""}
            {v.dueAt
              ? ` / due ${day(v.dueAt)}`
              : v.requestedDueAt
                ? ` / you asked for ${day(v.requestedDueAt)}`
                : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Chip tone={stage.tone}>{stage.label}</Chip>
          <ChevronRight size={15} className="text-dim" aria-hidden="true" />
        </div>
      </div>
    </button>
  );
}

/*
 * One request, opened.
 *
 * Everything we know about it in one place, so the answer to "what is
 * happening with this" never needs an email. The video is here when there is
 * one to watch, and reviewing it is the same screen the rest of the portal
 * uses.
 */
function RequestDetail({
  v,
  cuts,
  onReview,
  onCancel,
  busy,
}: {
  v: Video;
  cuts: Video[];
  onReview: (v: Video) => void;
  onCancel: (v: Video) => void;
  busy: boolean;
}) {
  const stage = stageFor(v.column);
  return (
    <div>
      <div className="grid gap-3">
        <div className="grid min-w-0 gap-3">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-h4 font-semibold text-ink">{v.title}</h2>
              <Chip tone={stage.tone}>{stage.label}</Chip>
              {v.typeLabel && <Chip tone="neutral">{v.typeLabel}</Chip>}
              {v.creditCost > 0 && <Chip tone="neutral">{creditWord(v.creditCost)}</Chip>}
              {v.aspect && <Chip tone="neutral">{v.aspect}</Chip>}
            </div>
            <p className="mt-2 text-body-sm text-muted">{stage.blurb}</p>

            {v.column === "waiting" &&
              (v.assetsUrl ? (
                <div className="mt-3 rounded-[8px] border border-blue/40 bg-blue/[0.06] px-4 py-3">
                  <p className="text-body-sm text-ink">
                    Your footage is with us. We open and check every link before we
                    promise a date, so this one is not scheduled yet. If we cannot
                    open it we will message you.
                  </p>
                </div>
              ) : (
                <div className="mt-3 rounded-[8px] border border-gold/40 bg-gold/[0.06] px-4 py-3">
                  <p className="text-body-sm text-ink">
                    We do not have footage for this one yet. Message us a link and we
                    will get started.
                  </p>
                </div>
              ))}

            {v.brief && (
              <div className="mt-4">
                <p className="font-mono text-label uppercase text-dim">What you asked for</p>
                <p className="mt-1 whitespace-pre-wrap text-body-sm text-muted">{v.brief}</p>
              </div>
            )}

            {v.assetsUrl && (
              <div className="mt-4">
                <p className="font-mono text-label uppercase text-dim">Your footage</p>
                <a
                  href={v.assetsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block break-all text-body-sm text-blue underline underline-offset-2"
                >
                  {v.assetsUrl}
                </a>
              </div>
            )}
          </Card>

          {v.videoUrl ? (
            <Card title="Your video">
              <video
                src={v.videoUrl}
                controls
                playsInline
                preload="metadata"
                className="w-full rounded-[8px] bg-canvas"
              />
              {v.canReview && (
                <div className="mt-3">
                  <Button variant="brand" icon={<Play />} onClick={() => onReview(v)}>
                    {v.status === "revisions" ? "See it and add notes" : "Review and approve"}
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            <Card title="Your video">
              <p className="text-body-sm text-muted">
                Nothing to watch yet. It appears here the moment it is ready,
                and we email you when it does.
              </p>
            </Card>
          )}

          {cuts.length > 0 && (
            <Card
              title="Short cuts from this one"
              description="Each is a video of its own, with its own review and approval."
            >
              <div className="grid gap-2">
                {cuts.map((c) => (
                  <VideoRow key={c.id} v={c} onOpen={onReview} />
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="grid gap-3">
          <Card title="Dates">
            <dl className="grid gap-2 text-body-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">You asked for</dt>
                <dd className="text-ink">{day(v.requestedDueAt) || "no date"}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">We promised</dt>
                <dd className="text-ink">{day(v.dueAt) || "not set yet"}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Footage in</dt>
                <dd className="text-ink">{day(v.assetsReadyAt) || "not yet"}</dd>
              </div>
            </dl>
            <p className="mt-3 text-body-sm text-dim">
              Two to three business days per video, counted from when your
              footage reaches us.
            </p>
          </Card>

          {v.revisionsUsed > 0 && (
            <Card title="Changes">
              <p className="text-body-sm text-muted">
                {v.revisionsUsed} {v.revisionsUsed === 1 ? "round" : "rounds"} so far.
                Revisions are unlimited on your plan.
              </p>
            </Card>
          )}

          {v.canCancel && (
            <Card title="Changed your mind?">
              <p className="text-body-sm text-muted">
                Nobody has started this one, so you can pull it back and the
                credits go straight back to your month.
              </p>
              <div className="mt-3">
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => onCancel(v)}>
                  Pull it back
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
