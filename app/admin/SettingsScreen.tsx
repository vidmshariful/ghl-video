"use client";

import { useCallback, useEffect, useState } from "react";
import { authHeader } from "./client";
import { TeamScreen } from "./TeamScreen";
import { EmailTemplatesScreen } from "./EmailTemplatesScreen";
import { HEAD_SCRIPTS, BODY_END_SCRIPTS } from "@/lib/chrome";
import { AvatarUploader, PasswordCard } from "@/components/portal/account";
import { effectiveFeatures, type Role } from "./roles";

/*
 * Admin Settings: the pinned hub at the bottom of the menu. My profile is
 * for everyone; Team and Integrations need the Admin role, the same gate
 * the Team screen always had. Integrations reads connection status only,
 * never key material.
 */

type Me = {
  email: string;
  name: string | null;
  role: Role;
  features: string[] | null;
  avatarUrl: string | null;
};

type IntegrationsPayload = {
  integrations: {
    stripe: { configured: boolean; mode: "live" | "test" | null };
    supabase: { configured: boolean };
    highlevel: { configured: boolean };
    firstpromoter: { configured: boolean };
    brevo: { configured: boolean; from: string };
    regionGate: { configured: boolean };
  };
  adminAlertEmail: string;
};

const fieldCls =
  "w-full rounded-[8px] border border-hair bg-canvas px-4 py-3 text-body text-ink placeholder:text-dim focus:border-gold focus:outline-none";
const btnGold =
  "tap rounded-[8px] bg-brand-gradient px-6 py-2.5 text-body font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60";
const labelCls = "font-mono text-label uppercase text-muted";

type Tab = "profile" | "team" | "integrations" | "emails" | "code";

export function SettingsScreen({
  me,
  onMeChanged,
  initialTab = "profile",
}: {
  me: Me;
  onMeChanged: () => void;
  /* deep links (/admin/emails/, /admin/code/) open Settings on their tab */
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const isAdmin = me.role === "admin";
  const granted = effectiveFeatures(me.role, me.features) as string[];
  const tabs: { key: Tab; label: string }[] = [
    { key: "profile", label: "My profile" },
    ...(isAdmin
      ? ([
          { key: "team", label: "Team" },
          { key: "integrations", label: "Integrations" },
        ] as { key: Tab; label: string }[])
      : []),
    ...(granted.includes("emails") ? [{ key: "emails" as Tab, label: "Emails" }] : []),
    ...(granted.includes("code") ? [{ key: "code" as Tab, label: "Site code" }] : []),
  ];

  return (
    <div className="w-full">
      <h1 className="font-display text-h2 text-ink">Settings</h1>
      <p className="mt-2 max-w-[var(--measure-body)] text-body text-muted">
        Your account{isAdmin ? ", the team, and what the platform is connected to." : " and how you appear to clients."}
      </p>

      <div className="mt-6 inline-flex rounded-[8px] border border-hair bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`tap rounded-[6px] px-4 py-2 font-mono text-label uppercase transition-colors ${
              tab === t.key ? "bg-gold/15 font-bold text-gold" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div key={tab} className="portal-view mt-6">
        {tab === "team" && isAdmin ? (
          <TeamScreen meEmail={me.email} embedded />
        ) : tab === "integrations" && isAdmin ? (
          <IntegrationsTab />
        ) : tab === "emails" && granted.includes("emails") ? (
          <EmailTemplatesScreen embedded />
        ) : tab === "code" && granted.includes("code") ? (
          <CodeTab />
        ) : (
          <ProfileTab me={me} onMeChanged={onMeChanged} />
        )}
      </div>
    </div>
  );
}

/* ---------------- site code (read-only mirror) ---------------- */
function CodeTab() {
  const blocks: { label: string; where: string; code: string }[] = [
    {
      label: "Header code (GTM, Google Ads, Hotjar, FirstPromoter)",
      where: "Injected at body start on every public page.",
      code: HEAD_SCRIPTS,
    },
    {
      label: "Footer code (GTM noscript, chat widget)",
      where: "Injected right before the closing body tag.",
      code: BODY_END_SCRIPTS,
    },
  ];
  return (
    <div className="max-w-4xl">
      <p className="max-w-[var(--measure-body)] text-body text-muted">
        These tracking and verification snippets are hard-coded in the site
        source and injected on every public page: the marketing site, the
        sales pages, and checkout. Never the portals or this admin. This view
        is read-only, so what you see below is exactly what is live. To change
        it, edit <span className="font-mono text-body-sm text-ink">lib/chrome.ts</span> and deploy.
      </p>
      {blocks.map((b) => (
        <div key={b.label} className="mt-8">
          <span className="font-mono text-label uppercase text-muted">{b.label}</span>
          <p className="mt-1 text-body-sm text-dim">{b.where}</p>
          <pre className="mt-2 max-h-80 w-full overflow-auto rounded-[8px] border border-hair bg-[#05060a] p-4 font-mono text-body-sm leading-relaxed text-ink">
            {b.code}
          </pre>
        </div>
      ))}
    </div>
  );
}

/* ---------------- my profile ---------------- */
function ProfileTab({ me, onMeChanged }: { me: Me; onMeChanged: () => void }) {
  const [name, setName] = useState(me.name ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const r = await fetch("/api/admin/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ name }),
      });
      const j = await r.json();
      if (!r.ok) setErr(j.error ?? "Could not save. Try again.");
      else {
        setMsg("Saved.");
        onMeChanged();
      }
    } catch {
      setErr("Could not save. Try again.");
    }
    setBusy(false);
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="rounded-[12px] border border-hair bg-surface p-6">
        <AvatarUploader
          name={me.name}
          email={me.email}
          avatarUrl={me.avatarUrl}
          endpoint="/api/admin/me/avatar"
          onChanged={() => onMeChanged()}
        />
        <form onSubmit={save} className="mt-6 grid max-w-md gap-4 border-t border-hair pt-6">
          <label className="grid gap-2">
            <span className="font-mono text-label uppercase text-muted">Your name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              className={fieldCls}
            />
          </label>
          <p className="text-body-sm text-dim">
            Shown to the team, and to clients when you message them.
          </p>
          <div className="grid gap-2">
            <span className="font-mono text-label uppercase text-muted">Sign-in email</span>
            <p className="text-body text-ink">{me.email}</p>
          </div>
          {msg && <p className="text-body-sm text-green">{msg}</p>}
          {err && <p className="text-body-sm text-error">{err}</p>}
          <div>
            <button type="submit" disabled={busy} className={btnGold}>
              {busy ? "Saving" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
      <PasswordCard resetRedirect="/portal/set-password/" />
    </div>
  );
}

/* ---------------- integrations ---------------- */
const INTEGRATION_META: {
  key: keyof IntegrationsPayload["integrations"];
  name: string;
  powers: string;
  env: string;
}[] = [
  {
    key: "stripe",
    name: "Stripe",
    powers: "Every payment: one-time orders, subscriptions, refunds, disputes.",
    env: "STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET",
  },
  {
    key: "supabase",
    name: "Supabase",
    powers: "The database, portal logins, and private file storage.",
    env: "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
  },
  {
    key: "highlevel",
    name: "HighLevel CRM",
    powers: "Paid orders, subscriptions, and quote leads sync to contacts and pipelines.",
    env: "HIGHLEVEL_API_TOKEN, HIGHLEVEL_LOCATION_ID",
  },
  {
    key: "firstpromoter",
    name: "FirstPromoter",
    powers: "Partner stats in the partner portal: clicks, referrals, earnings, payouts.",
    env: "FIRSTPROMOTER_API_KEY, FIRSTPROMOTER_ACCOUNT_ID",
  },
  {
    key: "brevo",
    name: "Brevo email",
    powers: "Every client and team email the platform sends.",
    env: "BREVO_API_KEY, EMAIL_FROM",
  },
  {
    key: "regionGate",
    name: "Region gate",
    powers: "The edge block with the team bypass at /unlock. Dormant until the key is set.",
    env: "ACCESS_BYPASS_KEY",
  },
];

function IntegrationsTab() {
  const [data, setData] = useState<IntegrationsPayload | null>(null);
  const [err, setErr] = useState("");
  const [testState, setTestState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [testErr, setTestErr] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/integrations", { headers: await authHeader() });
        const j = await r.json();
        if (!active) return;
        if (!r.ok) setErr(j.error ?? "Could not load integration status.");
        else setData(j);
      } catch {
        if (active) setErr("Could not load integration status.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function sendTest() {
    setTestState("sending");
    setTestErr("");
    try {
      const r = await fetch("/api/admin/integrations", {
        method: "POST",
        headers: await authHeader(),
      });
      const j = await r.json();
      if (r.ok) setTestState("sent");
      else {
        setTestState("failed");
        setTestErr(j.error ?? "Send failed.");
      }
    } catch {
      setTestState("failed");
      setTestErr("Send failed.");
    }
  }

  if (err) return <p className="text-body text-error">{err}</p>;
  if (!data) return <p className="text-body text-muted">Checking connections...</p>;

  const pill = (state: "on" | "off" | "test") =>
    state === "on"
      ? "border-green/40 text-green"
      : state === "test"
        ? "border-gold/40 text-gold"
        : "border-hair text-dim";

  return (
    <div>
      <GoogleCard />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {INTEGRATION_META.map((m) => {
          const it = data.integrations[m.key];
          const state: "on" | "off" | "test" =
            m.key === "stripe" && (it as { mode?: string | null }).mode === "test"
              ? "test"
              : it.configured
                ? "on"
                : "off";
          const label =
            m.key === "stripe" && state !== "off"
              ? state === "test"
                ? "Test mode"
                : "Live"
              : m.key === "regionGate"
                ? state === "on"
                  ? "Active"
                  : "Dormant"
                : state === "on"
                  ? "Connected"
                  : "Not set";
          return (
            <div key={m.key} className="rounded-[12px] border border-hair bg-surface p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-h4 text-ink">{m.name}</p>
                <span
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${pill(state)}`}
                >
                  {label}
                </span>
              </div>
              <p className="mt-2 text-body-sm text-muted">{m.powers}</p>
              <p className="mt-3 font-mono text-label uppercase text-dim">{m.env}</p>
              {m.key === "brevo" ? (
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-hair pt-4">
                  <button
                    type="button"
                    disabled={testState === "sending"}
                    onClick={sendTest}
                    className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-50"
                  >
                    {testState === "sending" ? "Sending" : "Send me a test email"}
                  </button>
                  {testState === "sent" && (
                    <span className="text-body-sm text-green">Sent. Check your inbox.</span>
                  )}
                  {testState === "failed" && (
                    <span className="text-body-sm text-error">{testErr}</span>
                  )}
                  <span className="w-full text-body-sm text-dim">
                    Sends from {data.integrations.brevo.from}. Team alerts go to{" "}
                    {data.adminAlertEmail}.
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="mt-6 max-w-[var(--measure-body)] text-body-sm text-dim">
        Those keys live in Vercel under Environment Variables and never appear
        here. After changing one, redeploy for it to take effect.
      </p>
    </div>
  );
}

/* ---------------- Google (connected from here, not from Vercel) --------- */

type GoogleConn = {
  connected: boolean;
  clientEmail?: string;
  projectId?: string;
  property?: string | null;
  connectedAt?: string;
  lastOkAt?: string | null;
  lastError?: string | null;
};

const STEPS = [
  "In console.cloud.google.com create a project, then under APIs and Services, Library, enable the Search Console API and the Google Analytics Data API.",
  "Under IAM and Admin, Service Accounts, create a service account. Open it, go to Keys, Add key, Create new key, JSON. A file downloads.",
  "In Search Console open Settings, Users and permissions, Add user. Paste the address shown below once you connect, and give it Full access.",
  "Open the downloaded file in any text editor, copy everything, and paste it in the box here.",
];

function GoogleCard() {
  const [conn, setConn] = useState<GoogleConn | null>(null);
  const [properties, setProperties] = useState<{ siteUrl: string; permissionLevel: string }[]>([]);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/integrations/google", { headers: await authHeader() });
      const j = await r.json();
      if (r.ok) {
        setConn(j.connection);
        setProperties(j.properties ?? []);
      } else setErr(j.error ?? "Could not read the Google connection.");
    } catch {
      setErr("Could not read the Google connection.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function connect() {
    setBusy(true);
    setErr("");
    setNotice("");
    try {
      const r = await fetch("/api/admin/integrations/google", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ key }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not connect.");
      setKey("");
      setConn(j.connection);
      setProperties(j.properties ?? []);
      if (j.notice) setNotice(j.notice);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function choose(property: string) {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/integrations/google", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ property }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not save.");
      setConn(j.connection);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Google? The search numbers stop updating until you connect again.")) return;
    setBusy(true);
    try {
      await fetch("/api/admin/integrations/google", { method: "DELETE", headers: await authHeader() });
      setConn({ connected: false });
      setProperties([]);
    } finally {
      setBusy(false);
    }
  }

  if (!conn) return null;

  return (
    <div className="rounded-[12px] border border-hair bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-h4 text-ink">Google Search Console and Analytics</p>
          <p className="mt-1 max-w-[var(--measure-body)] text-body-sm text-muted">
            Reads what people search to find you, which pages earn the clicks,
            and where you rank. Read only: nothing on your Google account can be
            changed from here.
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 font-mono text-label uppercase ${
            conn.connected ? "border-green/40 text-green" : "border-hair text-dim"
          }`}
        >
          {conn.connected ? "Connected" : "Not connected"}
        </span>
      </div>

      {!conn.connected ? (
        <div className="mt-5 border-t border-hair pt-5">
          <ol className="grid gap-2">
            {STEPS.map((step, i) => (
              <li key={step} className="flex gap-3 text-body-sm text-muted">
                <span className="font-mono text-label text-gold">{i + 1}</span>
                <span className="max-w-[var(--measure-body)]">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-body-sm text-dim">
            No credit card and no billing account needed. The key is stored where
            only the server can read it and is never shown again.
          </p>
          <label className="mt-4 block">
            <span className={labelCls}>Paste the key file here</span>
            <textarea
              rows={5}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              spellCheck={false}
              className={`${fieldCls} mt-1.5 resize-y font-mono text-body-sm`}
              placeholder={'{ "type": "service_account", "project_id": "...", ... }'}
            />
          </label>
          {err ? <p className="mt-3 text-body-sm text-error">{err}</p> : null}
          <button
            type="button"
            onClick={connect}
            disabled={busy || key.trim().length < 40}
            className="tap mt-4 rounded-[8px] bg-brand-gradient px-5 py-2.5 text-body-sm font-semibold text-canvas transition-all hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "Checking with Google..." : "Connect Google"}
          </button>
        </div>
      ) : (
        <div className="mt-5 border-t border-hair pt-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="min-w-0">
              <p className={labelCls}>Connected as</p>
              <p className="mt-1 break-all font-mono text-body-sm text-ink">{conn.clientEmail}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(conn.clientEmail ?? "");
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
              className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold"
            >
              {copied ? "Copied" : "Copy address"}
            </button>
          </div>

          {notice ? (
            <p className="mt-4 rounded-[8px] border border-gold/30 bg-gold/[0.06] px-4 py-3 text-body-sm text-muted">
              {notice}
            </p>
          ) : null}
          {conn.lastError && !notice ? (
            <p className="mt-4 rounded-[8px] border border-error/30 bg-error/[0.06] px-4 py-3 text-body-sm text-muted">
              {conn.lastError}
            </p>
          ) : null}

          <div className="mt-5">
            <p className={labelCls}>Which property to read</p>
            {properties.length === 0 ? (
              <p className="mt-2 max-w-[var(--measure-body)] text-body-sm text-muted">
                This account cannot see any property yet. In Search Console open
                Settings, Users and permissions, Add user, and paste the address
                above with Full access. Then reload this page.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {properties.map((p) => (
                  <button
                    key={p.siteUrl}
                    type="button"
                    disabled={busy}
                    onClick={() => choose(p.siteUrl)}
                    className={`tap rounded-[8px] border px-4 py-2 text-body-sm transition-colors ${
                      conn.property === p.siteUrl
                        ? "border-gold/60 bg-gold/10 font-semibold text-gold"
                        : "border-hair text-muted hover:border-gold/40 hover:text-ink"
                    }`}
                  >
                    {p.siteUrl}
                  </button>
                ))}
              </div>
            )}
          </div>

          {err ? <p className="mt-4 text-body-sm text-error">{err}</p> : null}
          <div className="mt-5 flex items-center gap-3 border-t border-hair pt-5">
            <button type="button" onClick={load} disabled={busy} className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-muted transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-50">
              Re-check
            </button>
            <button
              type="button"
              onClick={disconnect}
              disabled={busy}
              className="tap rounded-[8px] border border-hair px-4 py-2 font-mono text-label uppercase text-dim transition-colors hover:border-error/60 hover:text-error disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
