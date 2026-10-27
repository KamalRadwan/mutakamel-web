// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../primitives/Tooltip";
import type { RecordWorkspaceView } from "./types";
import { ViewSwitcher, type ViewSwitcherProps } from "./ViewSwitcher";

afterEach(cleanup);

const labels = { board: "Board", card: "Card", table: "Table" };

function renderSwitcher(props: ViewSwitcherProps<RecordWorkspaceView>) {
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

  it("renders the toolbar segmented container and gradient active segment", () => {
    renderSwitcher({ value: "card", onChange: vi.fn(), available: ["board", "card", "table"], labels });

    expect(screen.getByRole("radiogroup")).toHaveClass(
      "h-(--size-toolbar-control)",
      "rounded-lg",
      "border",
      "border-line-control",
      "bg-surface-subtle",
      "p-0.5",
    );

    const active = screen.getByRole("radio", { name: "Card" });
    const inactive = screen.getByRole("radio", { name: "Board" });

    expect(active).toHaveClass("bg-gradient-primary", "text-white", "rounded-md", "shadow-sm");
    expect(inactive).toHaveClass("rounded-md", "text-muted-foreground");
    expect(inactive).not.toHaveClass("bg-gradient-primary");
  });

  it("supports non-record view sets such as calendar/board/table", () => {
    const onChange = vi.fn();
    render(
      <TooltipProvider>
        <ViewSwitcher
          value="calendar"
          onChange={onChange}
          available={["calendar", "board", "table"]}
          labels={{ calendar: "Calendar", board: "Board", table: "Table" }}
        />
      </TooltipProvider>,
    );

    const active = screen.getByRole("radio", { name: "Calendar" });
    expect(active).toHaveAttribute("aria-checked", "true");
    expect(active).toHaveClass("bg-gradient-primary", "text-white");

    fireEvent.click(screen.getByRole("radio", { name: "Board" }));
    expect(onChange).toHaveBeenCalledWith("board");
  });
});
