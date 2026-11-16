import type { EditorDocument } from "../../template-editor-model";
import type { DesignerDocumentSnapshot } from "../../designer-command-store";

// Structural projection of template-schema/src/types.ts; native admission remains authoritative.
export interface InlineBinding extends Record<string, unknown> { path: string; nullBehavior: "EMPTY" | "FALLBACK" | "ERROR" }
export type SafeLink = { source: "LITERAL"; href: string; target: "SAME_WINDOW" | "NEW_WINDOW" } |
  { source: "BINDING"; binding: InlineBinding; target: "SAME_WINDOW" | "NEW_WINDOW" };
export type RichMark = { type: "bold" | "italic" | "underline" } | { type: "link"; attrs: SafeLink };
export type RichInline = { type: "text"; text: string; marks?: RichMark[] } |
  { type: "variable"; attrs: { binding: InlineBinding }; marks?: RichMark[] } | { type: "hardBreak" };
export type Alignment = "START" | "CENTER" | "END" | "JUSTIFY";
export interface RichParagraph { type: "paragraph"; attrs?: { textAlign?: Alignment }; content?: RichInline[] }
/** Proposed template-owned semantic extension; current native schema refuses it until owner adoption. */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export interface RichHeading { type: "heading"; attrs: { level: HeadingLevel; textAlign?: Alignment }; content?: RichInline[] }
export type RichTextBlock = RichParagraph | RichHeading;
export type RichBlock = RichTextBlock | { type: "bulletList" | "orderedList"; content: { type: "listItem"; content: [RichParagraph] }[] };
export interface RichDocument { type: "doc"; content: RichBlock[] }
export interface ParagraphAddress { block: number; item?: number }
export interface RunAddress extends ParagraphAddress { run: number }
export interface RichBridge {
  read(): DesignerDocumentSnapshot;
  context(): { readonly key: string; readonly canRead: boolean };
  canEdit(): boolean;
  selection(): readonly string[];
  execute(document: EditorDocument): boolean;
}
export interface RichNative {
  validateTemplateDocumentModel(value: unknown): { readonly valid: boolean; readonly document?: EditorDocument };
}
export interface RichSession { owner: string; generation: number; nodeId: string; original: RichDocument; content: RichDocument }
export interface BindingChoice { key: string; label: string; binding: InlineBinding }
export type RichResult = "applied" | "unchanged" | "blocked" | "stale" | "invalid";
export function richClone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
