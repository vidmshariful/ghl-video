"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Field, Select, Textarea } from "@/components/portal/ui";
import { StyleGuideDoc } from "./StyleGuideDoc";

/*
 * How this client wants their videos cut, said once instead of every month.
 *
 * Not the Brand Kit. That is the brand itself, the logo and the colours and
 * how the name is said, and it goes on everything we make. This is the
 * editing brief, and it is the cheapest thing here to fill in and the most
 * expensive to skip: everything it does not say gets asked again, or guessed
 * wrong and then fixed in a round of changes.
 *
 * Nothing on it is required. A guide with three honest lines beats an empty
 * one, and a form that demands eleven fields gets abandoned at four.
 */

type Guide = {
  introOutro: string;
  captionStyle: string;
  music: string;
  pacing: string;
  broll: string;
  avoid: string;
  notes: string;
  defaultAspect: string | null;
  referenceUrls: string[];
  updatedAt: string | null;
};

const FIELDS: { key: keyof Guide; label: string; hint: string; placeholder: string }[] = [
  {
    key: "introOutro",
    label: "Intro and outro",
    hint: "Do you have one, and where do we get it?",
    placeholder: "Our 4 second animated intro, in the brand folder. No outro, end on the last line.",
  },
  {
    key: "captionStyle",
    label: "Captions",
    hint: "On or off, and how they should look.",
    placeholder: "Always on. Big, centred, one or two words at a time, white with a yellow highlight on the key word.",
  },
  {
    key: "music",
    label: "Music",
    hint: "What fits you, and what does not.",
    placeholder: "Low, modern, under the voice. Nothing corporate or upbeat stock.",
  },
  {
    key: "pacing",
    label: "Pacing",
    hint: "How tight, and how much movement.",
    placeholder: "Tight. Cut every pause and filler word. Zooms on the important lines, nothing gimmicky.",
  },
  {
    key: "broll",
    label: "B roll and screen recordings",
    hint: "What we can use and where it lives.",
    placeholder: "Use our HighLevel screen recordings whenever a feature is mentioned. Folder link in the notes.",
  },
  {
    key: "avoid",
    label: "Never do this",
    hint: "The fastest field to fill in, and the one that saves the most rounds.",
    placeholder: "No meme sound effects. Never show the client dashboard with real names in it. No stock footage of handshakes.",
  },
  {
    key: "notes",
    label: "Anything else",
    hint: "Names, pronunciations, links, whatever your editor should know.",
    placeholder: "Say Vidiosa as vid ee OH sa. Our product names are capitalised.",
  },
];

export function StyleGuideView({
  authedFetch,
  aspects,
}: {
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  aspects: { key: string; label: string; note: string }[];
}) {
  const [g, setG] = useState<Guide | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const j = await authedFetch("/api/portal/style-guide").catch(() => null);
    setG((j?.guide as Guide | null) ?? null);
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!g) return;
    setBusy(true);
    setErr("");
    setSaved(false);
    try {
      const j = (await authedFetch("/api/portal/style-guide", {
        method: "PUT",
        body: JSON.stringify(g),
      })) as { ok?: boolean; error?: string };
      if (j.error) setErr(j.error);
      else setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  if (!g) return <p className="text-body text-muted">Loading...</p>;

  const filled = FIELDS.filter((f) => String(g[f.key] ?? "").trim()).length;

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="grid min-w-0 gap-3">
        {/* what we wrote for them, above what they write for us: it is the
            thing they came here to read */}
        <StyleGuideDoc authedFetch={authedFetch} />

        <Card
          title="How we cut for you"
          description="Fill this in once and your editor works to it every month. Nothing here is required."
        >
        <div className="grid gap-4">
          <Field label="Your usual shape" hint="What most of your videos are cut for.">
            <Select
              value={g.defaultAspect ?? ""}
              onChange={(e) => setG({ ...g, defaultAspect: e.target.value || null })}
            >
              <option value="">No usual, we will ask each time</option>
              {aspects.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}, {a.note}
                </option>
              ))}
            </Select>
          </Field>

          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              <Textarea
                rows={2}
                value={String(g[f.key] ?? "")}
                onChange={(e) => setG({ ...g, [f.key]: e.target.value })}
                placeholder={f.placeholder}
              />
            </Field>
          ))}

          {err && <p className="text-body-sm text-error">{err}</p>}

          <div className="flex items-center gap-3">
            <Button variant="brand" disabled={busy} onClick={save}>
              {busy ? "Saving..." : "Save the guide"}
            </Button>
            {saved && <span className="text-body-sm text-green">Saved. Your editor sees it now.</span>}
          </div>
        </div>
        </Card>
      </div>

      <div className="grid gap-3">
        <Card title="Why this is worth ten minutes">
          <p className="text-body-sm text-muted">
            Almost every round of changes comes from something we had to guess.
            The guide is where the guessing stops. The line that saves the most
            time is the one about what we should never do.
          </p>
          <p className="mt-3 font-mono text-label uppercase text-dim">
            {filled} of {FIELDS.length} filled in
          </p>
        </Card>
        <Card title="Your logo and colours">
          <p className="text-body-sm text-muted">
            Those live in your Brand Kit, and we use them on everything we make
            for you. This guide is only about how your footage gets cut.
          </p>
        </Card>
      </div>
    </div>
  );
}
