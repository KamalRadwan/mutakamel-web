// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CardView, type CardViewLabels } from "./CardView";

afterEach(cleanup);

interface Lead {
  id: string;
  name: string;
}

const items: Lead[] = [
  { id: "lead-1", name: "Acme" },
  { id: "lead-2", name: "Globex" },
];

const labels: CardViewLabels = {
  retry: "Retry",
  errorTitle: "Could not load",
  emptyTitle: "No results",
  selectAll: "Select all",
  selectRow: "Select this item",
  sortAscending: "Sort ascending",
  sortDescending: "Sort descending",
  notSorted: "Not sorted",
  sortBy: "Sort by",
  pagination: {
    previous: "Previous",
    next: "Next",
    summary: (from, to, total) => `${from}-${to} of ${total}`,
  },
};

function renderCards(overrides: Partial<Parameters<typeof CardView<Lead>>[0]> = {}) {
  render(
    <CardView<Lead>
      items={items}
      itemKey={(item) => item.id}
      renderCard={(item) => <span>{item.name}</span>}
      isLoading={false}
      page={{ page: 1, limit: 25, total: 60 }}
      onPageChange={vi.fn()}
      labels={labels}
      {...overrides}
    />,
  );
}

describe("CardView", () => {
  it("paginates, which switching away from the table no longer drops (V2)", () => {
    const onPageChange = vi.fn();
    renderCards({ onPageChange });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("offers a toolbar sort control, since there are no column headers to click", () => {
    const onSortChange = vi.fn();
    renderCards({
      sortOptions: [
        { id: "createdAt", label: "Created" },
        { id: "name", label: "Name" },
      ],
      sort: { id: "createdAt", direction: "asc" },
      onSortChange,
    });

    fireEvent.click(screen.getByRole("button", { name: "Sort descending" }));
    expect(onSortChange).toHaveBeenCalledWith({ id: "createdAt", direction: "desc" });
  });

  it("renders no sort control for a list the server will not sort", () => {
    renderCards({ onSortChange: vi.fn() });
    expect(screen.queryByRole("button", { name: "Sort ascending" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sort descending" })).toBeNull();
  });

  it("selects one card and every card on the page, through the shared SelectionState", () => {
    const onSelectionChange = vi.fn();
    renderCards({ selection: { selectedIds: new Set<string>(), onSelectionChange } });

    fireEvent.click(screen.getAllByRole("checkbox", { name: "Select this item" })[0]);
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(["lead-1"]));

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(["lead-1", "lead-2"]));
  });

  it("renders the empty state from a required label, never a blank heading (2.11)", () => {
    renderCards({ items: [] });
    expect(screen.getByText("No results")).toBeInTheDocument();
  });
});
