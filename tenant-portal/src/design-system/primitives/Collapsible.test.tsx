// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./Collapsible";

afterEach(cleanup);

function renderCollapsible() {
  return render(
    <Collapsible>
      <CollapsibleTrigger>Advanced filters</CollapsibleTrigger>
      <CollapsibleContent>Owner, source, created between</CollapsibleContent>
    </Collapsible>,
  );
}

describe("Collapsible", () => {
  it("toggles the panel and keeps aria-expanded truthful", () => {
    renderCollapsible();
    const trigger = screen.getByRole("button", { name: "Advanced filters" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Owner, source, created between")).toBeNull();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Owner, source, created between")).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("carries a visible focus ring and a pointer cursor", () => {
    renderCollapsible();
    const className = screen.getByRole("button", { name: "Advanced filters" }).className;
    expect(className).toContain("focus-visible:ring-2");
    expect(className).toContain("cursor-pointer");
  });

  it("takes the same single height keyframe Accordion does, on the same terms", () => {
    const { container } = renderCollapsible();
    fireEvent.click(screen.getByRole("button", { name: "Advanced filters" }));
    const markup = container.innerHTML;

    // docs/design/motion.md#the-one-height-exception — a keyframe over a height
    // Radix has already measured, on a disclosure panel.
    expect(markup).toContain("data-[state=open]:animate-collapsible-down");
    expect(markup).toContain("data-[state=closed]:animate-collapsible-up");
    expect(markup).toContain("data-[state=open]:duration-150");
    expect(markup).toContain("data-[state=closed]:duration-100");

    // Transitioning height, and the grid-template-rows trick, both stay banned.
    expect(markup).not.toContain("transition-[height]");
    expect(markup).not.toContain("grid-rows-");
  });
});
