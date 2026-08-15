import {
  legalLinks as staticLegal,
  navLinks as staticNavLinks,
  navServices as staticNavServices,
  otherBrands as staticBrands,
  cta,
} from "@/lib/site";

/*
 * Site chrome: header nav, footer links, and the tracking + chat-widget
 * scripts.
 *
 * HARD-CODED here (client decision, July 2026). These used to be read
 * from Supabase at build time, but a slow or unreachable backend could
 * bake incomplete chrome into a deploy (missing nav/footer, or the
 * analytics and chat widget dropping out). They now live in code, so the
 * header, footer, tracking, and chat widget always render. Editing them
 * is a code change plus a deploy; the admin chrome/code screens no
 * longer drive the live site.
 */

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

/* Injected at body start: Google Tag Manager, Google Ads gtag, and
 * Hotjar. Kept verbatim from the previous backend config so analytics
 * and conversion tracking are unchanged. */
export const HEAD_SCRIPTS = `<!-- GTM loader -->
<script data-cfasync="false" data-pagespeed-no-defer type="text/javascript">
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'//www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-5LZRTLJJ');
</script>

<!-- GTM loader -->
<script data-cfasync="false" data-pagespeed-no-defer type="text/javascript">
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'//www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-NPHWVF2V');
</script>

<!-- GTM loader -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-NPHWVF2V');</script>

<!-- gtag config -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'AW-16454943179');
</script>

<!-- Hotjar -->
<script>
    (function(h,o,t,j,a,r){
        h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
        h._hjSettings={hjid:5195383,hjsv:6};
        a=o.getElementsByTagName('head')[0];
        r=o.createElement('script');r.async=1;
        r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
        a.appendChild(r);
    })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
</script>

<!-- gtag loader -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-16454943179">
</script>

<!-- FirstPromoter (affiliate click tracking; cid = the FP account id).
     Standard fpr.js on purpose: the fpr.highlevel.js variant from FP's
     HighLevel instructions is for HL funnel pages and needs jQuery. -->
<script>(function(w){w.fpr=w.fpr||function(){w.fpr.q = w.fpr.q||[];w.fpr.q[arguments[0]=='set'?'unshift':'push'](arguments);};})(window);
fpr("init", {cid:"ri063sv0"});
fpr("click");
</script>
<script src="https://cdn.firstpromoter.com/fpr.js" async></script>`;

/* Injected at body end: the LeadConnector chat widget and the GTM
 * noscript fallback. */
export const BODY_END_SCRIPTS = `<!-- LeadConnector widget -->
<script src="https://widgets.leadconnectorhq.com/loader.js" data-resources-url="https://widgets.leadconnectorhq.com/chat-widget/loader.js" data-widget-id="66b215e292c831bcfeb2c0f4">
 </script>

<!-- GTM noscript -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NPHWVF2V" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;

/* The complete, hard-coded chrome. Nav, services, brands, and legal come
 * from lib/site.ts; the footer company column and scripts are set here. */
const CHROME: SiteChrome = {
  headScripts: HEAD_SCRIPTS,
  bodyEndScripts: BODY_END_SCRIPTS,
  nav: staticNavLinks.map((l) => ({ label: l.label, href: l.href })),
  services: staticNavServices.map((s) => ({
    name: s.name,
    line: s.line,
    href: s.href,
    posterKey: s.posterKey,
  })),
  footerCompany: [
    { label: "About", href: "/about/" },
    { label: "Contact", href: "/contact/" },
    { label: cta.bookACall.label, href: cta.bookACall.href },
    { label: "Request a Quote", href: "/quote/" },
  ],
  brands: staticBrands.map((b) => ({ name: b.name, url: b.url, domain: b.domain })),
  legal: staticLegal.map((l) => ({ label: l.label, href: l.href })),
};

/* Async signature kept so the site layout's `await getChrome()` is
 * unchanged; it just resolves the static value now, no fetch. */
export async function getChrome(): Promise<SiteChrome> {
  return CHROME;
}
