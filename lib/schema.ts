/*
 * JSON-LD structured data, built from the same typed facts the pages
 * render, so the schema can never drift from the visible copy. Emitted
 * as server-rendered <script type="application/ld+json"> (see
 * components/JsonLd), so it is present in the static HTML that crawlers
 * and answer engines read without running JavaScript.
 *
 * Canonical host is the production domain (ghlvideo.com), never the
 * preview deploy.
 */
import { site, socials } from "@/lib/site";

const ORG_ID = `${site.url}/#organization`;
const SITE_ID = `${site.url}/#website`;

/* real profiles only: the LinkedIn entry is a "#" placeholder */
const sameAs = socials
  .map((s) => s.href)
  .filter((href) => href.startsWith("http"));

export function organizationSchema() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: site.name,
    url: site.url,
    email: site.email,
    logo: `${site.url}/logo.svg`,
    description: site.description,
    sameAs,
    /* GHL Video is a brand of Vidiosa LLC */
    parentOrganization: { "@type": "Organization", name: "Vidiosa LLC" },
  };
}

export function websiteSchema() {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    name: site.name,
    url: site.url,
    publisher: { "@id": ORG_ID },
  };
}

type Offers =
  | { price: number }
  | { lowPrice: number; highPrice?: number; count?: number };

function buildOffers(o: Offers) {
  if ("price" in o) {
    return {
      "@type": "Offer",
      price: String(o.price),
      priceCurrency: "USD",
    };
  }
  return {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: String(o.lowPrice),
    ...(o.highPrice ? { highPrice: String(o.highPrice) } : {}),
    ...(o.count ? { offerCount: o.count } : {}),
  };
}

export function serviceSchema({
  name,
  description,
  path,
  offers,
}: {
  name: string;
  description: string;
  path: string;
  offers: Offers;
}) {
  return {
    "@type": "Service",
    name,
    serviceType: name,
    description,
    url: `${site.url}${path}`,
    provider: { "@id": ORG_ID },
    areaServed: "Worldwide",
    offers: buildOffers(offers),
  };
}

export function faqSchema(items: readonly { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
