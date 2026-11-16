import type { EditorDocument, EditorNode } from "../../template-editor-model";
import type { DesignerDocumentSnapshot } from "../../designer-command-store";

export type DataValue = Record<string, unknown>;
export interface DataField {
  path: string; labelKey: string; dataType: string; nullable: boolean; parentNullable?: boolean;
  sensitive: boolean; previewAllowed: boolean; allowedFormats: string[]; valueEncoding?: string;
  dimension?: { kind: string; currencyPath?: string; unitPath?: string };
}
export interface DataDescriptor extends DataValue {
  key: string; version: 1; checksum: string; documentType: string;
  allowedOutputChannels: readonly string[]; allowedLayoutModes: readonly string[]; fields: DataField[];
}
export interface FunctionVersion {
  id: string; functionId: string; versionNumber: number; contentChecksum: string;
  scope: { scopeType: "TENANT" } | { scopeType: "COMPANY"; companyId: string };
  definition: DataValue & { parameters: readonly { name: string }[] };
}
export interface DataAuthority {
  key: string; tenantId: string; companyId: string | null; canRead: boolean; readOnly: boolean;
}
export interface DataBridge {
  read(): DesignerDocumentSnapshot;
  context(): DataAuthority;
  canEdit(): boolean;
  selection(): readonly string[];
  execute(document: EditorDocument): boolean;
  /** Run the caller's scope check after validation, at the terminal store dispatch. */
  executeScoped?(document: EditorDocument, isCurrent: () => boolean): boolean;
  subscribe(listener: () => void): () => void;
}
/** Inject the qualified browser-safe native package; no duplicate parser/evaluator. */
export interface DataNative {
  validateDescriptorModel(value: unknown): void;
  parseTemplateFormulaExpression(value: unknown): DataValue;
  inferTemplateFormulaType(value: unknown, context: DataValue): { type: string; dimension: string; nullable: boolean };
  validateTemplateDocumentModel(value: unknown, options: DataValue): { valid: boolean; document?: unknown };
}
/** These are owner-supplied authorized results, never user-authored registry entries. */
export interface DataCatalogue {
  authorityKey: string; tenantId: string; companyId: string | null;
  descriptor: unknown; versions: readonly FunctionVersion[];
  identityAuthority?: { currency(code: string): boolean; unit(code: string): boolean };
}
export interface DataDraft {
  context: DataAuthority; generation: number; cataloguePin: string;
  original: EditorNode; node: EditorNode;
  visibilityEdited: boolean;
}
export type DataResult = "applied" | "unchanged" | "unavailable" | "blocked" | "stale" | "invalid";
export function dataRecord(value: unknown): DataValue {
  return value && typeof value === "object" && !Array.isArray(value) ? value as DataValue : {};
}
export function dataClone<T>(value: T): T { return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T; }
