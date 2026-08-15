import "server-only";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { salesPages, salesPageUrl } from "@/lib/sales/pages";
import { site } from "@/lib/site";

/*
 * Data layer for the affiliate partner portal (/partners) and its admin
 * screen. Partners live in the `partners` table (migration 0024); this file
 * is the only place that shapes those rows for the portal APIs.
 *
 * NOTE: the checkout money path still reads lib/affiliates.ts (the code
 * registry) for discounts. This table is the management + portal source.
 * Bridging checkout to the DB is a deliberate later phase, so nothing in
 * here can affect payments.
 */

export type PartnerStatus = "applied" | "invited" | "active" | "paused" | "rejected";

export type PartnerRow = {
  id: string;
  ref: string;
  name: string;
  email: string | null;
  status: PartnerStatus;
  tier: "affiliate" | "vip" | "partnership";
  review_at: string | null;
  photo_path: string | null;
  role_line: string;
  tagline: string | null;
  bio: string | null;
  coupon_code: string | null;
  discount_percent: number;
  discount_months: number;
  stripe_coupon_id: string | null;
  fp_ref: string | null;
  fp_promoter_id: string | null;
  application: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PartnerAssetRow = {
  id: string;
  kind: "banner" | "graphic" | "logo" | "video" | "copy" | "doc";
  title: string;
  description: string | null;
  file_path: string | null;
  body: string | null;
  partner_id: string | null;
  sort: number;
  active: boolean;
  created_at: string;
};

export async function partnerByEmail(email: string): Promise<PartnerRow | null> {
  const clean = email.trim().toLowerCase();
  if (!clean) return null;
  const { data, error } = await supabaseAdmin()
    .from("partners")
    .select("*")
    .ilike("email", clean)
    .maybeSingle();
  if (error) throw new Error(`partner lookup failed: ${error.message}`);
  return (data as PartnerRow | null) ?? null;
}

export async function partnerByRef(ref: string): Promise<PartnerRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("partners")
    .select("*")
    .eq("ref", ref)
    .maybeSingle();
  if (error) throw new Error(`partner lookup failed: ${error.message}`);
  return (data as PartnerRow | null) ?? null;
}

/* What a partner LANDING PAGE needs about its partner: discount terms + the
 * coupon its buy buttons carry. DB-first (the managed source), falling back
 * to the code registry (lib/affiliates.ts) so a DB hiccup can never blank a
 * live campaign page. */
export async function partnerOffer(ref: string): Promise<{
  percent: number;
  months: number;
  couponCode: string | null;
}> {
  try {
    const row = await partnerByRef(ref);
    if (row) {
      return {
        percent: row.discount_percent,
        months: row.discount_months,
        couponCode: row.coupon_code,
      };
    }
  } catch {
    /* fall through to the registry */
  }
  const { affiliateByRef } = await import("@/lib/affiliates");
  const aff = affiliateByRef(ref);
  return {
    percent: aff?.discountPercent ?? 0,
    months: aff?.discountMonths ?? 0,
    couponCode: aff?.code ?? null,
  };
}

/* First sign-in after an invite counts as accepting it. */
export async function activateIfInvited(p: PartnerRow): Promise<PartnerRow> {
  if (p.status !== "invited") return p;
  const { data } = await supabaseAdmin()
    .from("partners")
    .update({ status: "active" })
    .eq("id", p.id)
    .eq("status", "invited")
    .select("*")
    .maybeSingle();
  return (data as PartnerRow | null) ?? { ...p, status: "active" };
}

/* Global assets plus this partner's own, active only, in display order. */
export async function assetsForPartner(partnerId: string): Promise<PartnerAssetRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("partner_assets")
    .select("*")
    .eq("active", true)
    .or(`partner_id.is.null,partner_id.eq.${partnerId}`)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`partner assets failed: ${error.message}`);
  return (data ?? []) as PartnerAssetRow[];
}

/* A file_path is either a full URL (external asset) or a path inside the
 * public partner-assets bucket. */
export function assetFileUrl(filePath: string | null): string | null {
  if (!filePath) return null;
  if (/^https?:\/\//i.test(filePath)) return filePath;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return base ? `${base}/storage/v1/object/public/partner-assets/${filePath}` : null;
}

/* The partner's landing pages, from the sales-page registry. */
export function pagesForRef(ref: string): { title: string; url: string }[] {
  return salesPages
    .filter((p) => p.kind === "partner" && p.affiliateRef === ref && p.status === "live")
    .map((p) => ({ title: p.title, url: `${site.url}${salesPageUrl(p.slug)}/` }));
}

/* A tracked link to any site path: our ref for attribution + discount, plus
 * the partner's FirstPromoter token when set, so both systems credit. */
export function trackedLink(p: Pick<PartnerRow, "ref" | "fp_ref">, path = "/"): string {
  const url = new URL(path, site.url);
  url.searchParams.set("ref", p.ref);
  if (p.fp_ref) url.searchParams.set("fpr", p.fp_ref);
  return url.toString();
}

/* Shared gate for the partner data routes: a valid session that is either
 * an active (or invited) partner, or a team member acting for one via the
 * validated X-Act-For header. When `feature` is given, members also need
 * that grant; owners always pass. Returns the OWNER's partner row (data is
 * always the owner's), or a status to respond with. */
export async function requireActivePartner(
  req: Request,
  feature?: string,
): Promise<
  | { partner: PartnerRow; isOwner: boolean; features: string[] | null }
  | { failStatus: 401 | 403 }
> {
  const { getSessionUser } = await import("@/lib/account/session");
  const user = await getSessionUser(req);
  if (!user) return { failStatus: 401 };
  const actFor = req.headers.get("x-act-for")?.trim().toLowerCase() || null;

  if (!actFor || actFor === user.email) {
    const partner = await partnerByEmail(user.email);
    if (!partner || !["active", "invited"].includes(partner.status)) return { failStatus: 403 };
    return { partner, isOwner: true, features: null };
  }

  const { supabaseAdmin } = await import("@/lib/checkout/supabase-admin");
  const { resolvePortalContext } = await import("@/lib/account-team");
  const ctx = await resolvePortalContext(supabaseAdmin(), req, "partner");
  if ("failStatus" in ctx) return ctx;
  const partner = await partnerByEmail(ctx.ownerEmail);
  if (!partner || !["active", "invited"].includes(partner.status)) return { failStatus: 403 };
  if (feature) {
    const { memberCan } = await import("@/lib/team-features");
    if (!memberCan(ctx.features, feature)) return { failStatus: 403 };
  }
  return { partner, isOwner: false, features: ctx.features };
}
