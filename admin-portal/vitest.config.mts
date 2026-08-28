import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "**/*.{test,spec}.?(c|m)[jt]s?(x)",
      "../packages/webphone/src/**/*.{test,spec}.?(c|m)[jt]s?(x)",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@mutakamel/webphone": path.resolve(__dirname, "../packages/webphone/src/index.ts"),
    },
  },
});
