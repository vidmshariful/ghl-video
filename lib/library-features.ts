/*
 * The HighLevel feature vocabulary behind the library's Filter by feature
 * rail, and the matcher that applies it.
 *
 * The vocabulary lives in the database (admin -> Products & Packs -> Library
 * filters) with this file's DEFAULT list as the build-time fallback, the
 * same authority order the site chrome uses: DB first, code when the DB is
 * unreachable or empty.
 *
 * Matching is deliberately dumb: an alias is a case-insensitive substring of
 * the video's title, subject and category. Not regex, although the first
 * version used them, because an admin screen that accepts regex hands the
 * owner a way to take the public library down with one bad bracket. A
 * substring cannot fail to compile.
 *
 * Import-free (types aside) so the rules test without a database.
 */

export type LibraryFeature = {
  key: string;
  label: string;
  aliases: string[];
  active: boolean;
  sort: number;
};

/** True when any alias appears in the text. Empty aliases match nothing. */
export function matchFeature(text: string, aliases: string[]): boolean {
  const hay = text.toLowerCase();
  return aliases.some((a) => {
    const needle = a.trim().toLowerCase();
    return needle.length > 0 && hay.includes(needle);
  });
}

/** What the rail shows: active features that match something, biggest first. */
export function featureCounts<T>(
  items: T[],
  textOf: (item: T) => string,
  features: LibraryFeature[],
): { key: string; label: string; count: number }[] {
  return features
    .filter((f) => f.active)
    .map((f) => ({
      key: f.key,
      label: f.label,
      count: items.filter((i) => matchFeature(textOf(i), f.aliases)).length,
    }))
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** keeps a hand-typed key url-safe and stable */
export function slugifyFeatureKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/* The launch vocabulary, matching what the catalogue's titles actually say.
 * Seeded into the table by migration 0064; kept here as the fallback. */
export const DEFAULT_LIBRARY_FEATURES: LibraryFeature[] = [
  { key: "ai-employee", label: "AI Employee", aliases: ["ai employee"], active: true, sort: 0 },
  { key: "conversational-ai", label: "Conversational AI", aliases: ["conversational ai"], active: true, sort: 1 },
  { key: "voice-ai", label: "Voice AI", aliases: ["voice ai"], active: true, sort: 2 },
  { key: "content-ai", label: "Content AI", aliases: ["content ai"], active: true, sort: 3 },
  { key: "ask-ai", label: "Ask AI", aliases: ["ask ai"], active: true, sort: 4 },
  { key: "ai-receptionist", label: "AI Receptionist", aliases: ["ai receptionist"], active: true, sort: 5 },
  { key: "inbox", label: "Unified Inbox", aliases: ["unified inbox", "all-in-one inbox"], active: true, sort: 6 },
  { key: "reputation", label: "Reputation & Reviews", aliases: ["reputation", "review"], active: true, sort: 7 },
  { key: "pipeline", label: "Pipeline & CRM", aliases: ["opportunity pipeline", "contact management"], active: true, sort: 8 },
  { key: "automation", label: "Workflows & Automation", aliases: ["automation", "workflow", "automated"], active: true, sort: 9 },
  { key: "funnels", label: "Funnels & Websites", aliases: ["funnel", "website"], active: true, sort: 10 },
  { key: "email", label: "Email Builder", aliases: ["email"], active: true, sort: 11 },
  { key: "social", label: "Social Media Planner", aliases: ["social media"], active: true, sort: 12 },
  { key: "calendars", label: "Calendars & Booking", aliases: ["calendar"], active: true, sort: 13 },
  { key: "texting", label: "Two-Way Texting", aliases: ["two-way", "texting"], active: true, sort: 14 },
  { key: "missed-call", label: "Missed Call Text Back", aliases: ["missed call"], active: true, sort: 15 },
  { key: "calls", label: "Calls & Dialer", aliases: ["call tracking", "power dialer"], active: true, sort: 16 },
  { key: "payments", label: "Payments & Invoicing", aliases: ["payment", "invoice", "invoicing"], active: true, sort: 17 },
  { key: "memberships", label: "Memberships & Courses", aliases: ["membership"], active: true, sort: 18 },
  { key: "mobile", label: "Mobile App", aliases: ["mobile app"], active: true, sort: 19 },
  { key: "reporting", label: "Reporting", aliases: ["reporting"], active: true, sort: 20 },
  { key: "forms", label: "Forms & Surveys", aliases: ["forms", "survey"], active: true, sort: 21 },
  { key: "chat", label: "Live Chat", aliases: ["live chat"], active: true, sort: 22 },
  {
    key: "platform",
    label: "The whole platform",
    aliases: ["all-in-one", "all in one", "platform", "everything in one place", "lead to close"],
    active: true,
    sort: 23,
  },
];

/** DB rows -> the shape above; anything malformed is dropped, not thrown. */
export function rowsToFeatures(rows: unknown): LibraryFeature[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => {
      /* a null or string element must fall out, not throw: this runs while
         rendering the public page and a bad row is not worth a crash */
      if (!r || typeof r !== "object") return null;
      const row = r as Record<string, unknown>;
      const key = typeof row.key === "string" ? row.key : "";
      const label = typeof row.label === "string" ? row.label : "";
      const aliases = Array.isArray(row.aliases)
        ? (row.aliases as unknown[]).filter((a): a is string => typeof a === "string")
        : [];
      if (!key || !label) return null;
      return {
        key,
        label,
        aliases,
        active: row.active !== false,
        sort: Number(row.sort ?? 0),
      };
    })
    .filter((f): f is LibraryFeature => f !== null)
    .sort((a, b) => a.sort - b.sort);
}
