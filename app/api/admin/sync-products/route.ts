import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { syncProductsFromCatalog } from "@/lib/checkout/sync-products";

export const runtime = "nodejs";

/*
 * Sync the products table from the catalog (lib/site.ts). Admin-only and
 * idempotent: new one-time SKUs get a row, existing catalog SKUs take the
 * catalog's price/name/metadata so display and charge can never drift.
 * The active switch and hand-created rows are never touched.
 */
export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  try {
    const result = await syncProductsFromCatalog(supabaseAdmin());
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed." },
      { status: 500 },
    );
  }
}
