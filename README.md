# GHL Video

Marketing site for GHL Video (a brand of Vidiosa LLC), the video studio built only for the HighLevel ecosystem.

- **Stack:** Next.js App Router, TypeScript, Tailwind CSS v4, Framer Motion. Static export (`output: "export"`).
- **Type:** Archivo (display, Google Fonts) and Raveo Display (body and labels, SIL OFL 1.1, self-hosted in `app/fonts/`), loaded via `next/font`.
- **Content:** every price, count, name, URL, and recurring line lives in `lib/site.ts`. Pages read from it; nothing is hardcoded per component.
- **Build brief:** `CLAUDE.md` in the repo root is the source of truth for design tokens, copy rules, and guardrails.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # static export to out/
```

Checkout, booking, and forms run on the existing HighLevel LeadConnector stack at order.ghlvideo.com; the site links out and embeds, it does not process payments.
