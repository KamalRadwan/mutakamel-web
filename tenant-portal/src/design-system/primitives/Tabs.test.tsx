// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";

function Fixture() {
  return (
    <Tabs defaultValue="one">
      <TabsList>
        <TabsTrigger value="one">First</TabsTrigger>
        <TabsTrigger value="two">Second</TabsTrigger>
        <TabsTrigger value="three" disabled>
          Third
        </TabsTrigger>
      </TabsList>
      <TabsContent value="one">First panel</TabsContent>
      <TabsContent value="two">Second panel</TabsContent>
    </Tabs>
  );
}

// Tabs had no test when it was restyled from a segmented control to admin's
// underline. These pin the shape, not just the colour, so the pill cannot
// quietly come back.

describe("Tabs", () => {
  it("draws an underline rule rather than a filled segmented track", () => {
    render(<Fixture />);
    const list = screen.getByRole("tablist");

    expect(list).toHaveClass("border-b", "border-border");
    // The two things that made it a pill. `shadow-pop` matters most: elevation
    // is reserved for surfaces genuinely floating above the document
    // (docs/design/geometry.md#elevation), and a selected tab is not one.
    expect(list).not.toHaveClass("bg-muted");
    expect(screen.getByRole("tab", { name: "First" })).not.toHaveClass("shadow-pop");
  });

  it("marks the active tab with the primary underline and leaves the rest transparent", () => {
    render(<Fixture />);
    const active = screen.getByRole("tab", { name: "First" });
    const inactive = screen.getByRole("tab", { name: "Second" });

    expect(active).toHaveAttribute("data-state", "active");
    expect(inactive).toHaveAttribute("data-state", "inactive");
    // Both carry the same rule element; only its colour is state-dependent, so
    // selecting a tab never changes the box and nothing below it shifts.
    for (const tab of [active, inactive]) {
      expect(tab).toHaveClass("after:absolute", "after:h-0.5", "after:bg-transparent");
      expect(tab).toHaveClass("data-[state=active]:after:bg-primary");
    }
  });

  it("uses min-h so a wrapped label grows the list instead of being clipped", () => {
    render(<Fixture />);
    expect(screen.getByRole("tablist")).toHaveClass("min-h-(--size-control-md)");
    expect(screen.getByRole("tablist")).not.toHaveClass("h-(--size-control-md)");
  });

  it("still switches panels, and keeps a disabled tab unselectable", () => {
    render(<Fixture />);

    expect(screen.getByText("First panel")).toBeInTheDocument();
    expect(screen.queryByText("Second panel")).not.toBeInTheDocument();

    // mouseDown, not click: Radix activates a tab on pointer-down, so a
    // synthetic click alone leaves the selection where it was.
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Second" }));
    expect(screen.getByText("Second panel")).toBeInTheDocument();

    // The disabled state is this portal's own addition — admin's Tabs has none,
    // so adopting admin's styling must not have dropped it.
    const disabled = screen.getByRole("tab", { name: "Third" });
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveClass("disabled:pointer-events-none", "disabled:opacity-50");
    fireEvent.mouseDown(disabled);
    expect(screen.getByText("Second panel")).toBeInTheDocument();
  });
});
