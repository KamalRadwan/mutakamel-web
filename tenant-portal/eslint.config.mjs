import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Template quasis carry class names just as string literals do. RegExp.source
// preserves word boundaries when embedding both forms in an esquery selector.
function classPattern(pattern) {
  return `:matches(Literal[value=/${pattern.source}/], TemplateElement[value.raw=/${pattern.source}/])`;
}

const designRuleIgnores = [
  "src/design-system/**",
  "**/*.test.{ts,tsx}",
  "**/*.spec.{ts,tsx}",
];

const designSyntaxRules = [
  {
    selector: classPattern(/\btext-\[[0-9]+(?:\.[0-9]+)?px\]/),
    message: "Arbitrary text-[Npx] — use named type steps, including micro/badge/caption/label/tab/card-title/column-title. See docs/design/specs/crm-leads-v3.md.",
  },
  {
    selector: classPattern(/\bfont-black\b/),
    message: "Weight 900 is banned; weights 400/500/600/700/800 are allowed. See docs/design/specs/crm-leads-v3.md.",
  },
  {
    selector: classPattern(/\brounded-(?:xl|2xl|3xl)\b/),
    message: "Use the radius scale or named rounded-card/rounded-column tokens, not rounded-xl/2xl/3xl. See docs/design/specs/crm-leads-v3.md.",
  },
  {
    selector:
      classPattern(/\b(?:bg|text|border|ring|from|to|via|fill|stroke|shadow|decoration|outline|divide|accent|placeholder|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b/),
    message: "Raw palette utility — use a semantic token (brand/positive/caution/negative/ink) instead. See docs/design/tokens.md.",
  },
  {
    selector: classPattern(/\b(?:bg|text|border|ring|from|to|via|fill|stroke|shadow|decoration|outline|divide|accent|placeholder|caret)-\[(?:#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?|hwb|(?:ok)?lab|(?:ok)?lch|color|light-dark)\(|color:)/),
    message: "Arbitrary colour — use a named semantic utility. See docs/design/specs/crm-leads-v3.md.",
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
    selector: classPattern(/\bz-(?:0|10|20|30|40|50|\[[0-9]+\])\b/),
    message:
      "Bare z-index — use a token: z-(--z-sticky-cell|--z-sticky-header|--z-topbar|--z-dropdown|--z-overlay|--z-toast). See docs/design/DESIGN-SYSTEM.md#stacking-order.",
  },
  {
    selector: classPattern(/\brtl:(?:rotate-180|scale-x-)/),
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
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // `const { dropped: _drop, ...rest } = value` is how a key is omitted, and the
  // omitted binding is the point of the expression rather than a leftover.
  // `ignoreRestSiblings` exists for exactly that shape and nothing else, so it
  // is preferred over an `^_` name pattern, which would also excuse a genuinely
  // dead variable that happens to be named with a leading underscore.
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { ignoreRestSiblings: true },
      ],
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
  // Shared design gates — docs/design/enforcement.md's ESLint table. The
  // narrower gradient scope below reuses this complete rule array because
  // flat config replaces overlapping no-restricted-syntax arrays rather than
  // merging them. Omitting a shared rule there would silently disable it — see
  // enforcement.md#the-trap-that-made-these-useless-elsewhere.
  //
  // Backdrop blur retains its census budget. Raw gradients are rejected in
  // app/components below; named gradient tokens are allowed (CRM Leads v3).
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
    ignores: designRuleIgnores,
    rules: {
      "no-restricted-syntax": ["error", ...designSyntaxRules],
    },
  },
  // Flat config replaces rule arrays, so retain every shared gate here.
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    ignores: designRuleIgnores,
    rules: {
      "no-restricted-syntax": [
        "error",
        ...designSyntaxRules,
        {
          selector: classPattern(/\bbg-(?:(?:linear|radial|conic)(?:-|\b)|gradient-to-|\[(?:image:)?(?:repeating-)?(?:linear|radial|conic)-gradient)/),
          message: "Raw gradient — use bg-gradient-header/brand-strip/primary/avatar/logo/canvas/chip-active. See docs/design/specs/crm-leads-v3.md.",
        },
      ],
    },
  },
]);

export default eslintConfig;
