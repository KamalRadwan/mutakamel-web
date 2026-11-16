import { dataClone, dataRecord, type DataDescriptor, type DataValue } from "./binding-contract";
import { cataloguePin, dataFields, documentFormulas, formulaContext } from "./binding-catalogue";
import { captureInspectorData, inspectorDataEditable, type InspectorDataCapture } from "./inspector-data-admission";
import type { InspectorDataPortHost } from "./inspector-data-contract";
import type { EditorDocument } from "../../template-editor-model";

export type CurrencyEligibilityRequest =
  | { kind: "BINDING"; binding: unknown; rowSourcePath?: string }
  | { kind: "FORMULA"; expression: unknown; format?: unknown; rowSourcePath?: string };
export interface ReferenceEligibilityRequest {
  kind: "BINDING" | "ROOT_BINDING" | "ROW_BINDING" | "FORMULA_REF";
  rowSourcePath?: string; allowNullable?: boolean; currencyCodePath?: string;
}
export interface EligibilityReceipt {
  sourceFingerprint: string; descriptorChecksum: string;
  current(): boolean;
  writable(): boolean;
}
export interface CurrencyEligibility extends EligibilityReceipt { paths: readonly string[]; allowContextCurrency: boolean }
export interface ReferenceEligibility extends EligibilityReceipt {
  values: readonly { path: string; inferred: { type: string; dimension: string; nullable: boolean } }[];
}
export interface DataEligibilityPort {
  currencies(request: CurrencyEligibilityRequest): CurrencyEligibility | null;
  references(request: ReferenceEligibilityRequest): ReferenceEligibility | null;
}

function rowContext(capture: InspectorDataCapture, requested?: string): boolean {
  return requested === undefined || capture.node.type === "dynamicTable" && capture.node.props.sourcePath === requested &&
    capture.descriptor.fields.some(field => field.path === requested && field.dataType === "ARRAY");
}
/** Only an existing native authoring slot is probed; no nodes, owner data or schema fields are fabricated. */
function probeDocument(capture: InspectorDataCapture, request: CurrencyEligibilityRequest, currencyCodePath?: string): EditorDocument | null {
  if (!rowContext(capture, request.rowSourcePath)) return null;
  const document = dataClone(capture.state.document!), node = document.nodes[capture.node.id];
  const format: DataValue = { ...dataRecord(request.kind === "BINDING" ? dataRecord(request.binding).format : request.format), type: "CURRENCY" };
  delete format.currencyCodePath;
  if (currencyCodePath !== undefined) format.currencyCodePath = currencyCodePath;
  const value: DataValue = request.kind === "BINDING" ? { kind: "BINDING", binding: { ...dataRecord(request.binding), format } } : { kind: "FORMULA", expression: dataClone(request.expression), format };
  if (node.type === "dataField" && request.kind === "BINDING" && !request.rowSourcePath) {
    const binding = dataRecord(value.binding);
    if (typeof binding.path !== "string" || typeof binding.nullBehavior !== "string") return null;
    node.binding = { ...binding, path: binding.path, nullBehavior: binding.nullBehavior }; return document;
  }
  if (node.type === "formula" && request.kind === "FORMULA" && !request.rowSourcePath) {
    node.props = { ...node.props, expression: dataClone(request.expression), format }; return document;
  }
  if (node.type === "staticTable" && !request.rowSourcePath) {
    const rows = Array.isArray(node.props.rows) ? node.props.rows : [];
    for (const row of rows) {
      const cells = dataRecord(row).cells;
      if (Array.isArray(cells) && cells.length) { dataRecord(cells[0]).value = value; return document; }
    }
  }
  if (node.type === "dynamicTable" && request.rowSourcePath === node.props.sourcePath) {
    const columns = Array.isArray(node.props.columns) ? node.props.columns : [];
    const column = columns.map(dataRecord).find(column => Object.hasOwn(column, "value") && !Object.hasOwn(column, "productImage"));
    if (column) { column.value = value; return document; }
  }
  if (node.type === "totals" && request.kind === "BINDING" && !request.rowSourcePath) {
    const rows = Array.isArray(node.props.rows) ? node.props.rows : [];
    if (rows.length) { dataRecord(rows[0]).binding = value.binding; return document; }
  }
  if (request.kind === "BINDING" && !request.rowSourcePath) {
    const pending: unknown[] = node.type === "richText" ? [node.props.document] : [node.props.label];
    while (pending.length) {
      const item = dataRecord(pending.pop());
      if (item.type === "variable") { dataRecord(item.attrs).binding = value.binding; return document; }
      if (item.kind === "BINDING" && Object.hasOwn(item, "binding")) { item.binding = value.binding; return document; }
      for (const key of ["content", "segments"]) if (Array.isArray(item[key])) pending.push(...item[key]);
    }
  }
  return null;
}
function admitted(capture: InspectorDataCapture, document: EditorDocument | null): boolean {
  if (!document) return false;
  try {
    const context = formulaContext(capture.descriptor, capture.catalogue, undefined, documentFormulas(document));
    return capture.native.validateTemplateDocumentModel(document, { dataSchema: capture.descriptor, functions: context.functions, formulaIdentityAuthority: capture.identityAuthority }).valid;
  } catch { return false; }
}
function sameDescriptor(a: DataDescriptor, b: DataDescriptor): boolean { return a.key === b.key && a.version === b.version && a.checksum === b.checksum; }

/** Full descriptor + current native admission is the shared eligibility authority; no STRING/nullability policy copy. */
export function createDataEligibilityPort(host: InspectorDataPortHost): DataEligibilityPort {
  const receipt = (capture: InspectorDataCapture): EligibilityReceipt => {
    const capturedCataloguePin = cataloguePin(capture.catalogue);
    const current = () => {
      const now = captureInspectorData(host);
      return !!now && now.pin === capture.pin && sameDescriptor(now.descriptor, capture.descriptor) &&
        capturedCataloguePin === cataloguePin(now.catalogue) && now.native === capture.native && now.identityAuthority === capture.identityAuthority;
    };
    return { sourceFingerprint: capture.fingerprint, descriptorChecksum: capture.descriptor.checksum, current,
      writable: () => { const now = captureInspectorData(host); return current() && !!now && inspectorDataEditable(host, now); } };
  };
  return {
    currencies(request) {
      const capture = captureInspectorData(host);
      if (!capture || !rowContext(capture, request.rowSourcePath)) return null;
      if (!probeDocument(capture, request)) return null;
      // ISO metadata only narrows enumeration. Every candidate/default is still admitted by the full native model.
      const paths = dataFields(capture.descriptor).filter(({ field }) => field.dataType === "STRING" && field.valueEncoding === "ISO_4217_UPPER")
        .map(({ path }) => path).filter(path => admitted(capture, probeDocument(capture, request, path)));
      const result = { ...receipt(capture), paths, allowContextCurrency: admitted(capture, probeDocument(capture, request)) };
      return result.current() ? result : null;
    },
    references(request) {
      const capture = captureInspectorData(host);
      if (!capture || request.rowSourcePath !== undefined && !capture.descriptor.fields.some(field => field.path === request.rowSourcePath && field.dataType === "ARRAY") || request.kind === "ROW_BINDING" && !request.rowSourcePath) return null;
      const context = formulaContext(capture.descriptor, capture.catalogue, request.rowSourcePath, documentFormulas(capture.state.document!));
      const paths = request.kind === "FORMULA_REF" ? Object.keys(context.formulas ?? {}).filter(id => id !== capture.node.props.formulaId) :
        dataFields(capture.descriptor, request.kind === "ROOT_BINDING" ? undefined : request.rowSourcePath).map(row => row.path);
      const values = paths.flatMap(path => {
        try {
          const expression = request.kind === "FORMULA_REF" ? { kind: request.kind, formulaId: path } : { kind: request.kind, path,
            ...(request.kind === "BINDING" && request.currencyCodePath !== undefined ? { currencyCodePath: request.currencyCodePath } : {}) };
          const inferred = capture.native.inferTemplateFormulaType(expression, context);
          return request.allowNullable === false && inferred.nullable ? [] : [{ path, inferred }];
        } catch { return []; }
      });
      const result = { ...receipt(capture), values };
      return result.current() ? result : null;
    },
  };
}
