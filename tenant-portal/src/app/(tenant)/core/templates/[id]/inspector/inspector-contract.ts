import type { EditorDocument, EditorNode } from "../../template-editor-model";
import type { DesignerDocumentSnapshot } from "../../designer-command-store";

/** Structural subset of UI04's canonical interaction bridge. */
export interface InspectorBridge {
  read(): DesignerDocumentSnapshot;
  context(): { readonly key: string; readonly canRead: boolean };
  canEdit(): boolean;
  selection(): readonly string[];
  select(ids: readonly string[]): boolean;
  execute(document: EditorDocument): boolean;
}
export interface InspectorNative {
  validateTemplateDocumentModel(value: unknown): { readonly valid: boolean; readonly document?: EditorDocument; readonly issues: readonly { readonly code: string; readonly message: string; readonly nodeId?: string }[] };
}
/** T01 owns geometry, graph commands, layers and their admission rules. */
export interface InspectorArrangement {
  resizeNumeric(frame: { x: number; y: number; width: number; height: number; rotationDeg: number }, aspect?: boolean): boolean;
  group(): boolean;
  ungroup(): boolean;
  layer(delta: -1 | 1): boolean;
  flags(flags: { locked?: boolean; hidden?: boolean }): boolean;
}
export interface InspectorDraft {
  readonly contextKey: string;
  readonly generation: number;
  readonly original: EditorNode;
  readonly originalDirection: string;
  node: EditorNode;
  direction: string;
}
export type InspectorResult = "applied" | "unchanged" | "stale" | "blocked" | "invalid";

export function inspectorClone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
export function inspectorRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function inspectorRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(inspectorRecord) : [];
}
