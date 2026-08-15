import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { getSessionUser } from "@/lib/account/session";
import { clearAvatar, saveAvatar } from "@/lib/profiles";

export const runtime = "nodejs";

/* The signed-in customer's profile photo: upload a new one or remove it. */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Attach an image file." }, { status: 400 });

  const result = await saveAvatar(supabaseAdmin(), user, file);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, avatarUrl: result.avatarUrl });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await clearAvatar(supabaseAdmin(), user);
  return NextResponse.json({ ok: true });
}
