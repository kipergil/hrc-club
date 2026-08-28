import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: path.resolve(dirname, "client"),
  resolve: {
    alias: {
      "@": path.resolve(dirname, "client/src"),
      "@shared": path.resolve(dirname, "shared"),
    },
  },
  build: {
    outDir: path.resolve(dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
});
