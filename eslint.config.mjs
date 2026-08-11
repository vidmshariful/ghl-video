import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
