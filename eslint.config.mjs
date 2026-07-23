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
]);

export default eslintConfig;
