import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The stacking ladder lives in CSS, so no type can hold it to its own ordering
// — and one pair of it fails silently rather than loudly. These are the four
// relations that have a reason; the absolute values are free to move.
const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function layer(name: string): number {
  const declaration = `--z-${name}:`;
  const line = CSS.split("\n").find((candidate) => candidate.trim().startsWith(declaration));
  if (!line) throw new Error(`${declaration} is not declared in globals.css`);
  // parseInt skips the leading space and stops at the semicolon.
  return Number.parseInt(line.trim().slice(declaration.length), 10);
}

describe("the stacking ladder", () => {
  it("declares every layer the design system names", () => {
    const names = ["sticky-cell", "sticky-header", "topbar", "overlay", "dropdown", "toast"];
    expect(names.map(layer).every(Number.isFinite)).toBe(true);
  });

  it("puts a dropdown above an overlay, or every select inside a dialog is lost", () => {
    // A Select, Popover or DropdownMenu portals to <body> as a SIBLING of the
    // dialog it was opened from, never as its child. Below the overlay it
    // paints behind the scrim: the list reads as a blur and every click on an
    // option lands on the overlay. The reverse cannot arise — opening a modal
    // dismisses any popover that was already open.
    expect(layer("dropdown")).toBeGreaterThan(layer("overlay"));
  });

  it("keeps a toast above the dialog whose outcome it reports", () => {
    expect(layer("toast")).toBeGreaterThan(layer("dropdown"));
  });

  it("keeps a sticky header above the sticky cells it labels", () => {
    expect(layer("sticky-header")).toBeGreaterThan(layer("sticky-cell"));
  });

  it("keeps the app chrome above the page and under every floating layer", () => {
    expect(layer("topbar")).toBeGreaterThan(layer("sticky-header"));
    expect(layer("topbar")).toBeLessThan(layer("overlay"));
  });
});
