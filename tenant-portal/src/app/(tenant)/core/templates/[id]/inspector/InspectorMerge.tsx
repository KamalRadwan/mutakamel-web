"use client";
import { Button } from "@/design-system";
import type { InspectorCopy } from "@/i18n/dictionaries/template-inspector";
import type { InspectorForm } from "./useInspectorForm";
import { InspectorSelect } from "./InspectorFields";
import { useInspectorMerge } from "./useInspectorMerge";

export function InspectorMerge({ form, row, column, rowCount, columnCount, number, copy: c }: { form: InspectorForm; row: number; column: number; rowCount: number; columnCount: number; number: Intl.NumberFormat; copy: InspectorCopy }) {
  const selection = useInspectorMerge(form, row, column, rowCount, columnCount);
  return <fieldset className="space-y-3 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-medium">{c.merge}</legend>
    <InspectorSelect label={c.endRow} value={selection.endRow} options={Array.from({ length: rowCount - row }, (_, index) => ({ value: String(index + row), label: number.format(index + row + 1) }))} onValue={selection.row} />
    <InspectorSelect label={c.endColumn} value={selection.endColumn} options={Array.from({ length: columnCount - column }, (_, index) => ({ value: String(index + column), label: number.format(index + column + 1) }))} onValue={selection.column} />
    <p className="text-xs text-muted-foreground">{c.mergeHelp}</p>
    <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={selection.merge}>{c.merge}</Button><Button type="button" size="sm" variant="outline" onClick={selection.unmerge}>{c.unmerge}</Button></div>
  </fieldset>;
}
