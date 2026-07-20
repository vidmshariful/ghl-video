import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Watermark } from "@/components/Watermark";
import {
  site,
  cta,
  entityLine,
  disclaimer,
  otherBrands,
  legalLinks,
  footerBlurb,
  navServices,
  navLinks,
} from "@/lib/site";
import type { SiteChrome } from "@/lib/chrome";

/*
 * Footer mirrors the nav IA: brand column, Services, Explore, Company,
 * Our Other Brands. Below the legal row, the giant GHL VIDEO wordmark
 * closes the page as its own grid cell. The email capture band waits
 * for the LeadConnector embed so we never ship a form that posts
 * nowhere.
 */

function Column({
  heading,
  links,
}: {
  heading: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      {/* h3: a footer column label must not outrank a section h2 */}
      <h3 className="font-mono text-label uppercase text-muted">{heading}</h3>
      <ul className="mt-4 flex flex-col gap-2.5">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link
              href={l.href}
              className="text-body text-muted transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer({ chrome }: { chrome?: SiteChrome }) {
  const services =
    chrome?.services.map((s) => ({ label: s.name, href: s.href })) ??
    navServices.map((s) => ({ label: s.name, href: s.href }));
  const explore =
    chrome?.nav ?? navLinks.map((l) => ({ label: l.label, href: l.href }));
  const company = chrome?.footerCompany ?? [
    { label: "Contact", href: "/contact/" },
    { label: cta.bookACall.label, href: cta.bookACall.href },
    { label: "Request a Quote", href: "/quote/" },
  ];
  const brands = chrome?.brands ?? otherBrands;
  const legal = chrome?.legal ?? legalLinks;
  return (
    <footer className="border-t border-hair bg-[#050505]">
      <div className="shell grid grid-cols-2 gap-x-8 gap-y-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
          <Logo className="h-6" />
          <p className="mt-4 max-w-[var(--measure-body)] text-body text-muted">{footerBlurb}</p>
          <p className="mt-3 font-mono text-body-sm text-muted">{entityLine}</p>
        </div>

        <Column heading="Services" links={services} />
        <Column heading="Explore" links={explore} />
        <Column heading="Company" links={company} />

        <div>
          <h3 className="font-mono text-label uppercase text-muted">
            Our Other Brands
          </h3>
          <ul className="mt-4 flex flex-col gap-2.5">
            {brands.map((brand) => (
              <li key={brand.name}>
                <a
                  href={brand.url}
                  target="_blank"
                  rel="noopener"
                  className="group inline-flex items-baseline gap-2 text-body text-muted transition-colors hover:text-ink"
                >
                  {brand.name}
                  <span className="font-mono text-body-sm text-muted group-hover:text-ink">
                    {brand.domain}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-hair">
        <div className="shell flex flex-col gap-3 py-6 font-mono text-body-sm text-dim md:flex-row md:items-center md:justify-between">
          <a
            href={`mailto:${site.email}`}
            className="transition-colors hover:text-muted"
          >
            {site.email}
          </a>
          <div className="flex gap-5">
            {legal.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="transition-colors hover:text-muted"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <p>{disclaimer}</p>
        </div>
      </div>

      {/* the brand moment: a full-width grid cell closing the page */}
      <Watermark />
    </footer>
  );
}
