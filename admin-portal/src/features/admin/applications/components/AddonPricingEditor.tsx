"use client";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/design-system";
import { useAddonPricingEditor, type AddonPricingOptions } from "../hooks/useAddonPricingEditor";

export function AddonPricingEditor(props: AddonPricingOptions) {
  const { errorRef, ...form } = useAddonPricingEditor(props);
  const { copy, mutation, canMutate } = props;
  const locked = form.locked;
  return <form onSubmit={form.submit} noValidate aria-busy={mutation.isSubmitting} className="space-y-4">
    <p className="text-sm text-muted-foreground">{copy.priceHint}</p>
    <div className="flex flex-wrap items-end gap-4"><Field label={copy.cycle} className="w-48">{field => <Select value={form.cycle} onValueChange={form.setCycle} disabled={mutation.isSubmitting}>
      <SelectTrigger {...field}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MONTHLY">{copy.monthly}</SelectItem><SelectItem value="ANNUAL">{copy.annual}</SelectItem></SelectContent>
    </Select>}</Field><div className="space-y-1"><Badge tone={form.ladder.configured ? "success" : "warn"}>{form.ladder.configured ? copy.configured : copy.unconfigured}</Badge>
      <p className="text-xs text-muted-foreground">{copy.priceRevision}: <bdi className="font-mono">{form.ladder.revision}</bdi></p></div></div>
    {props.readCurrent === false && <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm">{copy.priceReadRequired}</p>}
    {form.stale && <div role="status" className="space-y-2 rounded-md border border-warning bg-warning-subtle p-3 text-sm text-warning-subtle-foreground">
      <p>{copy.priceHeadChanged} <bdi className="font-mono">{form.ladder.revision} → {form.head.revision}</bdi></p>
      {canMutate && <Button type="button" variant="outline" size="sm" disabled={props.readCurrent === false || mutation.isSubmitting || Boolean(mutation.pending)} onClick={form.loadLatest}>{copy.loadLatestCycle}</Button>}
    </div>}
    {(Object.keys(form.errors).length > 0 || mutation.error) && <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-md border border-destructive bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <p>{copy.invalid}</p><ul className="list-disc ps-5">{Object.entries(form.errors).map(([key, message]) => <li key={key}><a className="underline" href={`#addon-price-${key}`}>{message}</a></li>)}</ul>
      {mutation.error && <><p>{mutation.error.message}</p><p className="break-all font-mono text-xs" dir="ltr">{mutation.error.errorCode} {mutation.error.correlationId}</p></>}
    </div>}
    <fieldset disabled={locked} id="addon-price-brackets" tabIndex={-1} aria-describedby={form.errors.brackets ? "addon-price-brackets-error" : undefined} className="space-y-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <legend className="sr-only">{copy.pricing}</legend>
      {form.rows.map((row, index) => <div key={index} className="grid grid-cols-[1fr_1fr_1.5fr_auto] items-end gap-2 rounded-md border border-border p-3 max-sm:grid-cols-2">
        <div><p className="mb-2 text-xs font-medium text-muted-foreground">{copy.min}</p><p className="flex min-h-10 items-center font-mono text-sm" dir="ltr">{index === 0 ? "1" : String(Number(form.rows[index - 1].maxUsers) + 1)}</p></div>
        <Field id={`addon-price-max-${index}`} label={copy.max}>{field => index === form.rows.length - 1
          ? <p className="flex min-h-10 items-center text-sm text-muted-foreground">{copy.openEnded}</p>
          : <Input {...field} dir="ltr" inputMode="numeric" value={row.maxUsers} onChange={event => form.changeRow(index, "maxUsers", event.target.value)} />}</Field>
        <Field id={`addon-price-unit-${index}`} label={copy.price} required>{field => <Input {...field} dir="ltr" inputMode="decimal" maxLength={19} value={row.unitPrice}
          onChange={event => form.changeRow(index, "unitPrice", event.target.value)} aria-invalid={Boolean(form.errors.brackets)} />}</Field>
        <Button type="button" variant="ghost" size="sm" aria-label={`${copy.removeBracket} ${index + 1}`} disabled={form.rows.length === 1} onClick={() => form.removeRow(index)}><Trash2 className="size-4" aria-hidden="true" /></Button>
      </div>)}
      {form.errors.brackets && <p id="addon-price-brackets-error" className="text-sm text-destructive-subtle-foreground">{form.errors.brackets}</p>}
      {canMutate && <Button type="button" variant="outline" size="sm" disabled={form.rows.length >= 100} onClick={form.addRow}><Plus className="size-4" aria-hidden="true" />{copy.addBracket}</Button>}
    </fieldset>
    {canMutate && <><Field id="addon-price-reason" label={copy.reason} hint={copy.reasonHint} required error={form.errors.reason}>{field => <Textarea {...field} rows={2} maxLength={256}
      disabled={locked} value={form.reason} onChange={event => form.setReason(event.target.value)} />}</Field>
      <Button type="submit" disabled={locked} loading={mutation.isSubmitting}>{copy.savePrices}</Button></>}
    <p className="text-xs text-muted-foreground">{copy.quoteUnavailable}</p>
  </form>;
}
