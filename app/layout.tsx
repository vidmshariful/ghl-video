import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { PageFrame } from "@/components/PageFrame";
import { ScrollRuler } from "@/components/ScrollRuler";
import { organizationSchema, websiteSchema } from "@/lib/schema";
import { site } from "@/lib/site";

/* Client-picked pairing: Archivo carries the headlines, Raveo Display
 * (Jakub Foglar, SIL OFL 1.1) carries body and labels. */
const archivo = Archivo({
  variable: "--font-heading",
  subsets: ["latin"],
});

const raveo = localFont({
  variable: "--font-body",
  src: [
    { path: "./fonts/RaveoDisplay-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/RaveoDisplay-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/RaveoDisplay-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/RaveoDisplay-Bold.woff2", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "GoHighLevel White-Label Video Infrastructure for HL SaaS | GHL Video",
    template: "%s | GHL Video",
  },
  description: site.description,
  openGraph: {
    type: "website",
    siteName: "GHL Video",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "GHL Video" }],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${raveo.variable} h-full antialiased`}
    >
      <head>
        {/* the hero panel's poster is the first meaningful paint */}
        <link rel="preload" as="image" href="/posters/clip-2.jpg" />
      </head>
      <body className="flex min-h-full flex-col">
        {/* sitewide entity graph, server-rendered into every page */}
        <JsonLd schema={[organizationSchema(), websiteSchema()]} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:rounded-[3px] focus:bg-gold focus:px-4 focus:py-2.5 focus:text-body focus:font-semibold focus:text-canvas"
        >
          Skip to content
        </a>
        <PageFrame />
        <ScrollRuler />
        <Header />
        <main id="main" className="relative z-10 flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
