/* The customer portal's sections. Each is a URL segment
 * (/portal/<section>/); the [[...view]] route validates against this list.
 * Plain module on purpose: the server route needs the VALUES, and data
 * exported from a "use client" file never crosses to server components.
 *
 * Six in the menu since phase 6 (owner decision, 14 September 2026): Home,
 * My work, Billing, Brand, Messages, Settings. The store and the offers are
 * reached from a strip on Home, so they keep their URLs without a place in
 * the menu. The old section names live on as aliases, because emails, bells
 * and bookmarks carry them: /portal/projects/ still opens the custom line. */
export const PORTAL_SECTIONS = [
  "home",
  "work",
  "billing",
  "brand",
  "messages",
  "settings",
  /* reachable from Home's strip, not from the menu */
  "library",
  "coming-soon",
  "book",
  "affiliate",
  "whitelabel",
  "socialx",
  "help",
] as const;
export type PortalSection = (typeof PORTAL_SECTIONS)[number];

/** The six the menu shows, in order; Settings sits at the bottom. */
export const NAV_SECTIONS: PortalSection[] = ["home", "work", "billing", "brand", "messages"];

export const WORK_LINES = ["premade", "custom", "editing"] as const;
export type WorkLine = (typeof WORK_LINES)[number];

/** Where an old section name goes now. */
export const LEGACY_SECTIONS: Record<string, { section: PortalSection; line?: WorkLine }> = {
  dashboard: { section: "home" },
  orders: { section: "billing" },
  videos: { section: "work", line: "premade" },
  projects: { section: "work", line: "custom" },
  custom: { section: "work", line: "custom" },
  subscriptions: { section: "work", line: "editing" },
  editing: { section: "work", line: "editing" },
};

export type ResolvedSection = { section: PortalSection; line: WorkLine | null; id: string | null };

/**
 * A portal path's segments (after /portal/), old or new, to the screen they
 * mean. /portal/work/custom/<id>/ opens that project; /portal/projects/<id>/
 * still does too. /portal/billing/<id>/ opens that order; /portal/library/<code>/
 * that item.
 */
export function resolveSection(segs: readonly string[]): ResolvedSection {
  const head = segs[0] ?? "home";
  if ((PORTAL_SECTIONS as readonly string[]).includes(head)) {
    const section = head as PortalSection;
    if (section === "work") {
      const line = (WORK_LINES as readonly string[]).includes(segs[1] ?? "") ? (segs[1] as WorkLine) : null;
      return { section, line, id: line ? (segs[2] ?? null) : null };
    }
    return { section, line: null, id: segs[1] ?? null };
  }
  const legacy = LEGACY_SECTIONS[head];
  if (legacy) return { section: legacy.section, line: legacy.line ?? null, id: segs[1] ?? null };
  return { section: "home", line: null, id: null };
}

/** The path for a screen: the one every link and pushState uses. */
export function sectionPath(section: PortalSection, line?: WorkLine | null, id?: string | null): string {
  if (section === "home") return "/portal/";
  if (section === "work") return line ? `/portal/work/${line}/${id ? `${id}/` : ""}` : "/portal/work/";
  return id ? `/portal/${section}/${id}/` : `/portal/${section}/`;
}

/** Is this a section head the portal will open, today's name or an old one? */
export function isPortalHead(head: string): boolean {
  return (PORTAL_SECTIONS as readonly string[]).includes(head) || head in LEGACY_SECTIONS;
}
