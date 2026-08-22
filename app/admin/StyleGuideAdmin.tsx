"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Chip, Input, Select, Textarea } from "@/components/portal/ui";
import { authHeader, when } from "./client";

/*
 * The visual style guide we write for an editing client, from our side.
 *
 * We upload it, they read it and mark up pages, we answer and mark things
 * dealt with. A new upload is a new version rather than an overwrite, so a
 * note that says "page 4 is too dark" still points at the page it was
 * written about after page 4 has changed.
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
  uploadedBy: string | null;
  createdAt: string;
  url: string | null;
};

const size = (n: number | null) =>
  n ? (n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`) : "";

export function StyleGuideAdmin({ email }: { email: string }) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [notes, setNotes] = useState<Record<string, Note[]>>({});
  const [showing, setShowing] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [what, setWhat] = useState("");
  const [reply, setReply] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const picker = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/style-guide?email=${encodeURIComponent(email)}`, {
        headers: await authHeader(),
      });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load the style guide.");
      setDocs(j.docs as Doc[]);
      setNotes((j.notes ?? {}) as Record<string, Note[]>);
      setShowing((s) => s ?? (j.docs as Doc[])[0]?.id ?? null);
    } catch {
      setErr("Could not load the style guide.");
    }
  }, [email]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const body = new FormData();
      body.append("email", email);
      body.append("file", file);
      body.append("note", what.trim());
      /* no Content-Type here on purpose: the browser sets the multipart
         boundary, and stamping json over it silently corrupts the upload */
      const r = await fetch("/api/admin/style-guide", {
        method: "POST",
        headers: await authHeader(),
        body,
      });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not upload that.");
      setFile(null);
      setWhat("");
      if (picker.current) picker.current.value = "";
      setShowing(null);
      await load();
    } catch {
      setErr("Could not upload that.");
    } finally {
      setBusy(false);
    }
  }

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/style-guide", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) setErr(j.error ?? "Could not save that.");
      else await load();
    } finally {
      setBusy(false);
    }
  }

  if (!docs) return null;

  const doc = docs.find((d) => d.id === showing) ?? docs[0] ?? null;
  const mine = doc ? (notes[doc.id] ?? []).filter((n) => !n.parentId) : [];
  const repliesTo = (id: string) =>
    doc ? (notes[doc.id] ?? []).filter((n) => n.parentId === id) : [];
  const open = mine.filter((n) => !n.resolvedAt).length;

  return (
    <div className="mt-3">
      <Card
        title="The style guide we made them"
        description="The visual guide we work to. They read it in their portal and mark up pages."
        actions={
          docs.length > 1 ? (
            <Select
              value={doc?.id ?? ""}
              onChange={(e) => setShowing(e.target.value)}
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
        {err && <p className="mb-3 text-body-sm text-error">{err}</p>}

        {!doc ? (
          <p className="text-body-sm text-muted">
            Nothing uploaded yet. They see a line saying we are still writing it.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={docs[0].id === doc.id ? "good" : "neutral"}>Version {doc.version}</Chip>
              {open > 0 && <Chip tone="warn">{open} to answer</Chip>}
              <span className="font-mono text-label uppercase text-dim">
                {doc.filename}
                {size(doc.sizeBytes) ? ` / ${size(doc.sizeBytes)}` : ""} / {when(doc.createdAt)}
              </span>
              {doc.url && (
                <Button variant="ghost" size="sm" href={doc.url} target="_blank">
                  Open it
                </Button>
              )}
            </div>
            {doc.note && <p className="mt-2 text-body-sm text-muted">{doc.note}</p>}

            <div className="mt-4 border-t border-hair pt-3">
              <p className="font-mono text-label uppercase tracking-[0.08em] text-muted">
                What they want changed
              </p>
              {mine.length === 0 ? (
                <p className="mt-2 text-body-sm text-muted">
                  No notes on this version.
                </p>
              ) : (
                <ul className="mt-2.5 grid gap-2">
                  {mine.map((n) => (
                    <li
                      key={n.id}
                      className={`rounded-[8px] border border-hair p-3 ${
                        n.resolvedAt ? "bg-surface/40" : "bg-surface"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-label uppercase text-gold">
                          {n.page ? `Page ${n.page}` : "The whole guide"}
                        </span>
                        <span className="font-mono text-label uppercase text-dim">
                          {n.name} / {when(n.at)}
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
                            {r.name} / {when(r.at)}
                          </p>
                          <p className="mt-0.5 whitespace-pre-wrap text-body-sm text-muted">
                            {r.body}
                          </p>
                        </div>
                      ))}

                      <div className="mt-2.5 flex flex-wrap items-end gap-2">
                        <div className="min-w-[14rem] flex-1">
                          <Input
                            value={reply[n.id] ?? ""}
                            onChange={(e) => setReply({ ...reply, [n.id]: e.target.value })}
                            placeholder="Answer them"
                            aria-label={`Answer the note on ${n.page ? `page ${n.page}` : "the guide"}`}
                          />
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy || !(reply[n.id] ?? "").trim()}
                          onClick={async () => {
                            await patch({
                              docId: doc.id,
                              parentId: n.id,
                              page: n.page,
                              body: reply[n.id],
                            });
                            setReply({ ...reply, [n.id]: "" });
                          }}
                        >
                          Reply
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => patch({ resolve: n.id, undo: !!n.resolvedAt })}
                        >
                          {n.resolvedAt ? "Reopen" : "Mark done"}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {/* upload, always available: the next version is how anything here
            actually gets fixed */}
        <div className="mt-4 border-t border-hair pt-3">
          <p className="font-mono text-label uppercase tracking-[0.08em] text-muted">
            {doc ? "Upload a new version" : "Upload their guide"}
          </p>
          <div className="mt-2 grid gap-2.5">
            <input
              ref={picker}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-body-sm text-muted file:mr-3 file:rounded-[3px] file:border-0 file:bg-surface file:px-3 file:py-2 file:font-mono file:text-label file:uppercase file:text-ink hover:file:bg-card"
              aria-label="Pick the PDF"
            />
            <Textarea
              rows={2}
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              placeholder="What changed in this version. They see this line."
              aria-label="What changed"
            />
            <div>
              <Button variant="brand" size="sm" disabled={busy || !file} onClick={upload}>
                {busy ? "Uploading..." : doc ? `Upload version ${docs[0].version + 1}` : "Upload it"}
              </Button>
            </div>
            <p className="text-body-sm text-dim">
              PDF, up to 25MB. Uploading tells them it is ready to read.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
