"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Plus } from "lucide-react";
import {
  Button,
  Card,
  Chip,
  Field,
  Input,
  PageHeader,
  Progress,
  Select,
  Textarea,
} from "@/components/portal/ui";

/*
 * An editing client's plan, from their side.
 *
 * This screen is the reason the spine was built. A subscription creates no
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
  title: string;
  status: string;
  form: "long" | "short" | null;
  brief: string | null;
  dueAt: string | null;
  requestedDueAt: string | null;
  createdAt: string;
};

type Plan = {
  planName: string;
  status: string;
  amountCents: number;
  renewsAt: string | null;
  endingAtPeriodEnd: boolean;
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

const STATUS_TONE: Record<string, "neutral" | "info" | "good" | "warn"> = {
  queued: "neutral",
  in_production: "info",
  ready: "good",
  revisions: "warn",
  approved: "good",
};

const STATUS_WORD: Record<string, string> = {
  queued: "In the queue",
  in_production: "Being edited",
  ready: "Ready to watch",
  revisions: "Changes in hand",
  approved: "Approved",
};

/** A slot counter that reads at a glance, per form. */
function Slots({
  label,
  used,
  allowed,
}: {
  label: string;
  used: number;
  allowed: number;
}) {
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

export function PlanView({
  authedFetch,
}: {
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
}) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState({ title: "", brief: "", form: "short", requestedDueAt: "" });
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

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      const j = (await authedFetch("/api/portal/plan", {
        method: "POST",
        body: JSON.stringify(draft),
      })) as { ok?: boolean; error?: string; warning?: string | null };
      if (j.error) return setErr(j.error);
      setSent(
        j.warning ??
          "Got it. It is in the queue and your producer will confirm the date.",
      );
      setDraft({ title: "", brief: "", form: "short", requestedDueAt: "" });
      setAsking(false);
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
          title="Your plan"
          description="Monthly editing, with your videos edited by a HighLevel-fluent team."
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

  const s = plan.slots;
  /* the warning for whichever form they are about to ask for */
  const warning = draft.form === "long" ? plan.warnings.long : plan.warnings.short;

  return (
    <div>
      <PageHeader
        title="Your plan"
        description={`${plan.planName}, ${money(plan.amountCents)} a month. ${
          plan.endingAtPeriodEnd
            ? `Ends ${day(plan.renewsAt)}.`
            : `Renews ${day(plan.renewsAt)}.`
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
                      onChange={(e) => setDraft({ ...draft, form: e.target.value })}
                    >
                      <option value="short">Short form</option>
                      <option value="long">Long form</option>
                    </Select>
                  </Field>
                </div>

                <Field
                  label="What do you want done, and where is the footage"
                  required
                  hint="Paste the link to your files, and say how you want it cut."
                >
                  <Textarea
                    rows={4}
                    value={draft.brief}
                    onChange={(e) => setDraft({ ...draft, brief: e.target.value })}
                    placeholder="Drive link, plus: trim the first 90 seconds, captions throughout, our intro on the front."
                  />
                </Field>

                <Field
                  label="When would you like it"
                  hint="Tell us your date. Your producer confirms what is possible."
                >
                  <Input
                    type="date"
                    value={draft.requestedDueAt}
                    onChange={(e) => setDraft({ ...draft, requestedDueAt: e.target.value })}
                  />
                </Field>

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
                    disabled={busy || !draft.title.trim() || !draft.brief.trim()}
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
            {plan.videos.length === 0 ? (
              <p className="text-body-sm text-muted">
                Nothing asked for yet this month. Your slots reset on{" "}
                {day(plan.cycle.endsAt)}, and they do not carry over, so it is
                worth using them.
              </p>
            ) : (
              <ul className="grid gap-2.5">
                {plan.videos.map((v) => (
                  <li
                    key={v.id}
                    className="flex flex-wrap items-start justify-between gap-3 border-t border-hair pt-2.5 first:border-t-0 first:pt-0"
                  >
                    <div className="min-w-0">
                      <p className="text-body-sm font-semibold text-ink">{v.title}</p>
                      <p className="mt-0.5 font-mono text-label uppercase text-dim">
                        {v.form === "long" ? "Long form" : "Short form"}
                        {v.dueAt
                          ? ` / due ${day(v.dueAt)}`
                          : v.requestedDueAt
                            ? ` / you asked for ${day(v.requestedDueAt)}`
                            : ""}
                      </p>
                    </div>
                    <Chip tone={STATUS_TONE[v.status] ?? "neutral"}>
                      {STATUS_WORD[v.status] ?? v.status}
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {plan.history.length > 0 && (
            <Card title="Earlier months">
              <ul className="grid gap-2">
                {plan.history.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-baseline justify-between gap-3 text-body-sm"
                  >
                    <span className="text-muted">{day(h.startsAt)}</span>
                    <span className="font-mono tabular-nums text-ink">
                      {h.longUsed}/{h.longAllowed} long, {h.shortUsed}/{h.shortAllowed} short
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
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
    </div>
  );
}
