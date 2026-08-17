"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  BOARDS,
  boardById,
  boardCss,
  checksFor,
  scoreBoard,
  type Board,
} from "@/components/uikits/boards";
import { KitPage, KitSection, Note } from "@/components/uikits/kit";

/*
 * The board layer. Real pages, rendered in a frame with the board's tokens
 * injected, so a direction is judged against the actual site rather than
 * against a mockup of it.
 *
 * Two things this does NOT do, both learned the hard way:
 *
 * 1. It does not hot-swap tokens on a live document. Changing a custom
 *    property at runtime does not drive transition-colors, so every element
 *    carrying it keeps its old paint until the next style recalc and reads
 *    as broken. Each board change reloads the frame instead.
 * 2. It does not touch production code. The board is injected into a
 *    same-origin frame from outside, so nothing that ships knows the kit
 *    or the boards exist.
 */

const PAGES = [
  { path: "/", label: "Home" },
  { path: "/premade", label: "Premade library" },
  { path: "/custom-video", label: "Custom video" },
  { path: "/editing", label: "Editing plans" },
  { path: "/work", label: "Work" },
  { path: "/quote", label: "Quote form" },
  { path: "/uikits/primitives", label: "Kit: primitives" },
  { path: "/uikits/patterns", label: "Kit: patterns" },
] as const;

const WIDTHS = [
  { w: 1280, label: "Desktop" },
  { w: 768, label: "Tablet" },
  { w: 390, label: "Phone" },
] as const;

function Preview({
  board,
  path,
  width,
}: {
  board: Board;
  path: string;
  width: number;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);

  /* Inject at load, with transitions suppressed for one frame so the board
   * is what the page paints first rather than something it animates toward. */
  const onLoad = useCallback(() => {
    const f = ref.current;
    if (!f) return;
    const d = f.contentDocument;
    if (!d) return;

    const freeze = d.createElement("style");
    freeze.textContent =
      "*,*::before,*::after{transition:none!important;animation-duration:0s!important}";
    d.head.appendChild(freeze);

    const skin = d.createElement("style");
    skin.setAttribute("data-board", board.id);
    skin.textContent = boardCss(board);
    d.head.appendChild(skin);

    /* Lift the freeze on a timer, NOT on requestAnimationFrame: rAF does not
     * fire while the tab is in the background, so a frame that finished
     * loading in a hidden tab stayed frozen and hidden forever. A timer is
     * throttled in the background but always fires. 60ms is past first paint
     * and under anything a person notices. */
    window.setTimeout(() => {
      freeze.remove();
      setLoading(false);
    }, 60);
  }, [board]);

  /* Safety net: if onLoad never fires at all (a frame that errors, a route
   * that hangs), do not leave a permanently blank panel with no explanation. */
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 4000);
    return () => window.clearTimeout(t);
  }, [board, path, width]);

  /* key on board + path so a change remounts the frame: a reload, not a swap */
  return (
    <div className="relative overflow-hidden rounded-[4px] border border-[var(--kit-line)] bg-[var(--kit-panel)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--kit-line)] px-4 py-2">
        <span className="text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--kit-text)]">
          {board.name.toUpperCase()}
        </span>
        <span className="text-[0.625rem] text-[var(--kit-dim)]">
          {path} &middot; {width}px
        </span>
      </div>
      <div className="overflow-x-auto">
        <div style={{ width, maxWidth: "none" }}>
          {loading ? (
            <div className="flex h-[560px] items-center justify-center text-[0.75rem] text-[var(--kit-dim)]">
              painting {board.name}...
            </div>
          ) : null}
          <iframe
            ref={ref}
            key={`${board.id}:${path}:${width}`}
            src={path}
            title={`${board.name} on ${path}`}
            onLoad={onLoad}
            style={{
              width,
              height: 560,
              border: 0,
              display: loading ? "none" : "block",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Swatches({ board }: { board: Board }) {
  const keys = [
    "canvas",
    "surface",
    "card",
    "hair",
    "ground-deep",
    "ground-mid",
    "ground-top",
    "text",
    "muted",
    "dim",
  ];
  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
      {keys.map((k) => (
        <div key={k} className="min-w-0">
          <div
            className="h-9 w-full rounded-[3px] border border-[var(--kit-line)]"
            style={{ background: board.tokens[k] }}
          />
          <div className="mt-1 truncate text-[0.5625rem] text-[var(--kit-dim)]" title={k}>
            {k}
          </div>
        </div>
      ))}
    </div>
  );
}

function Contrast({ board }: { board: Board }) {
  const checks = checksFor(board);
  const { failures, checked, weakest } = scoreBoard(board);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span
          className="rounded-[3px] px-2 py-0.5 text-[0.6875rem] font-semibold tracking-[0.1em] text-[#08090d]"
          style={{ background: failures ? "var(--kit-warn)" : "var(--green)" }}
        >
          {failures ? `${failures} BELOW BAR` : "ALL PASS"}
        </span>
        <span className="text-[0.75rem] text-[var(--kit-dim)]">
          {checked} binding pairs. Weakest: {weakest.fg} on {weakest.bg} at{" "}
          {weakest.ratio.toFixed(2)}.
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
        {checks.map((c) => (
          <div
            key={c.fg + c.bg}
            className="flex items-baseline justify-between gap-2 rounded-[3px] border border-[var(--kit-line)] px-2.5 py-1.5"
            style={{
              borderLeft: `2px solid ${
                c.advisory
                  ? "var(--kit-line)"
                  : c.pass
                    ? "var(--green)"
                    : "var(--kit-warn)"
              }`,
            }}
          >
            <span className="truncate text-[0.6875rem] text-[var(--kit-text)]">
              {c.fg} on {c.bg}
              {c.advisory ? (
                <span className="text-[var(--kit-dim)]"> (advisory)</span>
              ) : null}
            </span>
            <span className="shrink-0 text-[0.6875rem] tabular-nums text-[var(--kit-dim)]">
              {c.ratio.toFixed(2)}
              <span className="opacity-60"> /{c.bar}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BoardsClient() {
  const [boardId, setBoardId] = useState("graphite");
  const [path, setPath] = useState<string>("/");
  const [width, setWidth] = useState<number>(1280);
  const [compare, setCompare] = useState(true);

  const board = boardById(boardId);
  const current = boardById("current");

  /* remember the last pick across reloads: this is a tool, not a page */
  useEffect(() => {
    const saved = localStorage.getItem("uikit:board");
    if (saved) setBoardId(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem("uikit:board", boardId);
  }, [boardId]);

  const pill =
    "rounded-[3px] border px-3 py-1.5 text-[0.75rem] transition-colors";
  const on = "border-[var(--kit-accent)] text-[var(--kit-text)]";
  const off =
    "border-[var(--kit-line)] text-[var(--kit-dim)] hover:text-[var(--kit-text)]";

  return (
    <KitPage
      title="Concept boards"
      lede="Alternate directions for the look and feel, applied to the real site. A board is a set of token overrides injected into the page at first paint, so what you are looking at is what the site would become, not a mockup of it."
    >
      <KitSection title="Pick a direction" count={`${BOARDS.length} boards`}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {BOARDS.map((b) => (
              <button
                key={b.id}
                onClick={() => setBoardId(b.id)}
                className={`${pill} ${b.id === boardId ? on : off}`}
              >
                {b.name}
              </button>
            ))}
          </div>
          <p className="max-w-[72ch] text-[0.8125rem] leading-relaxed text-[var(--kit-dim)]">
            {board.blurb}
          </p>
          <Swatches board={board} />
        </div>
      </KitSection>

      <KitSection
        title="Contrast under this board"
        note="The same bar the live system was tuned to clear, recomputed for the board's own grounds. Small text needs 4.5, large text and UI edges need 3. A board that fails here is not a candidate, however good it looks."
      >
        <Contrast board={board} />
      </KitSection>

      <KitSection title="On the real site">
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {PAGES.map((p) => (
              <button
                key={p.path}
                onClick={() => setPath(p.path)}
                className={`${pill} ${p.path === path ? on : off}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {WIDTHS.map((w) => (
              <button
                key={w.w}
                onClick={() => setWidth(w.w)}
                className={`${pill} ${w.w === width ? on : off}`}
              >
                {w.label}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-[var(--kit-line)]" />
            <button
              onClick={() => setCompare((c) => !c)}
              className={`${pill} ${compare ? on : off}`}
            >
              {compare ? "Comparing with current" : "Board only"}
            </button>
          </div>
        </div>

        <div className={compare ? "grid grid-cols-1 gap-4 xl:grid-cols-2" : ""}>
          {compare && board.id !== "current" ? (
            <Preview board={current} path={path} width={width} />
          ) : null}
          <Preview board={board} path={path} width={width} />
        </div>
      </KitSection>

      <Note>
        Each frame reloads when you change board, page or width, rather than
        restyling in place. That is deliberate: swapping a custom property on
        a live document does not drive a CSS colour transition, so every
        element carrying transition-colors would keep its old paint and the
        board would look broken in ways the board is not responsible for.
      </Note>

      <Note tone="warn">
        Boards move the room, not the brand. Gold, blue and green are
        pixel-exact from the logo and stay fixed across all three, which is
        why the accents look identical and only the ground moves. Changing
        them is possible and is a much bigger decision, since the mark stops
        matching the site.
      </Note>
    </KitPage>
  );
}
