import { record } from "../../../contracts/core-page";
import { validateTemplateDocumentModel } from "@mutakamel/template-schema/browser-safe";
import { appendEditorElement, appendEditorNode, moveEditorNode, updateEditorNode, type EditorDocument, type EditorNode } from "../../template-editor-model";
import type { DesignerCommand } from "../../designer-command-store";
import type { TemplateDataSchema } from "../../template-design-api";
import type { TemplateAsset } from "../../template-assets-contract";
import { appendFlowBodyDivider, appendFlowBodyImage, appendFlowBodyTable, appendFlowBodyText, appendFlowBodyTotals, flowBodyDestination } from "../../pages/zone-flow-commands";
import { readDataDescriptor } from "../bindings/binding-catalogue";
import { appendSalesQuotationTable } from "../bindings/sales-quotation-binding-commands";
import { admitTableChoice, readScopedTableOffer, type ScopedTableChoice } from "../bindings/scoped-table-source";
import type { InspectorDataPortHost } from "../bindings/inspector-data-contract";

const tableScopePins = new WeakMap<() => EditorDocument | null, number>();
let nextTableScopePin = 0;

function supportsFlowRootInsertion(document: EditorDocument | null): document is EditorDocument {
  return document?.layoutMode === "EMAIL_FLOW";
}

function totalsPaths(host: InspectorDataPortHost | undefined, document: EditorDocument): string[] {
  if (!host || document.outputChannel !== "PRINT") return [];
  const descriptor = readDataDescriptor(host.readNative(), host.readCatalogue(), host.bridge.context(), document);
  return descriptor?.fields.filter(field => field.dataType === "CURRENCY" && field.allowedFormats.includes("CURRENCY") &&
    !field.path.includes("[]")).slice(-4).map(field => field.path) ?? [];
}

export function useDesignerNodeCommands(document: EditorDocument | null, selectedId: string | null, schema: TemplateDataSchema | null,
  assets: TemplateAsset[], copy: { text: string }, readDocument: () => EditorDocument | null, change: (next: EditorDocument) => void,
  execute: (command: DesignerCommand) => void, insertBound: (prepare: (current: EditorDocument, selection: readonly string[]) => EditorDocument | null, scope?: "rendered" | (() => boolean)) => boolean,
  readCurrentScopedDocument: () => EditorDocument | null, dataHost?: InspectorDataPortHost) {
  const readFlowDocument = () => {
    const current = readDocument();
    return supportsFlowRootInsertion(current) ? current : null;
  };
  const insertFlowBound: typeof insertBound = prepare =>
    insertBound((current, selection) => supportsFlowRootInsertion(current) ? prepare(current, selection) : null);
  const scopedBodyId = document && selectedId ? flowBodyDestination(document, selectedId)?.id : undefined;
  const isSalesQuotation = document?.documentType === "QUOTATION" && document.outputChannel === "PRINT" &&
    document.dataSourceKey === "TRADE_QUOTATION_PRINT_V1";
  const unboundBodyId = isSalesQuotation ? scopedBodyId : undefined;
  const insertUnbound = (prepare: (current: EditorDocument, id: string) => EditorDocument | null) => {
    if (!unboundBodyId) return;
    const current = readCurrentScopedDocument();
    const next = current && prepare(current, unboundBodyId);
    if (next && validateTemplateDocumentModel(next).valid) change(next);
  };
  const insertScoped = (prepare: (current: EditorDocument, id: string) => EditorDocument | null) => {
    if (!scopedBodyId) return false;
    return insertBound((current, selection) => selection.length === 1 && selection[0] === scopedBodyId
      ? prepare(current, scopedBodyId) : null, "rendered");
  };
  const readTableOffer = (current: EditorDocument, bodyId: string) => {
    const offer = readScopedTableOffer(dataHost, current, bodyId);
    if (!offer || readCurrentScopedDocument() !== current) return null;
    let scopePin = tableScopePins.get(readCurrentScopedDocument);
    if (scopePin === undefined) {
      scopePin = ++nextTableScopePin;
      tableScopePins.set(readCurrentScopedDocument, scopePin);
    }
    return { ...offer, pin: JSON.stringify([scopePin, offer.pin]) };
  };
  const tableDocument = dataHost && readCurrentScopedDocument();
  const tableBody = tableDocument && selectedId ? flowBodyDestination(tableDocument, selectedId) : undefined;
  const tableOffer = tableDocument && tableBody ? readTableOffer(tableDocument, tableBody.id) : null;
  const selected = selectedId && document ? document.nodes[selectedId] ?? null : null;
  const flowParent = isSalesQuotation && document && selected?.parentId ? document.nodes[selected.parentId] : undefined;
  const isReorderable = document && flowParent && selected?.layout.kind === "FLOW" &&
    flowBodyDestination(document, flowParent.id) && !selected.locked && !selected.hidden;
  const canMoveWithinBody = (delta: -1 | 1) => {
    if (!isReorderable || !flowParent || !document || !selectedId) return false;
    const index = flowParent.childIds.indexOf(selectedId);
    const sibling = index < 0 ? undefined : document.nodes[flowParent.childIds[index + delta]];
    return !!sibling && !sibling.locked;
  };
  const columns = Array.isArray(selected?.props.columns) ? selected.props.columns.map((value: unknown) => record(value)).filter((value): value is Record<string, unknown> => value !== null) : [];
  const rows = Array.isArray(selected?.props.rows) ? selected.props.rows.map((value: unknown) => record(value)).filter((value): value is Record<string, unknown> => value !== null) : [];
  const updateCollection = (key: "columns" | "rows", index: number, patch: Record<string, unknown>) => {
    const document = readDocument(), selected = document && selectedId ? document.nodes[selectedId] : null;
    if (!document || !selected || !Array.isArray(selected.props[key])) return;
    const values = selected.props[key] as unknown[];
    change(updateEditorNode(document, selected.id, { props: { ...selected.props, [key]: values.map((value, itemIndex) => itemIndex === index ? { ...record(value), ...patch } : value) } }));
  };
  return { selected, columns, rows, updateCollection,
    tableOffer,
    flowRootInsertionAvailable: supportsFlowRootInsertion(document),
    scopedTextInsertionAvailable: !!scopedBodyId && (isSalesQuotation || !!dataHost),
    unboundBodyInsertionAvailable: !!unboundBodyId,
    canMoveUpWithinBody: canMoveWithinBody(-1),
    canMoveDownWithinBody: canMoveWithinBody(1),
    scopedTotalsInsertionAvailable: !!document && !!scopedBodyId && totalsPaths(dataHost, document).length > 0,
    updateNode: (patch: Partial<EditorNode>) => { if (selectedId) execute({ kind: "EDIT_NODE", nodeId: selectedId, patch }); },
    move: (delta: -1 | 1) => { if (selectedId) execute({ kind: "REORDER_NODE", nodeId: selectedId, delta }); },
    moveWithinBody: (delta: -1 | 1) => {
      if (!selectedId || !canMoveWithinBody(delta)) return;
      const current = readCurrentScopedDocument();
      if (!current) return;
      const candidate = moveEditorNode(current, selectedId, delta);
      if (candidate !== current && validateTemplateDocumentModel(candidate).valid) change(candidate);
    },
    remove: () => { if (selectedId) execute({ kind: "REMOVE_NODE", nodeId: selectedId }); },
    insertText: () => {
      if (supportsFlowRootInsertion(document)) {
        const flow = readFlowDocument();
        if (flow) change(appendEditorNode(flow, "text", copy.text));
        return;
      }
      if (!dataHost && unboundBodyId) {
        insertUnbound((current, id) => appendFlowBodyText(current, id, copy.text));
        return;
      }
      insertScoped((current, id) => appendFlowBodyText(current, id, copy.text));
    },
    insertDivider: () => {
      if (unboundBodyId) insertUnbound(appendFlowBodyDivider);
      else {
        const flow = readFlowDocument();
        if (flow) change(appendEditorNode(flow, "divider", ""));
      }
    },
    insertField: (path: string) => insertFlowBound(document => schema?.fields.some(field => field.path === path &&
      !["ARRAY", "OBJECT", "IMAGE"].includes(field.dataType) && !path.includes("[]")) ? appendEditorNode(document, "dataField", path) : null),
    insertImage: (assetId: string) => {
      const asset = assets.find(row => row.id === assetId);
      if (!asset) return;
      if (unboundBodyId) insertUnbound((current, id) => appendFlowBodyImage(current, id, asset.id, asset.originalFileName));
      else {
        const flow = readFlowDocument();
        if (flow) change(appendEditorElement(flow, "image", { assetId, alt: asset.originalFileName, decorative: false }));
      }
    },
    insertTable: (choice: ScopedTableChoice) => {
      if (!tableDocument || !tableBody || !tableOffer || choice?.offerPin !== tableOffer.pin) return false;
      const readCurrentSource = () => admitTableChoice(readTableOffer(tableDocument, tableBody.id), choice);
      return insertBound((current, selection) => {
        if (current !== readCurrentScopedDocument() || selection.length !== 1 || selection[0] !== tableBody.id) return null;
        const source = readCurrentSource();
        if (!source) return null;
        if (current.dataSourceKey === "TRADE_QUOTATION_PRINT_V1" && dataHost) {
          const descriptor = readDataDescriptor(dataHost.readNative(), dataHost.readCatalogue(), dataHost.bridge.context(), current);
          return descriptor ? appendSalesQuotationTable(current, tableBody.id, source.columnPaths, descriptor) : null;
        }
        return appendFlowBodyTable(current, tableBody.id, source.sourcePath, source.rowKeyPath, source.columnPaths);
      }, () => readCurrentSource() !== null);
    },
    insertTotals: () => insertScoped((current, id) => appendFlowBodyTotals(current, id, totalsPaths(dataHost, current))),
  };
}
