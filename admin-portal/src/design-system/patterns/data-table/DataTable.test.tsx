// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr" }),
}));

import { DataTable } from "./DataTable";
import type { ColumnDef } from "./types";

interface Row {
  id: string;
  name: string;
  detail: string;
}

const columns: ColumnDef<Row>[] = [
  {
    key: "name",
    headerEn: "Name",
    headerAr: "الاسم",
    sortable: true,
    priority: "essential",
    cell: (row) => row.name,
  },
  {
    key: "detail",
    headerEn: "Detail",
    headerAr: "التفاصيل",
    priority: "detail",
    cell: (row) => row.detail,
  },
];

const rows: Row[] = [
  { id: "a", name: "Alpha", detail: "First" },
  { id: "b", name: "Beta", detail: "Second" },
];

const pagination = {
  page: 1,
  limit: 10,
  totalItems: 2,
  totalPages: 2,
  onPageChange: vi.fn(),
};

describe("DataTable", () => {
  it("uses a native sort button and exposes aria-sort on its header", () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        labelEn="Tenant records"
        labelAr="سجلات المستأجرين"
        columns={columns}
        data={rows}
        pagination={pagination}
        sort={{ sortBy: "detail", sortDir: "DESC", onSortChange }}
        getRowId={(row) => row.id}
      />,
    );

    const sortButton = screen.getByRole("button", { name: "Name" });
    expect(sortButton.closest("th")).toHaveAttribute("aria-sort", "none");
    fireEvent.click(sortButton);
    expect(onSortChange).toHaveBeenCalledWith("name", "ASC");
    expect(screen.getByRole("status")).toHaveTextContent("Name sorted ascending");
  });

  it("keeps rows, pagination, and focus mounted during background refresh", () => {
    const view = render(
      <DataTable
        labelEn="Tenant records"
        labelAr="سجلات المستأجرين"
        columns={columns}
        data={rows}
        pagination={pagination}
        sort={{ sortBy: "name", sortDir: "ASC", onSortChange: vi.fn() }}
        getRowId={(row) => row.id}
      />,
    );
    const sortButton = screen.getByRole("button", { name: "Name" });
    sortButton.focus();

    view.rerender(
      <DataTable
        labelEn="Tenant records"
        labelAr="سجلات المستأجرين"
        columns={columns}
        data={[]}
        isRefreshing
        pagination={{ ...pagination, totalItems: 0, totalPages: 0 }}
        sort={{ sortBy: "name", sortDir: "ASC", onSortChange: vi.fn() }}
        getRowId={(row) => row.id}
      />,
    );

    expect(screen.getByRole("region", { name: "Tenant records" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Name" }));
  });

  it("reconciles stable explicit IDs and announces selections dropped after refresh", async () => {
    const onSelectionChange = vi.fn();
    const view = render(
      <DataTable
        columns={columns}
        data={rows}
        pagination={pagination}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        selection={{ kind: "EXPLICIT_IDS", selectedIds: ["a", "b"], onSelectionChange }}
      />,
    );

    const alphaCheckbox = screen.getByRole("checkbox", { name: "Select Alpha" });
    expect(alphaCheckbox).toBeChecked();
    expect(alphaCheckbox.closest("tr")).toHaveClass("data-[state=selected]:border-s-primary");

    view.rerender(
      <DataTable
        columns={columns}
        data={[rows[0]]}
        pagination={{ ...pagination, totalItems: 1, totalPages: 1 }}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        selection={{ kind: "EXPLICIT_IDS", selectedIds: ["a", "b"], onSelectionChange }}
      />,
    );

    await waitFor(() => expect(onSelectionChange).toHaveBeenCalledWith(["a"]));
    expect(screen.getByRole("status")).toHaveTextContent("1 selected item was removed");
  });

  it("keeps authoritative all-matching scope separate from explicit IDs", () => {
    const onExcludedIdsChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={rows}
        pagination={{ ...pagination, totalItems: 100, totalPages: 10 }}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.name}
        selection={{
          kind: "ALL_MATCHING",
          queryFingerprint: "query-v1",
          totalMatching: 100,
          excludedIds: ["b", "outside-page"],
          onExcludedIdsChange,
          onClearSelection: vi.fn(),
        }}
      />,
    );

    expect(screen.getByText("98 selected")).toBeInTheDocument();
    expect(screen.getByText("All matching results except exclusions")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all visible rows" }));
    expect(onExcludedIdsChange).toHaveBeenCalledWith(["outside-page"]);
  });
});
