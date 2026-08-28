// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Button } from "./Button";

afterEach(cleanup);

describe("Button", () => {
  it("shows a spinner, sets aria-busy, and disables the button while loading", () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector("svg")).not.toBeNull();
  });

  it("keeps the label as the accessible name while loading, not a bare spinner", () => {
    render(<Button loading>Save changes</Button>);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("renders exactly one child element when asChild is set, so Radix Slot does not throw", () => {
    render(
      <Button asChild>
        <a href="/leads">Go to leads</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Go to leads" });
    expect(link.tagName).toBe("A");
  });

  it("does not render a spinner sibling when asChild is combined with loading — Slot requires exactly one child", () => {
    render(
      <Button asChild loading>
        <a href="/leads">Go to leads</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Go to leads" });
    expect(link.querySelector("svg")).toBeNull();
  });
});
