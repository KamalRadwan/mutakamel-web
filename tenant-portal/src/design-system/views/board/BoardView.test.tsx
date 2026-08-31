// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardView, type BoardViewLabels } from "./BoardView";
import type { BoardColumnDef } from "./types";

afterEach(cleanup);

interface Lead {
  id: string;
  name: string;
  stageId: string;
}

const columns: BoardColumnDef[] = [
  { id: "new", label: "New", count: 1 },
  { id: "qualified", label: "Qualified", count: 0 },
  { id: "converted", label: "Converted", count: 0, outcomeRole: "positive" },
];

const items: Lead[] = [{ id: "lead-1", name: "Acme", stageId: "new" }];

const labels: BoardViewLabels = {
  retry: "Retry",
  errorTitle: "Could not load",
  emptyTitle: "No results",
  selectAll: "Select all",
  selectRow: "Select this item",
  sortAscending: "Sort ascending",
  sortDescending: "Sort descending",
  notSorted: "Not sorted",
  emptyColumn: "Drop here",
  moveTo: "Move to",
  pagination: {
    previous: "Previous",
    next: "Next",
    summary: (from, to, total) => `${from}-${to} of ${total}`,
  },
};

// Radix opens a dropdown on pointerdown or on a key, not on a synthetic
// click. Enter is also the path a keyboard user takes, which is the point.
function openMoveMenu() {
  fireEvent.keyDown(screen.getByRole("button", { name: "Move to" }), { key: "Enter" });
}

function renderBoard(overrides: Partial<Parameters<typeof BoardView<Lead>>[0]> = {}) {
  const onCardMove = vi.fn();
  render(
    <BoardView<Lead>
      columns={columns}
      columnOf={(item) => item.stageId}
      items={items}
      itemKey={(item) => item.id}
      renderCard={(item) => <span>{item.name}</span>}
      onCardMove={onCardMove}
      isLoading={false}
      page={{ page: 1, limit: 25, total: 1 }}
      onPageChange={vi.fn()}
      labels={labels}
      {...overrides}
    />,
  );
  return { onCardMove };
}

describe("BoardView", () => {
  // WCAG 2.2 AA dragging-alternative. This is the single highest-severity
  // item in docs/build/MASTER-PLAN.md — without it the board is unusable to
  // anyone who cannot complete a press-move-release.
  it("offers every permitted destination through a single-pointer menu", () => {
    const { onCardMove } = renderBoard();

    openMoveMenu();
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Qualified" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Converted" })).toBeInTheDocument();
    // Never the column the card is already in.
    expect(within(menu).queryByRole("menuitem", { name: "New" })).toBeNull();

    fireEvent.click(within(menu).getByRole("menuitem", { name: "Qualified" }));
    expect(onCardMove).toHaveBeenCalledWith({
      itemId: "lead-1",
      fromColumnId: "new",
      toColumnId: "qualified",
      toIndex: 0,
    });
  });

  it("gates the menu with the same rule that gates dragging", () => {
    renderBoard({ canDrag: () => false });
    expect(screen.queryByRole("button", { name: "Move to" })).toBeNull();
  });

  it("filters destinations through canMoveTo, so a terminal column is never offered", () => {
    renderBoard({ canMoveTo: (_item, columnId) => columnId !== "converted" });

    openMoveMenu();
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Qualified" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Converted" })).toBeNull();
  });

  it("routes a menu move through confirmMove exactly as a drag would", async () => {
    const confirmMove = vi.fn().mockResolvedValue(false);
    const { onCardMove } = renderBoard({ confirmMove });

    openMoveMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Qualified" }));

    await vi.waitFor(() => expect(confirmMove).toHaveBeenCalledOnce());
    expect(onCardMove).not.toHaveBeenCalled();
  });

  it("groups items into columns itself and shows a drop zone in the empty ones", () => {
    renderBoard();
    expect(screen.getAllByText("Drop here")).toHaveLength(2);
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("carries pagination and selection, which switching away from the table no longer drops (V2)", () => {
    const onSelectionChange = vi.fn();
    const onPageChange = vi.fn();
    renderBoard({
      selection: { selectedIds: new Set<string>(), onSelectionChange },
      page: { page: 1, limit: 25, total: 60 },
      onPageChange,
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "Select this item" }));
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(["lead-1"]));

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
