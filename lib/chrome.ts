import {
  legalLinks as staticLegal,
  navLinks as staticNavLinks,
  navServices as staticNavServices,
  otherBrands as staticBrands,
  cta,
} from "@/lib/site";

/*
 * Site chrome from the backend: tracking scripts plus header and footer
 * links, managed in Supabase and read ONCE PER BUILD (static export, so
 * this fetch happens at build time, never in a visitor's browser).
 *
 * The anon key below is public by design: it is Supabase's publishable
 * key, and row-level security limits it to SELECT on the two chrome
 * tables. Writes happen only through the Supabase dashboard login, and
 * every write fires the Vercel deploy hook (a database trigger), so
 * saving in the dashboard IS the publish button.
 *
 * FAILURE POLICY: if Supabase is unreachable, paused, or returns
 * garbage, the build falls back to the static values in lib/site.ts.
 * The website can never break because the backend had a bad day.
 */
/* Env-first (NEXT_PUBLIC_ vars inline into both server and client bundles at
 * build), so rotating the anon key is an env flip + redeploy, no code edit.
 * The committed values are the working fallback. */
export const SB_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://xdarleyimthsnareuoxl.supabase.co";
export const SB_ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkYXJsZXlpbXRoc25hcmV1b3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NzI2NzAsImV4cCI6MjEwMDE0ODY3MH0.x0rM_RbjlFi9tvA7XTf74NVDDkagICkEPQcQyeaean8";

type LinkRow = {
  area: string;
  label: string;
  href: string;
  sort: number;
  enabled: boolean;
  external: boolean;
};

export type ChromeService = {
  name: string;
  line: string;
  href: string;
  posterKey: string;
};

export type SiteChrome = {
  headScripts: string;
  bodyEndScripts: string;
  nav: { label: string; href: string }[];
  services: ChromeService[];
  footerCompany: { label: string; href: string }[];
  brands: { name: string; url: string; domain: string }[];
  legal: { label: string; href: string }[];
};

const FALLBACK: SiteChrome = {
  headScripts: "",
  bodyEndScripts: "",
  nav: staticNavLinks.map((l) => ({ label: l.label, href: l.href })),
  services: staticNavServices.map((s) => ({
    name: s.name,
    line: s.line,
    href: s.href,
    posterKey: s.posterKey,
  })),
  footerCompany: [
    { label: "Contact", href: "/contact/" },
    { label: cta.bookACall.label, href: cta.bookACall.href },
    { label: "Request a Quote", href: "/quote/" },
  ],
  brands: staticBrands.map((b) => ({ name: b.name, url: b.url, domain: b.domain })),
  legal: staticLegal.map((l) => ({ label: l.label, href: l.href })),
};

async function sb<T>(path: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
      signal: ctrl.signal,
      // build-time only: keeps the marketing pages statically generated in
      // server mode. Chrome refreshes on rebuild (the DB write fires the
      // Vercel deploy hook), exactly as it did under static export.
      cache: "force-cache",
    });
    if (!r.ok) throw new Error(`supabase ${r.status}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function getChrome(): Promise<SiteChrome> {
  /* fallback drill: CHROME_OFFLINE=1 npx next build proves the site
     builds correctly with the backend unreachable */
  if (process.env.CHROME_OFFLINE === "1") return FALLBACK;
  try {
    const [settings, links] = await Promise.all([
      sb<{ head_scripts: string; body_end_scripts: string }[]>(
        "site_settings?select=head_scripts,body_end_scripts&id=eq.1",
      ),
      sb<LinkRow[]>(
        "site_links?select=area,label,href,sort,enabled,external&enabled=is.true&order=sort.asc",
      ),
    ]);
    const s = settings[0] ?? { head_scripts: "", body_end_scripts: "" };
    const by = (area: string) => links.filter((r) => r.area === area);
    const pick = (area: string, fb: { label: string; href: string }[]) => {
      const rows = by(area).map((r) => ({ label: r.label, href: r.href }));
      return rows.length ? rows : fb;
    };
    /* services keep their design-coupled fields (menu line, poster) from
       the static config, matched by href; the backend controls label,
       order, and visibility */
    const services = by("services").map((r) => {
      const match = staticNavServices.find((x) => x.href === r.href);
      return {
        name: r.label,
        href: r.href,
        line: match?.line ?? "",
        posterKey: match?.posterKey ?? "sampleC",
      };
    });
    return {
      headScripts: s.head_scripts ?? "",
      bodyEndScripts: s.body_end_scripts ?? "",
      nav: pick("header", FALLBACK.nav),
      services: services.length ? services : FALLBACK.services,
      footerCompany: pick("footer_company", FALLBACK.footerCompany),
      brands: by("footer_brands").length
        ? by("footer_brands").map((r) => ({
            name: r.label,
            url: r.href,
            domain: r.href.replace(/^https?:\/\//, "").replace(/\/$/, ""),
          }))
        : FALLBACK.brands,
      legal: pick("legal", FALLBACK.legal),
    };
  } catch {
    return FALLBACK;
  }
}
