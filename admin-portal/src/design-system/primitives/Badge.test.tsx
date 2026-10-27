// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Badge, badgeVariants, type BadgeProps } from "./Badge";

afterEach(cleanup);

describe("Badge", () => {
  it.each([
    ["success", "success"],
    ["brand", "success"],
    ["info", "info"],
    ["danger", "destructive"],
    ["warn", "warning"],
  ] as const)("preserves the %s tone role", (tone, role) => {
    render(<Badge tone={tone} size="sm">Status</Badge>);
    expect(screen.getByText("Status")).toHaveClass(
      `bg-${role}-subtle`,
      `text-${role}-subtle-foreground`,
      "text-badge",
    );
  });

  it("preserves the default size classes so existing callers do not change", () => {
    render(<Badge>Qualified</Badge>);
    const badge = screen.getByText("Qualified");

    expect(badge).toHaveClass(
      "rounded-sm",
      "px-1.5",
      "py-0.5",
      "text-xs",
      "font-semibold",
      "uppercase",
      "tracking-wide",
      "rtl:normal-case",
      "rtl:tracking-normal",
      "bg-muted",
      "text-muted-foreground",
    );
  });

  it("renders size='sm' at 24px height with rounded-md, px-2, text-badge, and without uppercase", () => {
    render(<Badge size="sm">Stage</Badge>);
    const badge = screen.getByText("Stage");

    expect(badge).toHaveClass("h-6", "rounded-md", "px-2", "text-badge", "font-semibold");
    expect(badge).not.toHaveClass("uppercase", "tracking-wide", "rounded-sm", "py-0.5");
  });

  it("supports all six admin semantic tones with zero purple or indigo classes", () => {
    const tones: NonNullable<BadgeProps["tone"]>[] = [
      "brand",
      "info",
      "success",
      "warn",
      "danger",
      "neutral",
    ];

    for (const tone of tones) {
      const classes = badgeVariants({ tone });
      expect(classes).not.toMatch(/purple|violet|indigo|fuchsia|pink/);
    }
  });
});
