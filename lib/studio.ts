import { SB_ANON, SB_URL } from "@/lib/chrome";

/*
 * Studio Insights data: capacity slots and the production board, read
 * with the RLS-limited anon key (both tables are public content, managed
 * from the admin Studio screen).
 *
 * FAILURE POLICY, same as the chrome: if Supabase is unreachable the
 * fetchers return empty and the page renders its designed empty states.
 * The site never breaks because the backend had a bad day.
 */
export type StudioSlot = {
  service: "premade" | "custom" | "editing";
  period_label: string;
  total: number;
  remaining: number;
  updated_at: string;
};

export type StudioUpdate = {
  id: string;
  title: string;
  status: "selected" | "in_production" | "published";
  note: string | null;
  target_date: string | null;
  link_slug: string | null;
  sort: number;
  updated_at: string;
};

async function sb<T>(path: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
      signal: ctrl.signal,
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`supabase ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Slots with a real capacity set (total > 0), keyed by service. */
export async function getStudioSlots(): Promise<StudioSlot[]> {
  try {
    const rows = await sb<StudioSlot[]>(
      "studio_slots?select=service,period_label,total,remaining,updated_at&total=gt.0",
    );
    return rows;
  } catch {
    return [];
  }
}

/** Published board entries across the three pipeline stages. */
export async function getStudioUpdates(): Promise<StudioUpdate[]> {
  try {
    return await sb<StudioUpdate[]>(
      "studio_updates?select=id,title,status,note,target_date,link_slug,sort,updated_at&published=is.true&order=sort.asc,updated_at.desc",
    );
  } catch {
    return [];
  }
}
