import type { EditorDocument } from "./template-editor-model";
import type { DesignerDocumentSnapshot } from "./designer-command-store";

export type Matrix = readonly [number, number, number, number, number, number];
export interface Point { readonly x: number; readonly y: number }
export interface Frame { x: number; y: number; width: number; height: number; rotationDeg: number; zIndex: number }
export interface NativeGeometry { readonly matrix: Matrix; readonly pageOrigin: Point; readonly pageKey: string; readonly zoneKey: string; readonly width: number; readonly height: number; readonly ancestors: readonly { matrix: Matrix; width: number; height: number }[] }
export type GraphCommand =
  | { kind: "TRANSFORM"; changes: { nodeId: string; frame: Frame }[] }
  | { kind: "RESIZE"; nodeId: string; width: number; height: number }
  | { kind: "MOVE"; nodeIds: string[]; destinationParentId: string; deltaMm: Point }
  | { kind: "COPY"; nodeIds: string[]; destinationParentId: string; deltaMm: Point; idMap: Record<string, string> }
  | { kind: "GROUP"; nodeIds: string[]; groupId: string }
  | { kind: "UNGROUP"; groupId: string };

/** Structural ports for the real browser-safe SC03 exports, never a replacement geometry engine. */
export interface DesignerNativeGeometry {
  validateTemplateDocumentModel(value: unknown): { readonly valid: boolean; readonly document?: EditorDocument; readonly issues: readonly { readonly code: string; readonly message: string; readonly nodeId?: string }[] };
  prepareTemplateGraphCommand(document: Readonly<EditorDocument>, command: GraphCommand): { readonly status: "VALIDATION_REQUIRED"; readonly candidate: EditorDocument };
  resolveTemplateTextDirection(direction: "AUTO" | "LTR" | "RTL", locale: string): "LTR" | "RTL";
  collectTemplateCopyIds(document: Readonly<EditorDocument>, nodeIds: readonly string[]): string[];
  remapTemplateDocumentNodes(document: Readonly<EditorDocument>, idMap: Readonly<Record<string, string>>): EditorDocument;
  projectTemplateGeometry(document: Readonly<EditorDocument>): ReadonlyMap<string, NativeGeometry>;
  multiplyTemplateMatrices(parent: Matrix, local: Matrix): Matrix;
  invertTemplateMatrix(matrix: Matrix): Matrix;
  transformTemplatePoint(matrix: Matrix, point: Point): Point;
  templateFrameMatrix(frame: Frame & { kind: "ABSOLUTE"; unit: "MM" }): Matrix;
  templateFrameCorners(matrix: Matrix, width: number, height: number): readonly Point[];
  templateFrameFromMatrix(matrix: Matrix, frame: Frame & { kind: "ABSOLUTE"; unit: "MM" }): Frame & { kind: "ABSOLUTE"; unit: "MM" };
  translateTemplateMatrix(x: number, y: number): Matrix;
  scaleTemplateMatrix(x: number, y: number): Matrix;
}
export interface DesignerInteractionBridge {
  read(): DesignerDocumentSnapshot;
  context(): { readonly key: string; readonly canRead: boolean };
  canEdit(): boolean;
  selection(): readonly string[];
  select(ids: readonly string[]): boolean;
  execute(document: EditorDocument): boolean;
  begin(): number | null;
  update(token: number, document: EditorDocument): boolean;
  commit(token: number): void;
  cancel(token: number): void;
}
export interface ViewportMapping {
  readonly clientLeft: number; readonly clientTop: number; readonly clientWidth: number;
  readonly inlineOffsetPx: number; readonly blockOffsetPx: number;
  readonly scrollLeft: number; readonly scrollTop: number;
  readonly panX: number; readonly panY: number; readonly zoom: number;
  readonly pageWidthMm: number; readonly direction: "LTR" | "RTL"; readonly pageKey: string;
}
export interface SnapGuide { readonly axis: "x" | "y"; readonly valueMm: number; readonly pageKey: string }
export type GestureKind = { kind: "move" } | { kind: "resize"; handle: readonly [-1 | 0 | 1, -1 | 0 | 1]; aspect: boolean } | { kind: "rotate" };
export interface InteractionSnapshot { readonly selectedIds: readonly string[]; readonly guides: readonly SnapGuide[]; readonly active: boolean; readonly error: string | null; readonly repairAvailable: boolean }
