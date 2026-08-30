"use client";

import { DataTable, type DataTableProps } from "../../patterns/data-table/DataTable";

// Configures DataTable — see docs/design/patterns.md#datatable, which
// already owns sticky headers, column sizing, row selection, sorting,
// pagination, keyboard navigation, the 36px row height and the zebra row
// token. Not a hand-rolled <table>.
export function TableView<T>(props: DataTableProps<T>) {
  return <DataTable {...props} />;
}
