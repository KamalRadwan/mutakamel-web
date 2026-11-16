"use client";
import { useState } from "react";
import type { InspectorForm } from "./useInspectorForm";

export function useInspectorMerge(form: InspectorForm, row: number, column: number, rowCount: number, columnCount: number) {
  const [lastRow, setLastRow] = useState(row), [lastColumn, setLastColumn] = useState(column);
  const endRow = Math.max(row, Math.min(rowCount - 1, lastRow)), endColumn = Math.max(column, Math.min(columnCount - 1, lastColumn));
  return { endRow, endColumn, row: (value: string) => setLastRow(Number(value)), column: (value: string) => setLastColumn(Number(value)),
    merge: () => form.merge(row, endRow, column, endColumn), unmerge: () => form.merge(row, row, column, column, true) };
}
