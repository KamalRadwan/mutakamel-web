import { parseEditorDocument } from "../../template-editor-model";
import { cataloguePin, documentFormulas, formulaContext, readDataDescriptor } from "./binding-catalogue";
import { dataRecord, type DataValue } from "./binding-contract";
import type { InspectorDataPickerProps, InspectorDataPortHost } from "./inspector-data-contract";

function projection(fields: InspectorDataPickerProps["fields"]): string {
  return JSON.stringify(fields.map(field => [field.path, field.dataType, [...field.allowedFormats].sort()]).sort((a, b) => String(a[0]).localeCompare(String(b[0]), "en-US")));
}
/** Context comes from the actual selected node; the projected fields never create a descriptor. */
export function captureInspectorData(host: InspectorDataPortHost, fields?: InspectorDataPickerProps["fields"], cell = false) {
  const state = host.bridge.read(), authority = { ...host.bridge.context() }, catalogue = host.readCatalogue(), native = host.readNative(), fingerprint = host.readSourceFingerprint();
  const descriptor = readDataDescriptor(native, catalogue, authority, state.document), selected = host.bridge.selection();
  const node = selected.length === 1 ? state.document?.nodes[selected[0]] : undefined;
  if (!native || !catalogue || !descriptor || !node || !fingerprint || !/^[0-9a-f]{64}$/.test(fingerprint)) return null;
  let rowSourcePath: string | undefined;
  if (cell) {
    if (!["staticTable", "dynamicTable"].includes(node.type)) return null;
    if (node.type === "dynamicTable") {
      if (typeof node.props.sourcePath !== "string" || !descriptor.fields.some(field => field.path === node.props.sourcePath && field.dataType === "ARRAY")) return null;
      rowSourcePath = node.props.sourcePath;
    }
  }
  const prefix = rowSourcePath ? `${rowSourcePath}[].` : "";
  const expected = prefix ? descriptor.fields.filter(field => field.path.startsWith(prefix)).map(field => ({ ...field, path: field.path.slice(prefix.length) })) : descriptor.fields.filter(field => !field.path.includes("[]"));
  if (fields && (new Set(fields.map(field => field.path)).size !== fields.length || projection(fields) !== projection(expected))) return null;
  return { state, authority, catalogue, native, descriptor, node, rowSourcePath, fingerprint, identityAuthority: catalogue.identityAuthority,
    pin: JSON.stringify([authority, state.generation, node, fingerprint, cataloguePin(catalogue), rowSourcePath, fields && projection(fields)]) };
}
export type InspectorDataCapture = NonNullable<ReturnType<typeof captureInspectorData>>;
export function canStageInspectorData(host: InspectorDataPortHost, capture: InspectorDataCapture, props: InspectorDataPickerProps, cell = false): boolean {
  if (props.disabled || !host.bridge.canEdit() || host.bridge.context().readOnly) return false;
  const current = captureInspectorData(host, props.fields, cell);
  if (!current || current.native !== capture.native || current.identityAuthority !== capture.identityAuthority || current.pin !== capture.pin || current.state.gestureActive) return false;
  return inspectorDataEditable(host, current);
}
export function inspectorDataEditable(host: InspectorDataPortHost, capture: InspectorDataCapture): boolean {
  if (!host.bridge.canEdit() || host.bridge.context().readOnly || capture.state.gestureActive) return false;
  let node = capture.node;
  const seen = new Set<string>();
  while (node) {
    if (node.locked || seen.has(node.id)) return false;
    seen.add(node.id);
    if (!node.parentId) break;
    const parent = capture.state.document?.nodes[node.parentId];
    if (!parent) return false;
    node = parent;
  }
  return true;
}
/** Binds T02's existing native call to the same current full descriptor and function/unit authority. */
export function createInspectorDataValidator(host: InspectorDataPortHost) {
  const initial = captureInspectorData(host);
  const initialCataloguePin = initial && cataloguePin(initial.catalogue);
  return { validateTemplateDocumentModel(value: unknown) {
    const current = captureInspectorData(host);
    if (!initial || !current || initial.authority.key !== current.authority.key || initial.authority.tenantId !== current.authority.tenantId || initial.authority.companyId !== current.authority.companyId ||
      initial.fingerprint !== current.fingerprint || initialCataloguePin !== cataloguePin(current.catalogue) || initial.native !== current.native || initial.identityAuthority !== current.identityAuthority || current.authority.readOnly || !host.bridge.canEdit()) return { valid: false, issues: [] };
    try {
      const document = parseEditorDocument(value), context = formulaContext(current.descriptor, current.catalogue, undefined, documentFormulas(document));
      const result = current.native.validateTemplateDocumentModel(document, { dataSchema: current.descriptor, functions: context.functions, formulaIdentityAuthority: current.catalogue.identityAuthority });
      if (!result.valid || !result.document) return { valid: false, issues: [] };
      return { valid: true, document: parseEditorDocument(result.document), issues: [] };
    } catch { return { valid: false, issues: [] }; }
  } };
}
export function inspectorCellFormulaFormats(inferred?: { type: string; dimension: string }): string[] {
  if (!inferred) return ["TEXT"];
  if (inferred.type === "DECIMAL") return ["TEXT", "NUMBER", ...(inferred.dimension === "MONEY" || inferred.dimension === "UNIT_PRICE" ? ["CURRENCY"] : []), ...(inferred.dimension === "SCALAR" ? ["PERCENTAGE"] : [])];
  const scalarFormats: Record<string, string[]> = { DATE: ["DATE"], BOOLEAN: ["BOOLEAN"] };
  return ["TEXT", ...(scalarFormats[inferred.type] ?? [])];
}
export function inferredInspectorCell(capture: InspectorDataCapture, expression: unknown) {
  try { return capture.native.inferTemplateFormulaType(expression, formulaContext(capture.descriptor, capture.catalogue, capture.rowSourcePath, documentFormulas(capture.state.document!))); }
  catch { return undefined; }
}
export function replaceCellFormat(value: DataValue, format: DataValue | undefined): DataValue {
  const next = { ...dataRecord(value) }; if (format === undefined) delete next.format; else next.format = format; return next;
}
