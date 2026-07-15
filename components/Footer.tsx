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

export function Footer() {
  return (
    <footer className="border-t border-hair bg-[#050505]">
      <div className="shell grid grid-cols-2 gap-x-8 gap-y-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
          <Logo className="h-6" />
          <p className="mt-4 max-w-[26ch] text-body text-muted">{footerBlurb}</p>
          <p className="mt-3 font-mono text-body-sm text-muted">{entityLine}</p>
        </div>

        <Column
          heading="Services"
          links={navServices.map((s) => ({ label: s.name, href: s.href }))}
        />
        <Column
          heading="Explore"
          links={navLinks.map((l) => ({ label: l.label, href: l.href }))}
        />
        <Column
          heading="Company"
          links={[
            { label: "Contact", href: "/contact/" },
            { label: cta.bookACall.label, href: cta.bookACall.href },
            { label: "Request a Quote", href: "/quote/" },
          ]}
        />

        <div>
          <h3 className="font-mono text-label uppercase text-muted">
            Our Other Brands
          </h3>
          <ul className="mt-4 flex flex-col gap-2.5">
            {otherBrands.map((brand) => (
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
            {legalLinks.map((l) => (
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
