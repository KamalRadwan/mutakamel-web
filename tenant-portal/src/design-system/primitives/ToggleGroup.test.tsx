// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToggleGroup, ToggleGroupItem } from "./ToggleGroup";

afterEach(cleanup);

// The Radix root prop type is a discriminated union on `type`, so spreading a
// Partial<> of it collapses the discriminant. Only the props these tests vary
// are threaded through.
interface GroupOverrides {
  onValueChange?: (value: string) => void;
  size?: React.ComponentProps<typeof ToggleGroup>["size"];
}

function renderGroup({ onValueChange, size }: GroupOverrides = {}) {
  return render(
    <ToggleGroup
      type="single"
      defaultValue="table"
      aria-label="View"
      onValueChange={onValueChange}
      size={size}
    >
      <ToggleGroupItem value="table">Table</ToggleGroupItem>
      <ToggleGroupItem value="card">Cards</ToggleGroupItem>
      <ToggleGroupItem value="board">Board</ToggleGroupItem>
    </ToggleGroup>,
  );
}

describe("ToggleGroup", () => {
  it("exposes pressed state through aria-pressed on a single-select group", () => {
    renderGroup();
    expect(screen.getByRole("radio", { name: "Table" })).toBeChecked();
  });

  it("reports the new value on change", () => {
    const onValueChange = vi.fn();
    renderGroup({ onValueChange });
    fireEvent.click(screen.getByRole("radio", { name: "Board" }));
    expect(onValueChange).toHaveBeenCalledWith("board");
  });

  it("gives the active segment contrast, never a per-item hue", () => {
    const { container } = renderGroup();
    const markup = container.innerHTML;
    expect(markup).toContain("data-[state=on]:bg-card");
    for (const hue of ["bg-brand-", "bg-positive-", "bg-caution-", "bg-negative-"]) {
      expect(markup).not.toContain(hue);
    }
  });

  it("propagates the group size to every item through context", () => {
    renderGroup({ size: "sm" });
    for (const label of ["Table", "Cards", "Board"]) {
      expect(screen.getByRole("radio", { name: label }).className).toContain("--size-control-sm");
    }
  });

  it("marks every segment as a pointer target with a visible focus ring", () => {
    renderGroup();
    const className = screen.getByRole("radio", { name: "Cards" }).className;
    expect(className).toContain("cursor-pointer");
    expect(className).toContain("focus-visible:ring-2");
  });
});
