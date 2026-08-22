"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileText } from "lucide-react";
import { Button, Card, Chip, Input, Select, Textarea } from "@/components/portal/ui";

/*
 * The style guide WE wrote, read by the client.
 *
 * Two pieces. In the sidebar it is a small card: which version, when it
 * landed, a glimpse of the first page, and a way in. The reading itself
 * happens full screen, the same as reviewing a cut, because a document meant
 * to be read does not belong squeezed into a column above a form.
 *
 * Feedback is pinned to a page the way video feedback is pinned to a second,
 * because "the page with the colours" is not a page number and everyone
 * loses a round of changes to it. We reply underneath and mark a note done
 * rather than deleting it, so what was asked for stays readable afterwards.
 */

type Note = {
  id: string;
  page: number | null;
  side: "client" | "studio";
  name: string;
  body: string;
  parentId: string | null;
  resolvedAt: string | null;
  at: string;
};

type Doc = {
  id: string;
  version: number;
  filename: string;
  sizeBytes: number | null;
  note: string | null;
  createdAt: string;
  url: string | null;
  hosted?: "ours" | "linked";
};

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const size = (n: number | null) =>
  n ? (n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`) : "";

/* the browser's own viewer, with its chrome turned off for the thumbnail */
const clean = (url: string, page?: number) =>
  `${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH${page ? `&page=${page}` : ""}`;

/* Supabase takes a download hint on a signed url; a link elsewhere does not,
   so it opens in a tab and the reader saves it from there */
const saveHref = (d: Doc) =>
  d.url && d.hosted === "ours" ? `${d.url}&download=${encodeURIComponent(d.filename)}` : d.url;

export function StyleGuideDoc({
  authedFetch,
}: {
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
}) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [notes, setNotes] = useState<Record<string, Note[]>>({});
  const [showing, setShowing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const j = (await authedFetch("/api/portal/style-guide-doc").catch(() => null)) as {
      docs?: Doc[];
      notes?: Record<string, Note[]>;
    } | null;
    setDocs(j?.docs ?? []);
    setNotes(j?.notes ?? {});
    setShowing((s) => s ?? j?.docs?.[0]?.id ?? null);
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!docs) return null;

  if (!docs.length)
    return (
      <Card title="Your style guide">
        <p className="text-body-sm text-muted">
          We are still writing yours. It is the visual guide we build from your
          brand and work to on every video, and it lands here for you to read
          and mark up when it is ready.
        </p>
      </Card>
    );

  const doc = docs.find((d) => d.id === showing) ?? docs[0];
  const mine = (notes[doc.id] ?? []).filter((n) => !n.parentId);
  const openCount = mine.filter((n) => !n.resolvedAt).length;

  return (
    <>
      <Card title="Your style guide">
        <p className="text-body-sm text-muted">
          The visual guide we made you, and work to on every video.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip tone="good">Version {doc.version}</Chip>
          {openCount > 0 && <Chip tone="info">{openCount} open</Chip>}
          <span className="font-mono text-label uppercase text-dim">
            {when(doc.createdAt)}
            {size(doc.sizeBytes) ? ` / ${size(doc.sizeBytes)}` : ""}
          </span>
        </div>

        {/* a glimpse of the first page, not a reading experience: it is here
            to say "this is the thing", and the button does the rest */}
        {doc.url ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Open the style guide, version ${doc.version}`}
            className="tap group relative mt-3 block h-40 w-full overflow-hidden rounded-[8px] border border-hair bg-card transition-colors hover:border-gold/60"
          >
            <iframe
              src={clean(doc.url, 1)}
              title=""
              aria-hidden="true"
              tabIndex={-1}
              scrolling="no"
              className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
              style={{ width: "250%", height: "250%", transform: "scale(0.4)" }}
            />
            {/* always on top, small and out of the way: it labels the preview
                where the page draws, and carries the box on its own where it
                does not. Mobile Safari in particular will not draw a PDF in a
                frame this size, and an unexplained empty panel reads as a
                fault rather than a document. */}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-canvas/80 py-1.5 font-mono text-label uppercase tracking-[0.08em] text-muted backdrop-blur-[2px]">
              <FileText size={12} aria-hidden="true" />
              Open the guide
            </span>
            <span className="pointer-events-none absolute inset-0 bg-canvas/0 transition-colors group-hover:bg-canvas/20" />
          </button>
        ) : (
          <p className="mt-3 text-body-sm text-error">
            This file has gone missing. Tell us and we will put it back.
          </p>
        )}

        <div className="mt-3 grid gap-2">
          <Button variant="brand" size="sm" full onClick={() => setOpen(true)}>
            Read it and give feedback
          </Button>
          {saveHref(doc) && (
            <Button variant="ghost" size="sm" full href={saveHref(doc) as string} target="_blank">
              Download
            </Button>
          )}
        </div>
      </Card>

      {open && (
        <FullScreen
          docs={docs}
          doc={doc}
          notes={notes}
          onPick={setShowing}
          onClose={() => setOpen(false)}
          onChanged={load}
          authedFetch={authedFetch}
        />
      )}
    </>
  );
}

/* ---------------- reading it properly ---------------- */

/*
 * Full screen, over everything, the same shape a cut is reviewed in: the
 * document big on one side, what has been said about it down the other, and
 * a way out in the corner.
 */
function FullScreen({
  docs,
  doc,
  notes,
  onPick,
  onClose,
  onChanged,
  authedFetch,
}: {
  docs: Doc[];
  doc: Doc;
  notes: Record<string, Note[]>;
  onPick: (id: string) => void;
  onClose: () => void;
  onChanged: () => Promise<void>;
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
}) {
  const [page, setPage] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [jump, setJump] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  /* escape closes it, the way every other overlay here behaves */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  const mine = (notes[doc.id] ?? []).filter((n) => !n.parentId);
  const repliesTo = (id: string) => (notes[doc.id] ?? []).filter((n) => n.parentId === id);
  const latest = docs[0].id === doc.id;

  async function send() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setErr("");
    try {
      const j = (await authedFetch("/api/portal/style-guide-doc", {
        method: "POST",
        body: JSON.stringify({
          docId: doc.id,
          page: page ? Number(page) : null,
          body: text,
        }),
      })) as { ok?: boolean; error?: string };
      if (j.error) return setErr(j.error);
      setBody("");
      setPage("");
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-canvas/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Style guide, version ${doc.version}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex min-h-full items-start justify-center p-3 sm:p-6"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="w-full max-w-[1600px] rounded-[12px] border border-hair bg-surface p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-h3 leading-tight text-ink">Your style guide</h2>
              <p className="mt-1 font-mono text-label uppercase tracking-[0.1em] text-dim">
                Version {doc.version}
                {latest ? " / current" : " / older version"} / {when(doc.createdAt)}
              </p>
            </div>
            <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
              {docs.length > 1 && (
                <Select
                  value={doc.id}
                  onChange={(e) => {
                    onPick(e.target.value);
                    setJump(0);
                  }}
                  aria-label="Which version"
                  /* full width on a phone, where a fixed width pushes the
                     header off the edge of the panel */
                  className="w-full sm:w-auto"
                >
                  {docs.map((d) => (
                    <option key={d.id} value={d.id}>
                      Version {d.version}
                      {docs[0].id === d.id ? " (current)" : ""}
                    </option>
                  ))}
                </Select>
              )}
              {saveHref(doc) && (
                <a
                  href={saveHref(doc) as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap rounded-[8px] border border-hair px-3 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-blue/60 hover:text-blue"
                >
                  Download
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="tap rounded-[8px] border border-hair px-3 py-1.5 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
              >
                Close
              </button>
            </div>
          </div>

          {doc.note && <p className="mb-3 text-body-sm text-muted">{doc.note}</p>}

          <div className="grid gap-4 lg:grid-cols-[1fr_22rem] lg:items-start">
            {doc.url ? (
              <div className="overflow-hidden rounded-[8px] border border-hair bg-canvas">
                <iframe
                  key={`${doc.id}-${jump}`}
                  src={doc.url + (jump > 0 ? `#page=${jump}` : "")}
                  title={`Style guide, version ${doc.version}`}
                  /* shorter on a phone so the notes are not a screen and a
                     half below the thing they are about */
                  className="h-[58vh] w-full border-0 sm:h-[78vh]"
                />
              </div>
            ) : (
              <p className="text-body-sm text-error">
                This file has gone missing. Tell us and we will put it back.
              </p>
            )}

            <div className="grid gap-3">
              <div>
                <p className="font-mono text-label uppercase tracking-[0.08em] text-muted">
                  What you want changed
                </p>
                {mine.length === 0 ? (
                  <p className="mt-2 text-body-sm text-muted">
                    Nothing yet. Say the page and what is wrong with it, and we
                    will answer here.
                  </p>
                ) : (
                  <ul className="mt-2.5 grid max-h-[38vh] gap-2 overflow-y-auto pr-1">
                    {mine.map((n) => (
                      <li
                        key={n.id}
                        className={`rounded-[8px] border border-hair p-3 ${
                          n.resolvedAt ? "bg-surface/40" : "bg-card"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          {n.page ? (
                            <button
                              type="button"
                              onClick={() => setJump(n.page as number)}
                              className="tap font-mono text-label uppercase text-blue underline underline-offset-2"
                            >
                              Page {n.page}
                            </button>
                          ) : (
                            <span className="font-mono text-label uppercase text-dim">
                              The whole guide
                            </span>
                          )}
                          <span className="font-mono text-label uppercase text-dim">
                            {n.side === "client" ? "You" : n.name} / {when(n.at)}
                          </span>
                          {n.resolvedAt && <Chip tone="good">Done</Chip>}
                        </div>
                        <p
                          className={`mt-1.5 whitespace-pre-wrap text-body-sm ${
                            n.resolvedAt ? "text-dim" : "text-ink"
                          }`}
                        >
                          {n.body}
                        </p>
                        {repliesTo(n.id).map((r) => (
                          <div key={r.id} className="mt-2 border-l border-hair pl-3">
                            <p className="font-mono text-label uppercase text-dim">
                              {r.side === "client" ? "You" : r.name} / {when(r.at)}
                            </p>
                            <p className="mt-0.5 whitespace-pre-wrap text-body-sm text-muted">
                              {r.body}
                            </p>
                          </div>
                        ))}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {latest ? (
                <div className="grid gap-2.5 border-t border-hair pt-3">
                  <div className="flex flex-wrap items-end gap-2.5">
                    <div className="w-24">
                      <label className="mb-1.5 block font-mono text-label uppercase tracking-[0.08em] text-muted">
                        Page
                      </label>
                      <Input
                        type="number"
                        min={1}
                        value={page}
                        onChange={(e) => setPage(e.target.value)}
                        placeholder="4"
                      />
                    </div>
                    <p className="pb-2.5 text-body-sm text-dim">
                      Empty means the whole thing.
                    </p>
                  </div>
                  <Textarea
                    rows={3}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="The headline font is too light on the dark pages."
                    aria-label="Your note"
                  />
                  {err && <p className="text-body-sm text-error">{err}</p>}
                  <div>
                    <Button
                      variant="brand"
                      size="sm"
                      disabled={busy || !body.trim()}
                      onClick={send}
                    >
                      {busy ? "Sending..." : "Send the note"}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="border-t border-hair pt-3 text-body-sm text-dim">
                  Notes go on the current version. Switch to it to add one.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
