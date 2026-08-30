// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./HoverCard";

afterEach(cleanup);

describe("HoverCard", () => {
  it("keeps its content out of the tree until it is open", () => {
    render(
      <HoverCard>
        <HoverCardTrigger>Sara Ahmed</HoverCardTrigger>
        <HoverCardContent>Account manager, Cairo branch</HoverCardContent>
      </HoverCard>,
    );
    expect(screen.queryByText("Account manager, Cairo branch")).toBeNull();
  });

  it("renders the content above other chrome on the dropdown layer, never a bare z-index", () => {
    const { baseElement } = render(
      <HoverCard open>
        <HoverCardTrigger>Sara Ahmed</HoverCardTrigger>
        <HoverCardContent>Account manager, Cairo branch</HoverCardContent>
      </HoverCard>,
    );
    const content = screen.getByText("Account manager, Cairo branch");
    expect(content.className).toContain("z-(--z-dropdown)");
    expect(content.className).not.toMatch(/(?:^|\s)z-\d+/);
    // Portalled, so a scrolling ancestor cannot clip it.
    expect(baseElement.contains(content)).toBe(true);
  });

  it("uses the raised surface treatment — border, popover ground and shadow-pop", () => {
    render(
      <HoverCard open>
        <HoverCardTrigger>Sara Ahmed</HoverCardTrigger>
        <HoverCardContent>Account manager, Cairo branch</HoverCardContent>
      </HoverCard>,
    );
    const className = screen.getByText("Account manager, Cairo branch").className;
    expect(className).toContain("border-border");
    expect(className).toContain("bg-popover");
    expect(className).toContain("shadow-pop");
  });
});
