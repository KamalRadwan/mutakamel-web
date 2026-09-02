// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IdentifierText } from "./IdentifierText";

const UUID = "0198c4a2-7f31-7c2e-9b40-1d5f8e2a6c11";

afterEach(cleanup);

describe("IdentifierText", () => {
  it("isolates the identifier from the surrounding paragraph direction", () => {
    render(<IdentifierText>{UUID}</IdentifierText>);
    const node = screen.getByText(UUID);

    // Both are load-bearing and neither substitutes for the other: <bdi>
    // isolates the run, dir pins its internal direction. A <span dir="ltr">
    // still leaks directional influence into the Arabic sentence around it.
    expect(node.tagName).toBe("BDI");
    expect(node).toHaveAttribute("dir", "ltr");
  });

  it("wraps with wrap-anywhere and never break-all", () => {
    render(<IdentifierText>{UUID}</IdentifierText>);
    const node = screen.getByText(UUID);

    // break-all hyphenates ordinary prose mid-syllable in both scripts;
    // wrap-anywhere breaks only a token that would otherwise overflow.
    expect(node).toHaveClass("wrap-anywhere");
    expect(node).not.toHaveClass("break-all");
    expect(node).toHaveClass("font-mono");
  });

  it("keeps the caller's classes alongside its own", () => {
    render(<IdentifierText className="text-xs text-muted-foreground">{UUID}</IdentifierText>);
    const node = screen.getByText(UUID);
    expect(node).toHaveClass("text-xs");
    expect(node).toHaveClass("wrap-anywhere");
  });

  it("opts into one-gesture selection only when asked", () => {
    const { rerender } = render(<IdentifierText>{UUID}</IdentifierText>);
    expect(screen.getByText(UUID)).not.toHaveClass("select-all");

    rerender(<IdentifierText selectAll>{UUID}</IdentifierText>);
    expect(screen.getByText(UUID)).toHaveClass("select-all");
  });
});
