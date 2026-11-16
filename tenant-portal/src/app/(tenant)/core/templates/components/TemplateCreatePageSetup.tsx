"use client";
import { Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { TEMPLATE_PAGE_PRESETS, TEMPLATE_PAGE_ORIENTATIONS, resolveTemplateCreatePage, templateCreatePageCopy, type TemplateCreatePageValues } from "../template-create-page";

const measurementPrecision = { maximumSignificantDigits: 12 };

export function TemplateCreatePageSetup({ values, onChange, disabled, outputChannel }: {
  values: TemplateCreatePageValues; onChange: (patch: Partial<TemplateCreatePageValues>) => void; disabled: boolean; outputChannel: string;
}) {
  const { lang } = useI18n(); const copy = templateCreatePageCopy[lang];
  if (outputChannel !== "PRINT") return null;
  const printableArea = resolveTemplateCreatePage(values)?.printableArea;
  const margins = ["top", "end", "bottom", "start"] as const;
  return <div className="grid gap-3 sm:grid-cols-2">
    <Field label={copy.pagePreset} required><Select value={values.preset} onValueChange={value => {
      const preset = TEMPLATE_PAGE_PRESETS.find(preset => preset === value); if (preset) onChange({ preset });
    }} disabled={disabled}><SelectTrigger size="sm" aria-label={copy.pagePreset}><SelectValue /></SelectTrigger>
      <SelectContent>{TEMPLATE_PAGE_PRESETS.map(preset => <SelectItem key={preset} value={preset}>{copy[preset]}</SelectItem>)}</SelectContent></Select></Field>
    <Field label={copy.pageOrientation} required><Select value={values.orientation} onValueChange={value => {
      const orientation = TEMPLATE_PAGE_ORIENTATIONS.find(orientation => orientation === value); if (orientation) onChange({ orientation });
    }} disabled={disabled}><SelectTrigger size="sm" aria-label={copy.pageOrientation}><SelectValue /></SelectTrigger>
      <SelectContent>{TEMPLATE_PAGE_ORIENTATIONS.map(orientation => <SelectItem key={orientation} value={orientation}>{copy[orientation]}</SelectItem>)}</SelectContent></Select></Field>
    {values.preset === "CUSTOM" ? <>
      <Field label={copy.pageWidth} required><Input size="sm" dir="ltr" inputMode="decimal" value={values.widthMm} disabled={disabled} onChange={event => onChange({ widthMm: event.target.value })} /></Field>
      <Field label={copy.pageHeight} required><Input size="sm" dir="ltr" inputMode="decimal" value={values.heightMm} disabled={disabled} onChange={event => onChange({ heightMm: event.target.value })} /></Field>
    </> : null}
    {margins.map(side => <Field key={side} label={copy[side]} required><Input size="sm" dir="ltr" inputMode="decimal" value={values[side]} disabled={disabled} onChange={event => onChange({ [side]: event.target.value })} /></Field>)}
    <div className="sm:col-span-2">
      <p role="status" aria-atomic="true" className="text-sm text-muted-foreground">
        {printableArea ? <>
          {copy.printableArea}{" "}
          <bdi dir="ltr" className="font-medium text-foreground">
            {formatNumber(printableArea.widthMm, lang, measurementPrecision)} ×{" "}
            {formatNumber(printableArea.heightMm, lang, { ...measurementPrecision, style: "unit", unit: "millimeter" })}
          </bdi>
        </> : null}
      </p>
      {!printableArea ? <p role="alert" className="text-sm text-negative">{copy.pageInvalid}</p> : null}
    </div>
  </div>;
}
