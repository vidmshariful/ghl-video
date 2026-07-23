import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { syncProductsFromCatalog } from "@/lib/checkout/sync-products";

export const runtime = "nodejs";

/*
 * Seed the products table from the catalog. Admin-only, insert-only, and
 * idempotent: run it after adding a video or pack to lib/site.ts and the
 * new one-time SKUs get their products row (existing rows are preserved).
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
