import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Feature code imports design-system pieces only from the @/design-system
  // barrel, never a deep path — see
  // docs/architecture/file-architecture.md#the-barrel. Inside
  // src/design-system/ itself, deep relative imports between its own files
  // are correct and expected, so this is scoped everywhere else.
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["src/design-system/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/design-system/**"],
              message: "Import from the @/design-system barrel, not a deep path — see docs/architecture/file-architecture.md#the-barrel.",
            },
          ],
        },
      ],
    },
  },
  // Phase 5 design gates — docs/design/enforcement.md's ESLint table. Every
  // pattern for this file scope lives in this ONE no-restricted-syntax call:
  // a second block setting the same rule key for overlapping files replaces
  // it rather than merging (flat config is last-write-wins per rule key),
  // which is exactly how these went dead once already elsewhere — see
  // enforcement.md#the-trap-that-made-these-useless-elsewhere.
  //
  // gradients/backdrop-blur are deliberately absent: enforcement.md gives
  // them a numeric budget (<=2, <=1), not a zero-tolerance ban, and
  // no-restricted-syntax can only reject every occurrence, not count them —
  // `pnpm design:census -- --check` is what enforces the budget.
  //
  // Excluded beyond src/design-system/: src/components/auth/ is Tier-1 (the
  // spine — HANDOFF.md says do not touch, no carve-out for styling-only
  // edits), and it is the sole remaining source of every violation these
  // rules would catch. Linting code that can never legally be fixed would
  // make this gate permanently, uninformatively red. Test files are
  // excluded because their raw <button>s are test-harness code, not
  // production markup — the hand-rolled-button rule is about UI.
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      "src/design-system/**",
      "src/components/auth/**",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/\\btext-\\[[0-9]+px\\]/]",
          message: "Arbitrary text-[Npx] — use the 7-step type scale instead. See docs/design/typography.md.",
        },
        {
          selector: "Literal[value=/\\bfont-(?:bold|extrabold|black)\\b/]",
          message: "Only three font weights exist (400/500/600) — bold-or-heavier is banned. See docs/design/DESIGN-SYSTEM.md.",
        },
        {
          selector: "Literal[value=/\\brounded-(?:xl|2xl|3xl)\\b/]",
          message: "The radius scale stops at rounded-lg (8px) — see docs/design/DESIGN-SYSTEM.md.",
        },
        {
          selector:
            "Literal[value=/\\b(?:bg|text|border|ring|from|to|via|fill|stroke|shadow|decoration|outline|divide|accent|placeholder|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\\b/]",
          message: "Raw palette utility — use a semantic token (brand/positive/caution/negative/ink) instead. See docs/design/tokens.md.",
        },
        {
          selector:
            "ConditionalExpression[test.operator='==='][test.right.value='ar']:matches([consequent.type='Literal'], [alternate.type='Literal'])",
          message: 'Language ternary around a string — add the key to both dictionaries instead. See docs/design/i18n.md#the-zero-ternary-rule.',
        },
        {
          selector:
            "ConditionalExpression[test.type='Identifier'][test.name=/^(?:isRtl|isArabic)$/]:matches([consequent.type='Literal'], [alternate.type='Literal'])",
          message: 'Language ternary around a string — add the key to both dictionaries instead. See docs/design/i18n.md#the-zero-ternary-rule.',
        },
        {
          selector:
            "LogicalExpression[operator='&&'][left.operator='==='][left.right.value='ar'][right.type='Literal']",
          message: 'Language ternary around a string — add the key to both dictionaries instead. See docs/design/i18n.md#the-zero-ternary-rule.',
        },
        {
          selector:
            "LogicalExpression[operator='&&'][left.type='Identifier'][left.name=/^(?:isRtl|isArabic)$/][right.type='Literal']",
          message: 'Language ternary around a string — add the key to both dictionaries instead. See docs/design/i18n.md#the-zero-ternary-rule.',
        },
        {
          selector: "Literal[value=/\bz-(?:0|10|20|30|40|50|\[[0-9]+\])\b/]",
          message:
            "Bare z-index — use a token: z-(--z-sticky-cell|--z-sticky-header|--z-topbar|--z-dropdown|--z-overlay|--z-toast). See docs/design/DESIGN-SYSTEM.md#stacking-order.",
        },
        {
          selector: "JSXElement > JSXOpeningElement[name.name='button']",
          message: "Hand-rolled <button> — use the design-system Button primitive. See docs/design/patterns.md.",
        },
        {
          selector: "JSXElement > JSXOpeningElement[name.name='table']",
          message: "Hand-rolled <table> — use DataTable or the Table primitive. See docs/design/patterns.md.",
        },
      ],
    },
  },
]);

export default eslintConfig;
