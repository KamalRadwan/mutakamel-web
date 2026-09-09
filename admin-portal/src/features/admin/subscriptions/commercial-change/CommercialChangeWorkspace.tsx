"use client";
import { Button, Card, Checkbox, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/design-system";
import { useCommercialChangeSessionKey, useCommercialChangeWorkspace, type CommercialChangeWorkspaceProps } from "./hooks/useCommercialChangeWorkspace";
import { CommercialOperationEvidence, CommercialPreviewEvidence, CommercialReceiptEvidence } from "./CommercialChangeEvidence";
import { commercialWorkspaceCopy } from "./commercial-workspace-copy";
import { commercialChangeCopy } from "./commercial-change-copy";

export function CommercialChangeWorkspace(props: CommercialChangeWorkspaceProps) {
  const sessionKey = useCommercialChangeSessionKey(props.source);
  return <CommercialChangeSession key={sessionKey} {...props} />;
}

function CommercialChangeSession(props: CommercialChangeWorkspaceProps) {
  const state = useCommercialChangeWorkspace(props);
  const { errorRef } = state;
  const copy = commercialWorkspaceCopy(props.lang);
  const evidenceCopy = commercialChangeCopy(props.lang);
  const locked = state.draftLocked || !state.canPrepare;
  const catalogue = state.catalogue;
  return <section className="min-w-0 space-y-4" dir={props.lang === "ar" ? "rtl" : "ltr"} aria-busy={state.busy || undefined}>
    <Card className="space-y-4 p-4">
      <div><h3 className="text-sm font-semibold">{copy.title}</h3><p className="mt-1 text-sm text-muted-foreground">{copy.intro}</p></div>
      {state.error && <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-md bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <p>{state.error.message}</p><p className="break-all font-mono text-xs"><bdi>{state.error.errorCode} {state.error.correlationId}</bdi></p>
      </div>}
      {!state.canPrepare && <p className="text-sm text-muted-foreground">{copy.forbidden}</p>}
      {!state.lifecycleAllowsChange && <p role="status" className="text-sm text-muted-foreground">{copy.lifecycleUnavailable}</p>}
      {state.sourceChanged && <p role="status" className="rounded-md bg-warning-subtle p-3 text-sm text-warning-subtle-foreground">{copy.changed}</p>}
      {!state.journal.request && <fieldset disabled={locked} className="space-y-3">
        {state.targets.map(item => <div key={item.selectionKey} className="space-y-3 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-medium"><bdi>{item.name}</bdi></h4>
            <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={locked || catalogue.loading || !state.canReadCatalogue} onClick={() => state.chooseApplication({ id: item.applicationId, key: item.key })}>{copy.editCatalogue}</Button>
              <Button type="button" variant="outline" disabled={locked} onClick={() => state.updateTarget(item.selectionKey, { removed: !item.removed })}>{item.removed ? copy.restore : copy.remove}</Button></div></div>
          <p className="text-xs text-muted-foreground">{copy.tier}: <bdi>{item.tierName}</bdi>{item.removed && ` · ${copy.remove}`}</p>
          {!item.removed && <Field id={`commercial-seats-${item.selectionKey}`} label={copy.seats} error={!Number.isInteger(item.seats) || item.seats < 1 || item.seats > 100000 ? copy.invalid : undefined}>{field =>
            <Input {...field} type="number" min={1} max={100000} step={1} value={Number.isNaN(item.seats) ? "" : item.seats} onChange={event => state.updateTarget(item.selectionKey, { seats: event.target.value === "" ? NaN : Number(event.target.value) })} />}</Field>}
          {item.addons.map(addon => <div key={addon.selectionKey} className="space-y-2 border-s-2 border-border ps-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm"><bdi>{addon.name}</bdi></p><Button type="button" variant="outline" disabled={locked || item.removed}
              onClick={() => state.updateTarget(item.selectionKey, { addons: item.addons.map(row => row.selectionKey === addon.selectionKey ? { ...row, removed: !row.removed } : row) })}>{addon.removed ? copy.restore : copy.remove}</Button></div>
            {item.removed || addon.removed ? <p className="text-xs text-muted-foreground">{copy.remove}</p> : <Field id={`commercial-seats-${addon.selectionKey}`} label={copy.seats}
              error={!Number.isInteger(addon.seats) || addon.seats < 1 || addon.seats > item.seats ? copy.invalid : undefined}>{field => <Input {...field} type="number" min={1} max={item.seats} step={1}
                value={Number.isNaN(addon.seats) ? "" : addon.seats} onChange={event => state.updateTarget(item.selectionKey, { addons: item.addons.map(row => row.selectionKey === addon.selectionKey ? { ...row, seats: event.target.value === "" ? NaN : Number(event.target.value) } : row) })} />}</Field>}
          </div>)}
        </div>)}
        {!state.canReadCatalogue && <p className="text-sm text-muted-foreground">{copy.cataloguePermission}</p>}
        {state.canReadCatalogue && <div className="space-y-3 rounded-md bg-muted p-3">
          {state.canReadApplications && <><Button type="button" variant="outline" disabled={locked || catalogue.loading || !catalogue.moreApplications} onClick={() => void catalogue.loadApplications()}>{catalogue.applications.length ? copy.more : copy.addApplication}</Button>
            <div className="flex flex-wrap gap-2">{catalogue.applications.map(item => <Button key={item.id} type="button" variant="outline" disabled={locked || catalogue.loading} onClick={() => state.chooseApplication(item)}><bdi>{item.name}</bdi></Button>)}</div></>}
          {catalogue.error && <p role="alert" className="text-sm text-destructive-subtle-foreground">{catalogue.error.message}</p>}
          {catalogue.selected && <><p className="text-sm font-medium"><bdi>{catalogue.selected.key}</bdi></p>
            <Field label={copy.tier}>{field => <Select value={state.selectedTier} onValueChange={state.setSelectedTier} disabled={locked || catalogue.loading}>
              <SelectTrigger {...field}><SelectValue placeholder={copy.choose} /></SelectTrigger><SelectContent>{catalogue.tiers.map(tier => <SelectItem key={tier.id} value={tier.id}>{tier.name}</SelectItem>)}</SelectContent></Select>}</Field>
            <Button type="button" variant="outline" disabled={locked || catalogue.loading || !catalogue.tiers.some(tier => tier.id === state.selectedTier)} onClick={state.useTier}>{copy.useTier}</Button>
            <div><Button type="button" variant="outline" disabled={locked || catalogue.loading || !catalogue.moreAddons} onClick={() => void catalogue.loadAddons()}>{catalogue.addons.length ? copy.more : copy.loadAddons}</Button></div>
            <div className="flex flex-wrap gap-2">{catalogue.addons.map(addon => <Button type="button" variant="outline" key={addon.id} disabled={locked || catalogue.loading} onClick={() => void catalogue.chooseAddon(addon.key)}>{addon.name}</Button>)}</div>
            {!catalogue.moreAddons && !catalogue.addons.length && <p className="text-sm text-muted-foreground">{copy.noOptions}</p>}
            {catalogue.detail && <div className="space-y-2"><p className="text-sm"><bdi>{catalogue.detail.name}</bdi></p>{!state.addonAvailable && <p className="text-sm text-muted-foreground">{copy.unavailableAddon}</p>}
              <Button type="button" variant="outline" disabled={locked || !state.addonAvailable} onClick={state.addAddon}>{copy.addAddon}</Button></div>}
          </>}
        </div>}
        <p className="text-xs text-muted-foreground">{copy.invalid}</p>
        <Button type="button" disabled={locked || !state.request || state.sourceChanged || !state.lifecycleAllowsChange} onClick={() => void state.prepare()}>{copy.prepare}</Button>
      </fieldset>}
      {state.journal.request && <div className="space-y-2"><h4 className="text-sm font-medium">{copy.retained}</h4><ol className="space-y-2 text-sm">{state.journal.request.changes.map(change => <li key={change.selectionKey}>
        {change.operation === "ADOPT_DEFINITION" ? evidenceCopy.definition : evidenceCopy[change.operation]} · <bdi>{state.labels[change.selectionKey] ?? evidenceCopy[change.sourceKind]}</bdi>{"seats" in change && ` · ${copy.seats}: ${change.seats}`}
        <details className="text-xs"><summary className="min-h-11 cursor-pointer py-3 focus-visible:ring-2 focus-visible:ring-ring">{copy.references}</summary>
          {Object.entries(change).filter(([key]) => key.endsWith("Id") || key.endsWith("Key")).map(([key, value]) => <p key={key} className="break-all font-mono"><bdi>{key}: {value}</bdi></p>)}
        </details>
      </li>)}</ol></div>}
      <p className="text-xs text-muted-foreground">{copy.limited}</p>
      {state.busy && <p role="status" className="text-sm">{copy.preparing}</p>}
      {state.journal.pending && <div role="status" className="space-y-3 rounded-md bg-warning-subtle p-3 text-sm text-warning-subtle-foreground"><p>{copy.pending}</p>
        <p className="break-all font-mono text-xs"><bdi>{state.journal.pending.key}</bdi></p>
        <Button type="button" variant="outline" disabled={state.busy || !state.canPrepare || ((state.journal.pending.kind === "APPLY" || state.journal.pending.kind === "RECOVER") && !state.canApply)} onClick={() => void state.retry()}>{copy.retry}</Button></div>}
      <div className="flex flex-wrap gap-2">
        {(state.journal.preparationId || state.operation) && <Button type="button" variant="outline" disabled={state.busy || !state.canRead} onClick={() => void state.refreshOperation()}>{copy.refresh}</Button>}
        <Button type="button" variant="outline" disabled={state.busy || !state.journalReady || Boolean(state.journal.pending) || Boolean((state.journal.preparationId || state.operation) && !state.terminal && !state.receipt)} onClick={state.reset}>{copy.newDraft}</Button>
      </div>
    </Card>
    {state.operation && <CommercialOperationEvidence value={state.operation} lang={props.lang} />}
    {state.journal.preparationId && state.journal.request && !state.receipt && !state.terminal && <div className="space-y-2"><p className="text-sm text-muted-foreground">{copy.previewNeeded}</p>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={state.busy || !state.canPrepare || Boolean(state.journal.pending) || state.operation?.state !== "READY" || state.sourceChanged} onClick={() => void state.price()}>{copy.price}</Button>
        {state.journal.previewKey && !state.preview && <Button type="button" variant="outline" disabled={state.busy || !state.canPrepare || Boolean(state.journal.pending)} onClick={() => void state.price(true)}>{copy.replayPreview}</Button>}</div></div>}
    {state.preview && <><CommercialPreviewEvidence value={state.preview} lang={props.lang} expired={state.expired} labels={state.labels} />
      {!state.receipt && state.canApply && <Card className="space-y-3 p-4"><label htmlFor="commercial-reviewed" className="flex min-h-11 items-center gap-3 text-sm">
        <Checkbox id="commercial-reviewed" checked={state.reviewed} disabled={state.busy || state.expired || Boolean(state.journal.pending)} onCheckedChange={checked => state.setReviewed(checked === true)} />{copy.review}</label>
        <Button type="button" disabled={state.busy || !state.reviewed || state.expired || !state.preview.financial.canApply || state.sourceChanged || state.terminal || Boolean(state.journal.pending)} onClick={() => void state.apply()}>{copy.apply}</Button></Card>}
    </>}
    {state.receipt && <CommercialReceiptEvidence value={state.receipt} lang={props.lang} />}
    {state.historicalReceipt && <CommercialReceiptEvidence value={state.historicalReceipt} lang={props.lang} />}
    {state.canApply && (state.operation || state.journal.pending?.kind === "RECOVER") && <Card className="space-y-3 p-4"><h3 className="text-sm font-semibold">{copy.recovery}</h3><p className="text-sm text-muted-foreground">{copy.recoveryHint}</p>
      <Field id="commercial-recovery-reason" label={copy.reason} hint={copy.reasonHint}>{field => <Textarea {...field} maxLength={256} value={state.reason} disabled={state.busy} onChange={event => state.setReason(event.target.value)} />}</Field>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={state.busy || !state.reason.trim() || Boolean(state.journal.pending)} onClick={() => void state.recover("RECONCILE")}>{copy.reconcile}</Button>
        <Button type="button" variant="outline" disabled={state.busy || state.terminal || !state.reason.trim() || Boolean(state.journal.pending)} onClick={() => void state.recover("CANCEL_PREPARATION")}>{copy.cancel}</Button></div></Card>}
    {state.canRead && <details className="rounded-md border border-border p-4 text-sm"><summary className="min-h-11 cursor-pointer py-3 font-medium focus-visible:ring-2 focus-visible:ring-ring">{copy.lookup}</summary>
      <div className="space-y-3"><Field id="commercial-operation-reference" label={copy.operationId}>{field => <Input {...field} dir="ltr" value={state.operationReference} disabled={state.busy || Boolean(state.journal.request || state.journal.preparationId || state.operation)} onChange={event => state.setOperationReference(event.target.value)} />}</Field>
        <Button type="button" variant="outline" disabled={state.busy || !state.operationReference.trim() || Boolean(state.journal.request || state.journal.preparationId || state.operation)} onClick={() => void state.refreshOperation()}>{copy.refresh}</Button>
        <Field id="commercial-receipt-reference" label={copy.receiptId}>{field => <Input {...field} dir="ltr" value={state.receiptReference} disabled={state.busy} onChange={event => state.setReceiptReference(event.target.value)} />}</Field>
        <Button type="button" variant="outline" disabled={state.busy || !state.receiptReference.trim()} onClick={() => void state.readReceipt()}>{copy.readReceipt}</Button></div>
    </details>}
  </section>;
}
