"use client";

import Link from "next/link";
import { Button, DateTime, DetailSection, ErrorState, IdentifierText, PageHeader, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { OwnerGate } from "../../components/OwnerGate";
import { commercialErrorMessage } from "../commercial-error-messages";
import { useCommercialChange } from "../hooks/useCommercialChange";
import { useCommercialFlowFocus } from "../hooks/useCommercialFlowFocus";
import { useSubscription } from "../hooks/useSubscription";
import { useCommercialLabels } from "../hooks/useCommercialLabels";
import { CommercialCartEditor } from "./CommercialCartEditor";
import { CommercialChangeList } from "./CommercialChangeList";
import { CommercialPreviewDetails } from "./CommercialPreviewDetails";
import { CommercialReceiptDetails } from "./CommercialReceiptDetails";
import { CommercialRecoveryControls } from "./CommercialRecoveryControls";

export function CommercialChangeWorkspace() {
  const { t } = useI18n();
  const copy = t.commercialPurchase;
  const subscription = useSubscription();
  const labels = useCommercialLabels(subscription.view);
  const change = useCommercialChange(subscription.view, subscription.reload, !subscription.denied && !subscription.subscriptionError);
  const state = change.state, intent = state?.intent, operation = state?.operation;
  const headingRef = useCommercialFlowFocus(state?.phase, state?.preview?.previewId, !change.denied && !subscription.denied);
  return <div className="flex min-w-0 flex-col gap-4">
    <PageHeader headingRef={headingRef} className="sr-only" title={copy.title} description={copy.description} secondaryActions={<>
      <Button size="sm" variant="outline" asChild><Link href={TENANT_ROUTES.coreSubscription}>{t.commercialReceipt.back}</Link></Button>
      <Button size="sm" variant="outline" disabled={change.busy} onClick={() => void change.recheck()}>{copy.recheck}</Button>
    </>} />
    <OwnerGate denied={change.denied || subscription.denied}>
      {!state && <Skeleton className="h-48 w-full" />}
      {state?.phase === "storage" && <ErrorState title={copy.storageFailed} description={copy.storageNotice} onRetry={() => void change.recheck()} retryLabel={copy.recheck} />}
      {state?.error && <div role="alert" className="flex min-w-0 flex-col gap-1">
        <p className="text-sm text-destructive">{commercialErrorMessage(copy, state.error)}</p>
        {state.error.correlationId && <p className="text-xs text-muted-foreground">{copy.supportReference}: <IdentifierText>{state.error.correlationId}</IdentifierText></p>}
      </div>}
      <p role="status" aria-atomic="true" className="text-sm text-muted-foreground">
        {change.busy ? copy.waiting : state?.receipt ? copy.appliedStatus
          : state?.phase === "saved" && !state.error ? state.preview ? copy.quoteReadyStatus : operation ? copy.preparedStatus : null : null}
      </p>
      {state?.phase === "idle" && <>
        {subscription.isLoading ? <Skeleton className="h-48 w-full" /> : subscription.subscriptionError ? <ErrorState title={t.coreBilling.subscriptionLoadFailed} description={commercialErrorMessage(copy, subscription.subscriptionError)} onRetry={subscription.reload} retryLabel={t.common.retry} />
          : subscription.view && <>
            {!change.fresh && <p className="text-sm text-muted-foreground">{copy.unavailable}</p>}
            <CommercialCartEditor view={subscription.view} change={change} labels={labels} onRememberOffers={labels.rememberOffers} />
          </>}
      </>}
      {intent && <>
        <details className="rounded-md border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">{copy.technicalIdentifiers}</summary>
        <DetailSection title={copy.original} description={copy.originalNotice} fields={[
          { label: copy.subscriptionId, value: intent.subscriptionId && <IdentifierText>{intent.subscriptionId}</IdentifierText> },
          { label: copy.prepareKey, value: <IdentifierText>{intent.prepareKey}</IdentifierText> },
          ...(intent.pending ? [{ label: copy.pendingCommand, value: copy.status[intent.pending.kind] },
            { label: copy.originalKey, value: <IdentifierText>{intent.pending.key}</IdentifierText> }] : []),
        ]} /></details>
        <CommercialChangeList request={intent.request} labels={labels} />
        {intent.pending?.kind === "RECOVER" && <DetailSection title={copy.recovery} fields={[
          { label: t.commercialReceipt.change, value: copy.status[intent.pending.request.action] },
          { label: t.commercialOperation.revision, value: <IdentifierText>{intent.pending.request.expectedOperationRevision}</IdentifierText> },
          { label: copy.reason, value: intent.pending.request.reason },
        ]} />}
        {state?.phase === "uncertain" && <div className="flex flex-col gap-2"><p className="text-sm text-muted-foreground">{copy.uncertain}</p>
          <div><Button size="sm" variant="outline" disabled={!change.canRetry} onClick={() => void change.retry()}>{copy.retryOriginal}</Button></div></div>}
        {intent.operationId && <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={change.busy || !change.ready} onClick={() => void change.reload()}>{copy.readProgress}</Button>
          <Button size="sm" variant="outline" asChild><Link href={`${TENANT_ROUTES.coreSubscription}/operations/${intent.operationId}`}>{copy.openProgress}</Link></Button>
        </div>}
        {(intent.expiredApplies.length > 0 || intent.unresolvedPreviews.length > 0 || intent.rejectedRecoveries.length > 0) && <details className="rounded-md border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">{copy.previousRequests}</summary>
          <div className="mt-3 flex min-w-0 flex-col gap-3">
            {intent.expiredApplies.map((row) => <DetailSection key={row.applyKey} title={copy.status.APPLY} fields={[
              { label: t.commercialReceipt.preview, value: <Link className="underline" href={`${TENANT_ROUTES.coreSubscription}/receipts/${row.previewId}`}><IdentifierText>{row.previewId}</IdentifierText></Link> },
              { label: copy.originalKey, value: <IdentifierText>{row.applyKey}</IdentifierText> },
              { label: copy.status.PREVIEW, value: <IdentifierText>{row.previewKey}</IdentifierText> },
            ]} />)}
            {intent.unresolvedPreviews.map((key) => <DetailSection key={key} title={copy.status.PREVIEW} fields={[
              { label: copy.originalKey, value: <IdentifierText>{key}</IdentifierText> },
            ]} />)}
            {intent.rejectedRecoveries.map((row) => <DetailSection key={row.key} title={copy.rejectedRecovery} fields={[
              { label: copy.originalKey, value: <IdentifierText>{row.key}</IdentifierText> },
              { label: t.commercialReceipt.change, value: copy.status[row.request.action] },
              { label: t.commercialOperation.revision, value: <IdentifierText>{row.request.expectedOperationRevision}</IdentifierText> },
              { label: copy.recoveryReason, value: row.request.reason },
            ]} />)}
          </div>
        </details>}
      </>}
      {operation && !state?.receipt && <DetailSection title={t.commercialOperation.progress} description={t.commercialOperation.progressNotice} fields={[
        { label: t.commercialOperation.state, value: t.commercialOperation.status[operation.state] },
        { label: t.commercialOperation.revision, value: <IdentifierText>{operation.operationRevision}</IdentifierText> },
        { label: t.commercialOperation.updatedAt, value: <DateTime value={operation.updatedAt} /> },
      ]}><details className="rounded-md border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">{copy.technicalIdentifiers}</summary>
        <IdentifierText>{operation.operationId}</IdentifierText>
      </details></DetailSection>}
      {change.canQuote && <div><Button size="sm" variant="outline" onClick={() => void change.quote()}>{state?.preview ? copy.newQuote : copy.quoteAction}</Button></div>}
      {state?.preview && state.phase !== "complete" && <>
        <CommercialPreviewDetails preview={state.preview} labels={labels} />
        {change.expired && <p role="status" className="text-sm text-muted-foreground">{copy.expired}</p>}
        <p className="text-xs text-muted-foreground">{copy.applyNotice}</p>
        <div><Button size="sm" variant="outline" disabled={!change.canApply} onClick={() => void change.apply()}>{copy.apply}</Button></div>
      </>}
      {change.canRecover && <CommercialRecoveryControls change={change} />}
      {state?.receipt && <><CommercialReceiptDetails receipt={state.receipt} /><div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild><Link href={`${TENANT_ROUTES.coreSubscription}/receipts/${state.receipt.previewId}`}>{t.commercialOperation.openReceipt}</Link></Button>
        <Button size="sm" variant="outline" asChild><Link href={`${TENANT_ROUTES.coreSubscription}/operations/${state.receipt.projection.preparationId}`}>{copy.openProgress}</Link></Button>
      </div></>}
      {state?.phase === "complete" && <div><Button size="sm" variant="outline" onClick={change.newChange}>{copy.newChange}</Button></div>}
    </OwnerGate>
  </div>;
}
