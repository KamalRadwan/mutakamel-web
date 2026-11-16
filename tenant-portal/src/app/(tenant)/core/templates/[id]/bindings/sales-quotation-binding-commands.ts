import {
  canonicalJson, TEMPLATE_LIMITS, type DynamicTableNodeV1, type TemplateValueFormatV1,
} from "@mutakamel/template-schema/browser-safe";
import { generateUUIDv7 } from "@/lib/uuid";
import type { DesignerDocumentSnapshot } from "../../designer-command-store";
import { appendFlowBodyTable, flowBodyDestination } from "../../pages/zone-flow-commands";
import { updateEditorNode, type EditorDocument, type EditorNode } from "../../template-editor-model";
import type { DataDescriptor } from "./binding-contract";
import { admitTableChoice, type ScopedTableChoice, type ScopedTableOffer } from "./scoped-table-source";
import {
  matchesSalesQuotationDraft, sameSalesQuotationTenant, readSalesQuotationDescriptor, validateSalesQuotationBindingDocument,
  type SalesQuotationBindingTrust, type SalesQuotationDraftAuthority, type SalesQuotationOwnerObservation,
} from "./sales-quotation-binding-authority";

const lineSourcePath = "quotation.items";
const lineRowKeyPath = "rowKey";
const lineItemPrefix = `${lineSourcePath}[].`;
const isScalar = (dataType: string) => !["ARRAY", "OBJECT", "IMAGE"].includes(dataType);
let nextOfferPin = 0;

export interface SalesQuotationBindingHost {
  /** Return immutable, stable observations until the corresponding owner, release or draft changes. */
  readOwner(): SalesQuotationOwnerObservation | null;
  /** Independent of readOwner and its Core response. */
  readTrust(): SalesQuotationBindingTrust | null;
  readDraftAuthority(): SalesQuotationDraftAuthority | null;
  /** Read the canonical store snapshot and selectedIds array. */
  readDocument(): DesignerDocumentSnapshot;
  readSelection(): readonly string[];
  canEdit(): boolean;
}

export interface SalesQuotationBindingOffer {
  readonly pin: string;
  readonly fields: readonly string[];
  readonly table: ScopedTableOffer | null;
  readonly tableHeaders: SalesQuotationTableHeaders | null;
}

interface SalesQuotationTableHeaders {
  readonly tableId: string;
  readonly columns: readonly { readonly id: string; readonly path: string; readonly label: string }[];
}

export interface SalesQuotationBindingCommand {
  readonly document: EditorDocument;
  /** Run immediately before dispatch into the canonical editor store. */
  isCurrent(): boolean;
}

/** Prepares scoped document changes without registering a formula or geometry provider. */
export function createSalesQuotationBindingCommands(host: SalesQuotationBindingHost) {
  function capture() {
    const owner = host.readOwner(), trust = host.readTrust(), authority = host.readDraftAuthority();
    const state = host.readDocument(), selection = host.readSelection();
    if (!owner || !trust || !authority || !host.canEdit() || !state.document || state.gestureActive ||
      state.generation !== authority.generation || owner.generation !== authority.generation ||
      owner.authorityKey !== authority.key || !sameSalesQuotationTenant(owner, authority) ||
      owner.companyId !== authority.companyId || selection.length !== 1) return null;
    const selected = state.document.nodes[selection[0]];
    const table = selected?.type === "dynamicTable" && !selected.locked && !selected.hidden && selected.layout.kind === "FLOW"
      ? selected : null;
    const body = table
      ? quotationTableFlowBody(state.document, table)
      : flowBodyDestination(state.document, selection[0]);
    if (!body) return null;
    return { owner, trust, authority, state, selection, document: state.document, body, table };
  }

  let active: { capture: NonNullable<ReturnType<typeof capture>>; offer: SalesQuotationBindingOffer;
    descriptor: NonNullable<ReturnType<typeof readSalesQuotationDescriptor>> } | null = null;
  function readCurrent() {
    try {
      const current = capture();
      if (!current) { active = null; return null; }
      const { owner, trust, authority, state, selection, document } = current;
      if (!owner.isCurrent() || !trust.isCurrent() || !authority.isCurrent()) { active = null; return null; }
      if (active && active.capture.owner === owner && active.capture.trust === trust &&
        active.capture.authority === authority && active.capture.state === state && active.capture.document === document &&
        active.capture.selection === selection) return active;
      active = null;
      const descriptor = readSalesQuotationDescriptor(owner.admission, trust);
      if (!descriptor || !matchesSalesQuotationDraft(authority, document) ||
        !validateSalesQuotationBindingDocument(authority.draft.editorDocument, descriptor) ||
        !validateSalesQuotationBindingDocument(document, descriptor)) return null;

      const pin = JSON.stringify([++nextOfferPin, selection[0], state.generation, owner.admission.fingerprint]);
      const fields = current.table ? [] : descriptor.fields
        .filter(field => !field.path.includes("[]") && isScalar(field.dataType)).map(field => field.path);
      const columns = descriptor.fields.filter(field => field.path.startsWith(lineItemPrefix) &&
        !field.path.slice(lineItemPrefix.length).includes("[]") && isScalar(field.dataType));
      // Trade's registered quotation parser rejects duplicates of the persisted line ID.
      const rowKey = columns.find(field => field.path === lineItemPrefix + lineRowKeyPath);
      const source = descriptor.fields.find(field => field.path === lineSourcePath && field.dataType === "ARRAY");
      const eligible = source && rowKey?.dataType === "STRING" && rowKey.valueEncoding === "UTF8_NFC" &&
        !rowKey.nullable && !rowKey.parentNullable;
      const paths = columns.map(field => field.path.slice(lineItemPrefix.length));
      const table = eligible && !current.table ? Object.freeze({ pin, sources: Object.freeze([Object.freeze({
          sourcePath: lineSourcePath, rowKeyPath: lineRowKeyPath,
          columnPaths: Object.freeze(paths),
        })]) }) : null;
      const tableHeaders = eligible && current.table ? readTableHeaders(current.table, paths) : null;
      if (current.table && !tableHeaders) return null;
      active = { capture: current, offer: Object.freeze({ pin, fields: Object.freeze(fields), table, tableHeaders }), descriptor };
      return active;
    } catch { active = null; return null; }
  }

  function prepare(current: NonNullable<ReturnType<typeof readCurrent>>, document: EditorDocument | null): SalesQuotationBindingCommand | null {
    try {
      if (!document || !validateSalesQuotationBindingDocument(document, current.descriptor)) return null;
      const candidate = canonicalJson(document);
      const isCurrent = () => {
        try { return readCurrent() === current && canonicalJson(document) === candidate; }
        catch { return false; }
      };
      return isCurrent() ? { document, isCurrent } : null;
    } catch { return null; }
  }

  return {
    readOffer: () => readCurrent()?.offer ?? null,
    prepareField(pin: string, path: string, label: string): SalesQuotationBindingCommand | null {
      const current = readCurrent();
      if (!current || pin !== current.offer.pin || !current.offer.fields.includes(path)) return null;
      const { document, body } = current.capture;
      try { return prepare(current, appendField(document, body, path, label)); }
      catch { return null; }
    },
    prepareTable(choice: ScopedTableChoice): SalesQuotationBindingCommand | null {
      const current = readCurrent();
      if (!current) return null;
      const { document, body } = current.capture;
      try {
        const source = admitTableChoice(current.offer.table, choice);
        return source ? prepare(current, appendSalesQuotationTable(document, body.id, source.columnPaths, current.descriptor)) : null;
      } catch { return null; }
    },
    prepareTableHeaders(pin: string, values: readonly { id: string; label: string }[]): SalesQuotationBindingCommand | null {
      const current = readCurrent();
      const offer = current?.offer.tableHeaders;
      const table = current?.capture.table;
      if (!current || !offer || !table || current.offer.pin !== pin || values.length !== offer.columns.length) return null;
      if (values.some((value, index) => value.id !== offer.columns[index].id || typeof value.label !== "string" ||
        value.label.length > TEMPLATE_LIMITS.maxTextCharsPerNode)) return null;
      if (values.every((value, index) => value.label === offer.columns[index].label)) return null;
      const columns = (table.props as unknown as DynamicTableNodeV1["props"]).columns.map((column, index) =>
        values[index].label === offer.columns[index].label ? column :
          { ...column, header: { kind: "TEXT", value: values[index].label } });
      return prepare(current, updateEditorNode(current.capture.document, table.id, { props: { ...table.props, columns } }));
    },
  };
}

export function appendSalesQuotationTable(document: EditorDocument, bodyId: string, columnPaths: readonly string[],
  descriptor: Pick<DataDescriptor, "fields">): EditorDocument | null {
  return appendFlowBodyTable(document, bodyId, lineSourcePath, lineRowKeyPath, columnPaths,
    path => quotationColumnFormat(descriptor, path));
}

function quotationColumnFormat(descriptor: Pick<DataDescriptor, "fields">, path: string): TemplateValueFormatV1 | undefined {
  const column = descriptor.fields.find(field => field.path === lineItemPrefix + path);
  if (column?.dataType === "DECIMAL" && column.allowedFormats.includes("NUMBER")) {
    return { type: "NUMBER", maximumFractionDigits: column.valueEncoding === "DECIMAL_STRING_24_8" ? 8 : 6 };
  }
  if (column?.dataType === "NUMBER" && column.allowedFormats.includes("NUMBER")) return { type: "NUMBER" };
  if (column?.dataType === "CURRENCY" && column.allowedFormats.includes("CURRENCY")) {
    const currency = descriptor.fields.find(field => field.path === "quotation.currencyCode" &&
      field.dataType === "STRING" && field.valueEncoding === "ISO_4217_UPPER" && !field.nullable && !field.parentNullable);
    if (currency) return { type: "CURRENCY", currencyCodePath: currency.path };
  }
}

function quotationTableFlowBody(document: EditorDocument, table: EditorNode): EditorNode | undefined {
  const parent = table.parentId ? document.nodes[table.parentId] : undefined;
  if (!parent?.childIds.includes(table.id)) return;
  const directBody = flowBodyDestination(document, parent.id);
  if (directBody) return directBody;
  if (parent.type !== "container" || parent.props.semanticRole !== "SECTION" ||
      parent.layout.kind !== "FLOW" || parent.locked || parent.hidden || !parent.parentId) return;
  const body = flowBodyDestination(document, parent.parentId);
  return body?.childIds.includes(parent.id) ? body : undefined;
}

function readTableHeaders(table: EditorNode, paths: readonly string[]): SalesQuotationTableHeaders | null {
  const { columns, sourcePath, rowKeyPath } = table.props as unknown as DynamicTableNodeV1["props"];
  if (sourcePath !== lineSourcePath || rowKeyPath !== lineRowKeyPath) return null;
  const headers = columns.flatMap(({ id, header, value }) => header.kind === "TEXT" && value?.kind === "BINDING" &&
    paths.includes(value.binding.path) ? [Object.freeze({ id, path: value.binding.path, label: header.value })] : []);
  return headers.length === columns.length ? Object.freeze({ tableId: table.id, columns: Object.freeze(headers) }) : null;
}

function appendField(document: EditorDocument, body: EditorNode, path: string, label: string): EditorDocument {
  const id = generateUUIDv7();
  const order = Math.max(-1, ...body.childIds.map(childId => Number(document.nodes[childId].layout.order))) + 1;
  const field: EditorNode = {
    id, type: "dataField", parentId: body.id, childIds: [], locked: false, hidden: false,
    layout: { kind: "FLOW", order }, style: {}, props: { label, labelPosition: "BEFORE", separator: ": " },
    binding: { path, nullBehavior: "EMPTY" },
  };
  return { ...document, nodes: { ...document.nodes, [body.id]: { ...body, childIds: [...body.childIds, id] }, [id]: field } };
}
