import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/*
 * Branding-brief intake, gated by the order's unguessable UUID (same capability
 * token as the receipt) so a buyer can submit it straight from the thank-you
 * page with no login. GET returns the order + any saved brief (files as
 * short-lived signed URLs); POST saves the fields to orders.metadata.intake,
 * uploads logo/screenshots to the private `intake` bucket, and flips
 * intake_completed. Admin reads the same data. Never trusts a client-supplied
 * anything but the UUID.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VOICEOVERS = ["Male", "Female", "No preference"];
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "application/pdf"];
const MAX_SHOTS = 8;

type Intake = {
  submittedAt: string;
  brandName: string;
  primaryColor: string;
  accentColor: string;
  voiceover: string;
  brandGuidelinesUrl: string;
  notes: string;
  logoPath: string | null;
  screenshotPaths: string[];
};

type DB = ReturnType<typeof supabaseAdmin>;
type Product = { name: string; sku: string; metadata: { code?: string } | null } | null;

async function loadOrder(db: DB, id: string) {
  const { data } = await db
    .from("orders")
    .select(
      "id, status, intake_completed, metadata, product:products(name, sku, metadata)",
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

async function signOne(db: DB, path: string | null): Promise<string | null> {
  if (!path) return null;
  // SVGs are welcome as logo sources (vector masters) but are served as a
  // download: rendered inline they can execute script on the storage origin.
  const opts = path.toLowerCase().endsWith(".svg") ? { download: true } : undefined;
  const { data } = await db.storage.from("intake").createSignedUrl(path, 3600, opts);
  return data?.signedUrl ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  if (!UUID_RE.test(orderId)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const db = supabaseAdmin();
  const order = await loadOrder(db, orderId);
  if (!order) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const product = order.product as unknown as Product;
  const intake = (order.metadata?.intake ?? null) as Intake | null;

  let logoUrl: string | null = null;
  let screenshotUrls: string[] = [];
  if (intake) {
    logoUrl = await signOne(db, intake.logoPath);
    screenshotUrls = (
      await Promise.all(intake.screenshotPaths.map((p) => signOne(db, p)))
    ).filter((u): u is string => !!u);
  }

  return NextResponse.json({
    productName: product?.name ?? null,
    productCode: product?.metadata?.code ?? product?.sku?.toUpperCase() ?? null,
    intakeCompleted: !!order.intake_completed,
    intake: intake ? { ...intake, logoUrl, screenshotUrls } : null,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const rl = rateLimit(`intake:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const { orderId } = await params;
  if (!UUID_RE.test(orderId)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const db = supabaseAdmin();
  const order = await loadOrder(db, orderId);
  if (!order) return NextResponse.json({ error: "Not found." }, { status: 404 });
  // pending stays open (a buyer can land here while the webhook is still
  // settling), but dead orders take no more uploads or edits.
  if (order.status === "failed" || order.status === "refunded") {
    return NextResponse.json(
      { error: "This order is closed and its brief can no longer be edited." },
      { status: 409 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  const str = (k: string, max: number) => String(form.get(k) ?? "").trim().slice(0, max);
  const brandName = str("brandName", 160);
  const primaryColor = str("primaryColor", 32);
  const accentColor = str("accentColor", 32);
  let voiceover = str("voiceover", 40);
  if (!VOICEOVERS.includes(voiceover)) voiceover = "No preference";
  const brandGuidelinesUrl = str("brandGuidelinesUrl", 500);
  const notes = str("notes", 4000);

  if (!brandName) {
    return NextResponse.json(
      { error: "Please tell us your brand or platform name." },
      { status: 400 },
    );
  }

  const prev = (order.metadata?.intake ?? null) as Intake | null;

  const uploadFile = async (file: File, prefix: string): Promise<string> => {
    if (!ALLOWED.includes(file.type)) {
      throw new Error(`Unsupported file type (${file.type || "unknown"}).`);
    }
    if (file.size > 10_485_760) throw new Error("A file is larger than 10 MB.");
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `${orderId}/${prefix}-${Date.now()}-${rand}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await db.storage.from("intake").upload(path, buf, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw new Error(error.message);
    return path;
  };

  let logoPath = prev?.logoPath ?? null;
  let screenshotPaths = prev?.screenshotPaths ?? [];
  try {
    const logo = form.get("logo");
    if (logo instanceof File && logo.size > 0) logoPath = await uploadFile(logo, "logo");

    const shots = form
      .getAll("screenshots")
      .filter((f): f is File => f instanceof File && f.size > 0)
      .slice(0, MAX_SHOTS);
    if (shots.length) {
      const uploaded: string[] = [];
      for (const f of shots) uploaded.push(await uploadFile(f, "shot"));
      screenshotPaths = uploaded;
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const intake: Intake = {
    submittedAt: new Date().toISOString(),
    brandName,
    primaryColor,
    accentColor,
    voiceover,
    brandGuidelinesUrl,
    notes,
    logoPath,
    screenshotPaths,
  };

  const { error } = await db
    .from("orders")
    .update({
      intake_completed: true,
      metadata: { ...(order.metadata ?? {}), intake },
    })
    .eq("id", orderId);
  if (error) {
    return NextResponse.json({ error: "Could not save your brief." }, { status: 500 });
  }

  await db.from("order_updates").insert({
    order_id: orderId,
    body: "Branding brief submitted by the client.",
  });

  return NextResponse.json({ ok: true });
}
