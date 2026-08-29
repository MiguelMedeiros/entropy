import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { defineConfig } from "vitest/config";

function developmentCsp() {
  return {
    name: "development-csp",
    apply: "serve" as const,
    transformIndexHtml(html: string) {
      return html
        .replace("script-src 'unsafe-inline'", "script-src 'self' 'unsafe-inline'")
        .replace("connect-src 'none'", "connect-src 'self' ws:");
    },
  };
}

export default defineConfig({
  plugins: [developmentCsp(), react(), viteSingleFile()],
  build: {
    target: "es2022",
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 2_000,
  },
  test: {
    environment: "node",
  },
});
