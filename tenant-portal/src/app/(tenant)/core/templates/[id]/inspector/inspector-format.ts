import type { TemplateDataSchema } from "../../template-design-api";
import { inspectorRecord } from "./inspector-contract";

export const inspectorFormatTypes = ["TEXT", "NUMBER", "CURRENCY", "PERCENTAGE", "DATE", "DATETIME", "BOOLEAN"] as const;
export type InspectorFormatType = (typeof inspectorFormatTypes)[number];
export function inspectorAllowedFormats(path: string, fields: TemplateDataSchema["fields"]): InspectorFormatType[] {
  const registered = fields.find(field => field.path === path)?.allowedFormats ?? [];
  return inspectorFormatTypes.filter(type => registered.includes(type));
}
export function inspectorFormatDefault(type: InspectorFormatType): Record<string, unknown> {
  if (type === "DATE") return { type, dateStyle: "MEDIUM" };
  if (type === "DATETIME") return { type, dateStyle: "MEDIUM", timeStyle: "SHORT" };
  if (type === "BOOLEAN") return { type, trueText: "", falseText: "" };
  return { type };
}
export function changeInspectorFormat(binding: unknown, type: string, fields: TemplateDataSchema["fields"]): Record<string, unknown> | null {
  const current = inspectorRecord(binding);
  if (type === "INHERIT") return { ...current, format: undefined };
  const allowed = inspectorAllowedFormats(String(current.path), fields);
  if (!allowed.includes(type as InspectorFormatType)) return null;
  return { ...current, format: inspectorFormatDefault(type as InspectorFormatType) };
}
