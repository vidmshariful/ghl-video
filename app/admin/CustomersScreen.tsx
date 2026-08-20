"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button, Card, Chip, EmptyState, Input, Table, Td, Th, Toolbar } from "@/components/portal/ui";
import { authHeader, money, when } from "./client";
import { CustomerRecord } from "./CustomerRecord";

/*
 * Every client, with numbers that are true.
 *
 * The list this replaces summed paid orders in the browser, so a client on a
 * $995 a month plan read as $0 and nothing showed which service anybody was
 * on. Both now come from the server, where subscriptions and invoiced custom
 * work are counted too, and the row opens a full record.
 */

type Row = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  tags: string[];
  hiddenSections: string[];
  lastSeenAt: string | null;
  createdAt: string;
  value: {
    totalCents: number;
    premadeCents: number;
    customCents: number;
    subscriptionsCents: number;
    monthlyCents: number;
    openInvoicesCents: number;
    refundedCents: number;
  };
  services: string[];
  counts: { orders: number; projects: number; subscriptions: number; openInvoices: number };
};

const SERVICE_TONE: Record<string, "good" | "info" | "warn"> = {
  premade: "info",
  custom: "warn",
  editing: "good",
};

type Sort = "value" | "recent" | "active";

export function CustomersScreen({
  openId,
  onOpen,
}: {
  openId: string | null;
  onOpen: (id: string | null) => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [service, setService] = useState<"all" | "premade" | "custom" | "editing">("all");
  const [sort, setSort] = useState<Sort>("value");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch("/api/admin/customers", { headers: await authHeader() });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load the clients.");
      setRows(j.customers as Row[]);
    } catch {
      setErr("Could not load the clients.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = (rows ?? []).filter(
      (c) =>
        (service === "all" || c.services.includes(service)) &&
        (!term ||
          c.email.toLowerCase().includes(term) ||
          (c.name ?? "").toLowerCase().includes(term) ||
          (c.company ?? "").toLowerCase().includes(term) ||
          c.tags.some((t) => t.toLowerCase().includes(term))),
    );
    return [...list].sort((a, b) => {
      if (sort === "value") return b.value.totalCents - a.value.totalCents;
      if (sort === "recent") return b.createdAt.localeCompare(a.createdAt);
      return (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? "");
    });
  }, [rows, q, service, sort]);

  /* one client, in full */
  if (openId) return <CustomerRecord id={openId} onBack={() => onOpen(null)} />;

  if (err) return <p className="text-body text-error">{err}</p>;
  if (!rows) return <p className="text-body text-muted">Loading...</p>;

  const totals = rows.reduce(
    (a, c) => ({
      value: a.value + c.value.totalCents,
      mrr: a.mrr + c.value.monthlyCents,
      open: a.open + c.value.openInvoicesCents,
    }),
    { value: 0, mrr: 0, open: 0 },
  );

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h2 text-ink">Clients</h1>
          <p className="mt-1 text-body text-muted">
            Everyone who has bought, across all three services.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="font-mono text-label uppercase text-dim">Everything billed</p>
          <p className="mt-2 font-display text-h2 tabular-nums text-gold">{money(totals.value)}</p>
        </Card>
        <Card>
          <p className="font-mono text-label uppercase text-dim">Recurring, per month</p>
          <p className="mt-2 font-display text-h2 tabular-nums text-green">{money(totals.mrr)}</p>
        </Card>
        <Card>
          <p className="font-mono text-label uppercase text-dim">Invoiced, unpaid</p>
          <p
            className={`mt-2 font-display text-h2 tabular-nums ${totals.open ? "text-error" : "text-ink"}`}
          >
            {money(totals.open)}
          </p>
        </Card>
      </div>

      <Toolbar
        right={
          <div className="flex flex-wrap gap-1.5">
            {(["all", "premade", "custom", "editing"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={service === s ? "primary" : "secondary"}
                onClick={() => setService(s)}
              >
                {s === "all" ? "Everyone" : s}
              </Button>
            ))}
            <span className="mx-1 w-px self-stretch bg-hair" aria-hidden="true" />
            {(
              [
                ["value", "By value"],
                ["recent", "Newest"],
                ["active", "Last seen"],
              ] as const
            ).map(([k, label]) => (
              <Button
                key={k}
                size="sm"
                variant={sort === k ? "primary" : "secondary"}
                onClick={() => setSort(k)}
              >
                {label}
              </Button>
            ))}
          </div>
        }
      >
        <div className="relative min-w-[14rem] max-w-sm flex-1">
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim"
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, company, email or tag"
            className="pl-9"
          />
        </div>
      </Toolbar>

      {shown.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="Nobody matches that"
          description="Try a different word, or clear the filter."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQ("");
                setService("all");
              }}
            >
              Clear
            </Button>
          }
        />
      ) : (
        <Card padded={false}>
          <div className="px-5 pb-5">
            <Table>
              <thead>
                <tr>
                  <Th>Client</Th>
                  <Th>Services</Th>
                  <Th align="right">Lifetime</Th>
                  <Th align="right">Monthly</Th>
                  <Th align="right">Last seen</Th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => onOpen(c.id)}
                    className="cursor-pointer transition-colors hover:bg-hair/30"
                  >
                    <Td strong>
                      <span className="block">{c.company || c.name || c.email}</span>
                      <span className="block font-mono text-label uppercase text-dim">
                        {c.email}
                      </span>
                    </Td>
                    <Td>
                      <span className="flex flex-wrap gap-1">
                        {c.services.length === 0 && (
                          <span className="font-mono text-label uppercase text-dim">none yet</span>
                        )}
                        {c.services.map((s) => (
                          <Chip key={s} tone={SERVICE_TONE[s] ?? "neutral"}>
                            {s}
                          </Chip>
                        ))}
                        {c.hiddenSections.length > 0 && (
                          <Chip tone="neutral">{c.hiddenSections.length} hidden</Chip>
                        )}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-semibold text-ink">{money(c.value.totalCents)}</span>
                      {c.value.openInvoicesCents > 0 && (
                        <span className="block font-mono text-label uppercase text-error">
                          {money(c.value.openInvoicesCents)} due
                        </span>
                      )}
                    </Td>
                    <Td align="right">
                      {c.value.monthlyCents ? money(c.value.monthlyCents) : "-"}
                    </Td>
                    <Td align="right">{c.lastSeenAt ? when(c.lastSeenAt) : "never"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
