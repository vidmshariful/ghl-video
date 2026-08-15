"use client";

import { useEffect, useState } from "react";
import { authHeader } from "./client";
import { TeamScreen } from "./TeamScreen";
import { AvatarUploader, PasswordCard } from "@/components/portal/account";
import type { Role } from "./roles";

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

type Tab = "profile" | "team" | "integrations";

export function SettingsScreen({
  me,
  onMeChanged,
}: {
  me: Me;
  onMeChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>("profile");
  const isAdmin = me.role === "admin";
  const tabs: { key: Tab; label: string }[] = [
    { key: "profile", label: "My profile" },
    ...(isAdmin
      ? ([
          { key: "team", label: "Team" },
          { key: "integrations", label: "Integrations" },
        ] as { key: Tab; label: string }[])
      : []),
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
        ) : (
          <ProfileTab me={me} onMeChanged={onMeChanged} />
        )}
      </div>
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
      <div className="grid gap-4 lg:grid-cols-2">
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
        Keys live in Vercel under Environment Variables and never appear here. After
        changing one, redeploy for it to take effect.
      </p>
    </div>
  );
}
