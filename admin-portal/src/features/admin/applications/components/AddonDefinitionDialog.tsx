"use client";
import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input, Select,
  SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/design-system";
import { useAddonDefinitionDialog, type AddonDialogOptions } from "../hooks/useAddonDefinitionDialog";
import { addonActionLabel } from "../lib/addon-presentation";

export function AddonDefinitionDialog(props: AddonDialogOptions) {
  const { errorRef, ...form } = useAddonDefinitionDialog(props);
  const { copy, action, mutation } = props;
  const metadata = action === "CREATE" || action === "UPDATE";
  const multiline = (key: "tierIds" | "featureIds" | "bindings" | "dependencies", label: string, hint: string) => (
    <Field id={`addon-${key}`} label={label} hideLabel hint={hint} error={form.errors[key]}>{field => <Textarea {...field} dir="ltr" rows={2}
      placeholder={label} value={form.fields[key]} onChange={event => form.setField(key, event.target.value)} className="font-mono text-xs" />}</Field>
  );
  return <Dialog open onOpenChange={open => { if (!open && !mutation.isSubmitting) props.onClose(); }}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto p-3 sm:p-3.5" showCloseButton={!mutation.isSubmitting}
      onOpenAutoFocus={form.captureReturnFocus} onCloseAutoFocus={form.restoreReturnFocus}>
      <DialogHeader><DialogTitle className="text-base font-semibold">{addonActionLabel(action, copy)}</DialogTitle><DialogDescription className="text-xs">
        {action === "PUBLISH" ? copy.publishWarning : metadata ? copy.pendingDraft : copy.lifecycleWarning}
      </DialogDescription></DialogHeader>
      {form.snapshot && <p className="mb-3 break-all text-xs text-muted-foreground"><bdi className="font-mono">{form.snapshot.key}</bdi> · {copy.catalogueRevision}: <bdi>{form.snapshot.catalogueRevision}</bdi>
        {form.snapshot.draft && <> · {copy.definitionRevision}: <bdi>{form.snapshot.draft.definitionRevision}</bdi></>}</p>}
      <form onSubmit={form.submit} noValidate className="space-y-3">
        {(Object.keys(form.errors).length > 0 || mutation.error) && <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-md border border-destructive bg-destructive-subtle p-2.5 text-xs text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <p className="font-semibold">{copy.invalid}</p><ul className="list-disc ps-4">{Object.entries(form.errors).map(([key, message]) => <li key={key}><a className="underline" href={`#addon-${key}`}>{message}</a></li>)}</ul>
          {mutation.error && <><p>{mutation.error.message}</p><p dir="ltr" className="break-all font-mono text-xs">{mutation.error.errorCode} {mutation.error.correlationId}</p></>}
        </div>}
        {mutation.pending && !mutation.isSubmitting && <p role="status" className="rounded-md border border-warning bg-warning-subtle p-2.5 text-xs text-warning-subtle-foreground">{mutation.canRetry ? copy.unknown : copy.recovered}</p>}
        <fieldset disabled={mutation.isSubmitting} className="space-y-3">
          {action === "CREATE" && <Field id="addon-key" label={copy.key} hideLabel hint={copy.keyInvalid} error={form.errors.key} required>{field =>
            <Input {...field} size="sm" dir="ltr" maxLength={65} placeholder={`${copy.key} *`} value={form.fields.key} onChange={event => form.setField("key", event.target.value)} />}</Field>}
          {metadata && <><Field id="addon-name" label={copy.name} hideLabel error={form.errors.name} required>{field => <Input {...field} size="sm" maxLength={128} placeholder={`${copy.name} *`} value={form.fields.name} onChange={event => form.setField("name", event.target.value)} />}</Field>
            <Field id="addon-description" label={copy.descriptionLabel} hideLabel error={form.errors.description}>{field => <Textarea {...field} maxLength={512} rows={2} placeholder={copy.descriptionLabel} value={form.fields.description} onChange={event => form.setField("description", event.target.value)} />}</Field></>}
          {action === "COMPATIBILITY_REPLACE" && <><Field label={copy.compatibility} hideLabel>{field => <Select value={form.fields.mode} onValueChange={value => form.setField("mode", value)}>
            <SelectTrigger {...field} size="sm"><SelectValue placeholder={copy.compatibility} /></SelectTrigger><SelectContent><SelectItem value="ALL_ACTIVE">{copy.allActive}</SelectItem><SelectItem value="ALLOWLIST">{copy.allowlist}</SelectItem></SelectContent>
          </Select>}</Field>{form.fields.mode === "ALLOWLIST" && <>
            {form.tiersLoading && <p role="status" className="text-xs text-muted-foreground">{copy.loadingTiers}</p>}
            {form.tiersError && <div role="alert" className="space-y-1.5 rounded-md border border-destructive bg-destructive-subtle p-2.5 text-xs text-destructive-subtle-foreground">
              <p>{copy.tiersFailed}</p><p>{form.tiersError.message}</p><p dir="ltr" className="break-all font-mono text-xs">{form.tiersError.errorCode} {form.tiersError.correlationId}</p>
              <Button type="button" variant="outline" size="sm" onClick={form.refreshTiers}>{copy.refreshTiers}</Button>
            </div>}
            {form.tiers && <fieldset id="addon-tierIds" tabIndex={-1} aria-describedby="addon-tierIds-hint" className="space-y-2 rounded-md border border-border p-2.5 outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <legend className="px-1 text-xs font-medium">{copy.parentTiers}</legend><p id="addon-tierIds-hint" className="text-xs text-muted-foreground">{copy.parentTiersHint}</p>
              {form.activeTiers.map(tier => <div key={tier.id} className="flex min-h-8 items-center gap-2.5">
                <Checkbox id={`addon-tier-${tier.id}`} checked={form.selectedTierIds.includes(tier.id)} onCheckedChange={checked => form.toggleTier(tier.id, checked === true)} />
                <label htmlFor={`addon-tier-${tier.id}`} className="min-w-0 cursor-pointer text-xs"><span className="block font-medium">{tier.name}</span><bdi className="break-all font-mono text-xs text-muted-foreground">{tier.key} · {tier.id}</bdi></label>
              </div>)}
              {form.activeTiers.length === 0 && <p role="status" className="text-xs text-muted-foreground">{copy.noActiveTiers}</p>}
              {form.unavailableTierIds.length > 0 && <div role="alert" className="space-y-1.5 rounded-md border border-warning bg-warning-subtle p-2.5 text-xs text-warning-subtle-foreground"><p>{copy.unavailableTiers}</p>
                {form.unavailableTierIds.map(id => <div key={id} className="flex min-h-8 items-center gap-2.5"><Checkbox id={`addon-tier-${id}`} checked onCheckedChange={checked => form.toggleTier(id, checked === true)} />
                  <label htmlFor={`addon-tier-${id}`} className="min-w-0 cursor-pointer"><span className="block text-xs">{form.tiers?.find(tier => tier.id === id)?.name ?? copy.unknownTier}</span><bdi className="break-all font-mono text-xs">{id}</bdi></label></div>)}
              </div>}
              {form.errors.tierIds && <p role="alert" className="text-xs text-destructive-subtle-foreground">{form.errors.tierIds}</p>}
            </fieldset>}
            {!form.tiers && !form.tiersLoading && <><p className="text-xs text-muted-foreground">{copy.manualTiers}</p>{multiline("tierIds", copy.tierIds, copy.linesHint)}</>}
          </>}</>}
          {action === "FEATURE_GRANTS_REPLACE" && multiline("featureIds", copy.featureIds, copy.linesHint)}
          {action === "COMPONENT_BINDINGS_REPLACE" && <>{multiline("bindings", copy.bindings, copy.bindingsHint)}{multiline("dependencies", copy.dependencies, copy.dependenciesHint)}</>}
          {action === "CONFIGURATION_SCHEMA_REPLACE" && <><p className="text-xs text-muted-foreground">{copy.referenceOnly}</p>
            {(["schemaOwner", "schemaKey", "schemaVersion", "checksum"] as const).map(key => <Field key={key} id={`addon-${key}`} label={copy[key]} hideLabel error={form.errors[key]} required>{field =>
              <Input {...field} size="sm" dir="ltr" placeholder={`${copy[key]} *`} value={form.fields[key]} onChange={event => form.setField(key, event.target.value)} />}</Field>)}</>}
          {!metadata && <Field id="addon-reason" label={copy.reason} hideLabel hint={copy.reasonHint} error={form.errors.reason} required>{field =>
            <Textarea {...field} rows={2} maxLength={256} placeholder={`${copy.reason} *`} value={form.fields.reason} onChange={event => form.setField("reason", event.target.value)} />}</Field>}
        </fieldset>
        <DialogFooter className="gap-2 pt-2"><Button size="sm" type="button" variant="outline" disabled={mutation.isSubmitting} onClick={props.onClose}>{copy.cancel}</Button>
          <Button size="sm" type="submit" disabled={form.tiersBlocked} loading={mutation.isSubmitting} variant={["DISABLE", "DELETE", "VERSION_REVOKE"].includes(action) ? "destructive" : "primary"}>{metadata ? copy.save : copy.confirm}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
