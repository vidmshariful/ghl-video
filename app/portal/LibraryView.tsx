"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ListChecks,
  PlayCircle,
  Search,
  Share2,
  ShoppingCart,
} from "lucide-react";
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
 * Two levels on purpose. The GRID is a calm shelf: posters, prices, and a
 * preview that plays on hover, because eighty videos all animating at once is
 * a wall of noise nobody can scan. The DETAIL is where intent goes: click any
 * card and it opens at /portal/library/<code>/ with a real player, and for a
 * pack or bundle, everything inside it. "12 videos" on a cover was the
 * argument for buying; the open pack is the proof.
 *
 * Every card is a real link. A founder deciding with a cofounder can send
 * them the exact pack, and middle-click works, because the fake-button card
 * that breaks both is the single most common marketplace mistake.
 *
 * Videos they already own are marked and sorted to the end rather than
 * hidden, and inside a pack each member they own is ticked: somebody who owns
 * nine of twelve wants to see exactly which three they are missing.
 */

type Member = {
  code: string;
  title: string;
  category: string | null;
  posterUrl: string | null;
  previewUrl: string | null;
  owned: boolean;
};

type Item = {
  code: string;
  title: string;
  subject: string | null;
  category: string | null;
  kind: "video" | "pack" | "bundle";
  videoCount: number | null;
  covers: string[];
  contains: string | null;
  members: Member[] | null;
  slots: { label: string; count: number }[] | null;
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

/** prefers-reduced-motion, live. Motion off means posters, not autoplay. */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/*
 * A preview that actually plays.
 *
 * The first version put the file in a <source> child with preload="none" and
 * called play() once on hover. Chrome's power saver is allowed to interrupt
 * exactly that call, and did, which is why the library looked like it played
 * nothing. This one holds src on the element, and when play() is refused it
 * waits for canplay and tries once more, but only while the pointer is still
 * on the card. Nothing loads until first hover, so browsing stays light.
 */
function PreviewVideo({
  src,
  poster,
  active,
  className,
}: {
  src: string;
  poster: string | null;
  active: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const wanted = useRef(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    wanted.current = active;
    if (!active) {
      v.pause();
      v.currentTime = 0;
      return;
    }
    v.muted = true;
    v.play().catch(() => {
      const retry = () => {
        if (wanted.current) v.play().catch(() => {});
      };
      v.addEventListener("canplay", retry, { once: true });
      if (v.readyState === 0) v.load();
    });
  }, [active]);

  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      /* no poster means the tile would sit pure black until hover, which on
         the dark skin reads as a hole; metadata fetches just enough for the
         browser to paint the first frame as its own cover */
      preload={poster ? "none" : "metadata"}
      poster={poster ?? undefined}
      className={className ?? "h-full w-full object-cover"}
    />
  );
}

/*
 * The cover of a pack or a bundle on the shelf.
 *
 * A collection has no footage of its own, so left alone it rendered as an
 * empty black rectangle, and it was the $1,595 items that looked emptiest.
 * Where we know the members, their stills are the cover. Where we do not,
 * the number is the cover: seventy nine videos is the entire argument.
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

/* One shelf card. The stretched link opens the detail; the Order button sits
 * above it, so buying stays one click for somebody already decided. */
function VideoCard({
  item,
  reduced,
  onOpen,
  picking = false,
  picked = false,
}: {
  item: Item;
  reduced: boolean;
  onOpen: (code: string) => void;
  /* while picking, the card toggles instead of opening */
  picking?: boolean;
  picked?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const isCollection = item.kind !== "video";
  /* while picking, the whole card is a toggle, so it says so */
  const openLabel = picking
    ? picked
      ? `Remove ${item.title} from your list`
      : `Add ${item.title} to your list`
    : `Open ${item.title}`;

  return (
    <div
      data-picking={picking ? "true" : undefined}
      className={`group relative flex h-full flex-col overflow-hidden rounded-[12px] border bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-[0_14px_34px_-16px_rgba(0,0,0,0.55)] focus-within:border-gold/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
        picked ? "border-gold" : "border-hair"
      }`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="relative aspect-video bg-ground-deep">
        {isCollection ? (
          <CollectionCover item={item} />
        ) : item.previewUrl && !reduced ? (
          <>
            <PreviewVideo src={item.previewUrl} poster={item.posterUrl} active={hover} />
            {/* says "this plays" without a click; steps aside while it does */}
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-200 ${hover ? "opacity-0" : "opacity-100"}`}
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-canvas/60 text-ink backdrop-blur-sm">
                <PlayCircle size={20} />
              </span>
            </span>
          </>
        ) : item.posterUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={item.posterUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-dim">
            <PlayCircle size={28} aria-hidden="true" />
          </div>
        )}
        {item.owned && (
          <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-full bg-chrome px-2.5 py-1 font-mono text-label uppercase text-chrome-text">
            <Check size={11} aria-hidden="true" /> Yours
          </span>
        )}
        {isCollection && item.covers.length >= 4 && item.videoCount && (
          <span className="absolute bottom-2 right-2 z-10 rounded-full bg-chrome px-2.5 py-1 font-mono text-label uppercase text-chrome-text">
            {item.videoCount} videos
          </span>
        )}
      </div>

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

        <div className="relative z-10 mt-auto pt-3">
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
              href={`/checkout/${item.code}/`}
            >
              Order now
            </Button>
          )}
        </div>
      </div>

      {/* the stretched link: the whole card opens the detail, as a real URL */}
      <a
        href={`/portal/library/${item.code}/`}
        aria-label={openLabel}
        className="absolute inset-0 z-[5] rounded-[12px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gold"
        onClick={(e) => {
          /* modified clicks keep native behaviour: new tab, window, download */
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          onOpen(item.code);
        }}
      />
    </div>
  );
}

/*
 * The open item: a real player and, for a collection, everything inside it.
 *
 * A pack has no footage of its own, so its player IS its members: click any
 * video inside and it plays up top. That turns "12 videos included" from a
 * claim into something a buyer can flip through, which is the whole reason
 * this view exists.
 */
function ItemDetail({
  item,
  reduced,
  onBack,
}: {
  item: Item;
  reduced: boolean;
  onBack: () => void;
}) {
  const playable = (item.members ?? []).filter((m) => m.previewUrl);
  const [playing, setPlaying] = useState<Member | null>(playable[0] ?? null);
  /* reopening a different item resets the hero to its first playable member */
  useEffect(() => {
    setPlaying(((item.members ?? []).filter((m) => m.previewUrl))[0] ?? null);
  }, [item.code, item.members]);

  const heroSrc = item.kind === "video" ? item.previewUrl : (playing?.previewUrl ?? null);
  const heroPoster = item.kind === "video" ? item.posterUrl : (playing?.posterUrl ?? null);

  return (
    <div>
      <Button variant="ghost" size="sm" icon={<ArrowLeft />} onClick={onBack}>
        Back to the library
      </Button>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-[12px] border border-hair bg-ground-deep">
            {heroSrc ? (
              <video
                key={heroSrc}
                src={heroSrc}
                poster={heroPoster ?? undefined}
                controls
                autoPlay={!reduced}
                muted
                playsInline
                className="aspect-video w-full bg-black object-contain"
              />
            ) : (
              <div className="aspect-video">
                <CollectionCover item={item} />
              </div>
            )}
          </div>
          {item.kind !== "video" && playing && (
            <p className="mt-2 truncate font-mono text-label uppercase text-dim">
              Playing: {playing.title}
            </p>
          )}

          {/* what is inside, by name */}
          {item.members && item.members.length > 0 && (
            <div className="mt-6">
              <h2 className="font-display text-h4 text-ink">
                The {item.members.length} videos inside
              </h2>
              <p className="mt-1 text-body-sm text-muted">
                Click any of them to watch its preview above.
                {item.members.some((m) => m.owned)
                  ? " Ones you already own are ticked."
                  : ""}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                {item.members.map((m) => {
                  const current = playing?.code === m.code;
                  return (
                    <button
                      key={m.code}
                      type="button"
                      disabled={!m.previewUrl}
                      onClick={() => m.previewUrl && setPlaying(m)}
                      aria-pressed={current}
                      className={`group/m overflow-hidden rounded-[8px] border text-left transition-colors ${
                        current
                          ? "border-gold"
                          : "border-hair hover:border-gold/50 disabled:cursor-default disabled:hover:border-hair"
                      }`}
                    >
                      <div className="relative aspect-video bg-ground-deep">
                        {m.posterUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={m.posterUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center text-dim">
                            <PlayCircle size={20} aria-hidden="true" />
                          </div>
                        )}
                        {m.owned && (
                          <span className="absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-chrome text-chrome-text">
                            <Check size={11} aria-hidden="true" />
                          </span>
                        )}
                      </div>
                      <p className="truncate px-2.5 py-2 text-body-sm font-medium text-ink">
                        {m.title}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* a bundle whose contents the buyer picks: show the shape honestly */}
          {!item.members?.length && item.slots && item.slots.length > 0 && (
            <div className="mt-6">
              <h2 className="font-display text-h4 text-ink">
                What the {item.videoCount} videos are
              </h2>
              <p className="mt-1 text-body-sm text-muted">
                You choose the exact videos after checkout, from the whole
                library, guided by these slots. Your brand goes on every one.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {item.slots.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center justify-between rounded-[8px] border border-hair bg-surface px-4 py-3"
                  >
                    <span className="text-body-sm font-medium text-ink">{s.label}</span>
                    <span className="font-mono text-body-sm font-semibold tabular-nums text-ink">
                      x {s.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* the buying column, sticky so the action never scrolls away */}
        <div className="lg:sticky lg:top-20">
          <Card>
            <p className="font-mono text-label uppercase text-dim">
              {item.code.toUpperCase()}
              {item.category ? ` / ${item.category}` : ""}
            </p>
            <h1 className="mt-1.5 font-display text-h3 text-ink">{item.title}</h1>
            {item.subject && <p className="mt-2 text-body-sm text-muted">{item.subject}</p>}

            <div className="mt-4 flex items-baseline justify-between border-t border-hair pt-4">
              <span className="text-body-sm text-muted">
                {item.videoCount ? `${item.videoCount} videos` : "One video"}
              </span>
              <span className="font-mono text-h3 font-semibold tabular-nums text-ink">
                {money(item.priceCents)}
              </span>
            </div>
            {item.videoCount && item.videoCount > 1 && (
              <p className="mt-1 text-right font-mono text-label uppercase text-dim">
                {money(Math.round(item.priceCents / item.videoCount))} per video
              </p>
            )}

            <div className="mt-4">
              {item.owned ? (
                <Button variant="ghost" full disabled>
                  Already yours
                </Button>
              ) : (
                <Button variant="brand" full icon={<ShoppingCart />} href={`/checkout/${item.code}/`}>
                  Order now
                </Button>
              )}
            </div>
            <p className="mt-3 text-body-sm text-dim">
              Delivered with your logo, your colours and your platform on
              screen. Not a template with a watermark.
            </p>
          </Card>
        </div>
      </div>

    </div>
  );
}

export function LibraryView({
  authedFetch,
  openCode,
  onOpenItem,
}: {
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  /** the item open at /portal/library/<code>/, or null for the shelf */
  openCode: string | null;
  onOpenItem: (code: string | null) => void;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "video" | "pack" | "bundle">("all");
  const [category, setCategory] = useState<string>("all");
  const reduced = useReducedMotion();

  /* picking a few to send somebody */
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [shareHref, setShareHref] = useState("");
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const pickedTotal = (items ?? [])
    .filter((i) => picked.includes(i.code))
    .reduce((sum, i) => sum + i.priceCents, 0);

  async function share() {
    setSharing(true);
    setCopied(false);
    try {
      const j = (await authedFetch("/api/portal/lists", {
        method: "POST",
        body: JSON.stringify({ codes: picked }),
      })) as { href?: string };
      if (j.href) setShareHref(`${window.location.origin}${j.href}`);
    } catch {
      /* the button simply does not resolve into a link */
    } finally {
      setSharing(false);
    }
  }

  useEffect(() => {
    authedFetch("/api/portal/library/")
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

  if (!items) return <p className="text-body text-muted">Loading the library...</p>;

  /* the open item, resolved from the URL segment; unknown codes fall back to
   * the shelf rather than a dead end */
  const open = openCode ? (items.find((i) => i.code === openCode.toLowerCase()) ?? null) : null;
  if (openCode && open) {
    return (
      <ItemDetail item={open} reduced={reduced} onBack={() => onOpenItem(null)} />
    );
  }

  const ownedCount = items.filter((i) => i.owned).length;

  return (
    <div>
      <PageHeader
        title="Video Library"
        description={
          ownedCount
            ? `What you have not bought yet. The ${ownedCount} you own are in My Videos.`
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

      {/*
        * Picking, and sending the picks to whoever has to agree.
        *
        * A founder choosing six videos is very often not the only person
        * deciding, and until now the only way to show a cofounder was a
        * screenshot. Turning picking on is deliberately a choice rather than
        * always-on: somebody browsing for one video should not have to think
        * about a list.
        */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          variant={picking ? "primary" : "secondary"}
          size="sm"
          icon={<ListChecks />}
          onClick={() => {
            setPicking((v) => !v);
            if (picking) setPicked([]);
          }}
        >
          {picking ? "Done picking" : "Pick a few to share"}
        </Button>
        {picking && (
          <>
            <span className="font-mono text-label uppercase text-dim">
              {picked.length === 0
                ? "Tap the videos you are considering"
                : `${picked.length} picked, ${money(pickedTotal)}`}
            </span>
            {picked.length > 0 && (
              <Button variant="brand" size="sm" icon={<Share2 />} onClick={share} disabled={sharing}>
                {sharing ? "Making the link..." : "Share the list"}
              </Button>
            )}
          </>
        )}
      </div>

      {shareHref && (
        <div className="mb-4">
          <Card tone="dark" title="Send them this link">
            <p className="text-body-sm text-chrome-muted">
              It shows what you picked and what it comes to, and nothing else.
              They do not need an account. Either of you can order from it, or
              ask us to invoice the set.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-[8px] border border-chrome-line bg-chrome-2 px-3 py-2 font-mono text-body-sm text-chrome-text">
                {shareHref}
              </code>
              <Button
                variant="brand"
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(shareHref);
                  setCopied(true);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </Card>
        </div>
      )}

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
            <VideoCard
              key={i.code}
              item={i}
              reduced={reduced}
              picking={picking}
              picked={picked.includes(i.code)}
              onOpen={
                picking
                  ? (code) =>
                      setPicked((p) =>
                        p.includes(code) ? p.filter((c) => c !== code) : [...p, code],
                      )
                  : onOpenItem
              }
            />
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
