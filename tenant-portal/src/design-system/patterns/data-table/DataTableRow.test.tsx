// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "../../primitives/Button";
import { Table, TableBody } from "../../primitives/Table";
import { DataTable } from "./DataTable";
import { DataTableRow, type DataTableRowProps } from "./DataTableRow";
import type { ColumnDef, DataTableLabels } from "./types";

afterEach(cleanup);

const row = { id: "1", name: "Alice" };
const columns: ColumnDef<typeof row>[] = [
  { id: "name", header: "Name", cell: (item) => item.name },
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

function renderRow(overrides: Partial<DataTableRowProps<typeof row>> = {}) {
  const props: DataTableRowProps<typeof row> = {
    row,
    id: row.id,
    columns,
    labels,
    hasSelection: true,
    isSelected: false,
    onToggleRow: vi.fn(),
    onRowClick: vi.fn(),
    hasStickyStart: false,
    hasStickyEnd: false,
    ...overrides,
  };
  render(<Table><TableBody><DataTableRow {...props} /></TableBody></Table>);
  return props;
}

describe("DataTableRow keyboard activation", () => {
  it("leaves Space on the selection checkbox available for its native toggle", () => {
    const { onRowClick, onToggleRow } = renderRow();
    const checkbox = screen.getByRole("checkbox", { name: "Select row" });
    checkbox.focus();

    expect(checkbox).toHaveFocus();
    expect(fireEvent.keyDown(checkbox, { key: " " })).toBe(true);
    expect(fireEvent.keyUp(checkbox, { key: " " })).toBe(true);
    expect(onRowClick).not.toHaveBeenCalled();

    // jsdom does not synthesize the browser's click after an uncancelled Space.
    fireEvent.click(checkbox);
    expect(onToggleRow).toHaveBeenCalledExactlyOnceWith(row.id);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("keeps Enter on a child action button from also opening the record", () => {
    const onAction = vi.fn();
    const { onRowClick } = renderRow({
      columns: [
        ...columns,
        {
          id: "actions",
          header: "Actions",
          cell: () => (
            <Button
              onClick={(event) => {
                event.stopPropagation();
                onAction();
              }}
            >
              Edit
            </Button>
          ),
        },
      ],
    });
    const button = screen.getByRole("button", { name: "Edit" });
    button.focus();

    expect(button).toHaveFocus();
    expect(fireEvent.keyDown(button, { key: "Enter" })).toBe(true);
    expect(onRowClick).not.toHaveBeenCalled();
    // As with Space, jsdom needs the native button click dispatched explicitly.
    fireEvent.click(button);
    fireEvent.keyUp(button, { key: "Enter" });
    expect(onAction).toHaveBeenCalledOnce();
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it.each(["Enter", " "])("activates the focused row with %j", (key) => {
    const { onRowClick, onToggleRow } = renderRow();
    const element = screen.getByRole("row");
    element.focus();

    expect(element).toHaveFocus();
    expect(fireEvent.keyDown(element, { key })).toBe(false);
    expect(onRowClick).toHaveBeenCalledExactlyOnceWith(row);
    expect(onToggleRow).not.toHaveBeenCalled();
  });

  it.each(["Enter", " "])("respects an already prevented %j on the row", (key) => {
    const { onRowClick } = renderRow();
    const element = screen.getByRole("row");
    element.addEventListener("keydown", (event) => event.preventDefault(), { capture: true });

    fireEvent.keyDown(element, { key });

    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("leaves unrelated keys and rows without activation callbacks alone", () => {
    const { onRowClick } = renderRow();
    expect(fireEvent.keyDown(screen.getByRole("row"), { key: "ArrowDown" })).toBe(true);
    expect(onRowClick).not.toHaveBeenCalled();
    cleanup();

    renderRow({ onRowClick: undefined });
    expect(screen.getByRole("row")).not.toHaveAttribute("tabindex");
    expect(fireEvent.keyDown(screen.getByRole("row"), { key: "Enter" })).toBe(true);
    expect(fireEvent.keyDown(screen.getByRole("row"), { key: " " })).toBe(true);
  });

  it.each(["Enter", " "])("does not open a record for %j on its drag handle", (key) => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={[row]}
        rowKey={(item) => item.id}
        labels={labels}
        isLoading={false}
        onRowClick={onRowClick}
        rowReorder={{
          onReorder: vi.fn(),
          rowLabel: (item) => item.name,
          dragHandleLabel: "Drag to reorder",
        }}
      />,
    );
    const handle = screen.getByRole("button", { name: "Drag to reorder: Alice" });
    handle.focus();

    expect(handle).toHaveFocus();
    fireEvent.keyDown(handle, { key });

    // Layout-dependent dragging is outside jsdom; this checks activation isolation.
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
