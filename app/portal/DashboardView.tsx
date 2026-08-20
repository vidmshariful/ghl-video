"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Clock, PlayCircle, Upload } from "lucide-react";
import {
  Button,
  Card,
  CardGrid,
  Chip,
  EmptyState,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
} from "@/components/portal/ui";
import {
  gettingStartedSteps,
  onboardingUnfinished,
  type OnboardingStep,
  type StepKey,
} from "@/lib/onboarding";

/*
 * The customer dashboard.
 *
 * The old one counted things we care about: active projects, delivered,
 * unread. Useful to us, and none of it answers the question somebody
 * actually opens this screen with, which is "what now".
 *
 * So it is built around three states a client can be in, in the order that
 * matters to them: something is ready for you, something is waiting on you,
 * something is being made. Then one card naming the single most useful next
 * action, because a dashboard of numbers still leaves people deciding what
 * to do, and deciding is the part they came here to avoid.
 *
 * Extracted from PortalClient rather than added to it: that file was already
 * 1,514 lines and every screen bolted on made the next one harder to find.
 */

type OrderSummary = {
  id: string;
  productName: string | null;
  productCode: string | null;
  status: string;
  stage: string;
  invoiceNumber: string | null;
  createdAt: string;
  intakeCompleted: boolean;
};

type Line = "premade" | "custom" | "editing";

type Video = {
  id: string;
  title: string;
  status: string;
  canReview: boolean;
  due?: { text: string; tone: string };
};

type Group = {
  orderId: string;
  productName: string;
  /* which of the three service lines this came from. Absent on older
   * payloads, which were all premade. */
  line?: Line;
  orderedAt?: string;
  videos: Video[];
};

/* a video plus where it lives, which is what the dashboard needs to send
 * somebody to the right screen */
type Placed = Video & { line: Line; groupName: string };

/*
 * Getting started, for somebody whose first order is still finding its feet.
 *
 * Three steps, and it disappears for good once they are done rather than
 * turning into a permanent badge saying well done. A checklist that survives
 * completion is decoration.
 *
 * Every step is real work with a real consequence, which is the whole
 * discipline here. Nothing rewards them for logging in, and the third step is
 * honest about being ours rather than pretending they can tick it while we
 * are still animating: a step somebody cannot finish is worse than no list.
 */
type Step = OnboardingStep & { action?: { label: string; run: () => void } };

function GettingStarted({ steps }: { steps: Step[] }) {
  const done = steps.filter((s) => s.state === "done").length;
  return (
    <Card
      tone="dark"
      title="Getting started"
      description={`${done} of ${steps.length} done. This disappears once you finish.`}
    >
      <ol className="grid gap-3">
        {steps.map((s, i) => (
          <li key={s.key} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border font-mono text-[10px] ${
                s.state === "done"
                  ? "border-green bg-green/15 text-green"
                  : s.state === "now"
                    ? "border-gold text-gold"
                    : "border-chrome-line text-chrome-dim"
              }`}
            >
              {s.state === "done" ? <CheckCircle2 size={12} /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-body-sm font-semibold ${
                  s.state === "done" ? "text-chrome-muted line-through" : "text-chrome-text"
                }`}
              >
                {s.title}
              </p>
              <p className="mt-0.5 text-body-sm text-chrome-muted">{s.hint}</p>
            </div>
            {s.action && s.state === "now" && (
              <Button variant="brand" size="sm" onClick={s.action.run}>
                {s.action.label}
              </Button>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

/*
 * The one-question ask: did an approved video actually do anything.
 *
 * Shows only when the dashboard would otherwise be quiet, because a person
 * with a video waiting to watch or a brief to send has a more important card
 * on screen, and two cards asking for attention are none. One video per
 * visit, chosen on the server. Skipping is honoured forever; "too early"
 * comes back a month later on purpose.
 */
type FeedbackAskData = { deliverableId: string; title: string };

function FeedbackAsk({
  ask,
  authedFetch,
  onDone,
}: {
  ask: FeedbackAskData;
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"ask" | "note" | "thanks">("ask");
  const [verdict, setVerdict] = useState<"working" | "not_really" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const send = (v: string, n?: string) =>
    authedFetch("/api/portal/feedback/", {
      method: "POST",
      body: JSON.stringify({ deliverableId: ask.deliverableId, verdict: v, ...(n ? { note: n } : {}) }),
    }).catch(() => ({}));

  if (phase === "thanks") {
    return (
      <Card title="Thank you.">
        <p className="text-body-sm text-muted">
          This is how we find out what actually works, and it changes what we
          make next.
        </p>
        <div className="mt-3">
          <Button variant="ghost" size="sm" onClick={onDone}>
            Close
          </Button>
        </div>
      </Card>
    );
  }

  if (phase === "note" && verdict) {
    return (
      <Card
        title={verdict === "working" ? "Good to hear. What happened?" : "What fell short?"}
      >
        <p className="text-body-sm text-muted">
          {verdict === "working"
            ? "A line from you helps the next founder decide, and we may ask to quote it."
            : "We read every word, and it changes what we make next."}
        </p>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            verdict === "working"
              ? "Demo calls doubled the week we put it on the homepage."
              : "Tell us straight."
          }
          className="mt-3 w-full rounded-[8px] border border-hair bg-canvas px-3.5 py-2.5 text-body-sm text-ink placeholder:text-dim/70 focus:border-gold focus:outline-none"
        />
        <div className="mt-3 flex gap-2">
          <Button
            variant="brand"
            size="sm"
            disabled={busy || !note.trim()}
            onClick={async () => {
              setBusy(true);
              await send(verdict, note.trim());
              setPhase("thanks");
              setBusy(false);
            }}
          >
            Send
          </Button>
          <Button variant="ghost" size="sm" onClick={onDone}>
            Done
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card title={`Did "${ask.title}" do anything for you?`}>
      <p className="text-body-sm text-muted">
        One click. It tells us whether the work works.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="brand"
          size="sm"
          onClick={() => {
            setVerdict("working");
            void send("working");
            setPhase("note");
          }}
        >
          It&apos;s working
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void send("too_early");
            setPhase("thanks");
          }}
        >
          Too early to tell
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setVerdict("not_really");
            void send("not_really");
            setPhase("note");
          }}
        >
          Not really
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void send("skipped");
            onDone();
          }}
        >
          Skip
        </Button>
      </div>
    </Card>
  );
}

/*
 * The offer slot. One offer, chosen on the server, or nothing at all.
 *
 * It sits below the work, never above it, and it never shows while somebody
 * is still getting started. A client whose paid order is stuck waiting for a
 * brief should not be sold anything: the useful thing we can do for them is
 * the brief, and putting a discount above it says we would rather have their
 * money again than finish what they already paid for.
 */
type Offer = {
  id: string;
  title: string;
  body: string | null;
  ctaLabel: string;
  href: string;
  discount: string | null;
};

function OfferSlot({ offer }: { offer: Offer }) {
  const go = () => {
    /* counted, but never waited on: a counter must not stand between somebody
     * and the thing they just clicked */
    void fetch("/api/portal/campaign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: offer.id }),
      keepalive: true,
    }).catch(() => {});
    window.location.href = offer.href;
  };
  return (
    <Card
      title={offer.title}
      description={offer.body ?? undefined}
      actions={
        <Button variant="secondary" onClick={go}>
          {offer.ctaLabel}
        </Button>
      }
    >
      {offer.discount && (
        <Chip tone="good">{offer.discount}</Chip>
      )}
    </Card>
  );
}

/*
 * A counter you can open.
 *
 * Wraps Stat rather than replacing it, so a counter with nothing behind it
 * stays exactly what it was: a number, not a button that does nothing. A
 * control that looks pressable and is not is worse than plain text.
 */
function Counter({
  label,
  value,
  hint,
  open,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  open: boolean;
  onClick?: () => void;
}) {
  if (!onClick) return <Stat label={label} value={value} hint={hint} />;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={`tap block w-full rounded-[12px] text-left transition-colors ${
        open ? "ring-1 ring-gold/60" : "hover:ring-1 hover:ring-gold/40"
      }`}
    >
      <Stat
        label={label}
        value={value}
        hint={open ? "Showing them below" : `${hint}. Tap to see them.`}
      />
    </button>
  );
}

/** The one thing worth doing next, and where it goes. */
type NextAction =
  | { kind: "brief"; order: OrderSummary }
  | { kind: "watch"; video: Placed }
  | { kind: "waiting"; soonest: string | null }
  | { kind: "nothing" };

const LINE_WORD: Record<Line, string> = {
  premade: "Pre-made",
  custom: "Custom",
  editing: "Editing",
};

export function DashboardView({
  firstName,
  subtitle,
  can,
  authedFetch,
  onOpenOrder,
  onOpenVideo,
  onGo,
}: {
  firstName: string | null;
  /** who they are, or whose portal they are working in */
  subtitle: string;
  can: (key: string) => boolean;
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onOpenOrder: (id: string) => void;
  /** open one video on whichever of the three screens it lives */
  onOpenVideo: (line: string, videoId: string) => void;
  onGo: (section: string) => void;
}) {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  /* null while unknown, so the checklist never flashes a step as undone */
  const [brandReady, setBrandReady] = useState<boolean | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [feedbackAsk, setFeedbackAsk] = useState<FeedbackAskData | null>(null);
  /* which counter is expanded, if any */
  const [lens, setLens] = useState<"ready" | "waiting" | "making" | null>(null);
  const canOrders = can("orders");

  useEffect(() => {
    if (!canOrders) {
      setOrders([]);
      setGroups([]);
      setBrandReady(true);
      return;
    }
    authedFetch("/api/portal/orders")
      .then((j) => setOrders((j.orders as OrderSummary[]) ?? []))
      .catch(() => setOrders([]));
    authedFetch("/api/portal/videos")
      .then((j) => setGroups((j.groups as Group[]) ?? []))
      .catch(() => setGroups([]));
    authedFetch("/api/portal/brand-kit")
      .then((j) => setBrandReady(Boolean((j.completeness as { ready?: boolean } | null)?.ready)))
      /* on failure assume it is fine: nagging over a network blip is worse
       * than missing one prompt */
      .catch(() => setBrandReady(true));
    authedFetch("/api/portal/campaign")
      .then((j) => setOffer((j.campaign as Offer | null) ?? null))
      .catch(() => setOffer(null));
    authedFetch("/api/portal/feedback")
      .then((j) => setFeedbackAsk((j.ask as FeedbackAskData | null) ?? null))
      .catch(() => setFeedbackAsk(null));
  }, [canOrders, authedFetch]);

  const loading = orders === null || groups === null;
  const list = orders ?? [];

  /*
   * Every video, carrying the line it came from.
   *
   * This is the whole fix for a dashboard that used to assume one service
   * line. The counters were already right, because they counted this list;
   * what was wrong was everything that then sent somebody to Pre-made
   * whatever they had pressed.
   */
  const allVideos: Placed[] = (groups ?? []).flatMap((g) =>
    g.videos.map((v) => ({
      ...v,
      line: (g.line ?? "premade") as Line,
      groupName: g.productName,
    })),
  );

  /* work of any kind, which is what decides whether this account is empty */
  const hasWork = list.length > 0 || allVideos.length > 0;

  /* Ready for them, waiting on them, being made. Everything on this screen
   * derives from these three, so they are worked out once. */
  const ready = allVideos.filter((v) => v.canReview);
  const needsBrief = list.filter((o) => o.status === "paid" && !o.intakeCompleted);
  /* an editing request we cannot open the footage for is the same kind of
   * blocked as an order with no brief: ours to chase, theirs to fix */
  const needsFootage = allVideos.filter(
    (v) => v.line === "editing" && v.due?.tone === "waiting",
  );
  const inProduction = allVideos.filter(
    (v) => !v.canReview && v.status !== "approved" && v.status !== "delivered",
  );

  const next: NextAction = needsBrief.length
    ? { kind: "brief", order: needsBrief[0] }
    : ready.length
      ? { kind: "watch", video: ready[0] }
      : inProduction.length
        ? {
            kind: "waiting",
            soonest:
              inProduction.map((v) => v.due?.text).find((t) => t && /Expected/.test(t)) ?? null,
          }
        : { kind: "nothing" };

  const count = (n: number) => (loading ? "-" : String(n));

  /*
   * The getting started list, and whether it is shown at all.
   *
   * Only for somebody with an order: with nothing bought there is nothing to
   * get started with, and the empty state below already points them at the
   * library. Once all three are done it never appears again.
   */
  const ACTIONS: Record<StepKey, { label: string; run: () => void } | undefined> = {
    brand: { label: "Add it", run: () => onGo("brand") },
    brief: needsBrief.length
      ? { label: "Send it", run: () => onOpenOrder(needsBrief[0].id) }
      : undefined,
    approve: ready.length
      ? { label: "Watch it", run: () => onOpenVideo(ready[0].line, ready[0].id) }
      : undefined,
  };
  const steps: Step[] = gettingStartedSteps({
    brandReady: !!brandReady,
    needsBrief: needsBrief.length,
    readyToWatch: ready.length,
    approvedAny: allVideos.some((v) => v.status === "approved"),
  }).map((s) => ({ ...s, action: ACTIONS[s.key] }));
  const onboarding =
    !loading &&
    canOrders &&
    brandReady !== null &&
    /* work of any kind. Gated on orders, an editing client who pays every
     * month never saw this at all. */
    hasWork &&
    onboardingUnfinished(steps);

  return (
    <div>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
        description={subtitle}
      />

      {onboarding && (
        <div className="mb-3">
          <GettingStarted steps={steps} />
        </div>
      )}

      {canOrders && (
        <>
          {/* The counters were always the only view across all three lines.
              They were also plain text, so the one screen that knew where
              everything stood could not take you to any of it. */}
          <CardGrid min="15rem">
            <Counter
              label="Ready to watch"
              value={count(ready.length)}
              hint={ready.length ? "Waiting for your approval" : "Nothing to review right now"}
              open={ready.length > 0 && lens === "ready"}
              onClick={ready.length ? () => setLens(lens === "ready" ? null : "ready") : undefined}
            />
            <Counter
              label="Waiting on you"
              value={count(needsBrief.length + needsFootage.length)}
              hint={
                needsBrief.length + needsFootage.length
                  ? "We cannot start without these"
                  : "Nothing needed from you"
              }
              open={needsBrief.length + needsFootage.length > 0 && lens === "waiting"}
              onClick={
                needsBrief.length + needsFootage.length
                  ? () => setLens(lens === "waiting" ? null : "waiting")
                  : undefined
              }
            />
            <Counter
              label="Being made"
              value={count(inProduction.length)}
              hint={inProduction.length ? "In the studio now" : "Nothing in production"}
              open={inProduction.length > 0 && lens === "making"}
              onClick={
                inProduction.length ? () => setLens(lens === "making" ? null : "making") : undefined
              }
            />
          </CardGrid>

          {lens && (
            <div className="mt-3">
              <Card
                title={
                  lens === "ready"
                    ? "Ready to watch"
                    : lens === "waiting"
                      ? "Waiting on you"
                      : "Being made"
                }
                description="Across everything you have with us, whichever service it came from."
                actions={
                  <Button variant="ghost" size="sm" onClick={() => setLens(null)}>
                    Hide
                  </Button>
                }
              >
                <ul className="grid gap-2.5">
                  {lens === "waiting" &&
                    needsBrief.map((o) => (
                      <li
                        key={o.id}
                        className="flex flex-wrap items-center justify-between gap-3 border-t border-hair pt-2.5 first:border-t-0 first:pt-0"
                      >
                        <div className="min-w-0">
                          <p className="text-body-sm font-semibold text-ink">
                            {o.productName ?? "Your order"}
                          </p>
                          <p className="mt-0.5 font-mono text-label uppercase text-dim">
                            Pre-made / needs your brief
                          </p>
                        </div>
                        <Button variant="brand" size="sm" onClick={() => onOpenOrder(o.id)}>
                          Send the brief
                        </Button>
                      </li>
                    ))}
                  {(lens === "ready"
                    ? ready
                    : lens === "waiting"
                      ? needsFootage
                      : inProduction
                  ).map((v) => (
                    <li
                      key={v.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-t border-hair pt-2.5 first:border-t-0 first:pt-0"
                    >
                      <div className="min-w-0">
                        <p className="text-body-sm font-semibold text-ink">{v.title}</p>
                        <p className="mt-0.5 font-mono text-label uppercase text-dim">
                          {LINE_WORD[v.line]}
                          {v.groupName ? ` / ${v.groupName}` : ""}
                          {v.due?.text ? ` / ${v.due.text}` : ""}
                        </p>
                      </div>
                      <Button
                        variant={lens === "making" ? "secondary" : "brand"}
                        size="sm"
                        onClick={() => onOpenVideo(v.line, v.id)}
                      >
                        {lens === "ready" ? "Watch it" : lens === "waiting" ? "Fix it" : "Follow it"}
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </>
      )}

      {/* The single most useful next thing. One card, one action. Stood down
          while the getting started list is up, because that list already
          carries the same action and two cards asking for one thing reads as
          two things. */}
      {!loading && canOrders && !onboarding && (
        <div className="mt-3">
          {next.kind === "brief" ? (
            <Card
              tone="dark"
              title="We need your brief to start"
              description={`${next.order.productName ?? "Your order"} is paid and waiting on your logo, colours and notes. Nothing moves until this lands.`}
              actions={
                <Button
                  variant="brand"
                  icon={<Upload />}
                  onClick={() => onOpenOrder(next.order.id)}
                >
                  Send the brief
                </Button>
              }
            >
              <p className="text-body-sm text-chrome-muted">
                It takes a couple of minutes, and you only do it once. Every order
                after this one uses the same details.
              </p>
            </Card>
          ) : next.kind === "watch" ? (
            <Card
              tone="dark"
              title="A video is ready for you"
              description={next.video.title}
              actions={
                <Button
                  variant="brand"
                  icon={<PlayCircle />}
                  onClick={() => onOpenVideo(next.video.line, next.video.id)}
                >
                  Watch it
                </Button>
              }
            >
              <p className="text-body-sm text-chrome-muted">
                Watch it, then approve it or tell us what to change. One round of
                changes is included.
              </p>
            </Card>
          ) : next.kind === "waiting" ? (
            <Card title="We are on it" description={next.soonest ?? "Your videos are in production."}>
              <p className="text-body-sm text-muted">
                Nothing is needed from you. We will email you the moment the first
                one is ready to watch.
              </p>
            </Card>
          ) : null}
        </div>
      )}

      {/* The ask, only on an otherwise quiet dashboard: somebody with a video
          to watch or a brief to send has a more important card up already. */}
      {!loading &&
        !onboarding &&
        feedbackAsk &&
        (next.kind === "waiting" || next.kind === "nothing") && (
          <div className="mt-3">
            <FeedbackAsk
              ask={feedbackAsk}
              authedFetch={authedFetch}
              onDone={() => setFeedbackAsk(null)}
            />
          </div>
        )}

      {/* The offer, if there is one for this person. Never while they are
          still getting started: selling to somebody whose paid order is stuck
          waiting on them says we would rather have their money again than
          finish what they already bought. */}
      {!loading && !onboarding && offer && (
        <div className="mt-3">
          <OfferSlot offer={offer} />
        </div>
      )}

      {/* Recent work, not recent orders: an editing client has no orders at
          all and used to be told they had bought nothing. A short list. */}
      {canOrders && (
        <div className="mt-6">
          {loading ? (
            <p className="text-body text-muted">Loading...</p>
          ) : !hasWork ? (
            <EmptyState
              icon={<PlayCircle />}
              title="Nothing here yet"
              description="When you order a video, start a custom project or join an editing plan, it appears here with everything you need to follow it."
              action={
                <Button variant="brand" onClick={() => onGo("library")}>
                  Browse videos
                </Button>
              }
            />
          ) : list.length === 0 ? (
            /* work, but none of it bought as an order: send them to the
               screen that actually holds theirs */
            <Card title="Your work">
              <ul className="grid gap-2.5">
                {[...new Map(allVideos.map((v) => [v.groupName, v])).values()]
                  .slice(0, 5)
                  .map((v) => (
                    <li
                      key={v.groupName}
                      className="flex flex-wrap items-center justify-between gap-3 border-t border-hair pt-2.5 first:border-t-0 first:pt-0"
                    >
                      <div className="min-w-0">
                        <p className="text-body-sm font-semibold text-ink">{v.groupName}</p>
                        <p className="mt-0.5 font-mono text-label uppercase text-dim">
                          {LINE_WORD[v.line]}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<ArrowRight />}
                        onClick={() =>
                          onGo(
                            v.line === "custom"
                              ? "projects"
                              : v.line === "editing"
                                ? "subscriptions"
                                : "videos",
                          )
                        }
                      >
                        Open
                      </Button>
                    </li>
                  ))}
              </ul>
            </Card>
          ) : (
            <Card
              title="Recent orders"
              padded={false}
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<ArrowRight />}
                  onClick={() => onGo("orders")}
                >
                  See all
                </Button>
              }
            >
              <div className="px-5 pb-5">
                <Table>
                  <thead>
                    <tr>
                      <Th>Order</Th>
                      <Th>Where it is up to</Th>
                      <Th align="right">Placed</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.slice(0, 5).map((o) => (
                      <tr
                        key={o.id}
                        onClick={() => onOpenOrder(o.id)}
                        className="tap cursor-pointer transition-colors hover:bg-hair/30"
                      >
                        <Td strong>
                          {o.productName ?? "Order"}
                          {o.productCode && (
                            <span className="ml-2 font-mono text-label text-dim">
                              {o.productCode}
                            </span>
                          )}
                        </Td>
                        <Td>
                          {/* money states outrank production states: an order
                              that was refunded or failed must never wear a
                              working chip, least of all one reading "paid" */}
                          {o.status === "refunded" ? (
                            <Chip tone="neutral">Refunded</Chip>
                          ) : o.status === "failed" ? (
                            <Chip tone="bad">Payment failed</Chip>
                          ) : o.status === "paid" && !o.intakeCompleted ? (
                            <Chip tone="warn">Waiting on your brief</Chip>
                          ) : o.stage === "delivered" ? (
                            <Chip tone="good">Delivered</Chip>
                          ) : (
                            <Chip tone="info">{o.stage.replace(/_/g, " ")}</Chip>
                          )}
                        </Td>
                        <Td align="right">
                          {new Date(o.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      )}

      {!canOrders && (
        <EmptyState
          icon={<CheckCircle2 />}
          title="You are signed in"
          description="Your account does not have access to orders. Whoever invited you can change that under Settings, Team."
        />
      )}

      {/* Quiet, and only when there is genuinely nothing else on the screen. */}
      {!loading && canOrders && list.length > 0 && next.kind === "nothing" && (
        <p className="mt-6 flex items-center gap-2 text-body-sm text-dim">
          <Clock size={14} aria-hidden="true" />
          Everything is up to date. Nothing needs you right now.
        </p>
      )}
    </div>
  );
}
