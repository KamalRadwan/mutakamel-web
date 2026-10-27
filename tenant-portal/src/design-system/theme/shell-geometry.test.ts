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
  it("keeps the topbar at 58px and toolbar at 48px at standard density", () => {
    expect(token("size-topbar")).toBe("calc(3.625rem * var(--ui-scale))");
    expect(token("size-toolbar")).toBe("calc(3rem * var(--ui-scale))");
  });

  it("includes the scaled 11px outer padding in the actionbar height", () => {
    expect(token("size-actionbar-inset")).toBe("calc(0.6875rem * var(--ui-scale))");
    expect(token("size-actionbar")).toBe(
      "calc(var(--size-toolbar) + var(--size-actionbar-inset))",
    );
  });

  it("derives the chrome offset from the fixed strip and both bars", () => {
    expect(token("size-brand-strip")).toBe("3px");
    expect(token("size-chrome")).toBe(
      "calc(var(--size-brand-strip) + var(--size-topbar) + var(--size-actionbar))",
    );
  });
});
