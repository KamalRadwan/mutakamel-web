"use client";
import { Button } from "@/design-system";
import type { InspectorCopy } from "@/i18n/dictionaries/template-inspector";
import type { TemplateDataSchema } from "../../template-design-api";
import { InspectorCellValue } from "./InspectorCellValue";
import { InspectorCellStyle } from "./InspectorCellStyle";
import { InspectorMerge } from "./InspectorMerge";
import { InspectorCheck, InspectorNumber, InspectorSelect, InspectorText } from "./InspectorFields";
import { inspectorRecord, inspectorRecords } from "./inspector-contract";
import { useInspectorTableSelection } from "./useInspectorTableSelection";
import type { InspectorForm } from "./useInspectorForm";

export function InspectorTable({ form, fields, copy: c }: { form: InspectorForm; fields: TemplateDataSchema["fields"]; copy: InspectorCopy }) {
  const node = form.draft!.node, props = node.props, columns = inspectorRecords(props.columns), rows = inspectorRecords(props.rows);
  const selection = useInspectorTableSelection(columns, rows);
  const column = columns[selection.columnIndex], row = rows[selection.rowIndex];
  const updateColumn = form.collection("columns", selection.columnIndex), dynamic = node.type === "dynamicTable";
  const rowFields = fields.filter(field => field.path.startsWith(`${String(props.sourcePath)}[].`)).map(field => ({ ...field, path: field.path.slice(String(props.sourcePath).length + 3) }));
  return <fieldset className="space-y-3"><legend className="text-sm font-medium">{c.table}</legend>
    <InspectorSelect label={c.repeatHeader} value={props.repeatHeader} options={(["EVERY_PAGE", "FIRST_PAGE_ONLY"] as const).map(value => ({ value, label: c[value] }))} onValue={form.prop("repeatHeader")} />
    <InspectorSelect label={c.rowSplit} value={props.rowSplit} options={(["ALLOW", "AVOID"] as const).map(value => ({ value, label: c[value] }))} onValue={form.prop("rowSplit")} />
    <InspectorCheck label={c.keepRowsTogether} value={props.keepRowsTogether} onValue={form.prop("keepRowsTogether")} />
    <InspectorCheck label={c.stripedRows} value={props.stripedRows} onValue={form.prop("stripedRows")} />
    {dynamic && <>
      <InspectorNumber label={c.minimumEmptyRows} value={props.minimumEmptyRows} min={0} max={100} step={1} onValue={form.prop("minimumEmptyRows")} />
      <InspectorSelect label={c.emptyBehavior} value={props.emptyBehavior} options={(["HEADER_ONLY", "MESSAGE", "MIN_ROWS"] as const).map(value => ({ value, label: c[value] }))} onValue={form.prop("emptyBehavior")} />
      {props.emptyBehavior === "MESSAGE" && <InspectorText label={c.emptyMessage} value={props.emptyMessage} onValue={form.prop("emptyMessage")} />}
    </>}
    <InspectorSelect label={c.columns} value={column?.id} options={columns.map((value, index) => ({ value: String(value.id), label: selection.number.format(index + 1) }))} onValue={selection.selectColumn} />
    {column && <div className="space-y-3 rounded-lg border border-border p-3">
      <InspectorNumber label={c.widthValue} value={inspectorRecord(column.width).value} min={0.001} max={1000} step={0.001} onValue={value => updateColumn({ width: { ...inspectorRecord(column.width), value } })} />
      <InspectorSelect label={c.unit} value={inspectorRecord(column.width).unit} options={(["MM", "PERCENT"] as const).map(value => ({ value, label: c[value] }))} onValue={unit => updateColumn({ width: { ...inspectorRecord(column.width), unit } })} />
      <InspectorSelect label={c.align} value={column.align} options={(["START", "CENTER", "END"] as const).map(value => ({ value, label: c[value] }))} onValue={align => updateColumn({ align })} />
      <InspectorSelect label={c.align} value={column.verticalAlign} options={(["TOP", "MIDDLE", "BOTTOM"] as const).map(value => ({ value, label: c[value] }))} onValue={verticalAlign => updateColumn({ verticalAlign })} />
      <InspectorCheck label={c.wrap} value={column.wrap} onValue={wrap => updateColumn({ wrap })} /><InspectorCheck label={c.visible} value={column.visible} onValue={visible => updateColumn({ visible })} />
      <InspectorCellStyle label={c.cellStyle} value={column.cellStyle} onValue={cellStyle => updateColumn({ cellStyle })} copy={c} />
      <InspectorCellStyle label={c.headerStyle} value={column.headerStyle} onValue={headerStyle => updateColumn({ headerStyle })} copy={c} />
      {dynamic && <>
        {inspectorRecord(column.header).kind === "TEXT" && <InspectorText label={c.header} value={inspectorRecord(column.header).value} onValue={value => updateColumn({ header: { ...inspectorRecord(column.header), value } })} />}
        {column.value && <InspectorCellValue label={c.cell} fields={rowFields} value={column.value} copy={c} onValue={value => updateColumn({ value })} />}
      </>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => form.table({ kind: "insert", axis: "column", index: selection.columnIndex })}>{c.before}</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => form.table({ kind: "insert", axis: "column", index: selection.columnIndex + 1 })}>{c.after}</Button>
        <Button type="button" size="sm" variant="outline" disabled={columns.length <= 1} onClick={() => form.table({ kind: "remove", axis: "column", index: selection.columnIndex })}>{c.remove}</Button>
        <Button type="button" size="sm" variant="outline" disabled={!selection.columnIndex} onClick={() => form.table({ kind: "move", axis: "column", index: selection.columnIndex, delta: -1 })}>{c.up}</Button>
        <Button type="button" size="sm" variant="outline" disabled={selection.columnIndex === columns.length - 1} onClick={() => form.table({ kind: "move", axis: "column", index: selection.columnIndex, delta: 1 })}>{c.down}</Button>
      </div>
    </div>}
    {!dynamic && <>
      <InspectorSelect label={c.rows} value={row?.id} options={rows.map((value, index) => ({ value: String(value.id), label: selection.number.format(index + 1) }))} onValue={selection.selectRow} />
      {row && <div className="space-y-3 rounded-lg border border-border p-3">
        {inspectorRecords(row.cells).map(cell => <InspectorCellValue key={String(cell.id)} label={`${c.cell} ${selection.number.format(columns.findIndex(column => column.id === cell.columnId) + 1)}`} value={cell.value} fields={fields.filter(field => !field.path.includes("[]"))} copy={c} onValue={value => form.collection("rows", selection.rowIndex)({ cells: inspectorRecords(row.cells).map(candidate => candidate.id === cell.id ? { ...candidate, value } : candidate) })} />)}
        {Array.isArray(inspectorRecord(props.fixedCanvas).rowHeightsMm) && <InspectorNumber label={c.rowHeight} value={(inspectorRecord(props.fixedCanvas).rowHeightsMm as number[])[selection.rowIndex]} min={0.001} max={1000} step={0.001} onValue={height => form.prop("fixedCanvas")({ ...inspectorRecord(props.fixedCanvas), rowHeightsMm: (inspectorRecord(props.fixedCanvas).rowHeightsMm as number[]).map((value, index) => index === selection.rowIndex ? height : value) })} />}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => form.table({ kind: "insert", axis: "row", index: selection.rowIndex })}>{c.before}</Button><Button type="button" size="sm" variant="outline" onClick={() => form.table({ kind: "insert", axis: "row", index: selection.rowIndex + 1 })}>{c.after}</Button>
          <Button type="button" size="sm" variant="outline" disabled={rows.length <= 1} onClick={() => form.table({ kind: "remove", axis: "row", index: selection.rowIndex })}>{c.remove}</Button>
          <Button type="button" size="sm" variant="outline" disabled={!selection.rowIndex} onClick={() => form.table({ kind: "move", axis: "row", index: selection.rowIndex, delta: -1 })}>{c.up}</Button><Button type="button" size="sm" variant="outline" disabled={selection.rowIndex === rows.length - 1} onClick={() => form.table({ kind: "move", axis: "row", index: selection.rowIndex, delta: 1 })}>{c.down}</Button>
        </div>
      </div>}
      {row && column && <InspectorMerge form={form} row={selection.rowIndex} column={selection.columnIndex} rowCount={rows.length} columnCount={columns.length} number={selection.number} copy={c} />}
    </>}
  </fieldset>;
}
