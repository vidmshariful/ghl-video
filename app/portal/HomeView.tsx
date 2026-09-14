"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, PageHeader, Row, Rows, Section, Status, Strip } from "@/components/portal/ui";
import { PartnershipCard, type Partnership } from "@/components/portal/PartnershipCard";
import { FeedbackAsk, OfferSlot, type FeedbackAskData, type Offer } from "./DashboardView";
import { LINE_WORD, projectWord, summarySentence, videoWord, type Line } from "@/lib/work-words";
import type { WorkLine } from "./sections";

/*
 * Home (phase 6, the portal blueprint of 13 September 2026).
 *
 * The screen answers one question, what now, in this order: a greeting
 * that says how much needs them, the things that need them with one action
 * each, what is in the studio with the word for where it stands, one quiet
 * strip for the month, and where to get more. Rows, not tiles; a dot and a
 * word, not a chip; one gold action on the whole screen.
 */

type OrderSummary = {
  id: string;
  productName: string | null;
  status: string;
  stage: string;
  intakeCompleted: boolean;
  kind?: "invoice" | "premade";
};
type Video = { id: string; title: string; status: string; canReview: boolean; due?: { text: string; tone: string } };
type Group = { orderId: string; productName: string; line?: Line; videos: Video[] };
type Placed = Video & { line: Line; groupName: string };
type Project = { id: string; title: string; open: boolean; status?: string; pipeline?: { ball?: string | null; current?: string | null } };
type Invoice = { id: string; number: string | null; totalCents: number; settled: boolean; voided: boolean; payUrl: string | null };
type Quote = { id: string; number: string; title: string; totalCents: number; open: boolean };

const money = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;

function greeting(name: string | null): string {
  const h = new Date().getHours();
  const word = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return name ? `${word}, ${name}.` : `${word}.`;
}

export function HomeView({
  firstName,
  subtitle,
  can,
  has,
  isOwner,
  showOffers,
  authedFetch,
  onOpenOrder,
  onOpenVideo,
  onOpenProject,
  onGo,
  otherAccounts = [],
  onSwitchAccount,
}: {
  firstName: string | null;
  subtitle: string;
  can: (key: string) => boolean;
  has: (key: string) => boolean;
  isOwner: boolean;
  showOffers: boolean;
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onOpenOrder: (id: string) => void;
  onOpenVideo: (line: string, videoId: string) => void;
  onOpenProject: (id: string) => void;
  /** a section, or an old section name: the shell resolves it */
  onGo: (key: string, line?: WorkLine) => void;
  otherAccounts?: { ownerEmail: string; ownerName: string | null }[];
  onSwitchAccount?: (ownerEmail: string) => void;
}) {
  const canOrders = can("orders");
  const hasPremade = has("videos") && canOrders;
  const hasCustom = has("projects") && canOrders;
  const hasEditing = has("subscriptions") && can("subscriptions");

  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [partnership, setPartnership] = useState<Partnership | null>(null);
  const [plan, setPlan] = useState<{ spent: number; allowed: number; name: string } | null>(null);
  const [brandReady, setBrandReady] = useState<boolean | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [ask, setAsk] = useState<FeedbackAskData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    if (!canOrders) {
      setOrders([]);
      setGroups([]);
      setBrandReady(true);
      return;
    }
    authedFetch("/api/portal/orders").then((j) => setOrders((j.orders as OrderSummary[]) ?? [])).catch(() => setOrders([]));
    authedFetch("/api/portal/videos").then((j) => setGroups((j.groups as Group[]) ?? [])).catch(() => setGroups([]));
    authedFetch("/api/portal/brand-kit")
      .then((j) => setBrandReady(Boolean((j.completeness as { ready?: boolean } | null)?.ready)))
      .catch(() => setBrandReady(true));
    authedFetch("/api/portal/campaign").then((j) => setOffer((j.campaign as Offer | null) ?? null)).catch(() => setOffer(null));
    authedFetch("/api/portal/feedback").then((j) => setAsk((j.ask as FeedbackAskData | null) ?? null)).catch(() => setAsk(null));
    authedFetch("/api/portal/invoices").then((j) => setInvoices((j.invoices as Invoice[]) ?? [])).catch(() => setInvoices([]));
    authedFetch("/api/portal/quotes").then((j) => setQuotes((j.quotes as Quote[]) ?? [])).catch(() => setQuotes([]));
  }, [canOrders, authedFetch]);
  useEffect(() => {
    if (!hasCustom) return;
    authedFetch("/api/portal/projects")
      .then((j) => {
        setPartnership((j.partnership as Partnership | null | undefined) ?? null);
        setProjects((j.projects as Project[] | undefined) ?? []);
      })
      .catch(() => setProjects([]));
  }, [hasCustom, authedFetch]);
  useEffect(() => {
    if (!hasEditing) return;
    authedFetch("/api/portal/plan")
      .then((j) => {
        const p = j.plan as { planName: string; credits: { spent: number; allowed: number } } | null | undefined;
        setPlan(p ? { spent: p.credits.spent, allowed: p.credits.allowed, name: p.planName } : null);
      })
      .catch(() => setPlan(null));
  }, [hasEditing, authedFetch]);

  const loading = orders === null || groups === null;
  const videos: Placed[] = useMemo(
    () => (groups ?? []).flatMap((g) => g.videos.map((v) => ({ ...v, line: (g.line ?? "premade") as Line, groupName: g.productName }))),
    [groups],
  );
  const shelfOrders = (orders ?? []).filter((o) => o.kind !== "invoice");
  const needsBrief = shelfOrders.filter((o) => o.status === "paid" && !o.intakeCompleted);
  const ready = videos.filter((v) => v.canReview);
  const needsFootage = videos.filter((v) => v.line === "editing" && v.due?.tone === "waiting");
  const inStudio = videos.filter((v) => !v.canReview && v.status !== "approved" && v.status !== "delivered" && v.status !== "cancelled");
  const openProjects = projects.filter((p) => p.open);
  const projectsOnThem = openProjects.filter((p) => p.pipeline?.ball === "client");
  const projectsOnUs = openProjects.filter((p) => p.pipeline?.ball !== "client");
  const owed = invoices.filter((i) => !i.settled && !i.voided);
  const openQuotes = quotes.filter((q) => q.open);
  const hasWork = shelfOrders.length > 0 || videos.length > 0 || openProjects.length > 0;
  const brandMissing = brandReady === false && hasWork;

  const youCount = needsBrief.length + ready.length + needsFootage.length + projectsOnThem.length + owed.length + openQuotes.length + (brandMissing ? 1 : 0);
  const usCount = inStudio.length + projectsOnUs.length;
  const delivered = videos.filter((v) => v.line === "premade" && v.status === "approved").length;

  /* one gold action on the whole screen: the line's own next thing */
  const primary = hasEditing
    ? { label: "Request an edit", run: () => onGo("work", "editing") }
    : hasCustom
      ? { label: "Open my projects", run: () => onGo("work", "custom") }
      : { label: "Browse the library", run: () => onGo("library") };

  return (
    <div>
      <PageHeader
        title={greeting(firstName)}
        description={loading ? subtitle : `${summarySentence({ you: youCount, us: usCount })} ${subtitle ? "" : ""}`.trim()}
        actions={
          canOrders ? (
            <Button variant="brand" onClick={primary.run}>
              {primary.label}
            </Button>
          ) : undefined
        }
      />

      {partnership && (
        <div className="mb-6">
          <PartnershipCard p={partnership} />
        </div>
      )}

      {otherAccounts.length > 0 && onSwitchAccount && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-gold/40 bg-gold/[0.06] px-4 py-3">
          <p className="text-body-sm text-ink">
            You are in your own account.{" "}
            {otherAccounts.length === 1
              ? `You also have access to ${otherAccounts[0].ownerName || otherAccounts[0].ownerEmail}'s portal.`
              : "You also have access to other portals."}
          </p>
          <div className="flex flex-wrap gap-2">
            {otherAccounts.map((a) => (
              <Button key={a.ownerEmail} size="sm" variant="secondary" onClick={() => onSwitchAccount(a.ownerEmail)}>
                Go to {a.ownerName || a.ownerEmail}
              </Button>
            ))}
          </div>
        </div>
      )}

      {canOrders && (
        <Section title="Needs you" count={loading ? undefined : youCount} first>
          {loading ? (
            <p className="text-body-sm text-muted">Loading...</p>
          ) : youCount === 0 ? (
            <p className="text-body-sm text-muted">Nothing needs you right now. We will email you the moment something does.</p>
          ) : (
            <Rows>
              {openQuotes.map((q) => (
                <Row
                  key={`q-${q.id}`}
                  title={q.title}
                  meta={`Quote ${q.number} / ${money(q.totalCents)}`}
                  status={<Status tone="gold">A quote to accept or decline</Status>}
                  action={
                    <Button size="sm" variant="secondary" onClick={() => onGo("billing")}>
                      Read it
                    </Button>
                  }
                />
              ))}
              {needsBrief.map((o) => (
                <Row
                  key={`b-${o.id}`}
                  title={o.productName ?? "Your order"}
                  meta="Pre-made / paid, waiting on your brief"
                  status={<Status tone="gold">Nothing starts until the brief lands</Status>}
                  action={
                    <Button size="sm" variant="secondary" onClick={() => onOpenOrder(o.id)}>
                      Send the brief
                    </Button>
                  }
                />
              ))}
              {ready.map((v) => (
                <Row
                  key={`r-${v.id}`}
                  title={v.title}
                  meta={`${LINE_WORD[v.line]} / ${v.groupName}`}
                  status={<Status tone="gold">Ready to watch. Approve it, or tell us what to change.</Status>}
                  action={
                    <Button size="sm" variant="secondary" onClick={() => onOpenVideo(v.line, v.id)}>
                      Watch
                    </Button>
                  }
                />
              ))}
              {needsFootage.map((v) => (
                <Row
                  key={`f-${v.id}`}
                  title={v.title}
                  meta={`Editing / ${v.groupName}`}
                  status={<Status tone="gold">The footage link does not open. Send a fresh one and the clock restarts.</Status>}
                  action={
                    <Button size="sm" variant="secondary" onClick={() => onOpenVideo(v.line, v.id)}>
                      Fix the link
                    </Button>
                  }
                />
              ))}
              {projectsOnThem.map((p) => (
                <Row
                  key={`p-${p.id}`}
                  title={p.title}
                  meta="Custom"
                  status={<Status tone="gold">{projectWord(p.status ?? "in_progress", "client", p.pipeline?.current ?? null).client}</Status>}
                  action={
                    <Button size="sm" variant="secondary" onClick={() => onOpenProject(p.id)}>
                      Review
                    </Button>
                  }
                />
              ))}
              {owed.map((i) => (
                <Row
                  key={`i-${i.id}`}
                  title={`Invoice ${i.number ?? ""}`.trim()}
                  meta={`${money(i.totalCents)} outstanding`}
                  status={<Status tone="gold">Waiting on payment</Status>}
                  action={
                    i.payUrl ? (
                      <Button size="sm" variant="secondary" href={i.payUrl}>
                        Pay it
                      </Button>
                    ) : undefined
                  }
                />
              ))}
              {brandMissing && (
                <Row
                  title="Your brand kit"
                  meta="Logo, colours, how your name is said"
                  status={<Status tone="gold">Every video uses it. Two minutes, once.</Status>}
                  action={
                    <Button size="sm" variant="secondary" onClick={() => onGo("brand")}>
                      Add it
                    </Button>
                  }
                />
              )}
            </Rows>
          )}
        </Section>
      )}

      {canOrders && (
        <Section
          title="In the studio"
          count={loading ? undefined : usCount}
          action={
            hasWork ? (
              <Button size="sm" variant="ghost" onClick={() => onGo("work")}>
                All my work
              </Button>
            ) : undefined
          }
        >
          {loading ? (
            <p className="text-body-sm text-muted">Loading...</p>
          ) : usCount === 0 ? (
            hasWork ? (
              <p className="text-body-sm text-muted">Nothing is in production right now.</p>
            ) : (
              <p className="text-body-sm text-muted">
                When you order a video, start a custom project or join an editing plan, it appears here with everything you need to follow it.
              </p>
            )
          ) : (
            <Rows>
              {inStudio.map((v) => (
                <Row
                  key={`s-${v.id}`}
                  title={v.title}
                  meta={`${LINE_WORD[v.line]} / ${v.groupName}${v.due?.text ? ` / ${v.due.text}` : ""}`}
                  status={<Status tone="blue">{videoWord(v.status, v.line).client}</Status>}
                  onClick={() => onOpenVideo(v.line, v.id)}
                />
              ))}
              {projectsOnUs.map((p) => (
                <Row
                  key={`u-${p.id}`}
                  title={p.title}
                  meta="Custom"
                  status={<Status tone="blue">{projectWord(p.status ?? "in_progress", "us", p.pipeline?.current ?? null).client}</Status>}
                  onClick={() => onOpenProject(p.id)}
                />
              ))}
            </Rows>
          )}
        </Section>
      )}

      {canOrders && !loading && (hasEditing || hasCustom || hasPremade) && (
        <div className="mt-10">
          <Strip
            items={[
              ...(hasEditing && plan
                ? [{ label: `Editing, ${new Date().toLocaleDateString("en-US", { month: "long" })}`, value: `${plan.spent} of ${plan.allowed}`, hint: "credits used", onClick: () => onGo("work", "editing") }]
                : []),
              ...(hasCustom
                ? [{ label: "Custom", value: String(openProjects.length), hint: openProjects.length === 1 ? "project in production" : "projects in production", onClick: () => onGo("work", "custom") }]
                : []),
              ...(hasPremade
                ? [{ label: "Pre-made", value: String(delivered), hint: delivered === 1 ? "video delivered" : "videos delivered", onClick: () => onGo("work", "premade") }]
                : []),
            ]}
          />
        </div>
      )}

      {!loading && ask && youCount === 0 && (
        <div className="mt-10">
          <FeedbackAsk ask={ask} authedFetch={authedFetch} onDone={() => setAsk(null)} />
        </div>
      )}
      {!loading && offer && youCount === 0 && (
        <div className="mt-10">
          <OfferSlot offer={offer} />
        </div>
      )}

      {/* where to get more: the store and, for an owner who should see them, the offers */}
      {(has("library") || has("book") || has("coming-soon") || (isOwner && showOffers)) && (
        <Section title="Get more">
          <Rows>
            {has("library") && canOrders && (
              <Row title="Browse the library" meta="Every pre-made video, ready to order" onClick={() => onGo("library")} />
            )}
            {has("coming-soon") && <Row title="Coming soon" meta="What we are making next" onClick={() => onGo("coming-soon")} />}
            {has("book") && <Row title="Book a call" meta="Custom video, scoped live" onClick={() => onGo("book")} />}
            {isOwner && showOffers && has("affiliate") && (
              <Row title="Affiliate program" meta="Earn on every client you send us" onClick={() => onGo("affiliate")} />
            )}
            {isOwner && showOffers && has("whitelabel") && (
              <Row title="White-label" meta="Our studio, your brand" onClick={() => onGo("whitelabel")} />
            )}
            {isOwner && showOffers && has("socialx") && <Row title="SocialX" meta="Social content, monthly" onClick={() => onGo("socialx")} />}
          </Rows>
        </Section>
      )}

      {!canOrders && (
        <p className="text-body-sm text-muted">
          Your account does not have access to orders. Whoever invited you can change that under Settings, Team.
        </p>
      )}
    </div>
  );
}
