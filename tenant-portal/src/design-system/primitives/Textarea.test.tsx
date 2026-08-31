// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Textarea } from "./Textarea";

afterEach(cleanup);

describe("Textarea", () => {
  it("takes a size variant that changes padding, matching Input's steps", () => {
    const { rerender } = render(<Textarea aria-label="Notes" size="sm" />);
    expect(screen.getByLabelText("Notes").className).toContain("px-2");

    rerender(<Textarea aria-label="Notes" size="lg" />);
    expect(screen.getByLabelText("Notes").className).toContain("px-4");
  });

  it("never takes a fixed control height — that would clamp a multi-line control to one row", () => {
    render(<Textarea aria-label="Notes" size="md" />);
    expect(screen.getByLabelText("Notes").className).not.toContain("--size-control-md");
  });

  it("renders 16px-class type below sm at every size, so mobile Safari does not zoom on focus", () => {
    const { rerender } = render(<Textarea aria-label="Notes" size="md" />);
    expect(screen.getByLabelText("Notes").className).toContain("text-base");
    expect(screen.getByLabelText("Notes").className).toContain("sm:text-sm");

    rerender(<Textarea aria-label="Notes" size="sm" />);
    expect(screen.getByLabelText("Notes").className).toContain("text-base");
    expect(screen.getByLabelText("Notes").className).toContain("sm:text-xs");
  });

  it("defaults to three rows and resizes vertically only", () => {
    render(<Textarea aria-label="Notes" />);
    const textarea = screen.getByLabelText("Notes");
    expect(textarea).toHaveAttribute("rows", "3");
    expect(textarea.className).toContain("resize-y");
  });

  it("renders readOnly distinctly from disabled — full contrast, still focusable", () => {
    render(<Textarea aria-label="Notes" readOnly defaultValue="Locked copy" />);
    const textarea = screen.getByLabelText("Notes");
    expect(textarea).toHaveAttribute("readonly");
    expect(textarea).toBeEnabled();
    expect(textarea.className).toContain("read-only:text-foreground");
    expect(textarea.className).toContain("read-only:bg-muted");
    // A readOnly control stays keyboard-reachable, so it keeps its focus ring.
    expect(textarea.className).toContain("focus-visible:ring-2");
  });

  it("keeps disabled dimmed and non-interactive", () => {
    render(<Textarea aria-label="Notes" disabled />);
    const textarea = screen.getByLabelText("Notes");
    expect(textarea).toBeDisabled();
    expect(textarea.className).toContain("disabled:opacity-50");
  });
});
