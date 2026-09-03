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
 * and conversion tracking are unchanged.
 *
 * TWO containers on purpose, each loaded ONCE. GTM-NPHWVF2V used to be
 * loaded twice (verified live: gtm.js?id=GTM-NPHWVF2V appeared twice in the
 * page's script list), which fires every tag inside it a second time. The
 * duplicate is removed.
 *
 * What these containers actually fire, measured on the live homepage rather
 * than assumed, so nobody removes one blind:
 *   G-NW101GQZX3  GA4 "2026 - www.ghlvideo.com", server-side tagged via
 *                 server.ghlvideo.com. This is the property the platform
 *                 reads in admin -> CMS -> SEO -> Traffic.
 *   G-XDLWFZE93L  GA4 "www.ghlvideo.com", older
 *   G-4PV3DEZ6YF  GA4 "GHL Video Analytics", older
 *   AW-16454943179  Google Ads conversions
 *   n.clarity.ms    Microsoft Clarity session recording
 * The two older GA4 properties are retired inside GTM, not here: which
 * container holds which tag is configured in tagmanager.google.com, and
 * deleting a container from this file would take Ads and Clarity with it. */
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
`;
/*
 * No affiliate tracker in that block, deliberately.
 *
 * FirstPromoter was retired in favour of Affixo, whose tag is a real
 * component (components/AffixoTag.tsx) so it can be kept off /admin and
 * /portal where there is no visitor to attribute. Do not paste an affiliate
 * snippet back in here: two trackers on one page count every click twice.
 *
 * This note is a TS comment rather than an HTML one on purpose. Everything
 * in the string above is injected raw into the page, so a comment written
 * there ships to every visitor and reads our file paths out loud.
 */

/*
 * Injected at body end: the LeadConnector chat widget and the GTM
 * noscript fallback.
 *
 * The small script after the widget hides its greeting bubble on phones.
 * That bubble is fixed-position and opens on its own, and at 375px it landed
 * on top of the hero call to action: measured on /premade/, the prompt box
 * ran 642 to 714 and the "See the videos" button 705 to 751, so it covered
 * the top of the primary button on the fold. The launcher circle is left
 * alone, so anyone who wants to chat still can, and desktop is untouched.
 *
 * It reaches into the widget's shadow root because external CSS cannot cross
 * that boundary, and it appends a style rule rather than hiding the node once,
 * so the widget re-rendering does not undo it. Written as a TS comment, not an
 * HTML one, for the same reason as the note above: everything inside the
 * string below ships to every visitor.
 */
export const BODY_END_SCRIPTS = `<!-- LeadConnector widget -->
<script src="https://widgets.leadconnectorhq.com/loader.js" data-resources-url="https://widgets.leadconnectorhq.com/chat-widget/loader.js" data-widget-id="66b215e292c831bcfeb2c0f4">
 </script>

<script>
(function(){var t=0;function f(){var e=document.querySelector("chat-widget"),r=e&&e.shadowRoot;
if(r){if(!r.getElementById("ghlv-chat-fit")){var s=document.createElement("style");s.id="ghlv-chat-fit";
s.textContent="@media (max-width:767px){.lc_text-widget--prompt{display:none!important}}";r.appendChild(s);}return;}
if(t++<20)setTimeout(f,300);}f();})();
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
