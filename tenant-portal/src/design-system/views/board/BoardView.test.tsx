// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "../../primitives/Button";
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

  // The footer exists so a card can carry a control on its own line. Inside
  // the activation surface that control would both open the record on click
  // and sit within @hello-pangea/dnd's drag handle — the pair of bugs the slot
  // was added to prevent.
  it("keeps the footer and the per-card classes off the activation surface", () => {
    renderBoard({
      renderFooter: (item) => <Button size="xs">Rate {item.name}</Button>,
      cardClassName: () => "border-swatch-teal",
    });

    const surface = screen.getByRole("button", { name: "Acme" });
    const footerControl = screen.getByRole("button", { name: "Rate Acme" });
    expect(surface).not.toContainElement(footerControl);
    expect(document.querySelector(".border-swatch-teal")).toContainElement(footerControl);
  });

  // Placement alone proved nothing: a control can sit outside the activation
  // surface and still have its click eaten by the drag layer above it, or
  // swallowed into opening the card. This presses it.
  it("lets a footer control run on click, without opening the card", () => {
    const onRate = vi.fn();
    const onActivate = vi.fn();
    renderBoard({
      onActivate,
      renderFooter: (item) => (
        <Button size="xs" onClick={() => onRate(item.id)}>
          Rate {item.name}
        </Button>
      ),
    });

    fireEvent.click(screen.getByRole("button", { name: "Rate Acme" }));

    expect(onRate).toHaveBeenCalledTimes(1);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("drops the 'Move to…' trigger when the screen supplies no label for it", () => {
    renderBoard({ labels: { ...labels, moveTo: undefined } });
    expect(screen.queryByRole("button", { name: "Move to" })).toBeNull();
  });

  // jsdom has no layout, so this is a CLASS contract and not a measurement —
  // a browser is what proves the pixels. What it pins is the half that
  // regresses silently: every column asking for the pane's full height itself,
  // and its body being the thing that scrolls. Left to the row's default
  // `align-items: stretch`, one `items-start` on that row would collapse every
  // column back onto its cards with nothing to catch it; and a body without
  // `min-h-0` grows past the column and hands the ROW a second scrollbar
  // instead of scrolling the cards.
  it("runs every column to the bottom of the pane and scrolls the cards inside it", () => {
    renderBoard();
    const body = document.querySelector('[data-rfd-droppable-id="new"]') as HTMLElement;
    const column = body.parentElement as HTMLElement;

    expect(column.className).toContain("h-full");
    expect(column.className).toContain("min-h-0");
    expect(body.className).toContain("min-h-0");
    expect(body.className).toContain("flex-1");
    expect(body.className).toContain("overflow-y-auto");

    // The empty column's dashed zone is `flex-1`, so with the column now full
    // height the drop target is the whole column rather than the inch its
    // heading occupies.
    const empty = document.querySelector('[data-rfd-droppable-id="qualified"]') as HTMLElement;
    expect(within(empty).getByText("Drop here").className).toContain("flex-1");
  });

  it("summarises a column with a bar whose counts are also readable as text", () => {
    renderBoard({
      columns: [
        {
          ...columns[0],
          segments: [{ id: "OVERDUE", label: "Overdue", value: 1, tone: "negative" }],
          segmentsLabel: "Activity",
        },
        ...columns.slice(1),
      ],
    });
    expect(screen.getByRole("img", { name: "Activity — Overdue: 1" })).toBeInTheDocument();
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
