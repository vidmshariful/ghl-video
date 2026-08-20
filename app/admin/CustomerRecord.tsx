"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, MessageSquare, Plus } from "lucide-react";
import { Button, Card, Chip, Input, Select, Table, Td, Th } from "@/components/portal/ui";
import { authHeader, money, when } from "./client";
import { HIDEABLE_SECTIONS } from "./customer-sections";

/*
 * One client, everything we know.
 *
 * Built to end the tab-hopping: what they are worth, what they have bought,
 * what we owe them, who else is on their account, what their brand is, and
 * what we have said to each other. The old screen showed a name, an email and
 * a total that was wrong for anyone who does not buy premade.
 *
 * The money panel splits by service on purpose. "Lifetime value" as one
 * number cannot tell you whether a client is a $2,000 one-off or $995 every
 * month, and those are completely different clients.
 */

type Value = {
  totalCents: number;
  premadeCents: number;
  addOnCents: number;
  customCents: number;
  subscriptionsCents: number;
  monthlyCents: number;
  openInvoicesCents: number;
  refundedCents: number;
};

type Record_ = {
  customer: {
    id: string;
    email: string;
    name: string | null;
    company: string | null;
    phone: string | null;
    tags: string[];
    hiddenSections: string[];
    lastSeenAt: string | null;
    createdAt: string;
    highlevelContactId: string | null;
  };
  value: Value;
  services: string[];
  orders: {
    id: string;
    productName: string | null;
    productSku: string | null;
    kind: "premade" | "addon" | "custom";
    parentOrderId: string | null;
    amountCents: number;
    status: string;
    stage: string;
    invoiceNumber: string | null;
    intakeCompleted: boolean;
    createdAt: string;
  }[];
  subscriptions: {
    id: string;
    planName: string | null;
    sku: string | null;
    amountCents: number | null;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    createdAt: string;
  }[];
  invoices: {
    id: string;
    number: string;
    token: string;
    totalCents: number;
    status: string;
    paid: boolean;
    parentOrderId: string | null;
    dueDate: string | null;
    createdAt: string;
  }[];
  videos: { id: string; orderId: string; title: string; status: string; dueAt: string | null }[];
  contacts: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: string;
    title: string | null;
  }[];
  team: { id: string; email: string; name: string | null; features: string[] | null; status: string }[];
  notes: { id: string; author: string; body: string; createdAt: string }[];
  conversations: {
    id: string;
    orderId: string | null;
    lastMessageAt: string | null;
    preview: string | null;
    lastSender: string | null;
  }[];
  brandKit: {
    kit: { brandName?: string | null; primaryColor?: string | null; accentColor?: string | null; pronunciation?: string | null; notes?: string | null } | null;
    completeness: { ready: boolean; percent: number; missing: string[] };
  };
};

const SERVICE_TONE: Record<string, "good" | "info" | "warn"> = {
  premade: "info",
  custom: "warn",
  editing: "good",
};

const PAY_TONE: Record<string, "good" | "warn" | "bad" | "neutral"> = {
  paid: "good",
  pending: "warn",
  failed: "bad",
  refunded: "neutral",
};

const ago = (iso: string | null) => (iso ? when(iso) : "never");

export function CustomerRecord({ id, onBack }: { id: string; onBack: () => void }) {
  const [data, setData] = useState<Record_ | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [contact, setContact] = useState<{ name: string; email: string; phone: string; title: string; role: string } | null>(null);
  const [busy, setBusy] = useState(false);
  /* which nudge is in flight: "<orderId>:<kind>" */
  const [sending, setSending] = useState<string | null>(null);
  /* their email history, straight from the log */
  const [emails, setEmails] = useState<
    { id: string; subject: string; status: string; error: string | null; at: string; templateKey: string | null; source: string }[] | null
  >(null);
  const [openEmail, setOpenEmail] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch(`/api/admin/customers/${id}`, { headers: await authHeader() });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load this client.");
      setData(j as Record_);
    } catch {
      setErr("Could not load this client.");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /* the log already answers "what did this person get": one query, theirs */
  useEffect(() => {
    if (!data?.customer.email) return;
    (async () => {
      try {
        const r = await fetch(
          `/api/admin/email-log?q=${encodeURIComponent(data.customer.email)}`,
          { headers: await authHeader() },
        );
        const j = await r.json();
        if (r.ok) setEmails(j.entries ?? []);
      } catch {
        setEmails([]);
      }
    })();
  }, [data?.customer.email]);

  async function sendNudge(orderId: string, kind: "order_confirmation" | "intake_reminder") {
    setSending(`${orderId}:${kind}`);
    setNote("");
    setErr("");
    try {
      const r = await fetch(`/api/admin/orders/${orderId}/resend-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ kind }),
      });
      const j = await r.json();
      if (!r.ok) setErr(j.error ?? "Not sent.");
      else
        setNote(
          kind === "intake_reminder"
            ? `Intake link sent to ${data?.customer.email}.`
            : `Confirmation re-sent to ${data?.customer.email}.`,
        );
      /* the log is the record; refresh it so the send shows up right away */
      const r2 = await fetch(
        `/api/admin/email-log?q=${encodeURIComponent(data?.customer.email ?? "")}`,
        { headers: await authHeader() },
      );
      const j2 = await r2.json();
      if (r2.ok) setEmails(j2.entries ?? []);
    } catch {
      setErr("Not sent.");
    } finally {
      setSending(null);
    }
  }

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/admin/customers/${id}`, {
      method: "PATCH",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    await load();
  }

  async function addContact() {
    if (!contact?.name.trim()) return;
    setBusy(true);
    await fetch(`/api/admin/customers/${id}/contacts`, {
      method: "POST",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify(contact),
    }).catch(() => null);
    setBusy(false);
    setContact(null);
    await load();
  }

  if (err) return <p className="text-body text-error">{err}</p>;
  if (!data) return <p className="text-body text-muted">Loading...</p>;

  const c = data.customer;
  const v = data.value;
  const title = c.company || c.name || c.email;
  const hidden = new Set(c.hiddenSections);

  return (
    <div className="w-full">
      <Button variant="ghost" size="sm" icon={<ArrowLeft />} onClick={onBack}>
        All clients
      </Button>

      {/* who they are, and what they are worth */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-h2 text-ink">{title}</h1>
          <p className="mt-1 text-body text-muted">
            {c.name && c.company ? `${c.name}, ` : ""}
            {c.email}
            {c.phone ? ` / ${c.phone}` : ""}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {data.services.map((s) => (
              <Chip key={s} tone={SERVICE_TONE[s] ?? "neutral"}>
                {s}
              </Chip>
            ))}
            {c.tags.map((t) => (
              <Chip key={t} tone="neutral">
                {t}
              </Chip>
            ))}
            <span className="ml-1 font-mono text-label uppercase text-dim">
              client since {when(c.createdAt)} / last seen {ago(c.lastSeenAt)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {c.highlevelContactId && (
            <Button
              variant="secondary"
              size="sm"
              icon={<ExternalLink />}
              href={`https://app.gohighlevel.com/v2/location/${process.env.NEXT_PUBLIC_HL_LOCATION ?? ""}/contacts/detail/${c.highlevelContactId}`}
            >
              In HighLevel
            </Button>
          )}
        </div>
      </div>

      {/* money, split by service, because one number hides which kind of client this is */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="font-mono text-label uppercase text-dim">Lifetime value</p>
          <p className="mt-2 font-display text-h2 tabular-nums text-gold">{money(v.totalCents)}</p>
          {v.refundedCents > 0 && (
            <p className="mt-1 text-body-sm text-muted">{money(v.refundedCents)} refunded</p>
          )}
        </Card>
        <Card>
          <p className="font-mono text-label uppercase text-dim">Every month</p>
          <p className="mt-2 font-display text-h2 tabular-nums text-ink">
            {v.monthlyCents ? money(v.monthlyCents) : "-"}
          </p>
          <p className="mt-1 text-body-sm text-muted">
            {v.monthlyCents ? "recurring" : "no active plan"}
          </p>
        </Card>
        <Card>
          <p className="font-mono text-label uppercase text-dim">Where it came from</p>
          <div className="mt-2 grid gap-1 text-body-sm">
            <span className="flex justify-between">
              <span className="text-muted">Premade</span>
              <span className="tabular-nums text-ink">{money(v.premadeCents)}</span>
            </span>
            <span className="flex justify-between">
              <span className="text-muted">Add-ons</span>
              <span className="tabular-nums text-ink">{money(v.addOnCents)}</span>
            </span>
            <span className="flex justify-between">
              <span className="text-muted">Custom</span>
              <span className="tabular-nums text-ink">{money(v.customCents)}</span>
            </span>
            <span className="flex justify-between">
              <span className="text-muted">Editing</span>
              <span className="tabular-nums text-ink">{money(v.subscriptionsCents)}</span>
            </span>
          </div>
        </Card>
        <Card>
          <p className="font-mono text-label uppercase text-dim">Waiting on payment</p>
          <p
            className={`mt-2 font-display text-h2 tabular-nums ${v.openInvoicesCents ? "text-error" : "text-ink"}`}
          >
            {v.openInvoicesCents ? money(v.openInvoicesCents) : "-"}
          </p>
          <p className="mt-1 text-body-sm text-muted">
            {v.openInvoicesCents ? "invoiced, unpaid" : "nothing outstanding"}
          </p>
        </Card>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="grid min-w-0 gap-3">
          {/* orders */}
          <Card title="Orders" padded={false}>
            <div className="px-5 pb-5">
              {data.orders.length === 0 ? (
                <p className="py-3 text-body-sm text-muted">No orders yet.</p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>What</Th>
                      <Th>State</Th>
                      <Th>Send</Th>
                      <Th align="right">Amount</Th>
                      <Th align="right">Placed</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders
                      .filter((o) => o.kind !== "addon")
                      .map((o) => (
                      <tr key={o.id}>
                        <Td strong>
                          {o.productName ?? "Order"}
                          {o.kind === "custom" && (
                            <span className="ml-2">
                              <Chip tone="warn">custom</Chip>
                            </span>
                          )}
                          {o.invoiceNumber && (
                            <span className="ml-2 font-mono text-label text-dim">
                              {o.invoiceNumber}
                            </span>
                          )}
                          {/* extra work billed against this order. It made no
                              new video, so it belongs here rather than
                              standing on its own as if it were a project. */}
                          {data.orders
                            .filter((a) => a.kind === "addon" && a.parentOrderId === o.id)
                            .map((a) => (
                              <span
                                key={a.id}
                                className="mt-1 flex items-center gap-2 font-normal text-body-sm text-muted"
                              >
                                <span aria-hidden="true" className="text-dim">
                                  &#8627;
                                </span>
                                {a.productName ?? "Extra work"}
                                <Chip tone="info">add-on</Chip>
                                <span className="tabular-nums">{money(a.amountCents)}</span>
                              </span>
                            ))}
                        </Td>
                        <Td>
                          <Chip tone={PAY_TONE[o.status] ?? "neutral"}>
                            {o.status === "paid" ? o.stage.replace(/_/g, " ") : o.status}
                          </Chip>
                        </Td>
                        <Td>
                          {/* the two nudges worth re-firing by hand. Every
                              other email is tied to an event happening, and
                              re-firing one without the event tells a client
                              a video is ready twice. */}
                          {o.status === "paid" ? (
                            <span className="flex flex-wrap gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={sending === `${o.id}:order_confirmation`}
                                onClick={() => sendNudge(o.id, "order_confirmation")}
                              >
                                {sending === `${o.id}:order_confirmation` ? "Sending..." : "Confirmation"}
                              </Button>
                              {!o.intakeCompleted && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={sending === `${o.id}:intake_reminder`}
                                  onClick={() => sendNudge(o.id, "intake_reminder")}
                                >
                                  {sending === `${o.id}:intake_reminder` ? "Sending..." : "Intake link"}
                                </Button>
                              )}
                            </span>
                          ) : (
                            <span className="font-mono text-label uppercase text-dim">-</span>
                          )}
                        </Td>
                        <Td align="right">{money(o.amountCents)}</Td>
                        <Td align="right">{when(o.createdAt)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </Card>

          {/* subscriptions */}
          {data.subscriptions.length > 0 && (
            <Card title="Plans" padded={false}>
              <div className="px-5 pb-5">
                <Table>
                  <thead>
                    <tr>
                      <Th>Plan</Th>
                      <Th>State</Th>
                      <Th align="right">Price</Th>
                      <Th align="right">Renews</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subscriptions.map((s) => (
                      <tr key={s.id}>
                        <Td strong>{s.planName ?? s.sku ?? "Plan"}</Td>
                        <Td>
                          <Chip
                            tone={
                              s.status === "active"
                                ? "good"
                                : s.status.startsWith("incomplete")
                                  ? "neutral"
                                  : "warn"
                            }
                          >
                            {s.cancelAtPeriodEnd ? "ending" : s.status}
                          </Chip>
                        </Td>
                        <Td align="right">{s.amountCents ? money(s.amountCents) : "-"}</Td>
                        <Td align="right">
                          {s.currentPeriodEnd ? when(s.currentPeriodEnd) : "-"}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card>
          )}

          {/* invoices */}
          {data.invoices.length > 0 && (
            <Card title="Invoices" padded={false}>
              <div className="px-5 pb-5">
                <Table>
                  <thead>
                    <tr>
                      <Th>Number</Th>
                      <Th>State</Th>
                      <Th align="right">Total</Th>
                      <Th align="right">Raised</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.map((i) => (
                      <tr key={i.id}>
                        <Td strong>
                          <a
                            href={`/invoice/${i.token}/`}
                            target="_blank"
                            rel="noopener"
                            className="hover:text-gold"
                          >
                            {i.number}
                          </a>
                        </Td>
                        <Td>
                          <Chip tone={i.paid ? "good" : i.status === "void" ? "neutral" : "warn"}>
                            {i.paid ? "paid" : i.status}
                          </Chip>
                        </Td>
                        <Td align="right">{money(i.totalCents)}</Td>
                        <Td align="right">{when(i.createdAt)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card>
          )}

          {/* videos */}
          <Card title={`Videos (${data.videos.length})`} padded={false}>
            <div className="px-5 pb-5">
              {data.videos.length === 0 ? (
                <p className="py-3 text-body-sm text-muted">
                  Nothing delivered yet.
                </p>
              ) : (
                <ul className="grid gap-1.5">
                  {data.videos.slice(0, 12).map((vd) => (
                    <li key={vd.id} className="flex items-center justify-between gap-3 text-body-sm">
                      <span className="min-w-0 truncate text-ink">{vd.title}</span>
                      <Chip tone={vd.status === "approved" ? "good" : "info"}>
                        {vd.status.replace(/_/g, " ")}
                      </Chip>
                    </li>
                  ))}
                  {data.videos.length > 12 && (
                    <li className="pt-1 text-body-sm text-dim">
                      and {data.videos.length - 12} more
                    </li>
                  )}
                </ul>
              )}
            </div>
          </Card>

          {/* internal notes */}
          <Card title="Internal notes">
            <p className="text-body-sm text-muted">
              Only the team sees these. The client never does.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Context worth keeping. Who introduced them, what they care about."
              />
              <Button
                variant="brand"
                size="sm"
                disabled={busy || !note.trim()}
                onClick={async () => {
                  await patch({ note });
                  setNote("");
                }}
              >
                Add
              </Button>
            </div>
            {data.notes.length > 0 && (
              <ul className="mt-4 grid gap-3">
                {data.notes.map((n) => (
                  <li key={n.id} className="border-t border-hair pt-3 first:border-t-0 first:pt-0">
                    <p className="text-body-sm text-ink">{n.body}</p>
                    <p className="mt-1 font-mono text-label uppercase text-dim">
                      {n.author} / {when(n.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* right rail: the account itself */}
        <div className="grid gap-3">
          <Card title="Messages">
            {data.conversations.length === 0 ? (
              <p className="text-body-sm text-muted">No conversation yet.</p>
            ) : (
              <ul className="grid gap-2.5">
                {data.conversations.slice(0, 4).map((v2) => (
                  <li key={v2.id} className="text-body-sm">
                    <p className="truncate text-ink">{v2.preview ?? "No messages"}</p>
                    <p className="mt-0.5 font-mono text-label uppercase text-dim">
                      {v2.lastSender ?? "-"} / {ago(v2.lastMessageAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <Button variant="secondary" size="sm" full icon={<MessageSquare />} href="/admin/messages/">
                Open messages
              </Button>
            </div>
          </Card>

          <Card title="Emails" description="What this person was sent, and what happened to each.">
            {emails === null ? (
              <p className="text-body-sm text-muted">Loading...</p>
            ) : emails.length === 0 ? (
              <p className="text-body-sm text-muted">
                Nothing recorded. The log started on 20 August 2026, so older
                sends are not in it.
              </p>
            ) : (
              <ul className="grid gap-2">
                {emails.slice(0, 8).map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setOpenEmail(openEmail === e.id ? null : e.id)}
                      className="tap w-full text-left"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-body-sm text-ink">
                          {e.subject}
                        </span>
                        <Chip
                          tone={
                            e.status === "sent"
                              ? "good"
                              : e.status === "failed"
                                ? "bad"
                                : e.status === "skipped"
                                  ? "warn"
                                  : "neutral"
                          }
                        >
                          {e.status}
                        </Chip>
                      </span>
                      <span className="mt-0.5 block font-mono text-label uppercase text-dim">
                        {e.templateKey ?? e.source} / {when(e.at)}
                      </span>
                      {openEmail === e.id && e.error && (
                        <span className="mt-1 block whitespace-pre-wrap text-body-sm text-error">
                          {e.error}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Brand">
            {data.brandKit.kit?.brandName ? (
              <div className="grid gap-1.5 text-body-sm">
                <span className="text-ink">{data.brandKit.kit.brandName}</span>
                <span className="flex items-center gap-2 text-muted">
                  {data.brandKit.kit.primaryColor && (
                    <span
                      aria-hidden="true"
                      className="inline-block h-4 w-4 rounded-[3px] border border-hair"
                      style={{ background: data.brandKit.kit.primaryColor }}
                    />
                  )}
                  {data.brandKit.kit.primaryColor ?? "no colour"}
                </span>
                {data.brandKit.kit.pronunciation && (
                  <span className="text-muted">said: {data.brandKit.kit.pronunciation}</span>
                )}
                <span className="mt-1 font-mono text-label uppercase text-dim">
                  {data.brandKit.completeness.percent}% complete
                </span>
              </div>
            ) : (
              <p className="text-body-sm text-muted">
                No brand kit yet. Their first brief fills it.
              </p>
            )}
          </Card>

          {/* who we actually deal with. Distinct from Team below, which is who
              can log in: most contacts never sign in at all. */}
          <Card
            title="Who we work with"
            actions={
              <Button
                variant="ghost"
                size="sm"
                icon={<Plus />}
                onClick={() =>
                  setContact({ name: "", email: "", phone: "", title: "", role: "production" })
                }
              >
                Add
              </Button>
            }
          >
            {data.contacts.length === 0 && !contact && (
              <p className="text-body-sm text-muted">
                Nobody named yet. Add the person who runs projects with you.
              </p>
            )}
            {data.contacts.length > 0 && (
              <ul className="grid gap-2.5">
                {data.contacts.map((c) => (
                  <li key={c.id} className="text-body-sm">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-ink">{c.name}</span>
                      <Chip tone={c.role === "primary" ? "good" : "info"}>{c.role}</Chip>
                    </span>
                    <p className="mt-0.5 font-mono text-label uppercase text-dim">
                      {[c.title, c.email, c.phone].filter(Boolean).join(" / ") || "no details"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {contact && (
              <div className="mt-3 grid gap-2 border-t border-hair pt-3">
                <Input
                  value={contact.name}
                  onChange={(e) => setContact({ ...contact, name: e.target.value })}
                  placeholder="Name"
                />
                <Input
                  value={contact.title}
                  onChange={(e) => setContact({ ...contact, title: e.target.value })}
                  placeholder="What they do, e.g. Head of Content"
                />
                <Input
                  value={contact.email}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })}
                  placeholder="Email"
                />
                <Input
                  value={contact.phone}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                  placeholder="Phone"
                />
                <Select
                  value={contact.role}
                  onChange={(e) => setContact({ ...contact, role: e.target.value })}
                  aria-label="What this contact is for"
                >
                  <option value="primary">Primary, the relationship</option>
                  <option value="production">Production, the day to day</option>
                  <option value="billing">Billing</option>
                  <option value="other">Other</option>
                </Select>
                <div className="flex gap-2">
                  <Button variant="brand" size="sm" disabled={busy || !contact.name.trim()} onClick={addContact}>
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setContact(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card title="Portal access">
            {data.team.length === 0 ? (
              <p className="text-body-sm text-muted">Nobody else on this account.</p>
            ) : (
              <ul className="grid gap-2.5">
                {data.team.map((m) => (
                  <li key={m.id} className="text-body-sm">
                    <span className="text-ink">{m.name || m.email}</span>
                    <span className="ml-2">
                      <Chip tone={m.status === "active" ? "good" : "neutral"}>{m.status}</Chip>
                    </span>
                    <p className="mt-0.5 font-mono text-label uppercase text-dim">
                      {m.features === null ? "everything" : m.features.join(", ") || "nothing"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* the access control Shariful asked for */}
          <Card title="What they see">
            <p className="text-body-sm text-muted">
              Hide the parts of the portal this client will never use. Everything
              is shown unless you switch it off here.
            </p>
            <div className="mt-3 grid gap-1.5">
              {HIDEABLE_SECTIONS.map((s) => {
                const off = hidden.has(s.key);
                return (
                  <label
                    key={s.key}
                    className="flex cursor-pointer items-center justify-between gap-3 text-body-sm text-ink"
                  >
                    <span>
                      {s.label}
                      <span className="block font-mono text-label uppercase text-dim">
                        {off ? "hidden" : "visible"}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={!off}
                      disabled={busy}
                      onChange={() => {
                        const next = off
                          ? c.hiddenSections.filter((k) => k !== s.key)
                          : [...c.hiddenSections, s.key];
                        void patch({ hiddenSections: next });
                      }}
                      className="h-4 w-4 shrink-0 rounded-[3px] border-hair"
                    />
                  </label>
                );
              })}
            </div>
          </Card>

          <Card title="Tags">
            <div className="flex flex-wrap gap-1.5">
              {c.tags.length === 0 && <p className="text-body-sm text-muted">No tags yet.</p>}
              {c.tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => void patch({ tags: c.tags.filter((x) => x !== t) })}
                  className="tap rounded-full border border-hair px-2.5 py-1 font-mono text-label uppercase text-muted transition-colors hover:border-error/60 hover:text-error"
                  aria-label={`Remove tag ${t}`}
                >
                  {t} &times;
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                placeholder="agency, priority"
              />
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus />}
                disabled={busy || !tagDraft.trim()}
                onClick={async () => {
                  await patch({ tags: [...c.tags, tagDraft.trim()] });
                  setTagDraft("");
                }}
              >
                Add
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
