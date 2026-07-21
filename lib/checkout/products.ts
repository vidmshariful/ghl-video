import "server-only";
import { supabaseAdmin } from "./supabase-admin";

/*
 * The product record is the single source of price truth. The server
 * always reads price_cents from here by SKU; the client never sends an
 * amount. metadata carries per-product config (tags, delivery, upsell).
 */
export type ProductMetadata = {
  tier?: string;
  video_count?: number;
  format?: string;
  capability?: string;
  delivery_days?: number;
  bump_eligible?: boolean;
  upsell_sku?: string;
  hl_tags?: string[];
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  type: "one_time" | "subscription";
  price_cents: number;
  currency: string;
  active: boolean;
  metadata: ProductMetadata;
};

/** Active product by SKU, or null. Inactive/unknown SKUs return null. */
export async function getActiveProductBySku(sku: string): Promise<Product | null> {
  const { data, error } = await supabaseAdmin()
    .from("products")
    .select("*")
    .eq("sku", sku)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(`products lookup failed: ${error.message}`);
  return (data as Product) ?? null;
}
