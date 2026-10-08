import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function token(name: string): string {
  const declaration = `--${name}:`;
  const line = CSS.split("\n").find((candidate) => candidate.trim().startsWith(declaration));
  if (!line) throw new Error(`${declaration} is not declared in globals.css`);
  return line.trim().slice(declaration.length).split(";", 1)[0]?.trim() ?? "";
}

describe("shell geometry", () => {
  it("keeps both navigation bars at the requested 35px standard-density height", () => {
    expect(token("size-topbar")).toBe("calc(2.1875rem * var(--ui-scale))");
    expect(token("size-actionbar")).toBe("calc(2.1875rem * var(--ui-scale))");
  });

  it("derives the chrome offset from the two bars instead of duplicating a literal", () => {
    expect(token("size-chrome")).toBe(
      "calc(var(--size-topbar) + var(--size-actionbar))",
    );
  });
});
