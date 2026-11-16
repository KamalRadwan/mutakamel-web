import type { DesignerCommandStore } from "../designer-command-store";
import type { EditorDocument } from "../template-editor-model";

/** Shapes from template-schema/src/types.ts; these are authoring ports, not Gateway DTOs. */
export type PageConfig = NonNullable<EditorDocument["page"]>;
export interface CanvasPage { id: string; name: string; page: PageConfig; rootNodeIds: string[] }
export type PageErrorCode = "unavailable" | "readOnly" | "busy" | "stale" | "invalid" | "locked" | "lastPage" | "recovery" | "layout" | "unsupported";
export class PageCommandError extends Error {
  constructor(readonly code: PageErrorCode) { super(code); }
}
export interface PageNative {
  validateTemplateDocumentModel(value: unknown): { readonly valid: boolean; readonly issues: readonly { readonly code: string; readonly message: string }[] };
  collectTemplateCopyIds(document: Readonly<EditorDocument>, nodeIds: readonly string[]): string[];
  remapTemplateDocumentNodes(document: Readonly<EditorDocument>, ids: Readonly<Record<string, string>>): EditorDocument;
  prepareTemplateGraphCommand(document: Readonly<EditorDocument>, command: {
    kind: "MOVE"; nodeIds: string[]; destinationParentId: string; deltaMm: { x: number; y: number };
  }): { readonly status: "VALIDATION_REQUIRED"; readonly candidate: EditorDocument };
}
export interface PageHost {
  readonly store: DesignerCommandStore;
  readonly native: PageNative | null;
  readonly validateBasicPageDocument?: PageNative["validateTemplateDocumentModel"];
  authorityKey(): string;
  canRead(): boolean;
  canEdit(): boolean;
  /** T05-owned synchronous assessment, including measured Flow zones and unsplittable overflow. */
  assessLayout?(base: Readonly<EditorDocument>, candidate: Readonly<EditorDocument>): boolean;
}
export interface PageView {
  readonly key: string;
  readonly name: string;
  readonly page: PageConfig | null;
  readonly rootNodeIds: readonly string[];
  readonly nodeIds?: readonly string[];
}
export interface PageSnapshot {
  readonly document: EditorDocument | null;
  readonly pages: readonly PageView[];
  readonly activeKey: string | null;
  readonly activeIndex: number;
  readonly selectedId: string | null;
  readonly basicSetupOnly: boolean;
  readonly editable: boolean;
  readonly blocked: PageErrorCode | null;
  readonly printBounds: boolean;
  readonly rulers: boolean;
  readonly error: PageErrorCode | null;
}
export interface RemovalReview {
  readonly pageId: string;
  readonly pageName: string;
  readonly contentCount: number;
  readonly base: EditorDocument;
  readonly authorityKey: string;
  readonly generation: number;
}
export function clonePageValue<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
export function explicitPages(document: EditorDocument): CanvasPage[] {
  if (document.layoutMode !== "FIXED_CANVAS") throw new PageCommandError("unsupported");
  if (!Array.isArray(document.canvasPages)) throw new PageCommandError("recovery");
  return document.canvasPages as CanvasPage[];
}
export function pageTree(document: EditorDocument, ids: readonly string[]): Set<string> {
  const result = new Set<string>();
  const visit = (id: string) => {
    if (result.has(id) || !document.nodes[id]) throw new PageCommandError("invalid");
    result.add(id); document.nodes[id].childIds.forEach(visit);
  };
  ids.forEach(visit); return result;
}
export function requireUnlocked(document: EditorDocument, ids: Iterable<string>): void {
  for (const id of ids) {
    let node = document.nodes[id];
    while (node) {
      if (node.locked) throw new PageCommandError("locked");
      if (!node.parentId) break;
      node = document.nodes[node.parentId];
    }
  }
}
