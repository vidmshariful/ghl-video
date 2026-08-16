/*
 * The site health rules. Kept pure and separate from the crawler and the
 * screen so the checks can be read and argued with in one place: what counts
 * as a problem, how bad it is, and what the fix is.
 *
 * Severity means something specific here:
 *   error  costs traffic or money right now (a page Google cannot index, a
 *          dead link a visitor will hit, two pages fighting for one title)
 *   warn   works, but is leaving results on the table
 *   info   worth knowing, not worth interrupting the day for
 */

/** What the crawler measures for one page. */
export type PageFacts = {
  path: string;
  status: number;
  redirectedTo?: string | null;
  title: string | null;
  description: string | null;
  canonical: string | null;
  noindex: boolean;
  h1s: string[];
  imagesMissingAlt: number;
  imageCount: number;
  internalLinks: string[];
  wordCount: number;
  error?: string | null;
};

export type LinkStatus = { path: string; status: number };

export type Finding = {
  id: string;
  severity: "error" | "warn" | "info";
  kind: string;
  path: string;
  message: string;
  detail?: string;
  /* what to do about it, in plain language */
  fix?: string;
};

/* Google truncates around these lengths. They are guidance, not law: a
 * slightly long title is a nudge, not a failure. */
export const TITLE_MIN = 25;
export const TITLE_MAX = 62;
export const DESC_MIN = 70;
export const DESC_MAX = 160;

const norm = (p: string) => {
  const clean = (p || "/").split("?")[0].split("#")[0].toLowerCase();
  return clean.endsWith("/") ? clean : `${clean}/`;
};

export function computeFindings(
  pages: PageFacts[],
  links: LinkStatus[],
  sitemapPaths: string[],
): Finding[] {
  const out: Finding[] = [];
  let n = 0;
  const add = (f: Omit<Finding, "id">) => out.push({ ...f, id: `f${++n}` });

  const inSitemap = new Set(sitemapPaths.map(norm));

  /* ---- per page ---- */
  for (const p of pages) {
    if (p.error) {
      add({
        severity: "error",
        kind: "unreachable",
        path: p.path,
        message: "The page could not be loaded.",
        detail: p.error,
        fix: "Open the page yourself. If it loads fine, run the check again; if not, this is a live outage on that page.",
      });
      continue;
    }

    if (p.status >= 400) {
      add({
        severity: "error",
        kind: "status",
        path: p.path,
        message: `The page returns ${p.status}.`,
        fix: "Either restore the page or add a redirect to its replacement in the Redirects tab.",
      });
      continue;
    }

    if (p.status >= 300 && p.redirectedTo) {
      add({
        severity: "warn",
        kind: "redirected",
        path: p.path,
        message: "A listed page redirects somewhere else.",
        detail: `Goes to ${p.redirectedTo}`,
        fix: "If this is deliberate, remove the page from the page list so it stops being advertised.",
      });
    }

    const title = (p.title ?? "").trim();
    if (!title) {
      add({
        severity: "error",
        kind: "title-missing",
        path: p.path,
        message: "No page title.",
        fix: "Add one in the Pages tab. This is the blue line Google shows.",
      });
    } else {
      if (title.length > TITLE_MAX) {
        add({
          severity: "warn",
          kind: "title-long",
          path: p.path,
          message: `Title is ${title.length} characters, so Google will cut it off.`,
          detail: title,
          fix: `Trim it to about ${TITLE_MAX} characters in the Pages tab.`,
        });
      } else if (title.length < TITLE_MIN) {
        add({
          severity: "info",
          kind: "title-short",
          path: p.path,
          message: `Title is only ${title.length} characters.`,
          detail: title,
          fix: "There is room to add the words people actually search for.",
        });
      }
    }

    const desc = (p.description ?? "").trim();
    if (!desc) {
      add({
        severity: "warn",
        kind: "description-missing",
        path: p.path,
        message: "No meta description.",
        fix: "Write one in the Pages tab. Without it Google invents the grey text under your link.",
      });
    } else if (desc.length > DESC_MAX) {
      add({
        severity: "warn",
        kind: "description-long",
        path: p.path,
        message: `Description is ${desc.length} characters, so the end gets cut off.`,
        detail: desc,
        fix: `Trim it to about ${DESC_MAX} characters.`,
      });
    } else if (desc.length < DESC_MIN) {
      add({
        severity: "info",
        kind: "description-short",
        path: p.path,
        message: `Description is only ${desc.length} characters.`,
        detail: desc,
        fix: "A fuller description gives people a reason to click.",
      });
    }

    if (p.h1s.length === 0) {
      add({
        severity: "warn",
        kind: "h1-missing",
        path: p.path,
        message: "No main heading on the page.",
        fix: "Every page needs one H1 saying what it is.",
      });
    } else if (p.h1s.length > 1) {
      add({
        severity: "info",
        kind: "h1-multiple",
        path: p.path,
        message: `${p.h1s.length} main headings on one page.`,
        detail: p.h1s.slice(0, 3).join(" / "),
        fix: "One H1 per page reads more clearly to Google.",
      });
    }

    if (p.imagesMissingAlt > 0) {
      add({
        severity: "warn",
        kind: "alt-missing",
        path: p.path,
        message: `${p.imagesMissingAlt} of ${p.imageCount} images have no alt text.`,
        fix: "Alt text is what a screen reader says and what Google reads. Decorative images can keep an empty alt on purpose.",
      });
    }

    if (!p.canonical) {
      add({
        severity: "warn",
        kind: "canonical-missing",
        path: p.path,
        message: "No canonical link.",
        fix: "The canonical tells Google which URL is the real one. Every page should name itself.",
      });
    } else {
      const c = norm(p.canonical.replace(/^https?:\/\/[^/]+/i, ""));
      if (c !== norm(p.path)) {
        add({
          severity: "info",
          kind: "canonical-elsewhere",
          path: p.path,
          message: "This page points its canonical at a different URL.",
          detail: p.canonical,
          fix: "Deliberate for duplicate pages, a mistake otherwise.",
        });
      }
    }

    if (p.noindex && inSitemap.has(norm(p.path))) {
      add({
        severity: "error",
        kind: "noindex-in-sitemap",
        path: p.path,
        message: "The page is hidden from Google but still listed in the sitemap.",
        fix: "Contradictory signals. Either index it or take it out of the sitemap.",
      });
    }

    if (p.status === 200 && !p.noindex && p.wordCount > 0 && p.wordCount < 120) {
      add({
        severity: "info",
        kind: "thin",
        path: p.path,
        message: `Only about ${p.wordCount} words of text.`,
        fix: "Thin pages rarely rank. Fine for a contact page, a problem for a page meant to bring traffic.",
      });
    }
  }

  /* ---- across pages ---- */
  const byTitle = new Map<string, string[]>();
  const byDesc = new Map<string, string[]>();
  for (const p of pages) {
    if (p.status !== 200 || p.noindex) continue;
    const t = (p.title ?? "").trim().toLowerCase();
    const d = (p.description ?? "").trim().toLowerCase();
    if (t) byTitle.set(t, [...(byTitle.get(t) ?? []), p.path]);
    if (d) byDesc.set(d, [...(byDesc.get(d) ?? []), p.path]);
  }
  for (const [t, paths] of byTitle) {
    if (paths.length > 1) {
      add({
        severity: "error",
        kind: "title-duplicate",
        path: paths[0],
        message: `${paths.length} pages share one title.`,
        detail: `"${t}" on ${paths.join(", ")}`,
        fix: "Give each page its own title, or they compete with each other in search.",
      });
    }
  }
  for (const paths of byDesc.values()) {
    if (paths.length > 1) {
      add({
        severity: "warn",
        kind: "description-duplicate",
        path: paths[0],
        message: `${paths.length} pages share one description.`,
        detail: `on ${paths.join(", ")}`,
        fix: "Write a description that fits each page.",
      });
    }
  }

  /* ---- links ---- */
  const linkStatus = new Map(links.map((l) => [norm(l.path), l.status]));
  const brokenTo = new Map<string, string[]>();
  for (const p of pages) {
    for (const l of p.internalLinks) {
      const st = linkStatus.get(norm(l));
      if (st !== undefined && st >= 400) {
        brokenTo.set(norm(l), [...(brokenTo.get(norm(l)) ?? []), p.path]);
      }
    }
  }
  for (const [target, sources] of brokenTo) {
    add({
      severity: "error",
      kind: "broken-link",
      path: sources[0],
      message: `A link points at ${target}, which is dead.`,
      detail: `Linked from ${[...new Set(sources)].join(", ")}`,
      fix: "Fix the link, or add a redirect for that URL in the Redirects tab.",
    });
  }

  /* ---- sitemap coverage ---- */
  const crawled = new Set(pages.filter((p) => p.status === 200 && !p.noindex).map((p) => norm(p.path)));
  for (const path of crawled) {
    if (!inSitemap.has(path)) {
      add({
        severity: "warn",
        kind: "not-in-sitemap",
        path,
        message: "An indexable page is missing from the sitemap.",
        fix: "Google finds pages faster when they are listed. Add it to the page list.",
      });
    }
  }

  const order = { error: 0, warn: 1, info: 2 } as const;
  return out.sort((a, b) => order[a.severity] - order[b.severity] || a.path.localeCompare(b.path));
}
