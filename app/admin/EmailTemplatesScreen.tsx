"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authHeader, supabase } from "./client";
import {
  DEFAULT_TEMPLATES,
  SITE_URL,
  TEMPLATE_VARIABLES,
  renderTemplate,
  wrapEmail,
} from "@/lib/email/templates";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Row = { key: string; subject: string; body: string; enabled: boolean };

/* sample values so the live preview and the test send show something real */
const SAMPLE: Record<string, string> = {
  customer_name: "Alex",
  product_name: "AI Receptionist + Conversational AI",
  order_code: "FEXP-031",
  update_message: "Your first cut is ready for review. Take a look and send any changes.",
  stage: "In review",
  portal_url: `${SITE_URL}/portal`,
  delivery_url: `${SITE_URL}/portal`,
};

const field =
  "mt-1.5 w-full rounded-[8px] border border-hair bg-canvas px-3 py-2.5 text-body text-ink focus:border-gold focus:outline-none";
const lab = "font-mono text-label uppercase text-muted";

export function EmailTemplatesScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [sel, setSel] = useState<string>(DEFAULT_TEMPLATES[0].key);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const def = useMemo(
    () => DEFAULT_TEMPLATES.find((t) => t.key === sel) ?? DEFAULT_TEMPLATES[0],
    [sel],
  );

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("email_templates")
      .select("key,subject,body,enabled");
    if (error) setErr(error.message);
    const map: Record<string, Row> = {};
    (data ?? []).forEach((r: any) => (map[r.key] = r));
    setRows(map);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // populate the editor from the saved row, falling back to the code default
  useEffect(() => {
    const r = rows[sel];
    const d = DEFAULT_TEMPLATES.find((t) => t.key === sel) ?? DEFAULT_TEMPLATES[0];
    setSubject(r?.subject ?? d.subject);
    setBody(r?.body ?? d.body);
    setEnabled(r?.enabled ?? true);
    setMsg("");
    setErr("");
  }, [sel, rows]);

  async function save() {
    setBusy("save");
    setErr("");
    setMsg("");
    const { error } = await supabase.from("email_templates").upsert(
      { key: sel, name: def.name, description: def.description, subject, body, enabled },
      { onConflict: "key" },
    );
    setBusy(null);
    if (error) setErr(error.message);
    else {
      setMsg("Saved.");
      load();
    }
  }

  function resetDefault() {
    setSubject(def.subject);
    setBody(def.body);
    setMsg("Loaded the default. Click Save to keep it.");
  }

  async function sendTest() {
    setBusy("test");
    setErr("");
    setMsg("");
    try {
      const r = await fetch("/api/admin/email/test", {
        method: "POST",
        headers: { ...(await authHeader()), "content-type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const j = await r.json();
      setBusy(null);
      if (!r.ok) setErr(j.error ?? "Test send failed.");
      else setMsg(`Test sent to ${j.to}.`);
    } catch {
      setBusy(null);
      setErr("Test send failed.");
    }
  }

  const preview = wrapEmail(renderTemplate(body, SAMPLE));
  const vars = TEMPLATE_VARIABLES[sel] ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {!embedded && <h1 className="font-display text-h2 text-ink">Email Templates</h1>}
          <p className={`${embedded ? "" : "mt-1 "}max-w-2xl text-body-sm text-muted`}>
            Emails the site sends to clients. Edit the subject and message, and use the
            variables below in double braces. The GHL Video header, colors, and footer
            are added automatically, so you only edit the message. The order update
            email is sent to the client whenever the team posts an update on their order.
          </p>
        </div>
        {DEFAULT_TEMPLATES.length > 1 && (
          <select value={sel} onChange={(e) => setSel(e.target.value)} className={`${field} w-auto`}>
            {DEFAULT_TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {err ? <p className="mt-4 text-body-sm text-error">{err}</p> : null}
      {msg ? <p className="mt-4 text-body-sm text-green">{msg}</p> : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {/* editor */}
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="font-display text-h4 text-ink">{def.name}</span>
            <label className="flex items-center gap-2 text-body-sm text-muted">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Enabled
            </label>
          </div>

          <label className="block">
            <span className={lab}>Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={field} />
          </label>

          <label className="mt-4 block">
            <span className={lab}>Body (HTML)</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              spellCheck={false}
              className={`${field} h-72 font-mono text-body-sm`}
            />
          </label>

          <div className="mt-4 rounded-[8px] border border-hair bg-canvas p-4">
            <p className={lab}>Variables</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {vars.map((v) => (
                <code
                  key={v}
                  className="rounded-[8px] border border-hair bg-surface px-2 py-1 font-mono text-label text-gold/80"
                >
                  {`{{${v}}}`}
                </code>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={save}
              disabled={busy !== null}
              className="tap rounded-[8px] bg-brand-gradient px-5 py-2.5 text-body-sm font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-50"
            >
              {busy === "save" ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={sendTest}
              disabled={busy !== null}
              className="tap rounded-[8px] border border-hair px-4 py-2.5 text-body-sm font-semibold text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-50"
            >
              {busy === "test" ? "Sending..." : "Send test to me"}
            </button>
            <button
              type="button"
              onClick={resetDefault}
              disabled={busy !== null}
              className="tap rounded-[8px] border border-hair px-4 py-2.5 text-body-sm font-semibold text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-50"
            >
              Reset to default
            </button>
          </div>
        </div>

        {/* live preview */}
        <div>
          <p className={`${lab} mb-2`}>Preview (with sample data)</p>
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={preview}
            className="h-[36rem] w-full rounded-[8px] border border-hair bg-white"
          />
        </div>
      </div>
    </div>
  );
}
