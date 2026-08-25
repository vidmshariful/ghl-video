"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive,
  FileText,
  File as FileIcon,
  Film,
  Image as ImageIcon,
  Music,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { Button, Card } from "@/components/portal/ui";

/*
 * The files a client and the studio pass each other, on whatever the file
 * belongs to.
 *
 * Lifted out of the custom project screen when editing requests needed the
 * same thing. It was going to be copied, which is how this repo has ended up
 * with two of something before: two panels, two ideas about the size limit,
 * two answers to "can I delete a file the studio sent". One panel, and the
 * caller says which endpoint it talks to.
 *
 * The endpoint is expected to answer GET with { files }, take a POST of
 * multipart form-data under "file", and take DELETE with ?fileId=. Both of
 * the routes behind it check the caller owns the thing before anything else.
 */

type ClientFile = {
  id: string;
  name: string;
  sizeBytes: number;
  kind: "image" | "video" | "audio" | "pdf" | "doc" | "archive" | "file";
  uploadedBy: "client" | "studio";
  uploaderName: string | null;
  at: string;
  url: string | null;
};

/** Who sent a file, said in the words of whoever is reading the panel. */
function senderWord(from: "client" | "studio", viewer: "client" | "studio"): string {
  if (viewer === "studio") return from === "studio" ? "from the team" : "from the client";
  return from === "studio" ? "from us" : "from you";
}

const MAX_ATTACH_BYTES = 10 * 1024 * 1024;

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const KIND_ICON: Record<ClientFile["kind"], typeof FileIcon> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  pdf: FileText,
  doc: FileText,
  archive: Archive,
  file: FileIcon,
};

/*
 * The files we pass each other. If we asked the client for a logo or a clip,
 * this is where it lands; if we handed them a reference, it shows here too.
 * Either side can add or remove, nothing over 10 MB.
 */
export function Attachments({
  endpoint,
  extraFields,
  viewer = "client",
  title = "Attachments",
  description = "Files we pass each other: what you send us, and what we send you. Up to 10 MB each.",
  empty = "Nothing here yet. Add a logo, a screenshot, a clip, anything we need.",
  authedFetch,
}: {
  /** the route that lists, takes and deletes them. May carry a query. */
  endpoint: string;
  /** extra form fields the route needs on an upload, e.g. which item this is */
  extraFields?: Record<string, string>;
  /**
   * Which side of the glass this panel is on.
   *
   * "from us" and "from you" only mean anything relative to the reader, and
   * the first version said them from the client's seat wherever it rendered,
   * so the studio board labelled the client's own logo "from you". The panel
   * has to be told who is looking.
   */
  viewer?: "client" | "studio";
  title?: string;
  description?: string;
  empty?: string;
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
}) {
  const [files, setFiles] = useState<ClientFile[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const j = await authedFetch(endpoint).catch(() => null);
    if (j && Array.isArray((j as { files?: unknown }).files)) setFiles((j as { files: ClientFile[] }).files);
    else if (!files) setFiles([]);
  }, [authedFetch, endpoint, files]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  async function upload(list: FileList | null) {
    if (!list || !list.length) return;
    setErr("");
    setBusy(true);
    for (const file of Array.from(list)) {
      if (file.size > MAX_ATTACH_BYTES) {
        setErr(`${file.name} is over 10 MB.`);
        continue;
      }
      const fd = new FormData();
      fd.append("file", file);
      for (const [k, v] of Object.entries(extraFields ?? {})) fd.append(k, v);
      const r = (await authedFetch(endpoint, {
        method: "POST",
        body: fd,
      }).catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (r && r.error) setErr(r.error);
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    await load();
  }

  async function remove(id: string) {
    setBusy(true);
    /* the endpoint may already carry a query, e.g. the admin route which
       names the item that way rather than in the path */
    const sep = endpoint.includes("?") ? "&" : "?";
    await authedFetch(`${endpoint}${sep}fileId=${id}`, {
      method: "DELETE",
    }).catch(() => null);
    setBusy(false);
    setConfirmId(null);
    await load();
  }

  return (
    <Card
      title={title}
      description={description}
      actions={
        <Button
          size="sm"
          variant="secondary"
          icon={<Upload />}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          Add file
        </Button>
      }
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void upload(e.target.files)}
      />
      {err && <p className="mb-2 text-body-sm text-error">{err}</p>}

      {files === null ? (
        <p className="text-body-sm text-dim">Loading...</p>
      ) : files.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="tap flex w-full flex-col items-center gap-2 rounded-[8px] border border-dashed border-hair px-3 py-8 text-center transition-colors hover:border-gold/50"
        >
          <Paperclip size={20} className="text-dim" aria-hidden="true" />
          <span className="text-body-sm text-dim">{empty}</span>
        </button>
      ) : (
        <ul className="grid gap-2">
          {files.map((f) => {
            const Icon = KIND_ICON[f.kind];
            return (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-[8px] border border-hair bg-canvas p-2"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[6px] border border-hair bg-surface">
                  {f.kind === "image" && f.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Icon size={18} className="text-muted" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-semibold text-ink" title={f.name}>
                    {f.name}
                  </p>
                  <p className="font-mono text-label uppercase tracking-[0.08em] text-dim">
                    {fmtSize(f.sizeBytes)} / {senderWord(f.uploadedBy, viewer)}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1">
                  {f.url && (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tap rounded-[6px] border border-hair px-2.5 py-1 font-mono text-label uppercase text-muted transition-colors hover:border-blue/60 hover:text-blue"
                    >
                      Open
                    </a>
                  )}
                  {confirmId === f.id ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(f.id)}
                        className="tap rounded-[6px] border border-error/50 px-2.5 py-1 font-mono text-label uppercase text-error transition-colors hover:bg-error hover:text-canvas"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="tap font-mono text-label uppercase text-dim transition-colors hover:text-muted"
                      >
                        No
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Delete ${f.name}`}
                      onClick={() => setConfirmId(f.id)}
                      className="tap grid h-7 w-7 place-items-center rounded-[6px] border border-hair text-dim transition-colors hover:border-error/60 hover:text-error"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
