"use client";

import { useCallback, useEffect, useState } from "react";

/*
 * What we are allowed to email them about.
 *
 * Two switches, because a preference screen with a row per template is a
 * screen nobody finishes, and it turns every future email into a decision
 * somebody has to make about a thing they have not seen yet.
 *
 * Saves on change rather than behind a button. Nobody presses Save on a
 * settings toggle, and the ones who do not press it end up believing they
 * changed something they did not.
 */

type Category = { key: string; label: string; blurb: string };
type Payload = { categories: Category[]; prefs: Record<string, boolean>; always: string };

export function EmailPrefsView({
  authedFetch,
  canEdit,
}: {
  authedFetch: (path: string, init?: RequestInit) => Promise<Record<string, unknown>>;
  canEdit: boolean;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const j = await authedFetch("/api/portal/email-prefs").catch(() => null);
    if (j && !j.error) setData(j as unknown as Payload);
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(key: string, on: boolean) {
    if (!data) return;
    const next = { ...data.prefs, [key]: on };
    setData({ ...data, prefs: next });
    setSaved(false);
    setErr("");
    const j = (await authedFetch("/api/portal/email-prefs", {
      method: "PUT",
      body: JSON.stringify({ prefs: next }),
    }).catch(() => null)) as { error?: string } | null;
    if (j?.error) {
      setErr(j.error);
      /* put it back: a switch that stays where you left it while the server
       * disagreed is a lie the next page load exposes */
      setData({ ...data, prefs: data.prefs });
      return;
    }
    setSaved(true);
  }

  if (!data) return null;

  return (
    <div className="rounded-[12px] border border-hair bg-surface p-6">
      <p className="text-body font-semibold text-ink">Emails</p>
      <p className="mt-1 max-w-[var(--measure-body)] text-body-sm text-muted">
        {data.always}
      </p>

      <div className="mt-5 grid gap-4">
        {data.categories.map((c) => {
          const on = data.prefs[c.key] !== false;
          return (
            <label
              key={c.key}
              className={`flex items-start gap-3 ${canEdit ? "cursor-pointer" : "opacity-70"}`}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={!canEdit}
                onChange={(e) => toggle(c.key, e.target.checked)}
                className="mt-1 size-4 shrink-0 accent-[color:var(--green)]"
              />
              <span className="min-w-0">
                <span className="block text-body-sm font-semibold text-ink">{c.label}</span>
                <span className="mt-0.5 block max-w-[var(--measure-body)] text-body-sm text-muted">
                  {c.blurb}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {!canEdit && (
        <p className="mt-4 text-body-sm text-dim">
          Only the account owner can change these.
        </p>
      )}
      {err && <p className="mt-4 text-body-sm text-error">{err}</p>}
      {saved && !err && <p className="mt-4 text-body-sm text-green">Saved.</p>}
    </div>
  );
}
