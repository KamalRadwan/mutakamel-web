// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Badge, badgeVariants, type BadgeProps } from "./Badge";

afterEach(cleanup);

describe("Badge", () => {
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

  it("supports only the five semantic tones with zero purple or indigo classes", () => {
    const tones: NonNullable<BadgeProps["tone"]>[] = [
      "brand",
      "positive",
      "caution",
      "negative",
      "neutral",
    ];

    for (const tone of tones) {
      const classes = badgeVariants({ tone });
      expect(classes).not.toMatch(/purple|violet|indigo|fuchsia|pink/);
    }
  });
});
