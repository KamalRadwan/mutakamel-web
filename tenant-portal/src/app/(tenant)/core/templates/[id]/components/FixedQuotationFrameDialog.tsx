"use client";

import { TEMPLATE_LIMITS } from "@mutakamel/template-schema/browser-safe";
import { useState, type FormEvent } from "react";
import { Button, Dialog, DialogDescription, DialogTitle, DialogTrigger, Field, Input } from "@/design-system";
import { TemplateDialogContent } from "../../feedback/TemplateDialogContent";
import type { useFixedQuotationPosition } from "../hooks/useFixedQuotationPosition";
import type { useTemplateDesignEditor } from "../hooks/useTemplateDesignEditor";

type Position = ReturnType<typeof useFixedQuotationPosition>;
type GeometryCopy = ReturnType<typeof useTemplateDesignEditor>["t"]["quotationPdf"]["designer"]["geometry"];

const fields = [
  { key: "x", label: "parentLeft", min: 0, max: TEMPLATE_LIMITS.pageMaxWidthMm },
  { key: "y", label: "parentTop", min: 0, max: TEMPLATE_LIMITS.pageMaxHeightMm },
  { key: "width", label: "width", min: 0.001, max: TEMPLATE_LIMITS.pageMaxWidthMm },
  { key: "height", label: "height", min: 0.001, max: TEMPLATE_LIMITS.pageMaxHeightMm },
  { key: "rotationDeg", label: "rotationDeg", min: -180, max: 180 },
] as const;

export function FixedQuotationFrameDialog({ position, copy, disabled = false }: { position: Position; copy: GeometryCopy; disabled?: boolean }) {
  const [target, setTarget] = useState<ReturnType<Position["readFrame"]>>(null);
  const [rejected, setRejected] = useState(false);
  const stale = !!target && (!position.frameAvailable || !position.isFrameCurrent(target));
  if (!position.frameAvailable && !target) return null;

  const change = (open: boolean) => {
    setRejected(false);
    setTarget(open ? position.readFrame() : null);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!target || stale) return;
    const data = new FormData(event.currentTarget);
    const read = (key: string) => {
      const value = data.get(key);
      return typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
    };
    const frame = { x: read("x"), y: read("y"), width: read("width"), height: read("height"), rotationDeg: read("rotationDeg") };
    if (fields.every(({ key }) => frame[key] === target.frame[key]) || position.applyFrame(target, frame)) change(false);
    else setRejected(true);
  };

  return <Dialog open={target !== null} onOpenChange={change}>
    <DialogTrigger asChild>
      <Button type="button" variant="outline" size="sm" disabled={disabled || !position.frameAvailable}>{copy.sizePosition}</Button>
    </DialogTrigger>
    <TemplateDialogContent>
      <DialogTitle>{copy.sizePosition}</DialogTitle>
      <DialogDescription>{copy.parentFrameHelp}</DialogDescription>
      {target && <form className="space-y-3" onSubmit={submit} onChange={() => setRejected(false)}>
        <fieldset className="grid gap-3 sm:grid-cols-2" disabled={stale}>
          {fields.map(({ key, label, min, max }) => <Field key={key} label={copy[label]} showLabel>
            <Input type="number" name={key} dir="ltr" min={min} max={max} step="any" defaultValue={target.frame[key]} required />
          </Field>)}
        </fieldset>
        {(stale || rejected) && <p role="alert" className="text-sm text-destructive">{stale ? copy.frameStale : copy.refused}</p>}
        <Button type="submit" size="sm" disabled={stale}>{copy.apply}</Button>
      </form>}
    </TemplateDialogContent>
  </Dialog>;
}
