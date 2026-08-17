import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * The client's brand, given once and used on everything after.
 *
 * Deliberately import-free at the top so the completeness rules can be shared
 * with the portal screen in the browser. The database half lives at the bottom
 * behind an explicit client argument, which is also what makes it testable
 * without a database: the rules are the part worth getting right, and they
 * are the part with no I/O in them.
 */

export type BrandKit = {
  brandName: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  pronunciation: string | null;
  notes: string | null;
  logoPath: string | null;
  screenshotPaths: string[];
};

export const EMPTY_BRAND_KIT: BrandKit = {
  brandName: null,
  primaryColor: null,
  accentColor: null,
  pronunciation: null,
  notes: null,
  logoPath: null,
  screenshotPaths: [],
};

/*
 * What the studio genuinely cannot start without, in the order somebody would
 * naturally supply it.
 *
 * Only three, and that restraint is the point. A checklist that demands
 * everything gets abandoned halfway, and a half filled kit that reads as
 * failing is worse than no checklist: the client stops, we chase, and the
 * order stalls on a field nobody actually needed. Pronunciation and notes
 * genuinely improve a video and are genuinely optional, so they are counted
 * as extras rather than held against anybody.
 */
const REQUIRED = [
  { key: "brandName", label: "Your brand or product name" },
  { key: "logoPath", label: "Your logo" },
  { key: "primaryColor", label: "Your main brand colour" },
] as const;

const EXTRAS = [
  { key: "accentColor", label: "A second colour" },
  { key: "pronunciation", label: "How your name is said out loud" },
  { key: "notes", label: "Anything else we should know" },
] as const;

export type Completeness = {
  /** every required piece is present */
  ready: boolean;
  /** nothing at all has been filled in */
  empty: boolean;
  /** 0 to 100, across required and extras, for a progress bar */
  percent: number;
  /** the required pieces still missing, named as a person would say them */
  missing: string[];
  /** the optional pieces still missing, offered rather than demanded */
  couldAdd: string[];
};

const has = (v: unknown) =>
  typeof v === "string" ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : false;

export function completeness(kit: BrandKit | null): Completeness {
  const k = kit ?? EMPTY_BRAND_KIT;
  const missing = REQUIRED.filter((f) => !has(k[f.key])).map((f) => f.label);
  const couldAdd = EXTRAS.filter((f) => !has(k[f.key])).map((f) => f.label);

  const total = REQUIRED.length + EXTRAS.length;
  const done = total - missing.length - couldAdd.length;

  return {
    ready: missing.length === 0,
    empty: done === 0,
    /* Rounded down, so a kit that is not finished can never show 100. */
    percent: Math.floor((done / total) * 100),
    missing,
    couldAdd,
  };
}

/* ---------------------------------------------------------------- */
/* the database half                                                  */
/* ---------------------------------------------------------------- */

/* A type-only import, so it is erased at compile time and the completeness
 * rules above stay usable from the browser. Hand rolling the shape instead
 * looked tidier and did not actually match the client, which is a worse kind
 * of wrong: it typechecks against itself and fails at the call site.
 *
 * Callers pass the service-role client, after a route has checked the session
 * owns this customer. */
type DB = SupabaseClient;

type Row = Record<string, unknown>;

const fromRow = (r: Row | null): BrandKit | null =>
  r
    ? {
        brandName: (r.brand_name as string | null) ?? null,
        primaryColor: (r.primary_color as string | null) ?? null,
        accentColor: (r.accent_color as string | null) ?? null,
        pronunciation: (r.pronunciation as string | null) ?? null,
        notes: (r.notes as string | null) ?? null,
        logoPath: (r.logo_path as string | null) ?? null,
        screenshotPaths: (r.screenshot_paths as string[] | null) ?? [],
      }
    : null;

export async function getBrandKit(db: DB, customerId: string): Promise<BrandKit | null> {
  const { data } = await db.from("brand_kits").select("*").eq("customer_id", customerId).maybeSingle();
  return fromRow(data as Row | null);
}

/**
 * Save the brand, merging rather than replacing.
 *
 * Only the fields actually supplied are written. A brief that asks for three
 * things must never blank the two the client gave us last time, which is
 * exactly what a straight overwrite would do.
 */
export async function saveBrandKit(
  db: DB,
  customerId: string,
  patch: Partial<BrandKit>,
): Promise<{ error: string | null }> {
  const row: Record<string, unknown> = { customer_id: customerId };
  const put = (col: string, v: unknown) => {
    if (v === undefined) return;
    if (typeof v === "string" && !v.trim()) return;
    if (Array.isArray(v) && !v.length) return;
    row[col] = v;
  };

  put("brand_name", patch.brandName);
  put("primary_color", patch.primaryColor);
  put("accent_color", patch.accentColor);
  put("pronunciation", patch.pronunciation);
  put("notes", patch.notes);
  put("logo_path", patch.logoPath);
  put("screenshot_paths", patch.screenshotPaths);

  /* Nothing worth writing. Not an error: an intake that only picked videos
   * legitimately has no brand fields in it. */
  if (Object.keys(row).length === 1) return { error: null };

  const { error } = await db
    .from("brand_kits")
    .upsert(row, { onConflict: "customer_id" });
  return { error: error ? String((error as { message?: string }).message ?? error) : null };
}
