// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "./DataTable";
import type { ColumnDef, DataTableLabels } from "./types";

afterEach(cleanup);

interface Row {
  id: string;
  name: string;
}

const columns: ColumnDef<Row>[] = [
  { id: "name", header: "Name", cell: (row) => row.name, sortable: true },
];

const labels: DataTableLabels = {
  retry: "Retry",
  errorTitle: "Could not load",
  emptyTitle: "No results",
  selectAll: "Select all",
  selectRow: "Select row",
  sortAscending: "Sort ascending",
  sortDescending: "Sort descending",
  notSorted: "Not sorted",
  pagination: {
    previous: "Previous",
    next: "Next",
    summary: (from, to, total) => `${from}-${to} of ${total}`,
  },
};

const basePage = { page: 1, limit: 10, total: 25 };

describe("DataTable", () => {
  it("renders the empty state and no table when rows is empty", () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        isLoading={false}
        page={basePage}
        onPageChange={vi.fn()}
        rowKey={(row) => row.id}
        labels={labels}
      />,
    );
    expect(screen.getByText("No results")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("renders ErrorState with a working retry callback instead of the table", () => {
    const onRetry = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={[]}
        isLoading={false}
        error={{ status: 500 }}
        onRetry={onRetry}
        page={basePage}
        onPageChange={vi.fn()}
        rowKey={(row) => row.id}
        labels={labels}
      />,
    );
    expect(screen.getByText("Could not load")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("calls onSortChange with the toggled direction when a sortable header is clicked", () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={[{ id: "1", name: "Alice" }]}
        isLoading={false}
        page={basePage}
        onPageChange={vi.fn()}
        sort={{ id: "name", direction: "asc" }}
        onSortChange={onSortChange}
        rowKey={(row) => row.id}
        labels={labels}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Name/ }));
    expect(onSortChange).toHaveBeenCalledWith({ id: "name", direction: "desc" });
  });

  it("calls onPageChange with the next page number from Pagination", () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={[{ id: "1", name: "Alice" }]}
        isLoading={false}
        page={basePage}
        onPageChange={onPageChange}
        rowKey={(row) => row.id}
        labels={labels}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("announces which column is sorted, and which way, through aria-sort", () => {
    const { rerender } = render(
      <DataTable
        columns={[...columns, { id: "created", header: "Created", cell: () => "—" }]}
        rows={[{ id: "1", name: "Alice" }]}
        isLoading={false}
        page={basePage}
        onPageChange={vi.fn()}
        sort={{ id: "name", direction: "asc" }}
        onSortChange={vi.fn()}
        rowKey={(row) => row.id}
        labels={labels}
      />,
    );
    expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute("aria-sort", "ascending");
    // A column that cannot sort carries no aria-sort at all — "none" would
    // claim it is sortable and merely unsorted.
    expect(screen.getByRole("columnheader", { name: "Created" })).not.toHaveAttribute("aria-sort");

    rerender(
      <DataTable
        columns={columns}
        rows={[{ id: "1", name: "Alice" }]}
        isLoading={false}
        page={basePage}
        onPageChange={vi.fn()}
        sort={{ id: "created", direction: "desc" }}
        onSortChange={vi.fn()}
        rowKey={(row) => row.id}
        labels={labels}
      />,
    );
    expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute("aria-sort", "none");
  });

  it("reserves scroll margin for the sticky chrome, so a focused row is never obscured", () => {
    render(
      <DataTable
        columns={[...columns, { id: "actions", header: "Actions", sticky: "end", cell: () => "—" }]}
        rows={[{ id: "1", name: "Alice" }]}
        isLoading={false}
        page={basePage}
        onPageChange={vi.fn()}
        rowKey={(row) => row.id}
        onRowClick={vi.fn()}
        labels={labels}
      />,
    );
    const row = screen.getByRole("row", { name: /Alice/ });
    expect(row.className).toContain("scroll-mt-(--size-row)");
    expect(row.className).toContain("scroll-me-16");
  });
});

/**
 * What these can and cannot prove.
 *
 * A drag cannot be driven here at all: jsdom has no layout, so every box
 * `@hello-pangea/dnd` measures is 0×0 and no sensor produces a meaningful drag
 * — the same limit `views/board/virtual-dnd.probe.test.tsx` records. What is
 * left is the structural half, and it is the half that regresses silently: a
 * row that should not be draggable losing its guard is invisible until an order
 * the server refuses reaches it. The order math itself is covered without a DOM
 * in `row-reorder.test.ts`.
 */
describe("DataTable row reordering", () => {
  const rows: Row[] = [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
    { id: "3", name: "Carol" },
  ];

  const reorder = (isPinned?: (id: string) => boolean) => ({
    onReorder: vi.fn(),
    isPinned,
    rowLabel: (row: Row) => row.name,
    dragHandleLabel: "Drag to reorder",
  });

  it("adds no handle column at all unless a caller asks for one", () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        isLoading={false}
        rowKey={(row) => row.id}
        labels={labels}
      />,
    );
    expect(screen.queryByLabelText(/Drag to reorder/u)).toBeNull();
    expect(screen.getAllByRole("row")[0]?.querySelectorAll("th")).toHaveLength(columns.length + 1);
  });

  it("names every grip by its own row, so a screen reader knows which one it holds", () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        isLoading={false}
        rowKey={(row) => row.id}
        labels={labels}
        rowReorder={reorder()}
      />,
    );
    expect(screen.getByLabelText("Drag to reorder: Alice")).toBeInTheDocument();
    expect(screen.getByLabelText("Drag to reorder: Carol")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: "Drag to reorder" })).toHaveLength(1);
  });

  // A pinned row keeps a dimmed grip rather than an empty cell, so the column
  // does not change width row to row — but it carries no handle at all.
  it("gives a pinned row no drag handle", () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        isLoading={false}
        rowKey={(row) => row.id}
        labels={labels}
        rowReorder={reorder((id) => id === "1")}
      />,
    );
    expect(screen.queryByLabelText("Drag to reorder: Alice")).toBeNull();
    expect(screen.getByLabelText("Drag to reorder: Bob")).toBeInTheDocument();
  });

  it("freezes every row while a reorder write is in flight", () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        isLoading={false}
        rowKey={(row) => row.id}
        labels={labels}
        rowReorder={{ ...reorder(), isPending: true }}
      />,
    );
    expect(screen.queryByLabelText(/Drag to reorder: /u)).toBeNull();
  });
});
