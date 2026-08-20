import Link from "next/link";
import { PortalTopbar } from "@/components/portal/Shell";
import { LibraryExplorer } from "./Explorer";
import { libraryBrowse } from "@/components/library/catalog";
import { getCatalog } from "@/lib/catalog-db";
import { JsonLd } from "@/components/JsonLd";
import { productCatalogSchema } from "@/lib/schema";
import { cta, disclaimer, entityLine } from "@/lib/content/core";
import { supabaseAdmin } from "@/lib/checkout/supabase-admin";

export const runtime = "nodejs";
/* the catalogue changes from admin, so this page follows within minutes */
export const revalidate = 300;

/*
 * /library: the catalogue, full page, portal-skinned, open to everyone.
 *
 * Its chrome is deliberately thin. Left: the logo and where you are. Right:
 * the two ways out that matter (sign in, book a call) and the theme toggle.
 * No site menu, because every menu item is an exit from the thing somebody
 * clicked through to do.
 */
export default async function LibraryPage() {
  const rows = await getCatalog();

  /*
   * Packs and bundles carry no footage and mostly no count on their own
   * rows: what they hold lives in the pack-membership and bundle-rule
   * tables. The count is the whole argument for buying one, so it is
   * computed here the same way the portal computes it, and anything whose
   * product row is switched off in admin is dropped rather than shipped
   * with a dead buy button.
   */
  const db = supabaseAdmin();
  const [{ data: packItems }, { data: bundleRules }, { data: products }, { data: statRows }] =
    await Promise.all([
      db.from("catalog_pack_items").select("pack_code"),
      db.from("catalog_bundle_rules").select("bundle_code, count"),
      db.from("products").select("sku, active"),
      db.from("catalog_stats").select("code, loves, plays"),
    ]);
  const memberCount = new Map<string, number>();
  for (const i of packItems ?? [])
    memberCount.set(String(i.pack_code), (memberCount.get(String(i.pack_code)) ?? 0) + 1);
  for (const r of bundleRules ?? [])
    memberCount.set(
      String(r.bundle_code),
      (memberCount.get(String(r.bundle_code)) ?? 0) + Number(r.count ?? 0),
    );
  const sellable = new Set(
    (products ?? []).filter((p) => p.active).map((p) => String(p.sku).toLowerCase()),
  );

  const videos = libraryBrowse(rows)
    .map((v) =>
      v.kind && v.kind !== "video" && !v.packCount
        ? { ...v, packCount: memberCount.get(v.slug) ?? null }
        : v,
    )
    /* a collection with a dead product row must not render a buy button */
    .filter((v) => (v.kind && v.kind !== "video" ? sellable.has(v.slug) : true))
    /* videos lead the default shelf; the sixteen collections were sorting
       ahead of them and burying the footage under tiles of numbers. The
       Packs and Bundles tabs still put collections front and centre. */
    .sort((a, b) => Number(a.kind !== "video" && !!a.kind) - Number(b.kind !== "video" && !!b.kind));
  /* hearts and plays, keyed by code, for the two ranked filters */
  const stats = Object.fromEntries(
    ((statRows ?? []) as { code: string; loves: number; plays: number }[]).map((r) => [
      r.code,
      { loves: Number(r.loves), plays: Number(r.plays) },
    ]),
  );

  const schema = videos
    .filter((v) => !v.previewOnly && v.price > 0)
    .map((v) => ({
      name: v.title,
      price: v.price,
      url: `https://www.ghlvideo.com/checkout/${v.code ?? v.slug}`,
    }));

  return (
    <>
      <JsonLd schema={[productCatalogSchema(schema)]} />
      <PortalTopbar
        area="Library"
        right={
          <div className="flex items-center gap-2">
            <Link
              href="/portal/"
              className="tap rounded-[8px] px-3 py-2 font-mono text-label uppercase text-chrome-muted transition-colors hover:text-chrome-text"
            >
              Login
            </Link>
            <Link
              href={cta.bookACall.href}
              className="tap rounded-[8px] bg-gold px-3.5 py-2 font-mono text-label font-bold uppercase text-canvas transition-opacity hover:opacity-90"
            >
              {cta.bookACall.label}
            </Link>
          </div>
        }
      />

      <div className="flex-1">
        <LibraryExplorer videos={videos} stats={stats} />
      </div>

      {/* thin, but a real footer: the entity and the disclaimer go on every
          footer we ship, whichever surface it is on */}
      <footer className="border-t border-hair">
        <div className="mx-auto flex w-full max-w-[100rem] flex-wrap items-center justify-between gap-3 px-4 py-6 md:px-8">
          <p className="font-mono text-label uppercase tracking-[0.1em] text-dim">
            {entityLine}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/premade/"
              className="tap font-mono text-label uppercase text-muted transition-colors hover:text-gold"
            >
              How premade works
            </Link>
            <Link
              href="/"
              className="tap font-mono text-label uppercase text-muted transition-colors hover:text-gold"
            >
              ghlvideo.com
            </Link>
          </div>
          <p className="w-full text-body-sm text-dim md:w-auto">{disclaimer}</p>
        </div>
      </footer>
    </>
  );
}
