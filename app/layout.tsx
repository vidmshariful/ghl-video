import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PageFrame } from "@/components/PageFrame";
import { ScrollRuler } from "@/components/ScrollRuler";
import { site } from "@/lib/site";

const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "GHL Video: Video built for HighLevel SaaS",
    template: "%s | GHL Video",
  },
  description: site.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${grotesk.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        {/* the hero panel's poster is the first meaningful paint */}
        <link rel="preload" as="image" href="/posters/clip-2.jpg" />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:rounded-[3px] focus:bg-green focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-[#08090D]"
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
