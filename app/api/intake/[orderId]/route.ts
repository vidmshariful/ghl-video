import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { validateBundleSelections, type BundleSelections } from "@/lib/bundles";

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
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "application/pdf"];
const MAX_SHOTS = 8;

type Intake = {
  submittedAt: string;
  brandName: string;
  primaryColor: string;
  accentColor: string;
  brandPronunciation: string;
  notes: string;
  logoPath: string | null;
  screenshotPaths: string[];
  // bundle video picks (Essential/Growth); null for single videos and Ultimate
  videoSelections?: BundleSelections | null;
};

type DB = ReturnType<typeof supabaseAdmin>;
type Product = { name: string; sku: string; metadata: { code?: string } | null } | null;

async function loadOrder(db: DB, id: string) {
  const { data } = await db
    .from("orders")
    .select(
      "id, customer_id, status, intake_completed, intake_completed_at, metadata, product:products(name, sku, metadata)",
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

/*
 * The brand this order's customer has already given us, if any.
 *
 * A second order used to ask for the same logo, colours and pronunciation as
 * the first, which is most of why a repeat order took minutes instead of
 * seconds. The kit is per customer, so once it exists the brief starts filled
 * in and the buyer is confirming rather than retyping.
 */
async function loadKit(db: DB, customerId: string | null) {
  if (!customerId) return null;
  const { getBrandKit } = await import("@/lib/brand-kit");
  return getBrandKit(db, customerId);
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

  /* Only when this order has no brief of its own. An order already briefed
   * shows what was actually sent for it, never a later edit of the kit: the
   * studio worked from what was on the order. */
  let prefill: Record<string, unknown> | null = null;
  if (!intake) {
    const kit = await loadKit(db, (order.customer_id as string | null) ?? null);
    if (kit) {
      prefill = {
        brandName: kit.brandName ?? "",
        brandPronunciation: kit.pronunciation ?? "",
        primaryColor: kit.primaryColor ?? "",
        accentColor: kit.accentColor ?? "",
        notes: kit.notes ?? "",
        logoOnFile: Boolean(kit.logoPath),
        logoUrl: await signOne(db, kit.logoPath ?? null),
      };
    }
  }

  return NextResponse.json({
    productName: product?.name ?? null,
    productCode: product?.metadata?.code ?? product?.sku?.toUpperCase() ?? null,
    // the product sku lets the client show the bundle video picker (it derives
    // the required counts and options from the shared sales catalog)
    bundleSku: product?.sku ?? null,
    intakeCompleted: !!order.intake_completed,
    intake: intake ? { ...intake, logoUrl, screenshotUrls } : null,
    prefill,
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
  const brandPronunciation = str("brandPronunciation", 200);
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

  /*
   * Falling back to the account's logo is what makes a repeat order quick.
   * Without it the buyer has to find and upload the identical file again for
   * every order, which is the single most annoying thing about ordering twice.
   * A file posted here still wins, so replacing it stays possible.
   */
  let logoPath = prev?.logoPath ?? null;
  if (!logoPath) {
    const kit = await loadKit(db, (order.customer_id as string | null) ?? null);
    logoPath = kit?.logoPath ?? kit?.logoDarkPath ?? kit?.logoLightPath ?? null;
  }
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

  // bundle video picks (Essential/Growth). The server is the authority on the
  // counts and which videos belong to each category; a tampered client cannot
  // save an invalid set. Non-pick products (single videos, Ultimate) store null.
  const product = order.product as unknown as Product;
  const sku = product?.sku ?? "";
  let videoSelections = (prev?.videoSelections ?? null) as BundleSelections | null;
  const rawSel = form.get("videoSelections");
  if (rawSel != null && String(rawSel).trim().length) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(rawSel));
    } catch {
      return NextResponse.json({ error: "Invalid video selection." }, { status: 400 });
    }
    const res = validateBundleSelections(sku, parsed as Record<string, unknown>);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    videoSelections = res.clean ?? null;
  } else {
    // no new selection posted: what is already saved must still satisfy the
    // bundle (this rejects a first submit that skipped the picker).
    const res = validateBundleSelections(sku, videoSelections ?? undefined);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    videoSelections = res.clean ?? videoSelections;
  }

  const intake: Intake = {
    submittedAt: new Date().toISOString(),
    brandName,
    primaryColor,
    accentColor,
    brandPronunciation,
    notes,
    logoPath,
    screenshotPaths,
    videoSelections,
  };

  const { error } = await db
    .from("orders")
    .update({
      intake_completed: true,
      /* The delivery clock starts here. Only stamped the first time, so
       * editing a brief later cannot push the promised date back. */
      ...(order.intake_completed_at ? {} : { intake_completed_at: new Date().toISOString() }),
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

  // A bundle is sold as "three videos of your choosing", so its deliverable
  // rows are created empty at payment and named here. Fail-soft: the brief is
  // already saved, and losing the naming must never cost the client their
  // upload. Only fills blanks, so resubmitting a brief cannot reassign a video
  // the studio has already started.
  if (videoSelections) {
    try {
      const { fillBundlePicks } = await import("@/lib/deliverables");
      const { filled } = await fillBundlePicks(db, orderId, videoSelections);
      if (filled) {
        await db.from("order_events").insert({
          order_id: orderId,
          event_type: "deliverables_named",
          payload: { count: filled },
        });
      }
    } catch (e) {
      console.error(`[intake] naming deliverables failed for order ${orderId}:`, e);
    }
  }

  /*
   * Lift the brand off this order and onto the account, so the next order does
   * not ask for it again.
   *
   * Written to both places during the changeover: the order keeps its own copy
   * so nothing that reads briefs today breaks, and the account gets the copy
   * everything will read tomorrow. The order copy retires once the portal owns
   * the brand kit properly.
   *
   * Merging, not replacing. A client editing one field of their brief must not
   * blank the logo they uploaded months ago.
   */
  try {
    const { data: ord } = await db
      .from("orders")
      .select("customer_id")
      .eq("id", orderId)
      .maybeSingle();
    const customerId = ord?.customer_id as string | null;
    if (customerId) {
      const { saveBrandKit } = await import("@/lib/brand-kit");
      await saveBrandKit(db, customerId, {
        brandName,
        primaryColor,
        accentColor,
        pronunciation: brandPronunciation,
        notes,
        logoPath,
        screenshotPaths,
      });
    }
  } catch (e) {
    /* The brief is already saved. Never cost a client their upload over a
     * copy we can rebuild from the order they just submitted. */
    console.error(`[intake] brand kit not updated for order ${orderId}:`, e);
  }

  /*
   * The brief has landed, so the videos now have a date to be promised for.
   * Fail-soft on purpose: the brief itself is already saved, and a client
   * must never see their upload rejected because we could not do arithmetic.
   * A missing date shows as no date rather than a wrong one, and the backfill
   * script can always fill it in.
   */
  try {
    const { setDueDatesForOrder } = await import("@/lib/deliverables");
    await setDueDatesForOrder(db, orderId);
  } catch (e) {
    console.error(`[intake] due dates failed for order ${orderId}:`, e);
  }

  /*
   * Tell both sides the brief is in. Only the first time: a client editing a
   * field on their brief a week later must not re-announce it to the studio or
   * re-promise a date. Fail-soft, after the due dates exist so the email can
   * name one.
   */
  if (!order.intake_completed_at) {
    try {
      const { sendBriefReceivedEmail } = await import("@/lib/email/notify");
      await sendBriefReceivedEmail(db, orderId);
    } catch (e) {
      console.error(`[intake] brief received email failed for order ${orderId}:`, e);
    }
  }

  return NextResponse.json({ ok: true });
}
