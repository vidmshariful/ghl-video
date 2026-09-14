"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/portal/ui";
import { chatGet, chatPostJson } from "@/components/chat/api";

/*
 * A quote waiting on the client, at the top of their screen: what it is,
 * what it costs, and the same accept and decline as the public quote page.
 * Answered ones sit underneath as the record of what was agreed.
 */
type Quote = {
  id: string;
  number: string;
  title: string;
  lineItems: { description: string; amountCents: number; quantity: number; unitCents: number }[];
  totalCents: number;
  scope: string | null;
  validUntil: string | null;
  status: string;
  open: boolean;
  acceptedAt: string | null;
  acceptedBy: string | null;
};

const money = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function OpenQuotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [canAnswer, setCanAnswer] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const load = () =>
    chatGet<{ quotes?: Quote[]; canAnswer?: boolean }>("/api/portal/quotes")
      .then((j) => {
        setQuotes(j.quotes ?? []);
        setCanAnswer(Boolean(j.canAnswer));
      })
      .catch(() => setQuotes([]));
  useEffect(() => {
    void load();
  }, []);

  const open = quotes.filter((q) => q.open);
  if (open.length === 0) return null;

  async function answer(q: Quote, action: "accept" | "decline") {
    setBusy(q.id);
    setErr("");
    try {
      const j = await chatPostJson<{ error?: string }>(
        "/api/portal/quotes",
        action === "accept" ? { id: q.id, action, name } : { id: q.id, action },
      );
      if (j.error) setErr(String(j.error));
      else await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-3">
      <Card tone="dark" title={open.length === 1 ? "A quote to look at" : `${open.length} quotes to look at`}>
        <ul className="grid gap-4">
          {open.map((q) => (
            <li key={q.id} className="border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                <div className="min-w-0">
                  <p className="text-body-sm font-semibold text-chrome-text">{q.title}</p>
                  <ul className="mt-1.5 grid gap-1">
                    {q.lineItems.map((li, n) => (
                      <li key={n} className="text-body-sm text-chrome-muted">
                        {li.description}
                        {li.quantity > 1 ? ` (${li.quantity} × ${money(li.unitCents)})` : ""}
                      </li>
                    ))}
                  </ul>
                  {q.scope && <p className="mt-2 whitespace-pre-wrap text-body-sm text-chrome-muted">{q.scope}</p>}
                  <p className="mt-1.5 font-mono text-label uppercase text-chrome-muted">
                    {q.number}
                    {q.validUntil ? ` / good until ${day(q.validUntil)}` : ""}
                  </p>
                </div>
                <span className="font-mono text-price font-bold tabular-nums text-chrome-text">{money(q.totalCents)}</span>
              </div>
              {canAnswer ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Type your name to accept"
                    aria-label="Type your name to accept"
                    className="min-w-[14rem] rounded-[8px] border border-white/15 bg-transparent px-3 py-2 text-body-sm text-chrome-text outline-none focus:border-gold"
                  />
                  <Button variant="brand" size="sm" disabled={busy === q.id || name.trim().length < 2} onClick={() => void answer(q, "accept")}>
                    Accept {money(q.totalCents)}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy === q.id} onClick={() => void answer(q, "decline")}>
                    Decline
                  </Button>
                </div>
              ) : (
                <p className="mt-3 text-body-sm text-chrome-muted">Only the account owner can accept a quote.</p>
              )}
            </li>
          ))}
        </ul>
        {err && <p className="mt-3 text-body-sm text-error">{err}</p>}
      </Card>
    </div>
  );
}
