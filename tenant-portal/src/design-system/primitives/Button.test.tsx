// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Button, buttonVariantClasses } from "./Button";

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

  it("renders the primary variant with bg-gradient-primary, text-white, and token hover states", () => {
    render(<Button variant="primary">New Lead</Button>);
    const button = screen.getByRole("button", { name: "New Lead" });

    expect(button).toHaveClass(
      "bg-gradient-primary",
      "text-white",
      "not-disabled:hover:brightness-90",
      "not-disabled:hover:shadow-pop",
      "focus-visible:ring-2",
    );
    expect(button.className).not.toMatch(/purple|violet|indigo|fuchsia|pink/);
  });

  it("supports the 33px toolbar control size step", () => {
    render(<Button size="toolbar">Filter</Button>);
    const button = screen.getByRole("button", { name: "Filter" });

    expect(button).toHaveClass(
      "h-(--size-toolbar-control)",
      "rounded-lg",
      "text-label",
      "font-bold",
    );
    expect(button).not.toHaveClass("rounded-md", "font-medium");
    expect(buttonVariantClasses("outline", "toolbar")).toContain("h-(--size-toolbar-control)");
  });
});
