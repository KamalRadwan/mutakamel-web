"use client";
import { Button, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import type { InitialCommercialCopy } from "./initial-commercial-copy";
import type { InitialCommercialTerms } from "./initial-commercial-request";
import { useInitialCreateOptions } from "./hooks/useInitialCreateOptions";

export function InitialCreateOptions({ scope, terms, onChange, locked, maxApplications, copy }: {
  scope: string; terms: InitialCommercialTerms; onChange: (next: InitialCommercialTerms) => void;
  locked: boolean; maxApplications: number; copy: InitialCommercialCopy;
}) {
  const { errorRef, ...state } = useInitialCreateOptions(scope, terms, onChange, locked, maxApplications);
  return <section aria-label={copy.options} aria-busy={state.loading} className="min-w-0 space-y-3 rounded-md border border-border p-3">
    <h3 className="text-sm font-semibold">{copy.options}</h3><p className="text-xs text-muted-foreground">{copy.optionsBoundary}</p>
    {!state.permitted ? <p className="text-xs text-muted-foreground">{copy.optionsForbidden}</p> :
      <Button type="button" variant="outline" disabled={locked || state.loading} loading={state.loading} onClick={() => void state.load()}>{copy.loadOptions}</Button>}
    {state.loading && <p role="status" className="text-sm">{copy.loadingOptions}</p>}
    {state.error && <div ref={errorRef} tabIndex={-1} role="alert" className="space-y-1 rounded-md border border-destructive p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <p>{copy.failure}</p><p>{state.error.message}</p><p className="break-all font-mono text-xs" dir="ltr">{state.error.errorCode} {state.error.correlationId}</p></div>}
    {state.value?.applications.length === 0 && <p role="status" className="text-sm">{copy.optionsEmpty}</p>}
    {state.value?.applications.map(application => {
      const selected = terms.applications.find(item => item.applicationId === application.applicationId);
      const diagnostics = [...application.selectionBlockers, ...application.readinessReasons, ...application.catalogueReasons];
      const tierId = selected?.tierId ?? state.tiers[application.applicationId] ?? "";
      return <section key={application.applicationId} className="min-w-0 space-y-3 rounded-md border border-border p-3">
        <h4 className="break-words text-sm font-medium">{application.name}</h4>
        {application.description !== null && <p className="break-words text-xs text-muted-foreground">{application.description}</p>}
        <p className="break-all font-mono text-xs" dir="ltr">{application.key} · {application.applicationId}</p>
        {!!diagnostics.length && <Diagnostics values={diagnostics} copy={copy} />}
        <Field label={`${copy.tier} — ${application.name}`}>{field => <Select value={tierId} disabled={!state.canEdit || Boolean(selected)} onValueChange={id => state.chooseTier(application.applicationId, id)}>
          <SelectTrigger {...field}><SelectValue placeholder={copy.chooseTier} /></SelectTrigger><SelectContent>{application.tiers.map(tier => <SelectItem key={tier.id} value={tier.id}>{tier.name}</SelectItem>)}</SelectContent>
        </Select>}</Field>
        {selected ? <p className="text-xs text-muted-foreground">{copy.changeTier}</p> : <Button type="button" variant="outline" size="sm"
          disabled={!state.canEdit || !tierId || !!diagnostics.length || terms.applications.length >= maxApplications} onClick={() => state.addApplication(application.applicationId)}>{copy.addApplication}</Button>}
        {application.addons.map(addon => {
          const chosen = selected?.addons.some(item => item.addonId === addon.addonId);
          const compatible = Boolean(selected && addon.compatibleTierIds.includes(selected.tierId));
          return <section key={addon.addonId} className="min-w-0 space-y-2 border-s-2 border-border ps-3">
            <h5 className="break-words text-sm font-medium">{addon.name}</h5>
            {addon.description !== null && <p className="break-words text-xs text-muted-foreground">{addon.description}</p>}
            <p className="break-all font-mono text-xs" dir="ltr">{addon.key} · {addon.definitionVersionId}</p>
            {!!addon.catalogueReasons.length && <Diagnostics values={addon.catalogueReasons} copy={copy} />}
            {!compatible && <p className="text-xs text-muted-foreground">{copy.incompatible}</p>}
            {chosen ? <p className="text-xs">{copy.selected}</p> : <Button type="button" variant="outline" size="sm"
              disabled={!state.canEdit || !compatible || !!diagnostics.length || !!addon.catalogueReasons.length || terms.applications.flatMap(item => item.addons).length >= 100}
              onClick={() => state.addAddon(application.applicationId, addon.addonId)}>{copy.addAddon}</Button>}
          </section>;
        })}
      </section>;
    })}
  </section>;
}
function Diagnostics({ values, copy }: { values: readonly string[]; copy: InitialCommercialCopy }) {
  return <div className="text-xs text-warning-subtle-foreground"><p>{copy.blocked}</p><ul className="list-disc space-y-1 ps-5">{values.map(value =>
    <li key={value} className="break-all font-mono"><bdi>{value}</bdi></li>)}</ul></div>;
}
