import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Builds the React UI into a single self-contained dist/ui.html.
// The service worker (src/code.ts) is built separately via esbuild → dist/code.js.
// The web-app manifest is copied from public/manifest.json → dist/manifest.json.
export default defineConfig({
  root: ".",
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      input: { ui: "ui.html" },
    },
  },
});
