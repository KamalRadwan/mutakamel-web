"use client";
import type { InspectorCopy } from "@/i18n/dictionaries/template-inspector";
import { InspectorNumber, InspectorText } from "./InspectorFields";
import { inspectorRecord } from "./inspector-contract";
import { InspectorFontPicker } from "./InspectorFontPicker";

export function InspectorCellStyle({ value, onValue, label, copy: c }: { value: unknown; onValue: (value: Record<string, unknown>) => void; label: string; copy: InspectorCopy }) {
  const style = inspectorRecord(value);
  return <fieldset className="space-y-3 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-medium">{label}</legend>
    <InspectorFontPicker value={style.fontFamilyToken} onValue={value => onValue({ ...style, fontFamilyToken: value === "INHERIT" ? undefined : value })} copy={c} />
    <InspectorNumber label={c.size} value={style.fontSizePx ?? 12} min={8} max={48} step={1} onValue={fontSizePx => onValue({ ...style, fontSizePx })} />
    <InspectorText label={c.color} value={style.color} onValue={color => onValue({ ...style, color: color || undefined })} />
    <InspectorText label={c.backgroundColor} value={style.backgroundColor} onValue={backgroundColor => onValue({ ...style, backgroundColor: backgroundColor || undefined })} />
  </fieldset>;
}
