"use client";
import { Button, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { availableFunctions } from "./binding-catalogue";
import { dataRecord, type DataCatalogue, type DataDescriptor, type DataValue } from "./binding-contract";
import { DataInput, DataNumber, DataSelect } from "./DataControls";
import { FieldPicker } from "./FieldPicker";
import { formulaChildrenForEditor, formulaKinds, newFormula, operandKinds, replaceFormulaOperand } from "./formula-editing";
import { useDataCopy, useDataInteger } from "./hooks/useDataControls";
import { useDataEditingDisabled } from "./data-editing-context";
import { useDataEligibility } from "./data-eligibility-context";

export interface FormulaEditorProps { value: unknown; change(value: DataValue): void; descriptor: DataDescriptor; catalogue: DataCatalogue; rowSourcePath?: string; formulas?: readonly string[]; allowCollection?: boolean; depth?: number }
export function FormulaEditor(props: FormulaEditorProps) {
  const { change, descriptor, catalogue, rowSourcePath, formulas = [], allowCollection = false, depth = 0 } = props;
  const c = useDataCopy(), value = dataRecord(props.value), kind = String(value.kind ?? "NULL_LITERAL");
  const integer = useDataInteger();
  const disabled = useDataEditingDisabled();
  const eligibility = useDataEligibility();
  const referenceKind = kind === "ROOT_BINDING" || kind === "ROW_BINDING" || kind === "FORMULA_REF" ? kind : "BINDING";
  const references = ["BINDING", "ROOT_BINDING", "ROW_BINDING", "FORMULA_REF"].includes(kind) ? eligibility?.references({ kind: referenceKind, rowSourcePath, allowNullable: true,
    ...(kind === "BINDING" && typeof value.currencyCodePath === "string" ? { currencyCodePath: value.currencyCodePath } : {}) }) : null;
  const referencePaths = references?.values.map(row => row.path) ?? [];
  const patch = (key: string, next: unknown) => change({ ...value, [key]: next });
  const child = (key: string, row = rowSourcePath) => <FormulaEditor {...props} value={value[key]} depth={depth + 1} rowSourcePath={row} change={next => patch(key, next)} />;
  const versions = availableFunctions(catalogue), fn = versions.find(row => row.id === value.functionVersionId);
  const kinds = formulaKinds.filter(key => (key !== "ROW_BINDING" || !!rowSourcePath) && (key !== "SUM_ROWS" || allowCollection) && (key !== "FUNCTION_CALL" || versions.length > 0) && (key !== "FORMULA_REF" || formulas.length > 0));
  if (depth > 32) return <p role="alert">{c.status.invalid}</p>;
  return <fieldset className="space-y-3 rounded-md border border-border p-3">
    <DataSelect label={c.kind} value={kind} values={kinds} change={key => change(newFormula(key))} />
    {!kinds.includes(kind) && <p role="alert">{c.notSupported}</p>}
    {["STRING_LITERAL", "DATE_LITERAL", "DECIMAL_LITERAL"].includes(kind) && <DataInput label={c.value} value={String(value.value ?? "")} change={next => patch("value", next)} hint={kind === "DECIMAL_LITERAL" ? c.decimalHint : undefined} />}
    {kind === "BOOLEAN_LITERAL" && <DataSelect label={c.value} value={value.value === true ? "TRUE" : "FALSE"} values={["TRUE", "FALSE"]} change={next => patch("value", next === "TRUE")} />}
    {kind === "DECIMAL_LITERAL" && <>
      <DataSelect label={c.dimension} value={String(value.dimension ?? "SCALAR")} values={catalogue.identityAuthority ? ["SCALAR", "MONEY", "QUANTITY", "UNIT_PRICE"] : ["SCALAR"]} change={dimension => change({ kind, value: value.value, dimension })} />
      {["MONEY", "UNIT_PRICE"].includes(String(value.dimension)) && <DataInput label={c.currencyCode} value={String(value.currencyCode ?? "")} change={next => patch("currencyCode", next)} />}
      {["QUANTITY", "UNIT_PRICE"].includes(String(value.dimension)) && <DataInput label={c.unit} value={String(value.unitCode ?? "")} change={next => patch("unitCode", next)} />}
      {!catalogue.identityAuthority && <p className="text-sm text-muted-foreground">{c.identityUnavailable}</p>}
    </>}
    {["BINDING", "ROOT_BINDING", "ROW_BINDING"].includes(kind) && <FieldPicker formula descriptor={descriptor} sourceReady={!!references} eligiblePaths={referencePaths} rowSourcePath={kind === "ROOT_BINDING" ? undefined : rowSourcePath} value={String(value.path ?? "")} change={path => { if (references?.writable() && referencePaths.includes(path)) change({ ...value, kind, path }); }} />}
    {kind === "FORMULA_REF" && <Field label={c.reference} showLabel><Select disabled={disabled || !references} value={String(value.formulaId ?? "")} onValueChange={next => { if (references?.writable() && referencePaths.includes(next)) patch("formulaId", next); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{formulas.filter(id => referencePaths.includes(id)).map(id => <SelectItem key={id} value={id}><bdi dir="ltr">{id}</bdi></SelectItem>)}</SelectContent></Select></Field>}
    {kind === "FUNCTION_CALL" && <>
      <Field label={c.functionVersion} showLabel><Select disabled={disabled} value={String(value.functionVersionId ?? "")} onValueChange={id => { const selected = versions.find(row => row.id === id); if (selected) change({ kind, functionVersionId: id, arguments: selected.definition.parameters.map(parameter => ({ name: parameter.name, expression: newFormula("NULL_LITERAL") })) }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{versions.map(row => <SelectItem key={row.id} value={row.id}>{String(row.definition.name ?? row.functionId)} · {c.version} {integer(row.versionNumber)} · <bdi dir="ltr">{row.id}</bdi></SelectItem>)}</SelectContent></Select></Field>
      {!fn && <p role="alert">{c.functionUnavailable}</p>}
      {fn && <p className="break-all text-xs">{c.functionPin}: <bdi dir="ltr">{fn.id} / {fn.contentChecksum}</bdi></p>}
      {fn && (Array.isArray(value.arguments) ? value.arguments : []).map((arg, index) => <section key={String(dataRecord(arg).name)} className="space-y-2"><p>{c.argument}: <bdi dir="ltr">{String(dataRecord(arg).name)}</bdi></p><FormulaEditor {...props} value={dataRecord(arg).expression} depth={depth + 1} change={next => patch("arguments", (value.arguments as unknown[]).map((item, at) => at === index ? { ...dataRecord(item), expression: next } : item))} /></section>)}
    </>}
    {operandKinds.includes(kind) && <>
      {(Array.isArray(value.operands) ? value.operands : []).map((operand, index) => <div key={index} className="space-y-2"><FormulaEditor {...props} value={operand} depth={depth + 1} change={next => change(replaceFormulaOperand(value, index, next))} /><Button type="button" variant="outline" size="sm" onClick={() => change(replaceFormulaOperand(value, index))}>{c.remove}</Button></div>)}
      <Button type="button" variant="outline" size="sm" disabled={Array.isArray(value.operands) && value.operands.length >= 100} onClick={() => patch("operands", [...(Array.isArray(value.operands) ? value.operands : []), newFormula("NULL_LITERAL")])}>{c.add}</Button>
    </>}
    {["ROUND", "DIVIDE"].includes(kind) && <><DataNumber label={c.scale} value={value.scale as number} change={next => patch("scale", next)} /><DataSelect label={c.rounding} value={String(value.rounding)} values={["HALF_UP", "HALF_EVEN", "DOWN"]} change={next => patch("rounding", next)} /></>}
    {kind === "COMPARE" && <DataSelect label={c.operator} value={String(value.operator)} values={["EQ", "NE", "LT", "LTE", "GT", "GTE"]} change={next => patch("operator", next)} />}
    {kind === "SUM_ROWS" && <Field label={c.source} showLabel><Select disabled={disabled} value={String(value.sourcePath ?? "")} onValueChange={next => change({ kind, sourcePath: next, item: newFormula("NULL_LITERAL") })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{descriptor.fields.filter(field => field.dataType === "ARRAY" && !field.path.includes("[]")).map(field => <SelectItem key={field.path} value={field.path}><bdi dir="ltr">{field.path}</bdi></SelectItem>)}</SelectContent></Select></Field>}
    {formulaChildrenForEditor(value).map(key => <section key={key} className="space-y-2"><p className="text-sm">{c.children[key as keyof typeof c.children]}</p>{child(key, kind === "SUM_ROWS" ? String(value.sourcePath) : rowSourcePath)}</section>)}
  </fieldset>;
}
