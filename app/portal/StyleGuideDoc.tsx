"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Chip, Input, Select, Textarea } from "@/components/portal/ui";

/*
 * The style guide WE wrote, read by the client.
 *
 * The other half of this screen is the client telling us how they want their
 * videos cut. This is the answer to it: the visual guide we build from their
 * brand and their numbers, and then work to.
 *
 * It is reviewed the way a cut is reviewed. A note is pinned to a page the
 * same way video feedback is pinned to a second, because "the page with the
 * colours" is not a page number and everyone loses a round of changes to it.
 * We reply underneath, and we mark a note dealt with rather than deleting
 * it, so what was asked for stays readable after it has been done.
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
};

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const size = (n: number | null) =>
  n ? `${n < 1024 * 1024 ? Math.round(n / 1024) + " KB" : (n / 1024 / 1024).toFixed(1) + " MB"}` : "";

export function StyleGuideDoc({
  authedFetch,
}: {
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
}) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [notes, setNotes] = useState<Record<string, Note[]>>({});
  const [showing, setShowing] = useState<string | null>(null);
  const [page, setPage] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  /* bumped to force the viewer to reload when jumping to a page */
  const [jump, setJump] = useState(0);

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
  const repliesTo = (id: string) => (notes[doc.id] ?? []).filter((n) => n.parentId === id);
  const open = mine.filter((n) => !n.resolvedAt).length;
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
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Your style guide"
      description="The visual guide we made you, and work to on every video. Read it and tell us what to change."
      actions={
        docs.length > 1 ? (
          <Select
            value={doc.id}
            onChange={(e) => {
              setShowing(e.target.value);
              setJump(0);
            }}
            aria-label="Which version"
            className="w-auto"
          >
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                Version {d.version}
                {docs[0].id === d.id ? " (current)" : ""}
              </option>
            ))}
          </Select>
        ) : null
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={latest ? "good" : "neutral"}>Version {doc.version}</Chip>
        {!latest && <Chip tone="warn">Not the current one</Chip>}
        {open > 0 && <Chip tone="info">{open} still open</Chip>}
        <span className="font-mono text-label uppercase text-dim">
          {when(doc.createdAt)}
          {size(doc.sizeBytes) ? ` / ${size(doc.sizeBytes)}` : ""}
        </span>
      </div>

      {doc.note && <p className="mt-2 text-body-sm text-muted">{doc.note}</p>}

      {doc.url ? (
        <>
          {/* the browser's own PDF viewer. A few of them refuse to show a PDF
              inline and hand it straight to downloads instead, which would
              otherwise leave an empty grey box and no explanation, so the way
              out sits right underneath it and says why it is there */}
          <div className="mt-3 overflow-hidden rounded-[8px] border border-hair bg-canvas">
            <iframe
              key={`${doc.id}-${jump}`}
              src={doc.url + (jump > 0 ? `#page=${jump}` : "")}
              title={`Style guide, version ${doc.version}`}
              className="h-[34rem] w-full"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" href={doc.url} target="_blank">
              Open it in a new tab
            </Button>
            <span className="text-body-sm text-dim">
              Nothing above? Your browser is set to download PDFs rather than
              show them. This opens it.
            </span>
          </div>
        </>
      ) : (
        <p className="mt-3 text-body-sm text-error">
          This file has gone missing. Tell us and we will put it back.
        </p>
      )}

      {/* the notes, and the box to add one */}
      <div className="mt-5 border-t border-hair pt-4">
        <p className="font-mono text-label uppercase tracking-[0.08em] text-muted">
          What you want changed
        </p>

        {mine.length === 0 ? (
          <p className="mt-2 text-body-sm text-muted">
            Nothing yet. Say the page and what is wrong with it, and we will
            answer here.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {mine.map((n) => (
              <li
                key={n.id}
                className={`rounded-[8px] border p-3 ${
                  n.resolvedAt ? "border-hair bg-surface/40" : "border-hair bg-surface"
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
                    <span className="font-mono text-label uppercase text-dim">The whole guide</span>
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
                    <p className="mt-0.5 whitespace-pre-wrap text-body-sm text-muted">{r.body}</p>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}

        {latest ? (
          <div className="mt-4 grid gap-2.5">
            <div className="flex flex-wrap items-end gap-2.5">
              <div className="w-28">
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
                Leave it empty if it is about the whole thing.
              </p>
            </div>
            <Textarea
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="The headline font is too light on the dark pages."
              aria-label="Your note"
            />
            {err && <p className="text-body-sm text-error">{err}</p>}
            <div>
              <Button variant="brand" size="sm" disabled={busy || !body.trim()} onClick={send}>
                {busy ? "Sending..." : "Send the note"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-body-sm text-dim">
            Notes go on the current version. Switch to it to add one.
          </p>
        )}
      </div>
    </Card>
  );
}
