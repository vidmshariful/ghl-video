import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { contextCan, resolvePortalContext } from "@/lib/account-team";
import { brandKitPayload, getBrandKit, type GuidelineFile } from "@/lib/brand-kit";

export const runtime = "nodejs";

/*
 * Brand files, uploaded straight from the Brand Kit screen.
 *
 * Before this the portal could only SHOW the logo; getting one to us meant
 * an order brief or a message. Now the kit takes uploads directly: the two
 * faces of the logo (dark artwork and white artwork) and the brand's own
 * guideline documents.
 *
 * Files land in the same private intake bucket the briefs use, under the
 * customer's own prefix, and are always handed back as expiring signed URLs.
 */

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const DOC_TYPES = [...LOGO_TYPES, "application/pdf", "application/zip"];
const MAX_BYTES = 10_485_760;
const MAX_GUIDELINES = 8;

const KINDS = ["logo_dark", "logo_light", "guideline"] as const;
type Kind = (typeof KINDS)[number];

const COLUMN: Record<Exclude<Kind, "guideline">, string> = {
  logo_dark: "logo_dark_path",
  logo_light: "logo_light_path",
};

async function ctxAndCustomer(req: Request) {
  const db = supabaseAdmin();
  const ctx = await resolvePortalContext(db, req, "customer");
  if ("failStatus" in ctx) return { db, error: "Unauthorized.", status: ctx.failStatus as number };
  if (!contextCan(ctx, "orders"))
    return { db, error: "You do not have access to this.", status: 403 };
  const { data } = await db
    .from("customers")
    .select("id")
    .eq("email", ctx.ownerEmail)
    .maybeSingle();
  if (!data?.id)
    return { db, error: "Your brand kit is created with your first order.", status: 409 };
  return { db, customerId: String(data.id) };
}

export async function POST(req: Request) {
  const got = await ctxAndCustomer(req);
  if ("error" in got) return NextResponse.json({ error: got.error }, { status: got.status });
  const { db, customerId } = got;

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid submission." }, { status: 400 });

  const kind = String(form.get("kind") ?? "") as Kind;
  const file = form.get("file");
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "Which slot?" }, { status: 400 });
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ error: "Pick a file first." }, { status: 400 });

  const allowed = kind === "guideline" ? DOC_TYPES : LOGO_TYPES;
  if (!allowed.includes(file.type))
    return NextResponse.json(
      {
        error:
          kind === "guideline"
            ? "That file type is not supported. PDF, ZIP or an image works."
            : "A logo should be PNG, SVG, JPG or WebP.",
      },
      { status: 400 },
    );
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "That file is larger than 10 MB." }, { status: 400 });

  const kit = await getBrandKit(db, customerId);
  if (kind === "guideline" && (kit?.guidelineFiles?.length ?? 0) >= MAX_GUIDELINES)
    return NextResponse.json(
      { error: `That is ${MAX_GUIDELINES} files already. Remove one first.` },
      { status: 400 },
    );

  const ext = (file.name.split(".").pop() || "bin")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `brand/${customerId}/${kind}-${Date.now()}-${rand}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await db.storage
    .from("intake")
    .upload(path, buf, { contentType: file.type, upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  if (kind === "guideline") {
    const entry: GuidelineFile = { path, name: file.name.slice(0, 160), size: file.size };
    const next = [...(kit?.guidelineFiles ?? []), entry];
    const { error } = await db
      .from("brand_kits")
      .upsert({ customer_id: customerId, guideline_files: next }, { onConflict: "customer_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    /* replacing a logo removes the file it replaces; a client's old marks
       should not pile up in a bucket they cannot see */
    const oldPath = kind === "logo_dark" ? kit?.logoDarkPath : kit?.logoLightPath;
    const { error } = await db
      .from("brand_kits")
      .upsert({ customer_id: customerId, [COLUMN[kind]]: path }, { onConflict: "customer_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (oldPath) await db.storage.from("intake").remove([oldPath]).catch(() => null);
  }

  return NextResponse.json(await brandKitPayload(db, customerId));
}

export async function DELETE(req: Request) {
  const got = await ctxAndCustomer(req);
  if ("error" in got) return NextResponse.json({ error: got.error }, { status: got.status });
  const { db, customerId } = got;

  const b = (await req.json().catch(() => ({}))) as { kind?: string; path?: string };
  const kind = String(b.kind ?? "") as Kind;
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "Which slot?" }, { status: 400 });

  const kit = await getBrandKit(db, customerId);

  if (kind === "guideline") {
    const path = String(b.path ?? "");
    const entry = (kit?.guidelineFiles ?? []).find((g) => g.path === path);
    if (!entry) return NextResponse.json({ error: "File not found." }, { status: 404 });
    const next = (kit?.guidelineFiles ?? []).filter((g) => g.path !== path);
    const { error } = await db
      .from("brand_kits")
      .update({ guideline_files: next })
      .eq("customer_id", customerId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await db.storage.from("intake").remove([path]).catch(() => null);
  } else {
    const oldPath = kind === "logo_dark" ? kit?.logoDarkPath : kit?.logoLightPath;
    if (!oldPath) return NextResponse.json({ error: "Nothing to remove." }, { status: 404 });
    const { error } = await db
      .from("brand_kits")
      .update({ [COLUMN[kind]]: null })
      .eq("customer_id", customerId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await db.storage.from("intake").remove([oldPath]).catch(() => null);
  }

  return NextResponse.json(await brandKitPayload(db, customerId));
}
