import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/checkout/admin-auth";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

export const runtime = "nodejs";

/*
 * The signed-in admin's own row: email, name, role, and features. The admin
 * shell reads this once after login to gate the menu to what this user may
 * see. Any admin may read their own row.
 */
export async function GET(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin()
    .from("admins")
    .select("email, name, role, features");
  const row = (data ?? []).find(
    (r) => (r.email ?? "").toLowerCase() === auth.email.toLowerCase(),
  );

  return NextResponse.json({
    email: auth.email,
    name: (row?.name as string | null) ?? null,
    role: (row?.role as string | undefined) ?? "manager",
    features: (row?.features as string[] | null | undefined) ?? null,
  });
}
