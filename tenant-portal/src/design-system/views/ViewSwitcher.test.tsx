// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../primitives/Tooltip";
import { ViewSwitcher } from "./ViewSwitcher";

afterEach(cleanup);

const labels = { board: "Board", card: "Card", table: "Table" };

function renderSwitcher(props: React.ComponentProps<typeof ViewSwitcher>) {
  return render(
    <TooltipProvider>
      <ViewSwitcher {...props} />
    </TooltipProvider>,
  );
}

describe("ViewSwitcher", () => {
  it("marks the active view aria-checked and the others not", () => {
    renderSwitcher({ value: "board", onChange: vi.fn(), available: ["board", "card", "table"], labels });

    expect(screen.getByRole("radio", { name: "Board" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Card" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "Table" })).toHaveAttribute("aria-checked", "false");
  });

  it("is a single radiogroup — Radix's own roving tabindex then makes it one tab stop", () => {
    renderSwitcher({ value: "board", onChange: vi.fn(), available: ["board", "card", "table"], labels });

    expect(screen.getAllByRole("radiogroup")).toHaveLength(1);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("calls onChange with the clicked view", () => {
    const onChange = vi.fn();
    renderSwitcher({ value: "board", onChange, available: ["board", "card", "table"], labels });

    fireEvent.click(screen.getByRole("radio", { name: "Table" }));
    expect(onChange).toHaveBeenCalledWith("table");
  });
});
