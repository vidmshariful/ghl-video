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

type Video = {
  id: string;
  title: string;
  status: string;
  canReview: boolean;
  due?: { text: string; tone: string };
};

type Group = { orderId: string; productName: string; videos: Video[] };

/** The one thing worth doing next, and where it goes. */
type NextAction =
  | { kind: "brief"; order: OrderSummary }
  | { kind: "watch"; video: Video; orderId: string }
  | { kind: "waiting"; soonest: string | null }
  | { kind: "nothing" };

export function DashboardView({
  firstName,
  subtitle,
  can,
  authedFetch,
  onOpenOrder,
  onGo,
}: {
  firstName: string | null;
  /** who they are, or whose portal they are working in */
  subtitle: string;
  can: (key: string) => boolean;
  authedFetch: (path: string) => Promise<Record<string, unknown>>;
  onOpenOrder: (id: string) => void;
  onGo: (section: string) => void;
}) {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const canOrders = can("orders");

  useEffect(() => {
    if (!canOrders) {
      setOrders([]);
      setGroups([]);
      return;
    }
    authedFetch("/api/portal/orders")
      .then((j) => setOrders((j.orders as OrderSummary[]) ?? []))
      .catch(() => setOrders([]));
    authedFetch("/api/portal/videos")
      .then((j) => setGroups((j.groups as Group[]) ?? []))
      .catch(() => setGroups([]));
  }, [canOrders, authedFetch]);

  const loading = orders === null || groups === null;
  const list = orders ?? [];
  const allVideos = (groups ?? []).flatMap((g) =>
    g.videos.map((v) => ({ ...v, orderId: g.orderId })),
  );

  /* Ready for them, waiting on them, being made. Everything on this screen
   * derives from these three, so they are worked out once. */
  const ready = allVideos.filter((v) => v.canReview);
  const needsBrief = list.filter((o) => o.status === "paid" && !o.intakeCompleted);
  const inProduction = allVideos.filter(
    (v) => !v.canReview && v.status !== "approved" && v.status !== "delivered",
  );

  const next: NextAction = needsBrief.length
    ? { kind: "brief", order: needsBrief[0] }
    : ready.length
      ? { kind: "watch", video: ready[0], orderId: ready[0].orderId }
      : inProduction.length
        ? {
            kind: "waiting",
            soonest:
              inProduction.map((v) => v.due?.text).find((t) => t && /Expected/.test(t)) ?? null,
          }
        : { kind: "nothing" };

  const count = (n: number) => (loading ? "-" : String(n));

  return (
    <div>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
        description={subtitle}
      />

      {canOrders && (
        <CardGrid min="15rem">
          <Stat
            label="Ready to watch"
            value={count(ready.length)}
            hint={ready.length ? "Waiting for your approval" : "Nothing to review right now"}
          />
          <Stat
            label="Waiting on you"
            value={count(needsBrief.length)}
            hint={needsBrief.length ? "We cannot start without these" : "Nothing needed from you"}
          />
          <Stat
            label="Being made"
            value={count(inProduction.length)}
            hint={inProduction.length ? "In the studio now" : "Nothing in production"}
          />
        </CardGrid>
      )}

      {/* The single most useful next thing. One card, one action. */}
      {!loading && canOrders && (
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
                <Button variant="brand" icon={<PlayCircle />} onClick={() => onGo("videos")}>
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

      {/* Recent orders. A short list, not the whole history. */}
      {canOrders && (
        <div className="mt-6">
          {loading ? (
            <p className="text-body text-muted">Loading...</p>
          ) : list.length === 0 ? (
            <EmptyState
              icon={<PlayCircle />}
              title="No orders yet"
              description="When you order a video, it appears here with everything you need to follow it."
              action={
                <Button variant="brand" onClick={() => onGo("orders")}>
                  Browse videos
                </Button>
              }
            />
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
                          {o.status === "paid" && !o.intakeCompleted ? (
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
