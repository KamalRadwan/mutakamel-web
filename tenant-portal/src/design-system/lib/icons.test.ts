import { readFileSync, readdirSync } from "node:fs";
import { extname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DIRECTIONAL_ICON_NAMES, iconSize, mirrorInRtl } from "./icons";

// The ESLint selector and the design census both skip src/design-system/ —
// the first by an explicit `ignores`, the second by SKIP_ABSOLUTE_DIRS. This
// test is what covers the gap, so the mirror rule is enforced everywhere and
// not only where the other two can see.
const designSystemRoot = resolve(__dirname, "..");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    if (extname(entry.name) !== ".tsx") return [];
    return entry.name.endsWith(".test.tsx") ? [] : [full];
  });
}

const files = sourceFiles(designSystemRoot).map((path) => ({
  path,
  text: readFileSync(path, "utf8"),
}));

describe("icon system", () => {
  it("maps every control size to exactly one icon size", () => {
    const sizes = ["xs", "sm", "md", "lg", "xl"] as const;
    const rendered = sizes.map((size) => iconSize({ size }));
    expect(new Set(rendered).size).toBeGreaterThan(1);
    for (const classes of rendered) expect(classes).toContain("shrink-0");
  });

  it("uses one mirror spelling across the whole design system", () => {
    const offenders = files
      .filter(({ text }) => /\brtl:(?:rotate-180|scale-x-)/.test(text))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it("mirrors every directional glyph it renders", () => {
    const offenders: string[] = [];
    for (const { path, text } of files) {
      for (const name of DIRECTIONAL_ICON_NAMES) {
        // Matches the JSX element, not the import line, and stops at the
        // closing bracket so a sibling element cannot satisfy the check.
        const element = new RegExp(`<${name}\\b[^>]*>`, "g");
        for (const match of text.match(element) ?? []) {
          // Either spelling counts: the exported `mirrorInRtl` constant, which
          // is what new code composes through `cn()`, or the literal class,
          // which is what a call site that predates the constant carries.
          const mirrored = match.includes(mirrorInRtl) || /\bmirrorInRtl\b/.test(match);
          if (!mirrored) offenders.push(`${path}: ${match}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
