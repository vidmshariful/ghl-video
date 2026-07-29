"use client";

import { supabaseBrowser as supabase } from "@/lib/supabase-browser";

/*
 * Authed fetch helpers for the chat UI, shared by the portal and the admin.
 * Both surfaces use the same Supabase browser session, so the bearer token is
 * simply whoever is signed in; the server routes decide what that identity can
 * see (own email in the portal, admins allowlist in admin).
 */
export type ChatAttachment = { name: string; size: number; type: string; url: string | null };
export type ChatMessage = {
  id: string;
  senderRole: "customer" | "studio";
  senderName: string | null;
  body: string;
  attachments: ChatAttachment[];
  createdAt: string;
};

async function token(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// The site forces a trailing slash on every path; hitting the canonical URL
// directly avoids a 308 on each (frequent, polled) chat request.
function canonical(path: string): string {
  const [p, q] = path.split("?");
  const base = p.endsWith("/") ? p : `${p}/`;
  return q ? `${base}?${q}` : base;
}

export async function chatGet<T>(path: string): Promise<T> {
  const t = await token();
  const r = await fetch(canonical(path), {
    headers: t ? { Authorization: `Bearer ${t}` } : {},
    cache: "no-store",
  });
  return r.json();
}

export async function chatPostForm<T>(path: string, form: FormData): Promise<T> {
  const t = await token();
  const r = await fetch(canonical(path), {
    method: "POST",
    headers: t ? { Authorization: `Bearer ${t}` } : {},
    body: form,
  });
  return r.json();
}

export async function chatPostJson<T>(path: string, body: unknown): Promise<T> {
  const t = await token();
  const r = await fetch(canonical(path), {
    method: "POST",
    headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}
