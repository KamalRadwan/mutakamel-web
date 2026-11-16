"use client";
import { Button } from "@/design-system";
import type { InspectorCopy } from "@/i18n/dictionaries/template-inspector";
import { InspectorCheck, InspectorNumber, InspectorSelect, InspectorText } from "./InspectorFields";
import { inspectorRecord } from "./inspector-contract";
import type { InspectorForm } from "./useInspectorForm";
import { InspectorFontPicker } from "./InspectorFontPicker";

export function InspectorAppearance({ form, copy: c }: { form: InspectorForm; copy: InspectorCopy }) {
  const node = form.draft!.node, style = node.style, border = inspectorRecord(style.border), padding = inspectorRecord(style.padding);
  const typography = !["image", "divider", "spacer", "pageBreak"].includes(node.type);
  return <>
    <InspectorText label={c.name} maxLength={120} value={node.name} onValue={form.name} />
    <InspectorSelect label={c.direction} value={form.draft!.direction} options={(["AUTO", "RTL", "LTR"] as const).map(value => ({ value, label: c[value] }))} onValue={form.direction} />
    {typography && <fieldset className="space-y-3 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-medium">{c.typography}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InspectorFontPicker value={style.fontFamilyToken} inherited={form.theme.fontFamilyToken} onValue={form.style("fontFamilyToken")} copy={c} />
        <InspectorNumber label={c.size} value={style.fontSizePx ?? form.theme.baseFontSizePx} min={8} max={96} onValue={form.style("fontSizePx")} />
        <InspectorSelect label={c.weight} value={style.fontWeight ?? "NORMAL"} options={[{ value: "NORMAL", label: c.normal }, { value: "MEDIUM", label: c.medium }, { value: "SEMIBOLD", label: c.semibold }, { value: "BOLD", label: c.bold }]} onValue={form.style("fontWeight")} />
        <InspectorSelect label={c.align} value={style.textAlign ?? "START"} options={(["START", "CENTER", "END", "JUSTIFY"] as const).map(value => ({ value, label: c[value] }))} onValue={form.style("textAlign")} />
        <InspectorNumber label={c.lineHeight} value={style.lineHeight ?? form.theme.lineHeight} min={1} max={2.5} onValue={form.style("lineHeight")} />
        <InspectorNumber label={c.spacing} value={style.letterSpacingPx ?? 0} min={-2} max={10} onValue={form.style("letterSpacingPx")} />
      </div>
      <InspectorSelect label={c.italic} value={style.fontStyle ?? "NORMAL"} options={[{ value: "NORMAL", label: c.normal }, { value: "ITALIC", label: c.italic }]} onValue={form.style("fontStyle")} />
      <InspectorCheck label={c.underline} value={style.textDecoration === "UNDERLINE"} onValue={value => form.style("textDecoration")(value ? "UNDERLINE" : "NONE")} />
    </fieldset>}
    <fieldset className="space-y-3 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-medium">{c.appearance}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {typography && <InspectorText label={c.color} value={style.color ?? ""} onValue={form.style("color")} />}
        <InspectorText label={c.backgroundColor} value={style.backgroundColor ?? ""} onValue={form.style("backgroundColor")} />
        <InspectorNumber label={c.opacity} value={style.opacity ?? 1} min={0} max={1} onValue={form.style("opacity")} />
        <InspectorNumber label={c.borderWidth} value={border.widthPx ?? 0} min={0} max={12} onValue={form.nestedStyle("border", "widthPx")} />
        <InspectorSelect label={c.border} value={border.style ?? "NONE"} options={(["NONE", "SOLID", "DASHED", "DOTTED"] as const).map(value => ({ value, label: c[value] }))} onValue={form.nestedStyle("border", "style")} />
        <InspectorText label={c.borderColor} value={border.color ?? "#000000"} onValue={form.nestedStyle("border", "color")} />
      </div>
      <p className="text-xs text-muted-foreground">{c.padding}</p>
      <InspectorSelect label={c.paddingUnit} value={padding.unit ?? "PX"} options={(["PX", "MM"] as const).map(value => ({ value, label: c[value] }))} onValue={form.nestedStyle("padding", "unit")} />
      <div className="grid grid-cols-2 gap-3">{(["blockStart", "inlineEnd", "blockEnd", "inlineStart"] as const).map(key => <InspectorNumber key={key} label={c[key]} value={padding[key] ?? 0} min={0} max={200} onValue={form.nestedStyle("padding", key)} />)}</div>
      <Button type="button" variant="outline" size="sm" onClick={form.resetStyle}>{c.resetStyle}</Button>
    </fieldset>
  </>;
}
