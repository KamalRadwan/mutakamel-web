"use client";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from "@/design-system";
import type { EditorDocument } from "../../template-editor-model";
import type { PageController } from "../page-controller";
import { guardPageCallback, type PageTextInterlock } from "../page-text-interlock";
import { pageNumberLocales, type PageCopy } from "../page-copy";
import { useZoneSetup } from "../hooks/useZoneSetup";

export function ZoneDialog({ controller, base, copy, locale, close, interlock, textActive }: {
  controller: PageController; interlock: PageTextInterlock; textActive: boolean; base: EditorDocument; copy: PageCopy; locale: "ar-EG" | "en-US"; close: () => void;
}) {
  const { editable, setup, heights, patch, height, invalid, summary, apply, bodyHeight, error } = useZoneSetup(controller, base, close);
  const number = new Intl.NumberFormat(pageNumberLocales[locale], { maximumFractionDigits: 2 });
  return <Dialog open onOpenChange={guardPageCallback(interlock, open => { if (!open) close(); })}><DialogContent showCloseButton={!textActive} size="2xl" className="max-h-[90dvh] overflow-y-auto">
    <DialogTitle>{copy.zones}</DialogTitle><DialogDescription>{copy.zoneHelp}</DialogDescription>
    <fieldset disabled={textActive || !editable} className="min-w-0 space-y-3">
    {invalid.length > 0 && <div ref={summary} role="alert" tabIndex={-1} className="text-sm text-destructive">{copy.invalidNumber}</div>}
    <div className="grid gap-4 sm:grid-cols-2">
      {(["header", "footer"] as const).map(type => <fieldset key={type} className="space-y-3 rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-medium">{copy[type]}</legend>
        <Field label={copy.enabled} showLabel><Switch checked={setup[type].enabled} onCheckedChange={guardPageCallback(interlock, enabled => patch(type, { enabled }))} /></Field>
        <Field label={copy.zoneHeight} showLabel error={invalid.includes(type) ? copy.invalidNumber : undefined}>
          <Input type="number" min={1} max={80} step="any" value={heights[type]} disabled={!setup[type].enabled} onChange={guardPageCallback(interlock, event => height(type, event.target.value))} />
        </Field>
        <Field label={copy.zoneMode} showLabel><Select value={setup[type].zoneMode} disabled={!setup[type].enabled} onValueChange={guardPageCallback(interlock, value => patch(type, { zoneMode: value as "FIXED" | "FLOW" }))}>
          <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FLOW">{copy.flow}</SelectItem>
            <SelectItem value="FIXED">{copy.fixed}</SelectItem>
          </SelectContent></Select></Field>
        <Field label={copy.repeat} showLabel><Select value={setup[type].repeat} disabled={!setup[type].enabled} onValueChange={guardPageCallback(interlock, value => patch(type, { repeat: value as "EVERY_PAGE" | "FIRST_PAGE" | "LAST_PAGE" }))}>
          <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EVERY_PAGE">{copy.every}</SelectItem>
            {type === "header" ? <SelectItem value="FIRST_PAGE">{copy.first}</SelectItem> : <SelectItem value="LAST_PAGE">{copy.last}</SelectItem>}
          </SelectContent></Select></Field>
      </fieldset>)}
    </div>
    <p role="status" className="text-sm">{copy.safeArea}: {Number.isFinite(bodyHeight) ? number.format(bodyHeight) : "—"}</p>
    {error && <p role="alert" className="text-sm text-destructive">{copy[error]}</p>}
    </fieldset>
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={textActive} onClick={guardPageCallback(interlock, close)}>{copy.cancel}</Button><Button variant="secondary" disabled={textActive || !editable} onClick={guardPageCallback(interlock, apply)}>{copy.apply}</Button></div>
  </DialogContent></Dialog>;
}
