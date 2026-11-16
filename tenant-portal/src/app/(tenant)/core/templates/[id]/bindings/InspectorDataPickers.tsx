"use client";
import { BindingEditor, FormatEditor } from "./BindingEditor";
import { DataEditingContext } from "./data-editing-context";
import { DataInput, DataSelect } from "./DataControls";
import { FormulaEditor } from "./FormulaEditor";
import { dataRecord } from "./binding-contract";
import { documentFormulas } from "./binding-catalogue";
import { inferredInspectorCell, inspectorCellFormulaFormats, replaceCellFormat } from "./inspector-data-admission";
import type { InspectorDataPickerProps, InspectorDataPortHost, InspectorDataPorts } from "./inspector-data-contract";
import { useDataCopy } from "./hooks/useDataControls";
import { useInspectorDataPicker } from "./hooks/useInspectorDataPicker";
import { createDataEligibilityPort } from "./data-eligibility";
import { DataEligibilityContext } from "./data-eligibility-context";

/** Create once for the current owner/source session; values remain in T02's local property draft. */
export function createInspectorDataPorts(host: InspectorDataPortHost): InspectorDataPorts {
  const eligibility = createDataEligibilityPort(host);
  function BindingPicker(props: InspectorDataPickerProps) {
    const c = useDataCopy(), form = useInspectorDataPicker(host, props);
    if (!form.capture) return <p role="status">{c.status.unavailable}</p>;
    return <DataEligibilityContext.Provider value={eligibility}><DataEditingContext.Provider value={form.disabled}><fieldset disabled={form.disabled}>
      <BindingEditor descriptor={form.capture.descriptor} value={props.value} change={form.stage} showFormat={false} />
    </fieldset></DataEditingContext.Provider></DataEligibilityContext.Provider>;
  }
  function CellValuePicker(props: InspectorDataPickerProps) {
    const c = useDataCopy(), form = useInspectorDataPicker(host, props, true), cell = dataRecord(props.value), kind = String(cell.kind ?? "TEXT");
    const capture = form.capture;
    if (!capture) return <p role="status">{c.status.unavailable}</p>;
    const inferred = kind === "FORMULA" ? inferredInspectorCell(capture, cell.expression) : undefined;
    return <DataEligibilityContext.Provider value={eligibility}><DataEditingContext.Provider value={form.disabled}><fieldset disabled={form.disabled} className="space-y-4">
      <DataSelect label={c.type} value={kind} values={["TEXT", "BINDING", "FORMULA"]} change={kind => form.stage(kind === "TEXT" ? { kind, value: "" } : kind === "BINDING" ? { kind, binding: { path: "", nullBehavior: "EMPTY" } } : { kind, expression: { kind: "NULL_LITERAL" } })} />
      {kind === "TEXT" && <DataInput label={c.text} value={String(cell.value ?? "")} change={value => form.stage({ ...cell, value })} />}
      {kind === "BINDING" && <BindingEditor descriptor={capture.descriptor} rowSourcePath={capture.rowSourcePath} value={cell.binding} change={binding => form.stage({ ...cell, binding })} />}
      {kind === "FORMULA" && <>
        <FormulaEditor descriptor={capture.descriptor} catalogue={capture.catalogue} rowSourcePath={capture.rowSourcePath} allowCollection={!!capture.rowSourcePath} formulas={Object.keys(documentFormulas(capture.state.document!))} value={cell.expression} change={expression => form.stage({ ...cell, expression })} />
        <FormatEditor currencyRequest={{ kind: "FORMULA", expression: cell.expression, format: cell.format, rowSourcePath: capture.rowSourcePath }} value={cell.format} allowed={inspectorCellFormulaFormats(inferred)} change={format => form.stage(replaceCellFormat(cell, format))} />
        {!inferred && <p role="status">{c.status.invalid}</p>}
      </>}
    </fieldset></DataEditingContext.Provider></DataEligibilityContext.Provider>;
  }
  return { BindingPicker, CellValuePicker };
}
