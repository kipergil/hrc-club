import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "client/src"),
      "@shared": path.resolve(dirname, "shared"),
    },
  },
  test: {
    // Node by default; the few tests that render components opt into jsdom
    // with a `@vitest-environment jsdom` docblock, so the whole suite does
    // not pay for a DOM it mostly does not use.
    environment: "node",
    include: ["{client,server,shared,scripts,directus}/**/*.test.{ts,tsx}"],
    globals: true,
  },
});
