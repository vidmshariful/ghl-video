"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Button, Card, Chip, Table, Td, Th } from "@/components/portal/ui";
import { authHeader, money, when } from "./client";

/*
 * One subscription, on a full page.
 *
 * Deliberately only the commercial record: what they bought, what it covers,
 * what they have paid, and the three things somebody actually needs to do to
 * a plan (reprice, cancel, resume). The editing itself is not here. A video
 * request is production work and lives on the Production board with the rest
 * of it, which is the whole reason this screen exists in this shape.
 */

type Detail = {
  subscription: {
    id: string;
    email: string;
    name: string | null;
    company: string | null;
    phone: string | null;
    planName: string;
    sku: string | null;
    includes: string[];
    status: string;
    amountCents: number;
    currency: string;
    interval: string;
    startedAt: string;
    renewsAt: string | null;
    endingAtPeriodEnd: boolean;
    stripeId: string | null;
  };
  paidToDateCents: number;
  payments: {
    amountCents: number;
    currency: string;
    paidAt: string;
    invoiceId: string | null;
    planName: string | null;
  }[];
  months: {
    id: string;
    startsAt: string;
    endsAt: string;
    longUsed: number;
    shortUsed: number;
    longAllowed: number;
    shortAllowed: number;
    delivered: number;
  }[];
};

const TONE: Record<string, "good" | "warn" | "bad" | "neutral"> = {
  active: "good",
  trialing: "warn",
  past_due: "bad",
  unpaid: "bad",
  canceled: "neutral",
  incomplete: "neutral",
};

export function SubscriptionDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/subscriptions/${id}/detail`, {
        headers: await authHeader(),
      });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load this plan.");
      setD(j as Detail);
    } catch {
      setErr("Could not load this plan.");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * Change what a plan bills from its next renewal. Nothing is prorated, so
   * the month the client is inside stays exactly as they agreed to it, and
   * they are emailed what changed before any money moves.
   */
  async function reprice() {
    if (!d) return;
    const current = (d.subscription.amountCents / 100).toFixed(2);
    const entered = window.prompt(
      `New monthly price for ${d.subscription.email}, in dollars.\n\nThey pay $${current} today. The new amount starts at their next renewal; this month is untouched.`,
      current,
    );
    if (entered === null) return;
    const dollars = Number(entered);
    if (!Number.isFinite(dollars) || dollars < 0) return setErr("That is not an amount.");
    const reason = window.prompt(
      "Why is it changing? The client sees this line in their email.",
      "We applied the discount you were promised.",
    );
    if (reason === null) return;

    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/admin/subscriptions/${id}/price`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ amountCents: Math.round(dollars * 100), reason }),
      });
      const j = await r.json();
      if (!r.ok) setErr(j.error ?? "Could not change the price.");
      else {
        setNote(`Now $${(j.newCents / 100).toFixed(2)} a month from ${j.effective}. ${d.subscription.email} has been emailed.`);
        await load();
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function act(action: string, confirmMsg: string) {
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/admin/subscriptions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ action }),
      });
      const j = await r.json();
      if (!j.ok) setErr(j.error ?? "Action failed.");
      else await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (err && !d) return <p className="text-body text-error">{err}</p>;
  if (!d) return <p className="text-body text-muted">Loading...</p>;

  const s = d.subscription;
  const live = s.status !== "canceled" && s.status !== "incomplete";

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onBack}
        className="tap inline-flex items-center gap-2 font-mono text-label uppercase text-muted transition-colors hover:text-gold"
      >
        <ArrowLeft size={14} aria-hidden="true" /> All subscriptions
      </button>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-h3 text-ink">{s.name || s.email}</h1>
          <p className="mt-1 font-mono text-label uppercase text-dim">
            {s.email}
            {s.company ? ` / ${s.company}` : ""}
            {s.phone ? ` / ${s.phone}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Chip tone={TONE[s.status] ?? "neutral"}>{s.status.replace(/_/g, " ")}</Chip>
          <span className="font-mono text-price font-bold tabular-nums text-ink">
            {money(s.amountCents, s.currency)}/{s.interval}
          </span>
        </div>
      </div>

      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}
      {note && <p className="mt-4 text-body-sm text-green">{note}</p>}

      <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="grid min-w-0 gap-3">
          <Card title={s.planName} description="What this plan covers, as it was sold.">
            {s.includes.length === 0 ? (
              <p className="text-body-sm text-muted">
                No catalogue entry for this sku, so nothing to list.
              </p>
            ) : (
              <ul className="grid gap-1.5">
                {s.includes.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-body-sm text-muted">
                    <Check size={14} className="mt-1 shrink-0 text-green" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Payments" description="Every charge that actually went through." padded={false}>
            <div className="px-5 pb-5">
              {d.payments.length === 0 ? (
                <p className="py-2 text-body-sm text-muted">
                  Nothing charged yet. The first payment lands when the plan starts.
                </p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>When</Th>
                      <Th>Plan</Th>
                      <Th align="right">Amount</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.payments.map((p) => (
                      <tr key={p.paidAt + p.amountCents}>
                        <Td strong>{when(p.paidAt)}</Td>
                        <Td>{p.planName ?? s.planName}</Td>
                        <Td align="right">{money(p.amountCents, p.currency)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </Card>

          {d.months.length > 0 && (
            <Card
              title="Months"
              description="What each billing month covered and what was used of it."
              padded={false}
            >
              <div className="px-5 pb-5">
                <Table>
                  <thead>
                    <tr>
                      <Th>Month</Th>
                      <Th align="right">Long form</Th>
                      <Th align="right">Short form</Th>
                      <Th align="right">Delivered</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.months.map((m) => (
                      <tr key={m.id}>
                        <Td strong>{when(m.startsAt)}</Td>
                        <Td align="right">
                          {m.longUsed} of {m.longAllowed}
                        </Td>
                        <Td align="right">
                          {m.shortUsed} of {m.shortAllowed}
                        </Td>
                        <Td align="right">{m.delivered}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card>
          )}
        </div>

        <div className="grid gap-3">
          <Card title="The plan">
            <dl className="grid gap-2 text-body-sm">
              {[
                ["Started", when(s.startedAt)],
                [s.endingAtPeriodEnd ? "Ends" : "Renews", s.renewsAt ? when(s.renewsAt) : "not set"],
                ["Paid to date", money(d.paidToDateCents, s.currency)],
                ["Charges", String(d.payments.length)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="tabular-nums text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {s.stripeId && (
              <p className="mt-3 break-all font-mono text-label uppercase text-dim">{s.stripeId}</p>
            )}
          </Card>

          {live && (
            <Card title="Change the plan">
              <div className="grid gap-2">
                <Button variant="secondary" disabled={busy} onClick={reprice}>
                  Change price
                </Button>
                {s.endingAtPeriodEnd ? (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => act("resume", `Keep ${s.email} on the plan and clear the pending cancel?`)}
                  >
                    Resume
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => act("cancel_period_end", `Cancel ${s.email}'s plan at the end of the period?`)}
                  >
                    Cancel at period end
                  </Button>
                )}
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => act("cancel_now", `Cancel ${s.email}'s plan IMMEDIATELY? They lose access now.`)}
                >
                  Cancel now
                </Button>
              </div>
              <p className="mt-3 text-body-sm text-dim">
                A price change starts at the next renewal. The month they are
                inside is never touched, and they are emailed what changed.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
