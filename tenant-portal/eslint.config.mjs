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
            // Envelope discipline (S1). unwrapCoreData takes `unknown`, so
            // nothing stops it being applied to a CRM body — where it either
            // silently no-ops or, the day a CRM route carries a `data` key,
            // silently returns the wrong object. Feature code goes through
            // src/lib/api/envelope.ts, whose path types cannot accept a CRM
            // route at all.
            {
              group: ["@/lib/api/axiosClient", "**/api/axiosClient", "./axiosClient"],
              importNames: ["unwrapCoreData"],
              message:
                "Do not unwrap a response through the Core helper directly — use readCoreData / readCrmBody from @/lib/api/envelope. See docs/architecture/data-layer.md#response-envelopes.",
            },
          ],
        },
      ],
    },
  },
  // Deliberately overrides the block above for the transport and session
  // layer, which owns unwrapCoreData and must keep calling it. Flat config
  // resolves two blocks setting the same rule key as last-write-wins rather
  // than merging (enforcement.md#the-trap-that-made-these-useless-elsewhere),
  // so this block restates the barrel pattern instead of only removing one —
  // dropping it here would silently switch the barrel rule off for src/lib/.
  {
    files: ["src/lib/**/*.ts", "src/context/**/*.ts", "src/context/**/*.tsx"],
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
  // src/components/auth/ was excluded here while HANDOFF.md fenced it as
  // Tier-1 "do not touch", which made it the sole remaining source of every
  // violation these rules catch. HANDOFF.md's 2026-08-31 amendment permits
  // the presentation-only conversion, MASTER-PLAN 3.12–3.13 landed it, and
  // the exclusion came out with 3.14 — the four files now lint like any
  // other feature code. Test files stay excluded because their raw
  // <button>s are test-harness code, not production markup.
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      "src/design-system/**",
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
            "ConditionalExpression[test.operator='==='][test.right.value='ar']:matches([consequent.type='Literal'], [alternate.type='Literal'], [consequent.type='TemplateLiteral'], [alternate.type='TemplateLiteral'], [consequent.type='ConditionalExpression'], [alternate.type='ConditionalExpression'])",
          message: 'Language ternary around a string — add the key to both dictionaries instead. See docs/design/i18n.md#the-zero-ternary-rule.',
        },
        {
          selector:
            "ConditionalExpression[test.type='Identifier'][test.name=/^(?:isRtl|isArabic)$/]:matches([consequent.type='Literal'], [alternate.type='Literal'], [consequent.type='TemplateLiteral'], [alternate.type='TemplateLiteral'], [consequent.type='ConditionalExpression'], [alternate.type='ConditionalExpression'])",
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
          // Every backslash here is doubled on purpose: this is a JS string
          // literal, so a single \b is the backspace character, not a regex
          // word boundary. The rule matched nothing at all until 3.35.
          selector: "Literal[value=/\\bz-(?:0|10|20|30|40|50|\\[[0-9]+\\])\\b/]",
          message:
            "Bare z-index — use a token: z-(--z-sticky-cell|--z-sticky-header|--z-topbar|--z-dropdown|--z-overlay|--z-toast). See docs/design/DESIGN-SYSTEM.md#stacking-order.",
        },
        {
          selector: "Literal[value=/\\brtl:(?:rotate-180|scale-x-)/]",
          message:
            "Non-canonical RTL mirror — the one mechanism is rtl:-scale-x-100. See docs/design/icons.md#mirroring.",
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
