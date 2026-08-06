import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { syncProductsFromCatalogTable } from "@/lib/checkout/sync-catalog";

export const runtime = "nodejs";

/*
 * Publish the `catalog` table to `products` so Catalog edits reach checkout.
 * Admin-only and idempotent. `active` is driven by the catalog (hidden or
 * in-production videos become unbuyable). Called by the Catalog screen after
 * every edit, and available as a manual "Publish to checkout" button.
 */
export async function POST(req: Request) {
  const admin = await verifyAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  try {
    const result = await syncProductsFromCatalogTable(supabaseAdmin());
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Publish failed." },
      { status: 500 },
    );
  }
}
