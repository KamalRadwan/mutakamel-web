import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Design-system migration guardrails (docs/design-system/migration.md,
// Phase 1.9 / 25.1). Warn-only while the codemods run; flips to "error" in
// Phase 25. Scoped away from src/design-system/ itself, which legitimately
// defines the tokens these patterns forbid everywhere else.
const RAW_COLOR_FAMILIES = [
  "slate", "gray", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
].join("|");

const designSystemRestrictedSyntax = [
  {
    selector: `Literal[value=/\\btext-\\[\\d+px\\]/]`,
    message: "Use the design-system type scale (text-2xs/xs/sm/base/lg/xl/2xl) instead of an arbitrary pixel size — see docs/design-system/typography.md.",
  },
  {
    selector: `TemplateElement[value.raw=/\\btext-\\[\\d+px\\]/]`,
    message: "Use the design-system type scale (text-2xs/xs/sm/base/lg/xl/2xl) instead of an arbitrary pixel size — see docs/design-system/typography.md.",
  },
  {
    selector: `Literal[value=/\\bfont-(black|extrabold|bold)\\b/]`,
    message: "Only font-semibold/medium/normal are themed — see the 3-weight policy in docs/design-system/typography.md.",
  },
  {
    selector: `TemplateElement[value.raw=/\\bfont-(black|extrabold|bold)\\b/]`,
    message: "Only font-semibold/medium/normal are themed — see the 3-weight policy in docs/design-system/typography.md.",
  },
  {
    selector: `Literal[value=/\\bbg-gradient-to-/]`,
    message: "Gradients are budgeted to 3 total (brand mark, sticky-header fade, skeleton shimmer) — see docs/design-system/geometry-and-density.md.",
  },
  {
    selector: `Literal[value=/\\bbackdrop-blur\\b/]`,
    message: "backdrop-blur is budgeted to 1 use (the modal/drawer scrim) — see docs/design-system/geometry-and-density.md.",
  },
  {
    selector: `Literal[value=/\\b(?:bg|text|border|ring|from|to|via|fill|stroke|shadow|decoration|outline|divide|accent)-(?:${RAW_COLOR_FAMILIES})-[0-9]{2,3}\\b/]`,
    message: "Use a semantic token (bg-card, text-foreground, border-border, …) instead of a raw Tailwind palette color — see docs/design-system/tokens.md.",
  },
  {
    selector: `Literal[value=/\\brounded-(2xl|3xl)\\b/]`,
    message: "rounded-2xl/3xl are being retired to the 5-step radius scale (xs/sm/md/lg/xl) — see docs/design-system/geometry-and-density.md.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/design-system/**"],
    rules: {
      "no-restricted-syntax": ["warn", ...designSystemRestrictedSyntax],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
