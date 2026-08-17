"use client";

import { useEffect, useState } from "react";
import { Clapperboard, ShoppingCart, ThumbsUp } from "lucide-react";
import { Button, Card, CardGrid, EmptyState, PageHeader } from "@/components/portal/ui";

/*
 * The upcoming shelf: what the studio is making next, and a way to say
 * "this one first".
 *
 * A vote is not decoration. The counts order the studio's queue by people
 * who intend to pay, and when a video ships, its voters are the list of
 * people to tell first. The optional note is where "yes but for dentists"
 * lives, which is usually worth more than the vote itself.
 *
 * A priced upcoming video can be preordered through the normal checkout;
 * the money path does not fork for this. No price, no button: the vote is
 * the whole offer.
 */

type Upcoming = {
  code: string;
  title: string;
  subject: string | null;
  category: string | null;
  posterUrl: string | null;
  votes: number;
  voted: boolean;
  preorderCents: number | null;
};

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });

function UpcomingCard({
  item,
  onVote,
}: {
  item: Upcoming;
  onVote: (code: string, note?: string) => Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[12px] border border-hair bg-surface">
      <div className="relative aspect-video bg-ground-deep">
        {item.posterUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={item.posterUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-dim">
            <Clapperboard size={26} aria-hidden="true" />
            <span className="font-mono text-label uppercase">In the studio</span>
          </div>
        )}
        {item.votes > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-chrome px-2.5 py-1 font-mono text-label uppercase text-chrome-text">
            {item.votes} waiting
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-body-sm font-semibold text-ink">{item.title}</p>
        <p className="mt-0.5 truncate font-mono text-label uppercase text-dim">
          {item.code.toUpperCase()}
          {item.category ? ` / ${item.category}` : ""}
        </p>
        {item.subject && <p className="mt-2 text-body-sm text-muted">{item.subject}</p>}

        {asking ? (
          <div className="mt-3">
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything we should know? Your niche, the angle you need."
              className="w-full rounded-[8px] border border-hair bg-canvas px-3 py-2 text-body-sm text-ink placeholder:text-dim/70 focus:border-gold focus:outline-none"
            />
            <div className="mt-2 flex gap-2">
              <Button
                variant="brand"
                size="sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onVote(item.code, note.trim() || undefined);
                  setBusy(false);
                  setAsking(false);
                }}
              >
                {busy ? "Saving..." : "Count me in"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAsking(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-auto flex flex-wrap gap-2 pt-3">
            {item.voted ? (
              <Button variant="ghost" size="sm" disabled icon={<ThumbsUp />}>
                You are on the list
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                icon={<ThumbsUp />}
                onClick={() => setAsking(true)}
              >
                I want this first
              </Button>
            )}
            {item.preorderCents != null && (
              <Button
                variant="primary"
                size="sm"
                icon={<ShoppingCart />}
                href={`/checkout/${item.code}/`}
              >
                Preorder, {money(item.preorderCents)}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ComingSoonView({
  authedFetch,
}: {
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
}) {
  const [items, setItems] = useState<Upcoming[] | null>(null);

  const load = () =>
    authedFetch("/api/portal/coming-soon/")
      .then((j) => setItems((j.items as Upcoming[]) ?? []))
      .catch(() => setItems([]));

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authedFetch]);

  async function vote(code: string, note?: string) {
    await authedFetch("/api/portal/coming-soon/", {
      method: "POST",
      body: JSON.stringify({ code, ...(note ? { note } : {}) }),
    }).catch(() => ({}));
    await load();
  }

  if (!items) return <p className="text-body text-muted">Loading...</p>;

  return (
    <div>
      <PageHeader
        title="Coming Soon"
        description="What the studio is making next. Tell us which one you need and we make it sooner."
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<Clapperboard />}
          title="Nothing queued right now"
          description="New videos land here before they launch. When one is up, you can claim it first."
        />
      ) : (
        <CardGrid min="17rem">
          {items.map((i) => (
            <UpcomingCard key={i.code} item={i} onVote={vote} />
          ))}
        </CardGrid>
      )}

      <Card className="mt-6" title="Need something that is not on the list?">
        <p className="text-body-sm text-muted">
          We make custom videos to order. Book a call and tell us what you are
          trying to explain.
        </p>
      </Card>
    </div>
  );
}
