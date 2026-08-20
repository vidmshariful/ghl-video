"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, Chip, Field, Input } from "@/components/portal/ui";
import { authHeader } from "./client";

/*
 * The public library's Filter by feature rail, editable.
 *
 * Each row is one HighLevel feature: the label people see, and the aliases
 * that catch videos for it. Aliases are plain substrings matched against
 * video titles, never regex, so nothing typed here can break the page.
 *
 * The matches count beside each row is the whole trick: it is computed live
 * against the catalogue, so an alias that catches nothing announces itself
 * while the person is still looking at it. A feature with zero matches
 * never renders publicly, so a stale row costs nothing but tidiness.
 */

type Feature = {
  id: string;
  key: string;
  label: string;
  aliases: string[];
  active: boolean;
  sort: number;
  matches: number;
};

export function LibraryFiltersTab() {
  const [features, setFeatures] = useState<Feature[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  /* per-row alias drafts, committed on Save rather than per keystroke */
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/library-features", { headers: await authHeader() });
      const j = await r.json();
      if (!r.ok) return setErr(j.error ?? "Could not load the filters.");
      setFeatures(j.features as Feature[]);
      setDrafts({});
    } catch {
      setErr("Could not load the filters.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function call(method: string, body?: Record<string, unknown>, query = "") {
    setErr("");
    const r = await fetch(`/api/admin/library-features${query}`, {
      method,
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setErr(j.error ?? "That did not save.");
    await load();
  }

  if (err && !features) return <p className="text-body text-error">{err}</p>;
  if (!features) return <p className="text-body text-muted">Loading...</p>;

  return (
    <div className="grid gap-3">
      <Card
        title="Filter by feature, on the public library"
        description="Each row is one HighLevel feature on ghlvideo.com/library. Aliases are plain words matched against video titles; the matches count updates as you save, and a feature that matches nothing is simply not shown."
      >
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[16rem] flex-1">
            <Field label="Add a feature" hint="The label buyers see, e.g. QR Builder.">
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="QR Builder"
              />
            </Field>
          </div>
          <Button
            variant="primary"
            icon={<Plus />}
            disabled={busy === "new" || !newLabel.trim()}
            onClick={async () => {
              setBusy("new");
              await call("POST", { label: newLabel });
              setNewLabel("");
              setBusy(null);
            }}
          >
            Add it
          </Button>
        </div>
        <p className="mt-3 text-body-sm text-dim">
          Changes reach the public page within five minutes. New features start
          with their own name as the first alias.
        </p>
      </Card>

      {err && <p className="text-body-sm text-error">{err}</p>}

      <div className="grid gap-2">
        {features.map((f) => {
          const draft = drafts[f.id] ?? f.aliases.join(", ");
          const dirty = draft !== f.aliases.join(", ");
          return (
            <Card key={f.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      defaultValue={f.label}
                      aria-label={`Label for ${f.label}`}
                      className="max-w-[16rem] font-semibold"
                      onBlur={(e) => {
                        const label = e.target.value.trim();
                        if (label && label !== f.label) void call("PATCH", { id: f.id, label });
                      }}
                    />
                    <Chip tone={f.matches ? "good" : "warn"}>
                      {f.matches
                        ? `${f.matches} ${f.matches === 1 ? "video" : "videos"}`
                        : "matches nothing"}
                    </Chip>
                    {!f.active && <Chip tone="neutral">off</Chip>}
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <div className="min-w-[18rem] flex-1">
                      <Input
                        value={draft}
                        aria-label={`Aliases for ${f.label}`}
                        placeholder="reputation, review"
                        onChange={(e) => setDrafts((d) => ({ ...d, [f.id]: e.target.value }))}
                      />
                    </div>
                    {dirty && (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={busy === f.id}
                        onClick={async () => {
                          setBusy(f.id);
                          await call("PATCH", {
                            id: f.id,
                            aliases: draft.split(",").map((a) => a.trim()),
                          });
                          setBusy(null);
                        }}
                      >
                        Save aliases
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy === f.id}
                    onClick={() => call("PATCH", { id: f.id, active: !f.active })}
                  >
                    {f.active ? "Turn off" : "Turn on"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 />}
                    disabled={busy === f.id}
                    onClick={() => {
                      if (!window.confirm(`Delete "${f.label}"? The public rail loses it immediately.`))
                        return;
                      void call("DELETE", undefined, `?id=${f.id}`);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
