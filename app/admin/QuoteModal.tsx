"use client";

import { useState } from "react";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/portal/ui";
import { authHeader, money } from "./client";

/*
 * Raise a quote and send it, from the Custom screen: for an enquiry, a
 * client, or a project already open. The client accepts on our quote page
 * or in their portal; accepting books the work in at the agreed price.
 * Opens in the shared Modal, per the portal rule.
 */
export type QuoteSeed = {
  customerEmail: string;
  customerName?: string | null;
  customerCompany?: string | null;
  requestId?: string | null;
  projectId?: string | null;
  title?: string;
  scope?: string;
};

type Line = { description: string; unit: string; quantity: string };
const EMPTY_LINE: Line = { description: "", unit: "", quantity: "1" };

export function QuoteModal({ seed, onClose, onSent }: { seed: QuoteSeed; onClose: () => void; onSent: () => void }) {
  const [title, setTitle] = useState(seed.title ?? "");
  const [scope, setScope] = useState(seed.scope ?? "");
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }]);
  const [discountKind, setDiscountKind] = useState<"" | "percent" | "flat">("");
  const [discountValue, setDiscountValue] = useState("");
  const [validUntil, setValidUntil] = useState(() => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const subtotal = lines.reduce((s, l) => s + Math.round(Number(l.unit || 0) * 100) * Math.max(1, Math.round(Number(l.quantity || 1))), 0);
  const discount =
    discountKind === "percent"
      ? Math.round((subtotal * Math.min(100, Number(discountValue || 0))) / 100)
      : discountKind === "flat"
        ? Math.min(subtotal, Math.round(Number(discountValue || 0) * 100))
        : 0;
  const total = Math.max(0, subtotal - discount);

  async function submit(send: boolean) {
    setBusy(true);
    setErr("");
    try {
      const h = { ...(await authHeader()), "Content-Type": "application/json" };
      const r = await fetch("/api/admin/quotes", {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          customerEmail: seed.customerEmail,
          customerName: seed.customerName ?? "",
          customerCompany: seed.customerCompany ?? "",
          requestId: seed.requestId ?? null,
          projectId: seed.projectId ?? null,
          title,
          scope,
          validUntil,
          discountKind: discountKind || null,
          discountValue: discountKind === "flat" ? Math.round(Number(discountValue || 0) * 100) : Number(discountValue || 0),
          lineItems: lines.map((l) => ({ description: l.description, unitCents: Math.round(Number(l.unit || 0) * 100), quantity: Number(l.quantity || 1) })),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; quote?: { id: string } };
      if (!r.ok || !j.quote) {
        setErr(j.error ?? "Could not raise the quote.");
        return;
      }
      if (send) {
        const s = await fetch(`/api/admin/quotes/${j.quote.id}`, { method: "PATCH", headers: h, body: JSON.stringify({ action: "send" }) });
        const sj = (await s.json().catch(() => ({}))) as { error?: string };
        if (!s.ok) {
          setErr(sj.error ?? "Raised, but not sent.");
          return;
        }
      }
      onSent();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={seed.projectId ? "Quote this project" : "Send a quote"}>
      <div className="grid gap-4">
        <p className="text-body-sm text-muted">
          To <span className="text-ink">{seed.customerName || seed.customerCompany || seed.customerEmail}</span> ({seed.customerEmail}). They accept on the quote page or in their portal; accepting books the work in at this price.
        </p>
        <Field label="What the work is">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ninety second explainer for G2 Momentum" />
        </Field>
        <div className="grid gap-2">
          <span className="font-mono text-label uppercase text-dim">Lines</span>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_7rem_4rem_auto] items-center gap-2">
              <Input value={l.description} placeholder="Description" onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, description: e.target.value } : x)))} />
              <Input value={l.unit} inputMode="decimal" placeholder="Price" onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, unit: e.target.value } : x)))} />
              <Input value={l.quantity} inputMode="numeric" placeholder="Qty" onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, quantity: e.target.value } : x)))} />
              <Button variant="ghost" size="sm" onClick={() => setLines(lines.length > 1 ? lines.filter((_, k) => k !== i) : [{ ...EMPTY_LINE }])} aria-label="Remove line">
                Remove
              </Button>
            </div>
          ))}
          <div>
            <Button variant="secondary" size="sm" onClick={() => setLines([...lines, { ...EMPTY_LINE }])}>
              Add a line
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Discount">
            <Select value={discountKind} onChange={(e) => setDiscountKind(e.target.value as "" | "percent" | "flat")}>
              <option value="">None</option>
              <option value="percent">Percent off</option>
              <option value="flat">Amount off</option>
            </Select>
          </Field>
          <Field label={discountKind === "percent" ? "Percent" : "Amount"}>
            <Input value={discountValue} inputMode="decimal" disabled={!discountKind} onChange={(e) => setDiscountValue(e.target.value)} />
          </Field>
          <Field label="Good until">
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </Field>
        </div>
        <Field label="What is included" hint="The paragraph under the lines: rounds, formats, what they supply.">
          <Textarea rows={4} value={scope} onChange={(e) => setScope(e.target.value)} />
        </Field>
        {err && <p className="text-body-sm text-error">{err}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hair pt-4">
          <span className="font-mono text-label uppercase text-dim">
            Total <span className="text-ink">{money(total)}</span>
            {discount ? ` after ${money(discount)} off` : ""}
          </span>
          <span className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => void submit(false)} disabled={busy}>
              Save as draft
            </Button>
            <Button variant="brand" onClick={() => void submit(true)} disabled={busy || !title.trim() || total < 50}>
              Send the quote
            </Button>
          </span>
        </div>
      </div>
    </Modal>
  );
}
