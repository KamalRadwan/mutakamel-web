"use client";

import Link from "next/link";
import { Button, DateTime, DetailSection, ErrorState, IdentifierText, PageHeader, PermissionGate, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { useCommercialChange } from "../hooks/useCommercialChange";
import { useDefinitionAdoptionDiscovery } from "../hooks/useDefinitionAdoptionDiscovery";
import { CommercialChangeList } from "./CommercialChangeList";
import { CommercialPreviewDetails } from "./CommercialPreviewDetails";
import { CommercialReceiptDetails } from "./CommercialReceiptDetails";
import { CommercialRecoveryControls } from "./CommercialRecoveryControls";
import { DefinitionAdoptionEditor } from "./DefinitionAdoptionEditor";

export function DefinitionAdoptionWorkspace() {
  const { t } = useI18n();
  const copy = t.commercialAdoption, commandCopy = t.commercialPurchase;
  const discovery = useDefinitionAdoptionDiscovery();
  const change = useCommercialChange(null, discovery.reload, !discovery.denied && !discovery.state?.error && !discovery.busy, discovery.revision);
  const state = change.state, intent = state?.intent, operation = state?.operation;
  return <div className="flex min-w-0 flex-col gap-4">
    <PageHeader title={copy.title} description={copy.description} secondaryActions={<>
      <Button variant="outline" asChild><Link href={TENANT_ROUTES.coreApplicationAccess}>{t.applicationAccess.title}</Link></Button>
      <Button variant="outline" disabled={change.busy || discovery.busy} onClick={() => void change.recheck()}>{copy.recheck}</Button>
    </>} />
    <PermissionGate require={[]} denied={change.denied || discovery.denied}>
      {!state && <Skeleton className="h-48 w-full" />}
      {state?.phase === "storage" && <ErrorState title={commandCopy.storageFailed} description={commandCopy.storageNotice} onRetry={() => void change.recheck()} retryLabel={copy.recheck} />}
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error.code === "SUBSCRIPTION_PLAN_CHANGE_PREVIEW_EXPIRED" ? commandCopy.expired
        : state.error.code === "COMMERCIAL_RECOVERY_REVISION_STALE" ? commandCopy.recoveryRejected : commandCopy.failed}</p>}
      {change.busy && <p role="status" aria-busy="true" className="text-sm text-muted-foreground">{commandCopy.waiting}</p>}
      {discovery.state?.changed && <p role="alert" className="text-sm text-muted-foreground">{copy.changed}</p>}
      {discovery.state?.error && <ErrorState title={copy.failed} onRetry={discovery.reload} retryLabel={copy.refresh} />}
      {!change.busy && <div><Button variant="outline" disabled={discovery.busy} onClick={discovery.reload}>{copy.refresh}</Button></div>}
      {state?.phase === "idle" && <>
        {discovery.busy && <Skeleton className="h-24 w-full" />}
        <DefinitionAdoptionEditor discovery={discovery} change={change} />
      </>}
      {intent && <>
        <DetailSection title={commandCopy.original} description={commandCopy.originalNotice} fields={[
          { label: commandCopy.prepareKey, value: <IdentifierText>{intent.prepareKey}</IdentifierText> },
          ...(intent.subscriptionId ? [{ label: commandCopy.subscriptionId, value: <IdentifierText>{intent.subscriptionId}</IdentifierText> }] : []),
          ...(intent.pending ? [{ label: commandCopy.pendingCommand, value: commandCopy.status[intent.pending.kind] },
            { label: commandCopy.originalKey, value: <IdentifierText>{intent.pending.key}</IdentifierText> }] : []),
        ]} />
        <CommercialChangeList request={intent.request} />
        <p className="text-xs text-muted-foreground">{copy.sourceNotice}</p>
        {intent.adoptionSources.map((source) => <DetailSection key={source.selectionKey} title={copy.current} fields={[
          { label: t.commercialReceipt.selection, value: <IdentifierText>{source.addonSelectionId}</IdentifierText> },
          { label: copy.current, value: <IdentifierText>{source.fromDefinitionVersionId}</IdentifierText> },
        ]} />)}
        {intent.pending?.kind === "RECOVER" && <DetailSection title={commandCopy.recovery} fields={[
          { label: t.commercialReceipt.change, value: commandCopy.status[intent.pending.request.action] },
          { label: t.commercialOperation.revision, value: <IdentifierText>{intent.pending.request.expectedOperationRevision}</IdentifierText> },
          { label: commandCopy.recoveryReason, value: intent.pending.request.reason },
        ]} />}
        {state?.phase === "uncertain" && <div className="flex flex-col gap-2"><p className="text-sm text-muted-foreground">{commandCopy.uncertain}</p>
          <div><Button variant="outline" disabled={!change.canRetry} onClick={() => void change.retry()}>{commandCopy.retryOriginal}</Button></div></div>}
        {intent.operationId && <div><Button variant="outline" disabled={change.busy || !change.ready} onClick={() => void change.reload()}>{commandCopy.readProgress}</Button></div>}
        {(intent.expiredApplies.length > 0 || intent.unresolvedPreviews.length > 0 || intent.rejectedRecoveries.length > 0) && <details className="rounded-md border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">{commandCopy.previousRequests}</summary>
          <div className="mt-3 flex min-w-0 flex-col gap-3">
            {intent.expiredApplies.map((row) => <DetailSection key={row.applyKey} title={commandCopy.status.APPLY} fields={[
              { label: t.commercialReceipt.preview, value: <IdentifierText>{row.previewId}</IdentifierText> },
              { label: commandCopy.originalKey, value: <IdentifierText>{row.applyKey}</IdentifierText> },
              { label: commandCopy.status.PREVIEW, value: <IdentifierText>{row.previewKey}</IdentifierText> },
            ]} />)}
            {intent.unresolvedPreviews.map((key) => <DetailSection key={key} title={commandCopy.status.PREVIEW} fields={[
              { label: commandCopy.originalKey, value: <IdentifierText>{key}</IdentifierText> },
            ]} />)}
            {intent.rejectedRecoveries.map((row) => <DetailSection key={row.key} title={commandCopy.rejectedRecovery} fields={[
              { label: commandCopy.originalKey, value: <IdentifierText>{row.key}</IdentifierText> },
              { label: t.commercialOperation.revision, value: <IdentifierText>{row.request.expectedOperationRevision}</IdentifierText> },
              { label: t.commercialReceipt.change, value: commandCopy.status[row.request.action] },
              { label: commandCopy.recoveryReason, value: row.request.reason },
            ]} />)}
          </div>
        </details>}
      </>}
      {operation && !state?.receipt && <>
        <DetailSection title={t.commercialOperation.progress} description={t.commercialOperation.progressNotice} fields={[
          { label: t.commercialOperation.state, value: t.commercialOperation.status[operation.state] },
          { label: t.commercialOperation.operation, value: <IdentifierText>{operation.operationId}</IdentifierText> },
          { label: t.commercialOperation.revision, value: <IdentifierText>{operation.operationRevision}</IdentifierText> },
          { label: t.commercialOperation.updatedAt, value: <DateTime value={operation.updatedAt} /> },
        ]} />
        {(operation.state === "BLOCKED" || operation.state === "NEEDS_REVIEW") && <p role="status" className="text-sm text-muted-foreground">{copy.blocked}</p>}
      </>}
      {change.canQuote && <div><Button variant="outline" onClick={() => void change.quote()}>{copy.preview}</Button></div>}
      {state?.preview && state.phase !== "complete" && <>
        <p className="text-xs text-muted-foreground">{copy.previewNotice}</p><CommercialPreviewDetails preview={state.preview} />
        <p className="text-xs text-muted-foreground">{copy.noWallet}</p>
        {change.expired && <p role="status" className="text-sm text-muted-foreground">{commandCopy.expired}</p>}
        <div><Button variant="outline" disabled={!change.canApply} onClick={() => void change.apply()}>{copy.apply}</Button></div>
      </>}
      {change.canRecover && <CommercialRecoveryControls change={change} />}
      {state?.receiptError && <section className="rounded-md border border-border p-4" aria-label={t.commercialReceipt.loadFailed}>
        <h2 className="text-sm font-semibold">{t.commercialReceipt.loadFailed}</h2>
        <PermissionGate require={[]} denied={state.receiptError.status === 403}>
          <ErrorState title={t.commercialReceipt.loadFailed} description={t.commercialReceipt.loadFailedDescription}
            onRetry={() => void change.reload()} retryLabel={commandCopy.readProgress} />
        </PermissionGate>
      </section>}
      {state?.receipt && <CommercialReceiptDetails receipt={state.receipt} />}
      {state?.phase === "complete" && <div><Button variant="outline" onClick={change.newChange}>{commandCopy.newChange}</Button></div>}
    </PermissionGate>
  </div>;
}
