"use client";
import { Button, Field, Input } from "@/design-system";
import { isInitialSeatQuantity, type InitialCommercialTerms } from "./initial-commercial-request";
import type { InitialCommercialCopy } from "./initial-commercial-copy";
import { useInitialCommercialSelection } from "./hooks/useInitialCommercialSelection";

/** Local selected terms only; server options and quote evidence have separate owners. */
export function InitialCommercialSelection({ value, onChange, locked, copy }: {
  value: InitialCommercialTerms; onChange: (next: InitialCommercialTerms) => void; locked: boolean; copy: InitialCommercialCopy;
}) {
  const actions = useInitialCommercialSelection(value, onChange, locked);
  return <fieldset id="initial-selected-terms" tabIndex={-1} disabled={locked} className="min-w-0 space-y-3">
    <legend className="sr-only">{copy.application}</legend>
    <p className="text-xs text-muted-foreground">{copy.selectedOnly}</p>
    {value.applications.map(application => <section key={application.selectionKey} className="min-w-0 space-y-3 rounded-md border border-border p-3">
      <p className="break-all text-xs">{copy.application}: <bdi className="font-mono">{application.applicationId}</bdi></p>
      <p className="break-all text-xs text-muted-foreground">{copy.tier}: <bdi className="font-mono">{application.tierId}</bdi></p>
      <Field id={`initial-${application.selectionKey}`} label={copy.baseSeats} required error={isInitialSeatQuantity(application.seats) ? undefined : copy.invalidSeats}>{field =>
        <Input {...field} type="number" min={1} max={100000} step={1} value={Number.isFinite(application.seats) ? application.seats : ""}
          onChange={event => actions.setBaseSeats(application.selectionKey, event.target.value)} />}</Field>
      {application.addons.map(addon => <section key={addon.selectionKey} className="min-w-0 space-y-2 rounded-md border border-border bg-muted p-3">
        <p className="break-all text-xs">{copy.addon}: <bdi className="font-mono">{addon.addonId}</bdi></p>
        <p className="break-all text-xs text-muted-foreground">{copy.definition}: <bdi className="font-mono">{addon.definitionVersionId}</bdi></p>
        <Field id={`initial-${addon.selectionKey}`} label={copy.addonSeats} required error={isInitialSeatQuantity(addon.seats, application.seats) ? undefined : copy.invalidSeats}>{field =>
          <Input {...field} type="number" min={1} max={application.seats} step={1} value={Number.isFinite(addon.seats) ? addon.seats : ""}
            onChange={event => actions.setAddonSeats(application.selectionKey, addon.selectionKey, event.target.value)} />}</Field>
        <Button type="button" variant="outline" size="sm" onClick={() => actions.removeAddon(application.selectionKey, addon.selectionKey)}>{copy.removeAddon}</Button>
      </section>)}
      <Button type="button" variant="outline" size="sm" onClick={() => actions.removeApplication(application.selectionKey)}>{copy.removeApplication}</Button>
    </section>)}
    {!value.applications.length && <p role="alert" className="text-xs text-destructive">{copy.invalid}</p>}
  </fieldset>;
}
