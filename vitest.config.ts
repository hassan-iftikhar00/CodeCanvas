import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Frontend test config (B11). Run with `pnpm test` (single pass) or
// `pnpm test:watch`. These first suites cover pure logic, so the default
// `node` environment is enough; switch to `jsdom` later if a suite needs the
// DOM. The `@/` alias mirrors tsconfig.json so tests import the same way the
// app does.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
