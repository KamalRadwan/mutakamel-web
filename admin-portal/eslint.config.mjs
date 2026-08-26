import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Design-system migration guardrails (docs/design-system/migration.md,
// Phase 1.9 / 25.1). Scoped away from src/design-system/ itself, which
// legitimately defines the tokens these patterns forbid everywhere else.
//
// IMPORTANT: ESLint flat config merges `rules` per matching file by simple
// last-write-wins per rule id — it does NOT compose multiple config blocks
// that set the same rule id for overlapping `files`/`ignores`. Two earlier
// separate `no-restricted-syntax` blocks here (one for these patterns, one
// for the toast double-fire check below) both matched the same
// non-design-system .ts/.tsx files, so whichever block ESLint resolved
// last silently discarded the other's patterns entirely. In practice that
// meant every one of the patterns below has been dead code since it was
// introduced: none of them ever actually flagged anything in `pnpm lint`,
// including during every phase of this migration that ran lint as a gate.
// Fixed by merging every no-restricted-syntax pattern that targets the
// same file scope into one array per scope, below.
const RAW_COLOR_FAMILIES = [
  "slate", "gray", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
].join("|");

// Correctness guard, not a migration-tracking pattern — applies everywhere,
// including src/design-system/ itself. The transport layer already fires a
// toast on every non-public 403 (dispatchForbiddenToast in axiosClient.ts
// via the "global-toast" window event); a toast.error(...) inside a catch
// block that also references 403 or AUTHORIZATION double-fires. See
// docs/design-system/toast-contract.md.
const toastDoubleFireSyntax = {
  selector:
    "CatchClause:has(CallExpression[callee.property.name='error'][callee.object.name='toast']):has(Literal[value=403]), " +
    "CatchClause:has(CallExpression[callee.property.name='error'][callee.object.name='toast']):has(Literal[value=/AUTHORIZATION/])",
  message:
    "toast.error(...) here may double-fire with the transport's own 403 toast (dispatchForbiddenToast) — see docs/design-system/toast-contract.md.",
};

// Every pattern below has a real, live call site today in the routes
// Phases 20-21 deliberately left unconverted (provisioning,
// applications-catalogue, tenant-workspace — see
// docs/design-system/migration.md), plus font-weight/radius sites that are
// already clean. ESLint's `no-restricted-syntax` takes one severity for
// its whole pattern list, and flat config can't give two different
// severities to the same rule id on the same files (see the note above) —
// so this stays one list at "warn" rather than error on real,
// intentionally-deferred violations. `font-(black|extrabold|bold)` and
// `rounded-(2xl|3xl)` have zero known violations as of the Phase 25 census
// baseline and are the first candidates to promote to "error" once the
// remaining patterns' violations are cleared (which requires converting
// Phases 20-21, not a config change).
const designSystemSyntax = [
  {
    selector: `Literal[value=/\\bfont-(black|extrabold|bold)\\b/]`,
    message: "Only font-semibold/medium/normal are themed — see the 3-weight policy in docs/design-system/typography.md.",
  },
  {
    selector: `TemplateElement[value.raw=/\\bfont-(black|extrabold|bold)\\b/]`,
    message: "Only font-semibold/medium/normal are themed — see the 3-weight policy in docs/design-system/typography.md.",
  },
  {
    selector: `Literal[value=/\\brounded-(2xl|3xl)\\b/]`,
    message: "rounded-2xl/3xl are being retired to the 5-step radius scale (xs/sm/md/lg/xl) — see docs/design-system/geometry-and-density.md.",
  },
  {
    selector: `Literal[value=/\\btext-\\[\\d+px\\]/]`,
    message: "Use the design-system type scale (text-2xs/xs/sm/base/lg/xl/2xl) instead of an arbitrary pixel size — see docs/design-system/typography.md.",
  },
  {
    selector: `TemplateElement[value.raw=/\\btext-\\[\\d+px\\]/]`,
    message: "Use the design-system type scale (text-2xs/xs/sm/base/lg/xl/2xl) instead of an arbitrary pixel size — see docs/design-system/typography.md.",
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
  toastDoubleFireSyntax,
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Non-design-system app code: every migration pattern plus the toast
    // double-fire check, merged into the one array flat config actually
    // applies for this rule id on these files (see the file-scope note
    // above).
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/design-system/**"],
    rules: {
      "no-restricted-syntax": ["warn", ...designSystemSyntax],
    },
  },
  {
    // src/design-system/ itself: only the correctness guard applies — it
    // legitimately defines/uses the raw tokens, gradients, and blur the
    // migration patterns above forbid everywhere else.
    files: ["src/design-system/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["warn", toastDoubleFireSyntax],
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
