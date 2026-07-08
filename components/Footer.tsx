import Link from "next/link";
import { Logo } from "@/components/Logo";
import {
  site,
  nav,
  cta,
  entityLine,
  disclaimer,
  otherBrands,
  legalLinks,
  footerBlurb,
} from "@/lib/site";

/*
 * Four columns, identical on every page (brief section 11). The email
 * capture band above the columns waits for the LeadConnector embed so
 * we never ship a form that posts nowhere.
 */
export function Footer() {
  return (
    <footer className="border-t border-hair bg-[#05060A]">
      <div className="shell grid grid-cols-2 gap-x-8 gap-y-12 py-16 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
          <Logo className="h-6" />
          <p className="mt-4 max-w-[26ch] text-sm text-muted">{footerBlurb}</p>
          <p className="mt-3 font-mono text-xs text-dim">{entityLine}</p>
        </div>

        <div>
          <h2 className="font-mono text-label uppercase text-dim">Services</h2>
          <ul className="mt-4 flex flex-col gap-2.5">
            <li>
              <Link href="/premade/" className="text-sm text-muted transition-colors hover:text-ink">
                Premade Videos
              </Link>
            </li>
            <li>
              <Link href="/custom/" className="text-sm text-muted transition-colors hover:text-ink">
                Custom Production
              </Link>
            </li>
            <li>
              <Link href="/editing/" className="text-sm text-muted transition-colors hover:text-ink">
                Video Editing
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-mono text-label uppercase text-dim">Company</h2>
          <ul className="mt-4 flex flex-col gap-2.5">
            <li>
              <Link href="/about/" className="text-sm text-muted transition-colors hover:text-ink">
                About
              </Link>
            </li>
            <li>
              <Link href="/contact/" className="text-sm text-muted transition-colors hover:text-ink">
                Contact
              </Link>
            </li>
            <li>
              <Link href={cta.bookACall.href} className="text-sm text-muted transition-colors hover:text-ink">
                {cta.bookACall.label}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-mono text-label uppercase text-dim">
            Our Other Brands
          </h2>
          <ul className="mt-4 flex flex-col gap-2.5">
            {otherBrands.map((brand) => (
              <li key={brand.name}>
                <a
                  href={brand.url}
                  target="_blank"
                  rel="noopener"
                  className="group inline-flex items-baseline gap-2 text-sm text-muted transition-colors hover:text-ink"
                >
                  {brand.name}
                  <span className="font-mono text-xs text-dim group-hover:text-muted">
                    {brand.domain}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-hair">
        <div className="shell flex flex-col gap-3 py-6 font-mono text-xs text-dim md:flex-row md:items-center md:justify-between">
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
    </footer>
  );
}
