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

export type GuidelineFile = { path: string; name: string; size: number };

export type BrandKit = {
  brandName: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  pronunciation: string | null;
  notes: string | null;
  /* the three the studio used to ask for by email (16 September 2026) */
  website: string | null;
  voiceAccent: string | null;
  niche: string | null;
  /* the original single slot. Existing clients' logos live here and the
     intake brief falls back to it; new uploads use the two named slots. */
  logoPath: string | null;
  /* dark artwork, previewed on a white ground */
  logoDarkPath: string | null;
  /* white artwork, previewed on a dark ground */
  logoLightPath: string | null;
  guidelineFiles: GuidelineFile[];
  screenshotPaths: string[];
};

export const EMPTY_BRAND_KIT: BrandKit = {
  brandName: null,
  primaryColor: null,
  accentColor: null,
  pronunciation: null,
  notes: null,
  website: null,
  voiceAccent: null,
  niche: null,
  logoPath: null,
  logoDarkPath: null,
  logoLightPath: null,
  guidelineFiles: [],
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
  { key: "anyLogo", label: "Your logo" },
  { key: "primaryColor", label: "Your main brand colour" },
] as const;

/* Guideline files are deliberately in neither list, same as screenshots:
   reference paperwork helps the studio but a kit without it is not less
   ready and must never read that way. */
const EXTRAS = [
  { key: "secondLogo", label: "Your logo's other face, for dark and light scenes" },
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

/* the derived facts the checklists ask about: any logo at all, and whether
   both faces of the mark are in (counted once one is) */
const field = (k: BrandKit, key: string): unknown => {
  if (key === "anyLogo") return k.logoDarkPath ?? k.logoLightPath ?? k.logoPath;
  if (key === "secondLogo")
    return k.logoDarkPath && k.logoLightPath ? "both" : null;
  return k[key as keyof BrandKit];
};

export function completeness(kit: BrandKit | null): Completeness {
  const k = kit ?? EMPTY_BRAND_KIT;
  const missing = REQUIRED.filter((f) => !has(field(k, f.key))).map((f) => f.label);
  const couldAdd = EXTRAS.filter((f) => !has(field(k, f.key))).map((f) => f.label);

  const requiredDone = REQUIRED.length - missing.length;
  const extrasDone = EXTRAS.length - couldAdd.length;

  return {
    ready: missing.length === 0,
    empty: requiredDone + extrasDone === 0,
    /* The essentials carry half the bar by construction, however many
     * extras exist: a kit we can genuinely start from must never read as
     * barely begun. Rounded down, so unfinished can never show 100. */
    percent: Math.floor(
      (requiredDone / REQUIRED.length) * 50 + (extrasDone / EXTRAS.length) * 50,
    ),
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
        website: (r.website as string | null) ?? null,
        voiceAccent: (r.voice_accent as string | null) ?? null,
        niche: (r.niche as string | null) ?? null,
        logoPath: (r.logo_path as string | null) ?? null,
        logoDarkPath: (r.logo_dark_path as string | null) ?? null,
        logoLightPath: (r.logo_light_path as string | null) ?? null,
        guidelineFiles: (r.guideline_files as GuidelineFile[] | null) ?? [],
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
  put("website", patch.website);
  put("voice_accent", patch.voiceAccent);
  put("niche", patch.niche);
  put("logo_path", patch.logoPath);
  put("logo_dark_path", patch.logoDarkPath);
  put("logo_light_path", patch.logoLightPath);
  put("guideline_files", patch.guidelineFiles);
  put("screenshot_paths", patch.screenshotPaths);

  /* Nothing worth writing. Not an error: an intake that only picked videos
   * legitimately has no brand fields in it. */
  if (Object.keys(row).length === 1) return { error: null };

  const { error } = await db
    .from("brand_kits")
    .upsert(row, { onConflict: "customer_id" });
  return { error: error ? String((error as { message?: string }).message ?? error) : null };
}

/**
 * The kit as the portal screen consumes it: the row plus expiring signed
 * URLs for every stored file. One shape, built in one place, so the GET
 * and the upload route can never disagree about what the screen receives.
 */
export async function brandKitPayload(db: DB, customerId: string | null) {
  const kit = customerId ? await getBrandKit(db, customerId) : null;
  const sign = async (path: string | null) => {
    if (!path) return null;
    const { data } = await db.storage.from("intake").createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };
  return {
    kit,
    completeness: completeness(kit),
    logoUrl: await sign(kit?.logoPath ?? null),
    logoDarkUrl: await sign(kit?.logoDarkPath ?? null),
    logoLightUrl: await sign(kit?.logoLightPath ?? null),
    guidelines: await Promise.all(
      (kit?.guidelineFiles ?? []).map(async (g) => ({ ...g, url: await sign(g.path) })),
    ),
  };
}

/* ---------------------------------------------------------------- */
/* the kit reaching the orders still being worked                     */
/* ---------------------------------------------------------------- */

/* what the studio reads on the order, keyed the way the brief stores it */
const BRIEF_KEY: Partial<Record<keyof BrandKit, string>> = {
  brandName: "brandName",
  primaryColor: "primaryColor",
  accentColor: "accentColor",
  pronunciation: "brandPronunciation",
  notes: "notes",
  website: "website",
  voiceAccent: "voiceAccent",
  niche: "niche",
  logoPath: "logoPath",
  logoDarkPath: "logoPath",
  logoLightPath: "logoPath",
};

const BRIEF_LABEL: Record<string, string> = {
  brandName: "brand name",
  primaryColor: "main colour",
  accentColor: "second colour",
  brandPronunciation: "pronunciation",
  notes: "notes",
  website: "website",
  voiceAccent: "voiceover accent",
  niche: "niche",
  logoPath: "logo",
};

/**
 * A Brand Kit edit reaching every order still being worked.
 *
 * The studio reads the brief ON the order, and a client who fixed their logo
 * in the Brand Kit while a pack was in production had changed nothing the
 * studio would see: the one real revision case on the platform was exactly
 * that (Premade review, 16 September 2026). So the fields that changed are
 * copied onto the brief of each paid, undelivered order that has one, with
 * an update on the order saying what changed, and the producer is told.
 * Returns how many orders took the change.
 */
export async function propagateKitToOpenOrders(
  db: DB,
  customerId: string,
  patch: Partial<BrandKit>,
): Promise<number> {
  const fields: Record<string, string> = {};
  for (const [k, briefKey] of Object.entries(BRIEF_KEY) as [keyof BrandKit, string][]) {
    const v = patch[k];
    if (typeof v === "string" && v.trim()) fields[briefKey] = v.trim();
  }
  if (!Object.keys(fields).length) return 0;

  const { data: orders } = await db
    .from("orders")
    .select("id, metadata, product:products(name)")
    .eq("customer_id", customerId)
    .eq("status", "paid")
    .neq("fulfillment_stage", "delivered")
    .not("metadata->intake", "is", null);

  let touched = 0;
  for (const o of orders ?? []) {
    const meta = (o.metadata ?? {}) as Record<string, unknown>;
    const intake = (meta.intake ?? null) as Record<string, unknown> | null;
    if (!intake?.submittedAt) continue;
    const changed = Object.entries(fields).filter(([k, v]) => intake[k] !== v);
    if (!changed.length) continue;

    const now = new Date().toISOString();
    const { error } = await db
      .from("orders")
      .update({ metadata: { ...meta, intake: { ...intake, ...Object.fromEntries(changed), kitUpdatedAt: now } } })
      .eq("id", o.id as string);
    if (error) continue;

    const what = [...new Set(changed.map(([k]) => BRIEF_LABEL[k] ?? k))].join(", ");
    await db.from("order_updates").insert({
      order_id: o.id as string,
      body: `Brand kit updated by the client: ${what}. The brief on this order now carries it.`,
    });
    try {
      const { pushOrderOwnerNotification } = await import("@/lib/notifications");
      const product = o.product as { name?: string } | { name?: string }[] | null;
      const name = Array.isArray(product) ? product[0]?.name : product?.name;
      await pushOrderOwnerNotification(db, o.id as string, {
        kind: "brief_updated",
        title: `Brand changed on ${name ?? "an order"}`,
        body: `${what}. The brief on the order now carries it.`,
        href: `production/${o.id}`,
        vars: { product_name: name ?? "an order", what },
      });
    } catch (e) {
      console.error("[brand-kit] producer not told of a kit change:", e instanceof Error ? e.message : e);
    }
    touched++;
  }
  return touched;
}
