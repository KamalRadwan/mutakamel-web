import type { DataDescriptor } from "./[id]/bindings/binding-contract";
import { dataFields } from "./[id]/bindings/binding-catalogue";
import type { BindingChoice } from "./[id]/rich-text/rich-text-contract";
import type { EditorNode } from "./template-editor-model";
import type { TemplateDataSchema } from "./template-design-api";

/** Narrow the complete owner object; never construct a replacement validation schema. */
export function designerBindingDescriptor(value: unknown): DataDescriptor | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const descriptor = value as Record<string, unknown>;
  if (typeof descriptor.key !== "string" || descriptor.version !== 1 || typeof descriptor.checksum !== "string" ||
    typeof descriptor.documentType !== "string" || !Array.isArray(descriptor.allowedOutputChannels) ||
    !Array.isArray(descriptor.allowedLayoutModes) || !Array.isArray(descriptor.fields) || !descriptor.fields.every(field =>
      field && typeof field === "object" && typeof field.path === "string" && typeof field.labelKey === "string" &&
      typeof field.dataType === "string" && typeof field.nullable === "boolean" && typeof field.sensitive === "boolean" &&
      typeof field.previewAllowed === "boolean" && Array.isArray(field.allowedFormats))) return null;
  return value as DataDescriptor;
}
export function designerInlineBindings(descriptor: DataDescriptor): BindingChoice[] {
  return dataFields(descriptor).map(({ path }) => ({ key: path, label: path, binding: { path, nullBehavior: "EMPTY" } }));
}
/** Display-only filtering; native admission always receives the untouched full descriptor. */
export function designerBindingPickerScope(descriptor: DataDescriptor, fields: TemplateDataSchema["fields"], node?: EditorNode) {
  const allowed = new Set(fields.map(field => field.path));
  const source = node?.type === "dynamicTable" && typeof node.props.sourcePath === "string" ? node.props.sourcePath : undefined;
  const root = descriptor.fields.filter(field => allowed.has(field.path));
  const row = source ? descriptor.fields.filter(field => field.path.startsWith(`${source}[].`) && allowed.has(field.path.slice(source.length + 3))) : [];
  const rowSourcePath = !root.length && row.length ? source : undefined;
  return { descriptor: { ...descriptor, fields: rowSourcePath ? row : root }, rowSourcePath };
}
