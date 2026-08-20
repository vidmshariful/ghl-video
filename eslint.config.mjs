import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/* Added to every part's restricted-import patterns. The kit 404s outside
 * development, so anything that ships importing it would break in prod. */
const KIT_IS_DEV_ONLY = {
  group: ["@/components/uikits/*", "@/app/uikits/*"],
  message:
    "The UI kit is dev-only and 404s in production. Nothing that ships may import it.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // `react-hooks/set-state-in-effect` is a React 19 PERFORMANCE hint (not a
    // correctness rule). It fires on our intentional, correct patterns: closing
    // the mobile menu on route change, and the standard mount-then-fetch effects
    // in the admin/checkout/portal clients. Refactoring around the hint would be
    // worse, so turn just this hint off. rules-of-hooks and exhaustive-deps stay.
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },

  /* ----------------------------------------------------------------
   * Part boundaries. The app has 4 parts (public site, checkout,
   * sales pages, backend). They are cleanly separated today; these
   * rules KEEP them that way so a change in one part cannot silently
   * reach into another's UI or into the money-path internals. Shared
   * code belongs in lib/content, lib/chrome, or a top-level shared
   * component, which stay importable everywhere.
   * ---------------------------------------------------------------- */
  {
    // Part 1: public marketing site
    files: [
      "app/(site)/**/*.{ts,tsx}",
      "components/home/**/*.{ts,tsx}",
      "components/pages/**/*.{ts,tsx}",
      "components/premade/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/components/checkout/*",
                "@/components/sales/*",
                "@/components/admin/*",
                "@/lib/checkout/*",
              ],
              message:
                "Public site must not import checkout/sales/admin UI or money-path internals. Put shared code in lib/content or a shared component.",
            },
            KIT_IS_DEV_ONLY,
          ],
        },
      ],
    },
  },
  {
    // Part 2: checkout
    files: ["app/checkout/**/*.{ts,tsx}", "components/checkout/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/components/home/*",
                "@/components/pages/*",
                "@/components/premade/*",
                "@/components/sales/*",
              ],
              message:
                "Checkout must not import marketing or sales UI. Put shared code in a shared component.",
            },
            KIT_IS_DEV_ONLY,
          ],
        },
      ],
    },
  },
  {
    // Part 3: the portals (site admin, customer portal, partner portal).
    // One surface, three doors; they share the portal skin + auth and may
    // use only top-level shared components (Logo, GhlMark, chat).
    files: [
      "app/admin/**/*.{ts,tsx}",
      "app/portal/**/*.{ts,tsx}",
      "app/partners/**/*.{ts,tsx}",
      /* the public library wears the portal skin, so it keeps the portal's
         boundaries: shared card lives in components/library, not premade */
      "app/library/**/*.{ts,tsx}",
      "components/admin/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/components/home/*",
                "@/components/pages/*",
                "@/components/premade/*",
                "@/components/sales/*",
                "@/components/checkout/*",
              ],
              message:
                "Portals must not import marketing, sales, or checkout UI. Shared brand pieces (Logo, GhlMark, chat) live at the top level of components/.",
            },
            KIT_IS_DEV_ONLY,
          ],
        },
      ],
    },
  },
  {
    // Part 4: sales landing pages
    files: ["app/(sales)/**/*.{ts,tsx}", "components/sales/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/components/home/*",
                "@/components/pages/*",
                "@/components/premade/*",
                "@/components/checkout/*",
                "@/components/admin/*",
              ],
              message:
                "Sales pages must not import marketing/checkout/admin UI. Put shared code in a shared component or lib/content.",
            },
            KIT_IS_DEV_ONLY,
          ],
        },
      ],
    },
  },
  {
    /* The dev UI kit is the ONE declared exception to the part boundaries
     * above, and it has to be: a live gallery's whole job is rendering a
     * marketing button beside a portal card beside a checkout panel on one
     * page. Granting that exception anywhere else would defeat the rules;
     * it is safe here for exactly one reason, so keep the reason true:
     *
     *   /uikits 404s outside development (app/uikits/layout.tsx).
     *
     * The kit may import any surface's UI. Nothing may import the kit back,
     * which is what this second rule enforces from the other direction.
     */
    files: ["app/uikits/**/*.{ts,tsx}", "components/uikits/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    /* Production code must never depend on the dev-only kit. Scoped to the
     * paths the four blocks above do NOT already cover, because this rule
     * shares their name: in flat config a later block REPLACES an earlier
     * one's `no-restricted-imports` rather than merging with it, so listing
     * app/(site) or components/home here would silently delete their part
     * boundary. The covered paths carry the kit pattern inline instead. */
    files: [
      "components/*.{ts,tsx}",
      "components/portal/**/*.{ts,tsx}",
      "components/chat/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": ["error", { patterns: [KIT_IS_DEV_ONLY] }],
    },
  },
]);

export default eslintConfig;
