"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button, Card, Chip, EmptyState, Field, Input, Modal, Table, Td, Th, Toolbar } from "@/components/portal/ui";
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
  const [draft, setDraft] = useState<{
    company: string; name: string; email: string; phone: string;
    contactName: string; contactTitle: string; contactEmail: string; contactPhone: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function createClient() {
    if (!draft) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { ...(await authHeader()), "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not add the client.");
      setDraft(null);
      await load();
      if (j.id) onOpen(j.id);
    } finally {
      setBusy(false);
    }
  }

  /* one client, in full */
  if (openId) return <CustomerRecord id={openId} onBack={() => onOpen(null)} />;

  if (err) return <p className="text-body text-error">{err}</p>;
  if (!rows) return <p className="text-body text-muted">Loading...</p>;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h3 text-ink">Clients</h1>
          <p className="mt-0.5 text-body-sm text-muted">
            Everyone we work with. Add a client here before starting their first project.
          </p>
        </div>
        <Button
          variant="brand"
          icon={<Plus />}
          onClick={() =>
            setDraft({
              company: "", name: "", email: "", phone: "",
              contactName: "", contactTitle: "", contactEmail: "", contactPhone: "",
            })
          }
        >
          Add client
        </Button>
      </div>

      {err && <p className="mt-3 text-body-sm text-error">{err}</p>}

      <Modal open={!!draft} onClose={() => setDraft(null)} title="New client">
        {draft && (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company" hint="What you would call them.">
                <Input
                  value={draft.company}
                  onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                  placeholder="HighLevel"
                />
              </Field>
              <Field label="Account email" required hint="The address their portal is keyed to.">
                <Input
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  placeholder="billing@highlevel.com"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Account name" hint="Optional.">
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Phone" hint="Optional.">
                <Input
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                />
              </Field>
            </div>

            <div className="border-t border-hair pt-4">
              <p className="text-body-sm font-semibold text-ink">Their main contact</p>
              <p className="mt-0.5 text-body-sm text-muted">
                The person the relationship runs through. You can add whoever handles
                production separately once the client exists.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Name" hint="Who to call first.">
                  <Input
                    value={draft.contactName}
                    onChange={(e) => setDraft({ ...draft, contactName: e.target.value })}
                    placeholder="Chase Buckner"
                  />
                </Field>
                <Field label="What they do" hint="Optional.">
                  <Input
                    value={draft.contactTitle}
                    onChange={(e) => setDraft({ ...draft, contactTitle: e.target.value })}
                    placeholder="Head of Marketing"
                  />
                </Field>
                <Field label="Their email" hint="Leave empty to use the account email.">
                  <Input
                    value={draft.contactEmail}
                    onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })}
                  />
                </Field>
                <Field label="Their phone" hint="Optional.">
                  <Input
                    value={draft.contactPhone}
                    onChange={(e) => setDraft({ ...draft, contactPhone: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-hair pt-4">
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button variant="brand" disabled={busy} onClick={createClient}>
                {busy ? "Adding..." : "Add client"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

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
