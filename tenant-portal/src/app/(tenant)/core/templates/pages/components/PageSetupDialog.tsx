"use client";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import type { EditorDocument } from "../../template-editor-model";
import type { PageController } from "../page-controller";
import { guardPageCallback, type PageTextInterlock } from "../page-text-interlock";
import { explicitPages, type PageConfig } from "../page-contract";
import { pageNumberLocales, type PageCopy } from "../page-copy";
import { usePageSetup } from "../hooks/usePageSetup";
import { PageGeometryPreview } from "./PageGeometryPreview";

interface PageSetupDialogProps {
  controller: PageController; interlock: PageTextInterlock; textActive: boolean; base: EditorDocument; pageId?: string;
  copy: PageCopy; locale: "ar-EG" | "en-US"; close: () => void; basicSetupOnly: boolean;
}
export function PageSetupDialog({ base, pageId, ...props }: PageSetupDialogProps) {
  const initial = pageId ? explicitPages(base).find(page => page.id === pageId)?.page : base.page;
  if (!initial) return null;
  return <PageSetupForm {...props} base={base} pageId={pageId} initial={initial} />;
}
function PageSetupForm({ controller, base, pageId, initial, copy, locale, close, interlock, textActive, basicSetupOnly }: PageSetupDialogProps & { initial: PageConfig }) {
  const { editable, page, preview, numeric: numericValue, changeNumber, invalid, summary, apply, format, body, commandError, originalAsset, backgroundKind, changeBackground, changeColor, changeFit, backgroundColor, assetId, assetFit, assetOpacity } = usePageSetup(controller, base, initial, pageId, close, basicSetupOnly);
  const number = new Intl.NumberFormat(pageNumberLocales[locale], { maximumFractionDigits: 2 });
  const numeric = (key: string, label: string, value: number, min: number, max: number, disabled = false) => <Field key={key} label={label} showLabel error={invalid.includes(key) ? copy.invalidNumber : undefined}>
    <Input type="number" min={min} max={max} step="any" disabled={disabled} value={numericValue(key, value)} onChange={guardPageCallback(interlock, event => changeNumber(key, event.target.value))} />
  </Field>;
  return <Dialog open onOpenChange={guardPageCallback(interlock, open => { if (!open) close(); })}><DialogContent showCloseButton={!textActive} size="2xl" className="max-h-[90dvh] overflow-y-auto">
    <DialogTitle>{copy.setup}</DialogTitle><DialogDescription>{copy.bleed}</DialogDescription>
    <fieldset disabled={textActive || !editable} className="min-w-0 space-y-3">
    {invalid.length > 0 && <div ref={summary} role="alert" tabIndex={-1} className="text-sm text-destructive">{copy.invalidNumber}</div>}
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={copy.format} showLabel><Select value={page.preset} onValueChange={guardPageCallback(interlock, value => format(value as "A4" | "A5" | "LETTER" | "CUSTOM", page.orientation as "PORTRAIT" | "LANDSCAPE"))}>
        <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["A4", "A5", "LETTER", "CUSTOM"].map(preset => <SelectItem key={preset} value={preset}>{preset === "CUSTOM" ? copy.custom : preset === "LETTER" ? copy.letter : preset}</SelectItem>)}</SelectContent>
      </Select></Field>
      <Field label={copy.orientation} showLabel><Select value={page.orientation} onValueChange={guardPageCallback(interlock, value => format(page.preset as "A4" | "A5" | "LETTER" | "CUSTOM", value as "PORTRAIT" | "LANDSCAPE"))}>
        <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PORTRAIT">{copy.portrait}</SelectItem><SelectItem value="LANDSCAPE">{copy.landscape}</SelectItem></SelectContent>
      </Select></Field>
      {numeric("width", copy.width, page.widthMm, 50, 500, page.preset !== "CUSTOM")}
      {numeric("height", copy.height, page.heightMm, 50, 1000, page.preset !== "CUSTOM")}
      {(["top", "end", "bottom", "start"] as const).map(edge => numeric(edge, copy[edge], page.marginMm[edge], 0, 100))}
      {!basicSetupOnly && <>
        <Field label={copy.background} showLabel><Select value={backgroundKind} onValueChange={guardPageCallback(interlock, changeBackground)}>
          <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">{copy.noBackground}</SelectItem><SelectItem value="SOLID">{copy.solid}</SelectItem>
            {originalAsset && <SelectItem value="ASSET">{copy.asset}</SelectItem>}
          </SelectContent></Select></Field>
        {backgroundKind === "SOLID" && <Field label={copy.backgroundColor} showLabel><Input type="color" value={backgroundColor} onChange={guardPageCallback(interlock, event => changeColor(event.target.value))} /></Field>}
        {backgroundKind === "ASSET" && <>
          <Field label={copy.assetId} showLabel readOnly><Input readOnly value={assetId} /></Field>
          <Field label={copy.fit} showLabel><Select value={assetFit} onValueChange={guardPageCallback(interlock, changeFit)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CONTAIN">{copy.contain}</SelectItem><SelectItem value="COVER">{copy.cover}</SelectItem></SelectContent></Select></Field>
          {numeric("opacity", copy.opacity, assetOpacity, 0, 1)}
        </>}
      </>}
    </div>
    <div role="status" className="rounded-lg border border-border bg-muted p-3 text-sm">
      {copy.safeArea}: {Number.isFinite(body.width) ? number.format(body.width) : "—"} × {Number.isFinite(body.height) ? number.format(body.height) : "—"}
    </div>
    <PageGeometryPreview page={preview} label={copy.safeArea} size={`${number.format(body.width)} × ${number.format(body.height)}`} />
    {commandError && <p role="alert" className="text-sm text-destructive">{copy[commandError]}</p>}
    </fieldset>
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={textActive} onClick={guardPageCallback(interlock, close)}>{copy.cancel}</Button><Button variant="secondary" disabled={textActive || !editable} onClick={guardPageCallback(interlock, apply)}>{copy.apply}</Button></div>
  </DialogContent></Dialog>;
}
