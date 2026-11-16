"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export function useInspectorTableSelection(columns: Record<string, unknown>[], rows: Record<string, unknown>[]) {
  const [columnId, selectColumn] = useState(""), [rowId, selectRow] = useState("");
  const { lang } = useI18n();
  return { columnIndex: Math.max(0, columns.findIndex(column => column.id === columnId)), rowIndex: Math.max(0, rows.findIndex(row => row.id === rowId)), selectColumn, selectRow,
    number: new Intl.NumberFormat({ ar: "ar-EG-u-nu-latn", en: "en-US" }[lang]) };
}
