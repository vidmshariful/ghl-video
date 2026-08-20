"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clapperboard,
  FileText,
  LibraryBig,
  MessageSquare,
  Search,
  ShoppingCart,
  Sparkles,
} from "lucide-react";

/*
 * One search box for the whole portal.
 *
 * The portal grew into eleven screens, and finding a thing meant knowing
 * which one it was filed under: a question about how we built the product
 * rather than about their video. It gets worse every month, because the
 * subscription exists to produce fifty videos a year.
 *
 * Opens on the key everybody already tries, closes on Escape, and the
 * keyboard drives the list, because somebody who reaches for a shortcut does
 * not then want a mouse.
 */

type Hit = {
  id: string;
  kind: "video" | "order" | "project" | "invoice" | "library" | "message";
  title: string;
  meta: string;
  section: string;
  focus?: string;
  line?: string;
};

const ICON: Record<Hit["kind"], React.ReactNode> = {
  video: <Clapperboard />,
  project: <Sparkles />,
  order: <ShoppingCart />,
  invoice: <FileText />,
  library: <LibraryBig />,
  message: <MessageSquare />,
};

export function PortalSearch({
  authedFetch,
  onOpen,
}: {
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  onOpen: (hit: Hit) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  /* the shortcut everybody already tries */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
    else {
      setQ("");
      setHits([]);
      setCursor(0);
    }
  }, [open]);

  const run = useCallback(
    async (term: string) => {
      if (term.trim().length < 2) {
        setHits([]);
        return;
      }
      setBusy(true);
      const j = await authedFetch(`/api/portal/search?q=${encodeURIComponent(term)}`).catch(
        () => null,
      );
      setHits((j?.hits as Hit[]) ?? []);
      setCursor(0);
      setBusy(false);
    },
    [authedFetch],
  );

  /* typed-through rather than per-keystroke: a search that fires on every
   * letter spends most of its requests on words nobody finished */
  useEffect(() => {
    const t = setTimeout(() => void run(q), 180);
    return () => clearTimeout(t);
  }, [q, run]);

  function choose(h: Hit) {
    setOpen(false);
    onOpen(h);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search your portal"
        className="tap flex items-center gap-2 rounded-[8px] border border-chrome-line bg-chrome-2 px-2.5 py-1.5 text-chrome-muted transition-colors hover:border-gold/50 hover:text-chrome-text sm:px-3"
      >
        <Search size={15} aria-hidden="true" />
        <span className="hidden text-body-sm sm:inline">Search</span>
        <span className="hidden rounded-[3px] border border-chrome-line px-1 font-mono text-label md:inline">
          ⌘K
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close search"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-canvas/80"
          />
          <div className="portal-sheet absolute inset-x-0 top-0 mx-auto mt-[8vh] w-[min(38rem,calc(100%-2rem))] overflow-hidden rounded-[12px] border border-chrome-line bg-chrome shadow-2xl">
            <div className="flex items-center gap-2.5 border-b border-chrome-line px-4 py-3">
              <Search size={16} className="shrink-0 text-chrome-dim" aria-hidden="true" />
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setCursor((c) => Math.min(c + 1, hits.length - 1));
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setCursor((c) => Math.max(c - 1, 0));
                  }
                  if (e.key === "Enter" && hits[cursor]) choose(hits[cursor]);
                }}
                placeholder="Find a video, an order, an invoice, anything"
                aria-label="Search your portal"
                className="w-full bg-transparent text-body text-chrome-text placeholder:text-chrome-dim focus:outline-none"
              />
              {busy && <span className="font-mono text-label uppercase text-chrome-dim">...</span>}
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-1.5">
              {q.trim().length < 2 ? (
                <p className="px-3 py-6 text-center text-body-sm text-chrome-dim">
                  Type at least two letters. This looks across your videos, orders,
                  invoices, projects, messages and the library.
                </p>
              ) : hits.length === 0 && !busy ? (
                <p className="px-3 py-6 text-center text-body-sm text-chrome-dim">
                  Nothing matches {`"${q}"`}.
                </p>
              ) : (
                <ul className="grid gap-0.5">
                  {hits.map((h, i) => (
                    <li key={`${h.kind}-${h.id}`}>
                      <button
                        type="button"
                        onMouseEnter={() => setCursor(i)}
                        onClick={() => choose(h)}
                        className={`tap flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left transition-colors ${
                          i === cursor ? "bg-chrome-2" : "hover:bg-chrome-2/60"
                        }`}
                      >
                        <span
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-[6px] border border-chrome-line [&>svg]:h-[14px] [&>svg]:w-[14px] ${
                            i === cursor ? "text-gold" : "text-chrome-dim"
                          }`}
                        >
                          {ICON[h.kind]}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body-sm text-chrome-text">
                            {h.title}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-label uppercase text-chrome-dim">
                            {h.meta}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
