// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "../patterns/data-table/DataTable";
import { SettingsPresentationContext } from "../shell/settings-presentation";
import { Table, TableBody, TableCell, TableRow } from "./Table";

afterEach(cleanup);

describe("table spacing in Settings", () => {
  it("keeps the reorder placeholder empty while preserving compact records and drag handles", () => {
    const { container } = render(<SettingsPresentationContext.Provider value>
      <DataTable rows={[{ id: "1", name: "Qualified" }]} rowKey={(row) => row.id}
        columns={[{ id: "name", header: "Name", cell: (row) => row.name }]} isLoading={false}
        labels={{ retry: "Retry", errorTitle: "Could not load", emptyTitle: "No records", selectAll: "Select all",
          selectRow: "Select row", sortAscending: "Ascending", sortDescending: "Descending", notSorted: "Unsorted",
          pagination: { previous: "Previous", next: "Next", summary: (from, to, total) => `${from}-${to} of ${total}` } }}
        rowReorder={{ onReorder: vi.fn(), rowLabel: (row) => row.name, dragHandleLabel: "Reorder" }} />
    </SettingsPresentationContext.Provider>);

    const placeholder = container.querySelector('tbody > tr[aria-hidden="true"]');
    expect(placeholder).toHaveClass("h-0");
    expect(placeholder).not.toHaveClass("h-9", "h-(--size-row)");
    expect(placeholder?.querySelector("td")).toHaveClass("p-0");
    expect(placeholder?.querySelector("td")).not.toHaveClass("px-2.5", "py-1");
    const record = screen.getByText("Qualified").closest("tr");
    expect(record).toHaveClass("h-9");
    expect(screen.getByText("Qualified").closest("td")).toHaveClass("px-2.5", "py-1");
    expect(screen.getByLabelText("Reorder: Qualified")).toHaveAttribute("data-rfd-drag-handle-draggable-id", "1");
  });

  it.each([false, true])("preserves virtual spacer height and zero cell padding (Settings: %s)", (settings) => {
    const { container } = render(<SettingsPresentationContext.Provider value={settings}>
      <Table><TableBody><TableRow aria-hidden="true" style={{ height: 160 }}>
        <TableCell colSpan={2} className="p-0" />
      </TableRow></TableBody></Table>
    </SettingsPresentationContext.Provider>);

    expect(container.querySelector("tbody > tr")).toHaveStyle({ height: "160px" });
    expect(container.querySelector("td")).toHaveClass("p-0");
    expect(container.querySelector("td")).not.toHaveClass("px-2.5", "py-1", "px-4", "py-3");
  });
});
