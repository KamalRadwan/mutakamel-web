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
    // `@mutakamel/webphone` is consumed as source, so its own imports resolve
    // from the package directory. The React ecosystem entries below point them
    // back at this portal's copies, keeping one React instance in the run.
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@mutakamel/webphone": path.resolve(__dirname, "../packages/webphone/src/index.ts"),
      react: path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      "lucide-react": path.resolve(__dirname, "./node_modules/lucide-react"),
      "@testing-library/react": path.resolve(__dirname, "./node_modules/@testing-library/react"),
    },
  },
});
