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
