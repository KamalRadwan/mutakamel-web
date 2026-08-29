import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// This package is a plain React library, not a Next app, but both portals that
// consume it lint with this config. Sharing it keeps one set of rules across
// code that ships together -- notably the react-hooks rules, which is what
// `useWebRTCPhone` actually needs.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(["build/**"]),
  {
    rules: {
      // A library has no pages directory; the rule otherwise warns on every run.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
]);

export default eslintConfig;
