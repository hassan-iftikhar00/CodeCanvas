import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
// Import Prettier plugin
import prettier from "eslint-plugin-prettier";
// Import Prettier config
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Add Prettier configs
  prettierConfig,
  {
    plugins: {
      prettier,
    },
    rules: {
      "prettier/prettier": ["error", {}, { usePrettierrc: true }],
      // Pre-existing `any`s (Supabase generated types, version-history glue)
      // and effect-time setState predate the Next 16 / ESLint 9 migration.
      // Warn instead of error so `pnpm lint` gates NEW regressions without
      // demanding a refactor of working teammate-owned code. Tighten back to
      // "error" once the existing occurrences are cleaned up.
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Static design mockups (throwaway reference pages, not shipped UI):
    // full of prose with literal quotes/apostrophes and JSX comment art.
    files: ["src/app/design-preview/**", "src/app/design-preview-v2/**"],
    rules: {
      "react/no-unescaped-entities": "off",
      "react/jsx-no-comment-textnodes": "off",
    },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Non-frontend trees eslint must never crawl:
    "venv/**",
    "backend/**",
    "synthetic_dataset/**",
    // Root-level puppeteer helper script (CommonJS, not app code):
    "capture-ui.js",
  ]),
]);

export default eslintConfig;
