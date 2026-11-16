"use client";

import { TEMPLATE_LIMITS } from "@mutakamel/template-schema/browser-safe";
import { useState, type FormEvent } from "react";
import { Button, Dialog, DialogDescription, DialogTitle, DialogTrigger, Field, Textarea } from "@/design-system";
import { TemplateDialogContent } from "../../feedback/TemplateDialogContent";
import type { useSalesQuotationOriginBinding } from "../hooks/useSalesQuotationOriginBinding";
import { useInspectorCopy } from "../inspector/useInspectorForm";

type Binding = ReturnType<typeof useSalesQuotationOriginBinding>;
type HeaderOffer = NonNullable<Binding["offer"]>;

export function QuotationTableHeadersDialog({ binding }: { binding: Binding }) {
  const copy = useInspectorCopy();
  const [target, setTarget] = useState<HeaderOffer | null>(null);
  const [rejected, setRejected] = useState(false);
  const [changed, setChanged] = useState(false);
  const offer = binding.offer?.tableHeaders ? binding.offer : null;
  const headers = target?.tableHeaders;
  const stale = target !== null && offer !== target;
  if (!offer && !target) return null;

  const change = (open: boolean) => {
    setTarget(open ? offer : null);
    setRejected(false);
    setChanged(false);
  };
  const readLabels = (form: HTMLFormElement) => {
    const data = new FormData(form);
    return headers?.columns.map(column => {
      const value = String(data.get(column.id) ?? "");
      return { id: column.id, label: value === column.label.replace(/\r\n?/gu, "\n") ? column.label : value };
    }) ?? [];
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!target || stale || !changed) return;
    if (binding.updateTableHeaders(target.pin, readLabels(event.currentTarget))) change(false);
    else setRejected(true);
  };

  return <Dialog open={target !== null} onOpenChange={change}>
    <DialogTrigger asChild><Button type="button" variant="outline" size="sm" disabled={!offer}>
      {copy.editQuotationTableHeaders}
    </Button></DialogTrigger>
    <TemplateDialogContent>
      <DialogTitle>{copy.editQuotationTableHeaders}</DialogTitle>
      <DialogDescription>{copy.columns}</DialogDescription>
      {headers && <form className="space-y-3" onSubmit={submit}
        onChange={event => setChanged(readLabels(event.currentTarget).some((value, index) => value.label !== headers.columns[index].label))}>
        <fieldset className="grid gap-3 sm:grid-cols-2" disabled={stale}>
          {headers.columns.map(column => <Field key={column.id} label={column.path} showLabel>
            <Textarea name={column.id} defaultValue={column.label} dir="auto" rows={2} maxLength={TEMPLATE_LIMITS.maxTextCharsPerNode} />
          </Field>)}
        </fieldset>
        {(stale || rejected) && <p role="alert" className="text-sm text-destructive">{stale ? copy.stale : copy.invalid}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={stale || !changed}>{copy.apply}</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => change(false)}>{copy.reset}</Button>
        </div>
      </form>}
    </TemplateDialogContent>
  </Dialog>;
}
