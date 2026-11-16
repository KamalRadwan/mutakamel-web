import type { ComponentType } from "react";
import type { EditorNode } from "../../template-editor-model";
import type { TemplateDataSchema } from "../../template-design-api";
import type { InspectorBridge, InspectorNative, InspectorResult } from "./inspector-contract";

/** Supplied by the qualified owner-descriptor provider, never fabricated from the field projection. */
export interface InspectorValidationContext {
  readonly ownerKey: string;
  readonly dataSourceKey: string;
  readonly descriptorChecksum: string;
  readonly ready: boolean;
}
/** Same structural fields as the native browser-safe TEMPLATE_FONT_CATALOGUE_V1 entry. */
export interface InspectorFontMetadata {
  readonly fontToken: "SYSTEM_SANS" | "ARABIC_SANS" | "SYSTEM_SERIF";
  readonly cssFamilyToken: string;
  readonly fontBuildId: string;
  readonly installedFileChecksum: string;
  readonly mimeType: "font/ttf";
}
export interface InspectorLocalState { readonly ownerKey: string; readonly nodeId: string; readonly dirty: boolean; readonly stale: boolean; readonly disabled: boolean }
/** Structural functions from T06's actual reader/projector; host qualifies native public-entry adoption. */
export interface InspectorImageCropPort {
  contentFrame(node: Readonly<EditorNode>, sourceHref: string): { readonly width: number; readonly height: number } | null;
  computeImageCropPlacement(source: { width: number; height: number }, frame: { width: number; height: number }, fit: "COVER" | "CONTAIN", focal?: { focalX: number; focalY: number }): {
    readonly image: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
    readonly visibleSource: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  };
}
/** Optional T20-owned lifecycle; the existing DS Dialog remains the only focus trap. */
export interface InspectorDialogLifecycle {
  readonly onOpenAutoFocus?: (event: Event) => void;
  readonly onCloseAutoFocus?: (event: Event) => void;
  readonly onEscapeKeyDown?: (event: KeyboardEvent) => void;
}
export interface InspectorExtensionPorts {
  /** T14 owns its own content session; mount outside the property form to avoid nested forms. */
  readonly RichTextEditor?: ComponentType<{ bridge: InspectorBridge; native: InspectorNative; node: EditorNode; disabled: boolean }>;
  /** T15 returns a field/picker, whose result is staged in the inspector's atomic property command. */
  readonly BindingPicker?: ComponentType<{ value: unknown; fields: TemplateDataSchema["fields"]; onValue: (value: Record<string, unknown>) => void; disabled: boolean }>;
  readonly CellValuePicker?: ComponentType<{ value: unknown; fields: TemplateDataSchema["fields"]; onValue: (value: Record<string, unknown>) => void; disabled: boolean }>;
  /** T20 owns shared feedback/focus; no second focus trap or imperative focus manager is installed. */
  readonly Feedback?: ComponentType<{ result: InspectorResult | "structuralRefused"; dirty: boolean; stale: boolean; disabled: boolean }>;
}

export function inspectorAdmissionCurrent(bridge: InspectorBridge, validation?: InspectorValidationContext): boolean {
  const context = bridge.context(), document = bridge.read().document;
  return !!validation?.ready && !!validation.descriptorChecksum && context.canRead && validation.ownerKey === context.key && document?.dataSourceKey === validation.dataSourceKey;
}
export function bindInspectorAdmission(bridge: InspectorBridge, validation?: InspectorValidationContext): InspectorBridge {
  return { ...bridge, canEdit: () => inspectorAdmissionCurrent(bridge, validation) && bridge.canEdit(),
    execute: document => inspectorAdmissionCurrent(bridge, validation) && bridge.canEdit() && bridge.execute(document) };
}
