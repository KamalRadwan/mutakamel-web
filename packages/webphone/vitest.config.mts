import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
  },
});
