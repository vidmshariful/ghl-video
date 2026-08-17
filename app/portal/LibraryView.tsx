"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, PlayCircle, Search, ShoppingCart } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Tabs,
  Toolbar,
} from "@/components/portal/ui";

/*
 * The library: everything we sell, inside the portal.
 *
 * The premade page on the main site was doing two jobs at once, pitching and
 * listing, and did neither well. This does one: it is for somebody who has
 * already decided to buy and is choosing what.
 *
 * Videos they already own are marked and sorted to the end rather than
 * hidden. Hiding them would make the collection look smaller than it is, and
 * somebody who owns nine of a pack wants to see the three they are missing
 * beside the nine they have.
 */

type Item = {
  code: string;
  title: string;
  subject: string | null;
  category: string | null;
  kind: "video" | "pack" | "bundle";
  /* packs and bundles only: how many videos, their member stills, and the
   * headline of what is inside */
  videoCount: number | null;
  covers: string[];
  contains: string | null;
  priceCents: number;
  posterUrl: string | null;
  previewUrl: string | null;
  featured: boolean;
  owned: boolean;
};

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });

/*
 * The cover of a pack or a bundle.
 *
 * A collection has no footage of its own, so left alone it rendered as an
 * empty black rectangle, and it was the $1,595 items that looked emptiest.
 * Where we know the members, their stills are the cover. Where we do not,
 * because the customer picks the videos at intake, the number is the cover:
 * seventy nine videos is the entire argument for buying one, and it was the
 * one thing the card was not saying.
 */
function CollectionCover({ item }: { item: Item }) {
  if (item.covers.length >= 4) {
    return (
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-hair">
        {item.covers.slice(0, 4).map((src, n) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img key={n} src={src} alt="" className="h-full w-full object-cover" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-chrome px-4 text-center">
      <p className="font-display text-stat-lg leading-none text-chrome-text">
        {item.videoCount ?? "?"}
      </p>
      <p className="mt-1 font-mono text-label uppercase text-chrome-muted">videos</p>
      {item.contains && (
        <p className="mt-2 line-clamp-2 text-body-sm text-chrome-muted">{item.contains}</p>
      )}
    </div>
  );
}

/* One card. The preview plays on hover, which is the closest thing to
 * picking a video up and looking at it. */
function VideoCard({ item, onOrder }: { item: Item; onOrder: (code: string) => void }) {
  const vid = useRef<HTMLVideoElement>(null);
  const isCollection = item.kind !== "video";

  return (
    <div
      className={`group flex h-full flex-col overflow-hidden rounded-[12px] border bg-surface transition-colors ${
        item.owned ? "border-hair" : "border-hair hover:border-gold/50"
      }`}
      onMouseEnter={() => vid.current?.play().catch(() => {})}
      onMouseLeave={() => {
        if (!vid.current) return;
        vid.current.pause();
        vid.current.currentTime = 0;
      }}
    >
      <div className="relative aspect-video bg-ground-deep">
        {isCollection ? (
          <CollectionCover item={item} />
        ) : item.previewUrl ? (
          <video
            ref={vid}
            muted
            loop
            playsInline
            preload="none"
            poster={item.posterUrl ?? undefined}
            className="h-full w-full object-cover"
          >
            <source src={item.previewUrl} type="video/mp4" />
          </video>
        ) : item.posterUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={item.posterUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-dim">
            <PlayCircle size={28} aria-hidden="true" />
          </div>
        )}
        {item.owned && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-chrome px-2.5 py-1 font-mono text-label uppercase text-chrome-text">
            <Check size={11} aria-hidden="true" /> Yours
          </span>
        )}
        {/* the mosaic shows the videos but not how many, so the count is
            stated over it; the panel cover already says it in full */}
        {isCollection && item.covers.length >= 4 && item.videoCount && (
          <span className="absolute bottom-2 right-2 rounded-full bg-chrome px-2.5 py-1 font-mono text-label uppercase text-chrome-text">
            {item.videoCount} videos
          </span>
        )}
      </div>

      {/* flex-1 with the button on mt-auto, so the buttons line up across a
          row whether a title runs to one line or two */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="line-clamp-2 text-body-sm font-semibold text-ink">{item.title}</p>
            <p className="mt-0.5 truncate font-mono text-label uppercase text-dim">
              {item.code.toUpperCase()} /{" "}
              {item.videoCount ? `${item.videoCount} videos` : (item.category ?? item.kind)}
            </p>
          </div>
          <span className="shrink-0 font-mono text-body-sm font-semibold tabular-nums text-ink">
            {money(item.priceCents)}
          </span>
        </div>

        <div className="mt-auto pt-3">
          {item.owned ? (
            <Button variant="ghost" size="sm" full disabled>
              Already yours
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              full
              icon={<ShoppingCart />}
              onClick={() => onOrder(item.code)}
            >
              Order now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function LibraryView({
  authedFetch,
}: {
  authedFetch: (path: string) => Promise<Record<string, unknown>>;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "video" | "pack" | "bundle">("all");
  const [category, setCategory] = useState<string>("all");

  useEffect(() => {
    authedFetch("/api/portal/library")
      .then((j) => setItems((j.items as Item[]) ?? []))
      .catch(() => setItems([]));
  }, [authedFetch]);

  /* Only the categories that exist inside the tab you are on. Offering
   * "Marketing" while looking at bundles would be a filter that can only ever
   * empty the screen. */
  const categories = useMemo(
    () =>
      [
        ...new Set(
          (items ?? [])
            .filter((i) => kind === "all" || i.kind === kind)
            .map((i) => i.category)
            .filter((c): c is string => Boolean(c)),
        ),
      ].sort(),
    [items, kind],
  );

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (items ?? []).filter(
      (i) =>
        (kind === "all" || i.kind === kind) &&
        (category === "all" || i.category === category) &&
        (!term ||
          i.title.toLowerCase().includes(term) ||
          i.code.toLowerCase().includes(term) ||
          (i.subject ?? "").toLowerCase().includes(term) ||
          (i.category ?? "").toLowerCase().includes(term)),
    );
  }, [items, q, kind, category]);

  const order = (code: string) => {
    window.location.href = `/checkout/${code}/`;
  };

  if (!items) return <p className="text-body text-muted">Loading the library...</p>;

  const ownedCount = items.filter((i) => i.owned).length;

  return (
    <div>
      <PageHeader
        title="Video Library"
        description={
          ownedCount
            ? `Everything we make. You already own ${ownedCount}, marked and moved to the end.`
            : "Every video, pack and bundle we make. Your brand goes on whichever you choose."
        }
      >
        <Tabs
          tabs={[
            { key: "all" as const, label: "Everything", count: items.length },
            { key: "video" as const, label: "Videos", count: items.filter((i) => i.kind === "video").length },
            { key: "pack" as const, label: "Packs", count: items.filter((i) => i.kind === "pack").length },
            { key: "bundle" as const, label: "Bundles", count: items.filter((i) => i.kind === "bundle").length },
          ]}
          active={kind}
          onChange={(k) => {
            setKind(k);
            setCategory("all"); // the old category may not exist in the new tab
          }}
        />
      </PageHeader>

      <Toolbar
        right={
          categories.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant={category === "all" ? "primary" : "secondary"}
                onClick={() => setCategory("all")}
              >
                All types
              </Button>
              {categories.map((c) => (
                <Button
                  key={c}
                  size="sm"
                  variant={category === c ? "primary" : "secondary"}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </Button>
              ))}
            </div>
          ) : undefined
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
            placeholder="Search by name, code or type"
            className="pl-9"
          />
        </div>
      </Toolbar>

      {shown.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="Nothing matches that"
          description="Try a different word, or clear the filters to see everything."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQ("");
                setKind("all");
                setCategory("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((i) => (
            <VideoCard key={i.code} item={i} onOrder={order} />
          ))}
        </div>
      )}

      <Card className="mt-6" title="Not seeing what you need?">
        <p className="text-body-sm text-muted">
          We make custom videos to order. Tell us what you are trying to explain
          and we will quote it.
        </p>
      </Card>
    </div>
  );
}
