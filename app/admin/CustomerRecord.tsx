"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, ExternalLink, MessageSquare, Plus } from "lucide-react";
import { Button, Card, Chip, Field, Input, Modal, Select, Table, Tabs, Td, Th } from "@/components/portal/ui";
import { monthLabel, RETAINER_KIND_LABEL, type MonthSummary, type Retainer, type RetainerKind } from "@/lib/retainer";
import { authHeader, money, when } from "./client";
import { TeamCard } from "@/components/portal/team";
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
    disabledSections: string[];
    canSubmitProjects: boolean;
    /* the retainer terms, null for everyone not on one */
    retainer: Retainer | null;
    lastSeenAt: string | null;
    createdAt: string;
    highlevelContactId: string | null;
  };
  /* the retainer month by month, only for an account on one */
  partnership: {
    months: MonthSummary[];
    jobs: {
      id: string;
      title: string;
      status: string;
      retainerMonth: string | null;
      retainerKind: RetainerKind | null;
      createdAt: string;
    }[];
  } | null;
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
  videos: {
    id: string;
    /* null for project and plan work: it has no order behind it */
    orderId: string | null;
    title: string;
    status: string;
    dueAt: string | null;
    source: "purchase" | "project" | "plan";
  }[];
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
    logoDarkUrl?: string | null;
    logoLightUrl?: string | null;
    logoUrl?: string | null;
    guidelines?: { path: string; name: string; size: number; url: string | null }[];
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

/* the five groups the record splits into, in the order they are read */
type TabKey = "orders" | "videos" | "messages" | "access" | "profile";

export function CustomerRecord({ id, onBack }: { id: string; onBack: () => void }) {
  const [data, setData] = useState<Record_ | null>(null);
  const [tab, setTab] = useState<TabKey>("orders");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [welcomeTo, setWelcomeTo] = useState("");
  const [contact, setContact] = useState<{ name: string; email: string; phone: string; title: string; role: string } | null>(null);
  /* patch() reports failure by setting err; a caller that has already
     returned cannot read that state, so it reads the ref instead */
  const errRef = useRef("");
  /* which nudge is in flight: "<orderId>:<kind>" */
  const [sending, setSending] = useState<string | null>(null);
  /* their email history, straight from the log */
  const [emails, setEmails] = useState<
    { id: string; subject: string; status: string; error: string | null; at: string; templateKey: string | null; source: string }[] | null
  >(null);
  const [openEmail, setOpenEmail] = useState<string | null>(null);
  /* who is in their portal, and who has been */
  const [activity, setActivity] = useState<{
    people: { email: string; lastSeenAt: string; online: boolean }[];
    events: { id: string; email: string; kind: "signed_in" | "signed_out"; at: string }[];
  } | null>(null);

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

  /*
   * Portal activity, refreshed on a timer so "online now" means now rather
   * than whenever this screen was opened. Thirty seconds against a two
   * minute window, so somebody arriving shows up well before they would
   * have been marked stale.
   */
  useEffect(() => {
    let live = true;
    const pull = async () => {
      try {
        const r = await fetch(`/api/admin/customers/${id}/activity`, { headers: await authHeader() });
        const j = await r.json();
        if (live && r.ok) setActivity(j);
      } catch {
        /* the rest of the record is more important than this card */
      }
    };
    void pull();
    const t = window.setInterval(pull, 30_000);
    return () => {
      live = false;
      window.clearInterval(t);
    };
  }, [id]);

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

  async function sendWelcome(email: string) {
    setSending(`welcome:${email}`);
    setNote("");
    setErr("");
    try {
      const r = await fetch(`/api/admin/customers/${id}/welcome-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ email }),
      });
      const j = await r.json();
      if (!r.ok) setErr(j.error ?? "Not sent.");
      else
        setNote(
          j.asTeammate
            ? `${email} got the invite${j.granted ? " and a seat on this account, everything switched on" : ""}. The owner can trim their access under Settings, Team.`
            : `Welcome sent to ${email}.`,
        );
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

  /*
   * Save without making anybody watch it happen.
   *
   * This used to write, then re-download the entire record: eleven queries
   * and the brand kit, to flip one switch. The write is about 140ms and the
   * reload behind it about 1.3 seconds, so every toggle on this screen cost
   * a second and a half of staring at a disabled control.
   *
   * Now the change lands in the UI immediately and the write goes out
   * behind it. `optimistic` is what to show at once; the server hands back
   * the real row and we settle on that, so a value the server massaged
   * (trimmed a tag, capped a list) still ends up correct without a refetch.
   *
   * Failure used to be silent. The old version swallowed the error and then
   * reloaded, so a save that failed looked like a switch that would not
   * stay put, with nothing said. It reverts and says so now.
   */
  async function patch(
    body: Record<string, unknown>,
    optimistic?: Partial<Record_["customer"]>,
  ) {
    const before = data;
    if (optimistic && data) {
      setData({ ...data, customer: { ...data.customer, ...optimistic } });
      setErr("");
    }
    try {
      const r = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { ...(await authHeader()), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        customer?: Partial<Record_["customer"]>;
        note?: Record_["notes"][number];
      };
      if (!r.ok) throw new Error(j.error ?? "That did not save.");

      setData((d) =>
        !d
          ? d
          : {
              ...d,
              customer: { ...d.customer, ...(j.customer ?? {}) },
              /* a new note arrives with its real id and date, so it can go
                 straight to the top of the list */
              notes: j.note ? [j.note, ...d.notes] : d.notes,
            },
      );
    } catch (e) {
      setData(before);
      const msg = e instanceof Error ? e.message : "That did not save.";
      errRef.current = msg;
      setErr(msg);
      return;
    }
    errRef.current = "";
  }

  async function addContact() {
    if (!contact?.name.trim()) return;
    /* close the dialog now. The person has finished typing and pressed save;
       holding the modal open through a round trip and then a full refetch is
       the wait this screen was full of. */
    const draft = contact;
    setContact(null);
    setErr("");
    try {
      const r = await fetch(`/api/admin/customers/${id}/contacts`, {
        method: "POST",
        headers: { ...(await authHeader()), "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        contact?: Record_["contacts"][number];
      };
      if (!r.ok || !j.contact) throw new Error(j.error ?? "Could not add them.");
      setData((d) => (d ? { ...d, contacts: [...d.contacts, j.contact!] } : d));
    } catch (e) {
      /* put their typing back in front of them rather than losing it */
      setContact(draft);
      setErr(e instanceof Error ? e.message : "Could not add them.");
    }
  }

  if (err) return <p className="text-body text-error">{err}</p>;
  if (!data) return <p className="text-body text-muted">Loading...</p>;

  const c = data.customer;
  const v = data.value;
  const title = c.company || c.name || c.email;
  const hidden = new Set(c.hiddenSections);
  const disabledSet = new Set(c.disabledSections);
  /* add-ons are extra work billed against a project, not projects of their
     own, so the tab counts what they actually bought */
  const projectOrders = data.orders.filter((o) => o.kind !== "addon");

  return (
    <div className="w-full">
      <Button variant="ghost" size="sm" icon={<ArrowLeft />} onClick={onBack}>
        All clients
      </Button>

      {/* who they are, and what they are worth */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-h3 text-ink">{title}</h1>
          <p className="mt-0.5 text-body-sm text-muted">
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
          {/* the client's portal, exactly as they see it. Read only, and it
              leaves nothing behind on their account. */}
          <Button
            variant="secondary"
            size="sm"
            icon={<Eye />}
            href={`/portal/?as=${encodeURIComponent(c.email)}`}
          >
            View their portal
          </Button>
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

      {/* One client is more than one screen. It all used to stack into a
          page where you scrolled past every order to reach the access
          controls, so it is grouped now: what they bought, what they got,
          what we have said, who can sign in, and who they are. The name and
          the money stay above the tabs, because they are the context for
          all five. */}
      <div className="mt-6">
        <Tabs
          tabs={[
            { key: "orders", label: "Orders", count: projectOrders.length },
            { key: "videos", label: "Videos", count: data.videos.length },
            { key: "messages", label: "Messages", count: data.conversations.length },
            { key: "access", label: "Access" },
            { key: "profile", label: "Profile" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "orders" && (
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3">
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
        </div>
      )}

      {tab === "videos" && (
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3">
          {/* videos */}
          <Card title={`Videos (${data.videos.length})`} padded={false}>
            <div className="px-5 pb-5">
              {data.videos.length === 0 ? (
                <p className="py-3 text-body-sm text-muted">
                  Nothing delivered yet.
                </p>
              ) : (
                <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
                  {data.videos.map((vd) => (
                    <li key={vd.id} className="flex items-center justify-between gap-3 text-body-sm">
                      <span className="min-w-0 truncate text-ink">{vd.title}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {/* this list used to be built from orders alone, so a
                            client with twenty videos on a plan looked like a
                            client with none. Saying where each came from is
                            the point of showing them together. */}
                        <span className="font-mono text-label uppercase text-dim">
                          {vd.source}
                        </span>
                        <Chip tone={vd.status === "approved" ? "good" : "info"}>
                          {vd.status.replace(/_/g, " ")}
                        </Chip>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "messages" && (
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_22rem] lg:items-start">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
            <Card title="Emails" description="What this person was sent, and what happened to each.">
              {/* the welcome, for accounts the studio created by hand: nothing
                  else ever tells these people their portal exists. A contact
                  gets a seat on the account first, then the invite. */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Select
                    value={welcomeTo || data.customer.email}
                    onChange={(e) => setWelcomeTo(e.target.value)}
                    aria-label="Who gets the welcome email"
                  >
                    <option value={data.customer.email}>{data.customer.email} (account)</option>
                    {data.contacts
                      .filter(
                        (ct) =>
                          ct.email &&
                          ct.email.toLowerCase() !== data.customer.email.toLowerCase(),
                      )
                      .map((ct) => (
                        <option key={ct.id} value={ct.email ?? ""}>
                          {ct.email} ({ct.name})
                        </option>
                      ))}
                  </Select>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={sending?.startsWith("welcome:") ?? false}
                  onClick={() => sendWelcome(welcomeTo || data.customer.email)}
                >
                  {sending?.startsWith("welcome:") ? "Sending..." : "Send welcome"}
                </Button>
              </div>
              {emails === null ? (
                <p className="text-body-sm text-muted">Loading...</p>
              ) : emails.length === 0 ? (
                <p className="text-body-sm text-muted">
                  Nothing recorded. The log started on 20 August 2026, so older
                  sends are not in it.
                </p>
              ) : (
                <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
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
          </div>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
            <Card title="Messages">
              {data.conversations.length === 0 ? (
                <p className="text-body-sm text-muted">No conversation yet.</p>
              ) : (
                /* the track has to be allowed to shrink, or the preview line,
                   which is nowrap so it can end in an ellipsis, sizes the
                   column to the whole message instead of being clipped by it */
                <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
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
          </div>
        </div>
      )}

      {tab === "access" && (
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_22rem] lg:items-start">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
            {/* the client's own portal team, managed from here when they ask us
                to do it for them. Same card and same routes their Settings
                screen uses, so a member we add is not a different kind of
                member. */}
            {/*
             * Who is in the portal right now, and who has been.
             *
             * Sits under Access because it answers the other half of the same
             * question: that card says who MAY sign in, this one says who
             * does. Deliberately its own card rather than a column on the
             * team rows, because TeamCard is shared with the client portal
             * and the partner portal, and neither of those should grow a
             * surveillance column.
             */}
            <Card
              title="Portal activity"
              description="Who is signed in now, and the sign ins before this one. Studio staff using View as client are never counted."
            >
              {!activity ? (
                <p className="text-body-sm text-muted">Loading...</p>
              ) : activity.people.length === 0 && activity.events.length === 0 ? (
                <p className="text-body-sm text-muted">
                  Nobody from this account has signed in yet.
                </p>
              ) : (
                <>
                  {activity.people.length > 0 && (
                    <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
                      {activity.people.map((p) => (
                        <li
                          key={p.email}
                          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              aria-hidden="true"
                              className={`h-2 w-2 shrink-0 rounded-full ${
                                p.online ? "bg-green" : "bg-hair"
                              }`}
                            />
                            <span className="min-w-0 truncate text-body-sm text-ink">
                              {p.email}
                            </span>
                          </span>
                          <span
                            className={`shrink-0 font-mono text-label uppercase ${
                              p.online ? "text-green" : "text-dim"
                            }`}
                          >
                            {p.online ? "In the portal now" : `last seen ${when(p.lastSeenAt)}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {activity.events.length > 0 && (
                    <div className={activity.people.length > 0 ? "mt-5 border-t border-hair pt-4" : ""}>
                      <p className="font-mono text-label uppercase tracking-[0.08em] text-dim">
                        The log
                      </p>
                      <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2">
                        {activity.events.map((e) => (
                          <li
                            key={e.id}
                            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
                          >
                            <span className="min-w-0 truncate text-body-sm text-muted">
                              {e.email}
                            </span>
                            <span className="shrink-0 font-mono text-label uppercase text-dim">
                              {e.kind === "signed_in" ? "signed in" : "signed out"} /{" "}
                              {when(e.at)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </Card>

            <TeamCard
              endpoint={`/api/admin/customers/${data.customer.id}/team`}
              accountType="customer"
              heading="Portal access"
              blurb="Who can sign in to this client's portal. The primary account holder is always in; anyone below is a teammate they added, or one you added for them. Each gets their own login and the updates for the areas they are granted."
              owner={{ email: data.customer.email, name: data.customer.name }}
            />

            {/* the access control Shariful asked for */}
            <Card title="What they see">
              <p className="text-body-sm text-muted">
                Visible is normal. Disabled stays in their menu but locked, with
                a note on hover, which says this exists and you do not have it.
                Hidden removes it entirely.
              </p>
              {/* shrinkable track again: each row's max-content is its label
                  plus the three-way switch on one line, and an `auto` track
                  would size to that instead of letting the label truncate */}
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2">
                {HIDEABLE_SECTIONS.map((s) => {
                  const state = hidden.has(s.key)
                    ? "hidden"
                    : disabledSet.has(s.key)
                      ? "disabled"
                      : "visible";
                  /* one home per key: choosing a state clears the other list,
                     so a section can never be hidden AND disabled at once */
                  const set = (next: "visible" | "disabled" | "hidden") => {
                    const hiddenNext = c.hiddenSections.filter((k) => k !== s.key);
                    const disabledNext = c.disabledSections.filter((k) => k !== s.key);
                    if (next === "hidden") hiddenNext.push(s.key);
                    if (next === "disabled") disabledNext.push(s.key);
                    void patch(
                    { hiddenSections: hiddenNext, disabledSections: disabledNext },
                    { hiddenSections: hiddenNext, disabledSections: disabledNext },
                  );
                  };
                  return (
                    <div key={s.key} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-body-sm text-ink">{s.label}</span>
                      <span className="flex shrink-0 overflow-hidden rounded-[6px] border border-hair">
                        {(
                          [
                            ["visible", "On"],
                            ["disabled", "Locked"],
                            ["hidden", "Off"],
                          ] as const
                        ).map(([k, label]) => (
                          <button
                            key={k}
                            type="button"
                              onClick={() => set(k)}
                            aria-pressed={state === k}
                            className={`tap px-2 py-1 font-mono text-label uppercase transition-colors ${
                              state === k
                                ? k === "visible"
                                  ? "bg-green/15 text-green"
                                  : k === "disabled"
                                    ? "bg-gold/15 text-gold"
                                    : "bg-hair/60 text-muted"
                                : "text-dim hover:text-ink"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
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
              <Modal open={!!contact} onClose={() => setContact(null)} title="Add a contact">
                {contact && (
                  <div className="grid gap-2">
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
                  <div className="flex justify-end gap-2 border-t border-hair pt-3">
                    <Button variant="ghost" size="sm" onClick={() => setContact(null)}>
                      Cancel
                    </Button>
                    <Button variant="brand" size="sm" disabled={!contact.name.trim()} onClick={addContact}>
                      Save
                    </Button>
                  </div>
                  </div>
                )}
              </Modal>
            </Card>

            {/* A commercial switch, not a visibility one, which is why it is
                its own card above the section toggles rather than a row in
                them. */}
            <Card title="Custom video">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-body-sm font-semibold text-ink">
                    Let them submit projects directly
                  </p>
                  <p className="mt-1 text-body-sm text-muted">
                    For accounts on a retainer, where the rate is already agreed.
                    They brief a video straight from their portal with a script
                    and it lands in the backlog, with no quote in between. Off,
                    they request a quote like everyone else.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={c.canSubmitProjects ? "brand" : "secondary"}
                  onClick={() =>
                    void patch(
                      { canSubmitProjects: !c.canSubmitProjects },
                      { canSubmitProjects: !c.canSubmitProjects },
                    )
                  }
                >
                  {c.canSubmitProjects ? "On" : "Off"}
                </Button>
              </div>
            </Card>

            <PartnershipPanel
              retainer={c.retainer}
              partnership={data.partnership}
              /* no optimistic value: the route answers with the parsed terms,
                 which is what every other screen will read */
              onSave={(terms) => patch({ retainer: terms })}
            />
          </div>
        </div>
      )}

      {tab === "profile" && (
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_22rem] lg:items-start">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
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
                  disabled={!note.trim()}
                  onClick={() => {
                    /* clear the box first. Making somebody watch their own
                       typing sit there while a request goes out is the same
                       wait as before, just in a smaller place. */
                    const text = note;
                    setNote("");
                    void patch({ note: text }).then(() => {
                      /* patch already showed the error; give them the words
                         back so the note is not lost with it */
                      if (errRef.current) setNote(text);
                    });
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
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
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
                  {(data.brandKit.logoDarkUrl || data.brandKit.logoLightUrl || data.brandKit.logoUrl) && (
                    <span className="mt-1 grid grid-cols-2 gap-2">
                      {(data.brandKit.logoDarkUrl || (!data.brandKit.logoLightUrl && data.brandKit.logoUrl)) && (
                        <span className="flex h-14 items-center justify-center rounded-[8px] border border-hair bg-white p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={data.brandKit.logoDarkUrl ?? data.brandKit.logoUrl ?? undefined}
                            alt="Dark logo on white"
                            className="max-h-full max-w-full object-contain"
                          />
                        </span>
                      )}
                      {data.brandKit.logoLightUrl && (
                        <span className="flex h-14 items-center justify-center rounded-[8px] border border-hair bg-[#08090D] p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={data.brandKit.logoLightUrl}
                            alt="White logo on dark"
                            className="max-h-full max-w-full object-contain"
                          />
                        </span>
                      )}
                    </span>
                  )}
                  {(data.brandKit.guidelines ?? []).length > 0 && (
                    <span className="mt-1 grid gap-1">
                      {(data.brandKit.guidelines ?? []).map((g) => (
                        <a
                          key={g.path}
                          href={g.url ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="tap truncate text-body-sm text-muted transition-colors hover:text-gold"
                        >
                          {g.name}
                        </a>
                      ))}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-body-sm text-muted">
                  No brand kit yet. Their first brief fills it.
                </p>
              )}
            </Card>

            <Card title="Tags">
              <div className="flex flex-wrap gap-1.5">
                {c.tags.length === 0 && <p className="text-body-sm text-muted">No tags yet.</p>}
                {c.tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                    void patch(
                      { tags: c.tags.filter((x) => x !== t) },
                      { tags: c.tags.filter((x) => x !== t) },
                    )
                  }
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
                  disabled={!tagDraft.trim()}
                  onClick={async () => {
                    await patch(
                      { tags: [...c.tags, tagDraft.trim()] },
                      { tags: [...c.tags, tagDraft.trim()] },
                    );
                    setTagDraft("");
                  }}
                >
                  Add
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

/*
 * The retainer partnership: the terms, this month's count, and every month
 * since it started.
 *
 * HighLevel was the first (September 2026). The terms are edited in a popup,
 * per the platform rule; the count is read from the jobs and never typed.
 */
function PartnershipPanel({
  retainer,
  partnership,
  onSave,
}: {
  retainer: Retainer | null;
  partnership: Record_["partnership"];
  onSave: (terms: Record<string, unknown> | null) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const blank = {
    name: "Retainer partnership",
    monthly: "",
    videosMin: "8",
    videosMax: "12",
    activeMax: "2",
    turnaroundDays: "3",
    whiteLabel: true,
    startedOn: `${new Date().toISOString().slice(0, 7)}-01`,
    checkInOn: "",
    note: "",
  };
  const [form, setForm] = useState(blank);
  const open = () => {
    setForm(
      retainer
        ? {
            name: retainer.name,
            monthly: String(retainer.monthlyCents / 100),
            videosMin: String(retainer.videosMin),
            videosMax: String(retainer.videosMax),
            activeMax: String(retainer.activeMax),
            turnaroundDays: String(retainer.turnaroundDays),
            whiteLabel: retainer.whiteLabel,
            startedOn: retainer.startedOn,
            checkInOn: retainer.checkInOn ?? "",
            note: retainer.note ?? "",
          }
        : blank,
    );
    setEditing(true);
  };
  const save = async () => {
    setBusy(true);
    await onSave({
      name: form.name,
      monthlyCents: Math.round(Number(form.monthly) * 100),
      videosMin: Number(form.videosMin),
      videosMax: Number(form.videosMax),
      activeMax: Number(form.activeMax),
      turnaroundDays: Number(form.turnaroundDays),
      whiteLabel: form.whiteLabel,
      startedOn: form.startedOn,
      checkInOn: form.checkInOn || null,
      note: form.note || null,
    });
    setBusy(false);
    setEditing(false);
  };
  const end = async () => {
    setBusy(true);
    await onSave(null);
    setBusy(false);
  };

  const thisMonth = partnership?.months[0] ?? null;
  const STATUS_WORD: Record<string, string> = {
    backlog: "waiting to start",
    planning: "in production",
    in_progress: "in production",
    review: "in review",
    revision: "in revision",
    approved: "delivered",
    cutdowns: "delivered, formats being cut",
    closed: "delivered",
    cancelled: "cancelled",
  };

  return (
    <Card
      title="Partnership"
      description={
        retainer
          ? `${money(retainer.monthlyCents)} a month, paid upfront on the first, for ${retainer.videosMin} to ${retainer.videosMax} videos.`
          : "A flat monthly fee for a number of videos a month. Work under it is never priced per job."
      }
      actions={
        <span className="flex gap-2">
          {retainer && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void end()}>
              End it
            </Button>
          )}
          <Button size="sm" variant={retainer ? "secondary" : "brand"} onClick={open}>
            {retainer ? "Edit terms" : "Set up a retainer"}
          </Button>
        </span>
      }
    >
      {retainer && thisMonth && (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: monthLabel(thisMonth.month),
                value: `${thisMonth.counted} of ${retainer.videosMin} to ${retainer.videosMax}`,
              },
              { label: "Delivered", value: String(thisMonth.delivered) },
              {
                label: "In production now",
                value: `${thisMonth.activeNow} of ${retainer.activeMax}`,
              },
              { label: "Small animations", value: `${thisMonth.animations} included` },
            ].map((f) => (
              <div key={f.label} className="rounded-[8px] border border-hair bg-canvas px-3 py-2.5">
                <p className="font-mono text-label uppercase tracking-[0.08em] text-dim">{f.label}</p>
                <p className="mt-1 font-display text-h4 tabular-nums text-ink">{f.value}</p>
              </div>
            ))}
          </div>

          <p className="text-body-sm text-muted">
            {retainer.turnaroundDays} business days from brief to delivery, {retainer.activeMax} in
            production at a time{retainer.whiteLabel ? ", a white-label version of every video" : ""}.
            Started {retainer.startedOn}
            {retainer.checkInOn ? `, next check-in ${retainer.checkInOn}` : ", no check-in date set"}.
            {retainer.note ? ` ${retainer.note}` : ""}
          </p>

          {partnership && partnership.jobs.length > 0 && (
            <Table>
              <thead>
                <tr>
                  <Th>Job</Th>
                  <Th>Month</Th>
                  <Th>Under the partnership as</Th>
                  <Th>Where it is</Th>
                </tr>
              </thead>
              <tbody>
                {partnership.jobs.map((j) => (
                  <tr key={j.id}>
                    <Td>{j.title}</Td>
                    <Td>{j.retainerMonth ? monthLabel(j.retainerMonth) : "not set"}</Td>
                    <Td>{j.retainerKind ? RETAINER_KIND_LABEL[j.retainerKind] : ""}</Td>
                    <Td>{STATUS_WORD[j.status] ?? j.status}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          {partnership && partnership.months.length > 1 && (
            <Table>
              <thead>
                <tr>
                  <Th>Month</Th>
                  <Th>Videos briefed</Th>
                  <Th>Delivered</Th>
                  <Th>Small animations</Th>
                </tr>
              </thead>
              <tbody>
                {partnership.months.map((m) => (
                  <tr key={m.month}>
                    <Td>{monthLabel(m.month)}</Td>
                    <Td>
                      {m.counted} of {retainer.videosMin} to {retainer.videosMax}
                    </Td>
                    <Td>{m.delivered}</Td>
                    <Td>{m.animations}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      )}

      <Modal open={editing} onClose={() => setEditing(false)} title={retainer ? "Retainer terms" : "Set up a retainer"}>
        {editing && (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="What their portal calls it" hint="Shown on their dashboard.">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Monthly fee" required hint="Dollars, paid upfront on the first.">
                <Input
                  type="number"
                  value={form.monthly}
                  onChange={(e) => setForm({ ...form, monthly: e.target.value })}
                  placeholder="11000"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Videos, from">
                <Input type="number" value={form.videosMin} onChange={(e) => setForm({ ...form, videosMin: e.target.value })} />
              </Field>
              <Field label="Videos, up to">
                <Input type="number" value={form.videosMax} onChange={(e) => setForm({ ...form, videosMax: e.target.value })} />
              </Field>
              <Field label="In production at once">
                <Input type="number" value={form.activeMax} onChange={(e) => setForm({ ...form, activeMax: e.target.value })} />
              </Field>
              <Field label="Business days each">
                <Input type="number" value={form.turnaroundDays} onChange={(e) => setForm({ ...form, turnaroundDays: e.target.value })} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Started on" hint="The first day of the first month.">
                <Input type="date" value={form.startedOn} onChange={(e) => setForm({ ...form, startedOn: e.target.value })} />
              </Field>
              <Field label="Next check-in" hint="Quarterly, if agreed. Optional.">
                <Input type="date" value={form.checkInOn} onChange={(e) => setForm({ ...form, checkInOn: e.target.value })} />
              </Field>
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 text-body-sm">
              <input
                type="checkbox"
                checked={form.whiteLabel}
                onChange={(e) => setForm({ ...form, whiteLabel: e.target.checked })}
                className="mt-0.5 size-4 shrink-0 accent-[color:var(--green)]"
              />
              <span className="text-muted">A white-label version of every video is included.</span>
            </label>
            <Field label="Note" hint="Anything else agreed. Shown here only.">
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2 border-t border-hair pt-4">
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button variant="brand" disabled={busy || !form.monthly} onClick={() => void save()}>
                {busy ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
