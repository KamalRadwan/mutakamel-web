"use client";
import { Button, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useInitialCommercialEntry, useInitialCommercialWorkspace, type InitialCommercialWorkspaceProps } from "./hooks/useInitialCommercialWorkspace";
import { InitialCommercialSelection } from "./InitialCommercialSelection";
import { InitialCommercialQuote, InitialCommercialReceipt } from "./InitialCommercialQuote";
import { InitialCreateOptions } from "./InitialCreateOptions";

/** Reviewed initial selections and immutable seed receipt for the canonical owner. */
export function InitialCommercialWorkspace(props: InitialCommercialWorkspaceProps) {
  const { initial, copy, sessionKey } = useInitialCommercialEntry(props);
  if (!initial) return <p role="alert">{copy.invalid}</p>;
  return <InitialCommercialSession key={sessionKey} context={props.context} initialTerms={initial} onSeeded={props.onSeeded} />;
}

function InitialCommercialSession(props: InitialCommercialWorkspaceProps) {
  const { context } = props;
  const { state, terms, copy, dir, errorRef, errorMessage, invalidTrial, invalidFields, setTerms, restore, setCycle, setTrial } = useInitialCommercialWorkspace(props);
  return <section dir={dir} className="min-w-0 space-y-4 rounded-lg border border-border bg-card p-4" aria-busy={state.quoting || state.seeding}>
    <h2 className="text-sm font-semibold">{context.purpose === "TENANT_CREATION" ? copy.creation : copy.seed}</h2>
    <p className="text-sm text-muted-foreground">{copy.boundary}</p>
    {!state.canQuote && <p role="alert" className="text-sm text-warning-subtle-foreground">{copy.forbidden}</p>}
    {state.error && <div ref={errorRef} role="alert" tabIndex={-1} className="rounded-md border border-destructive bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <p>{copy.failure}</p><p>{errorMessage}</p><p className="break-all font-mono text-xs" dir="ltr">{state.error.errorCode} {state.error.correlationId}</p>
      {state.error.errorCode === "INITIAL_SELECTION_INVALID" && <ul className="list-disc ps-5">{invalidFields.map(field => <li key={field.id}><a className="underline" href={`#${field.id}`}>{field.label}</a></li>)}</ul>}</div>}
    <fieldset disabled={state.locked || !state.canQuote} className="grid gap-3 sm:grid-cols-2">
      <Field label={copy.cycle}>{field => <Select value={terms.billingCycle} onValueChange={setCycle}>
        <SelectTrigger {...field}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MONTHLY">{copy.monthly}</SelectItem><SelectItem value="ANNUAL">{copy.annual}</SelectItem></SelectContent>
      </Select>}</Field>
      <Field id="initial-trial-days" label={copy.trial} hint={copy.trialDefault} error={invalidTrial ? copy.invalidTrial : undefined}>{field =>
        <Input {...field} type="number" min={1} max={365} step={1} value={terms.trialDays ?? ""} onChange={event => setTrial(event.target.value)} />}</Field>
    </fieldset>
    <InitialCreateOptions scope={JSON.stringify(context)} terms={terms} onChange={setTerms} locked={state.locked || !state.canQuote} maxApplications={context.purpose === "TENANT_CREATION" ? 50 : 100} copy={copy} />
    <InitialCommercialSelection value={terms} onChange={setTerms} locked={state.locked || !state.canQuote} copy={copy} />
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={state.locked || !state.canQuote} onClick={restore}>{copy.restore}</Button>
      <Button type="button" disabled={!state.canQuote || state.locked || !state.journalReady || state.quoting} loading={state.quoting} onClick={() => void state.requestQuote()}>{copy.quote}</Button></div>
    {state.quoting && <p role="status" className="text-sm">{copy.quoting}</p>}
    {state.quote ? <InitialCommercialQuote quote={state.quote} expired={state.quoteIsExpired} copy={copy} /> : <p className="text-sm text-muted-foreground">{copy.noQuote}</p>}
    {context.purpose === "TENANT_CREATION" && state.creationFields && <p role="status" className="text-sm">{copy.creationReady}</p>}
    {context.purpose === "INITIAL_SEED" && <>
      {!state.canSeed && <p role="alert" className="text-sm text-warning-subtle-foreground">{copy.seedForbidden}</p>}
      {state.currentSubscription && <p role="status" className="text-sm">{copy.initialExists}</p>}
      {state.pending && !state.seeding && <div role="status" className="space-y-2 rounded-md border border-warning bg-warning-subtle p-3 text-sm"><p>{copy.pending}</p>
        <p className="break-all font-mono text-xs" dir="ltr">{state.pending.resource.id} · {state.pending.idempotencyKey}</p>
        {state.canRetry ? <Button type="button" variant="outline" loading={state.seeding} onClick={() => void state.retrySeed()}>{copy.retry}</Button> : <p>{copy.recovered}</p>}</div>}
      <Button type="button" disabled={!state.canSeed || state.locked || state.currentSubscription || !state.quote || state.quoteIsExpired} loading={state.seeding} onClick={() => void state.seed()}>{copy.submit}</Button>
      {state.seeding && <p role="status" className="text-sm">{copy.submitting}</p>}
      {state.receipt && <InitialCommercialReceipt receipt={state.receipt} copy={copy} />}
    </>}
  </section>;
}
