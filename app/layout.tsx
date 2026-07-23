import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
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

/* base only: the marketing metadata (titles, OG, description) lives in
 * the (site) route group layout so /admin does not inherit it */
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
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
        {/* the homepage hero's featured poster (home.work.pieces[0]) is the
            first meaningful paint; keep this in sync with that source */}
        <link rel="preload" as="image" href="/posters/ai-master.jpg" />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
