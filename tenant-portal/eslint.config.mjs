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
]);

export default eslintConfig;
