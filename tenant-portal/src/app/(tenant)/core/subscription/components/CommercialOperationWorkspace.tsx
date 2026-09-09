"use client";

import Link from "next/link";
import { Button, DateTime, DetailHeader, DetailSection, ErrorState, IdentifierText, NotFoundState, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { OwnerGate } from "../../components/OwnerGate";
import { useCommercialOperation } from "../hooks/useCommercialOperation";
import { CommercialReceiptPanel } from "./CommercialReceiptWorkspace";

export function CommercialOperationWorkspace({ operationId }: { operationId: string }) {
  const { t } = useI18n();
  const copy = t.commercialOperation;
  const read = useCommercialOperation(operationId);
  const operation = read.operation;
  return <div className="flex min-w-0 flex-col gap-4">
    <DetailHeader title={copy.title} subtitle={copy.description} backLabel={t.commercialReceipt.back} backHref={TENANT_ROUTES.coreSubscription}
      breadcrumbs={[{ label: t.nav.coreSubscription, href: TENANT_ROUTES.coreSubscription }]}
      secondaryActions={<Button variant="outline" onClick={read.reload} disabled={read.isLoading}>{t.coreBilling.reload}</Button>} />
    <OwnerGate denied={read.denied}>
      {read.isLoading && <div role="status" aria-label={copy.loading} aria-busy="true"><Skeleton className="h-64 w-full" /></div>}
      {read.isNotFound && <NotFoundState title={copy.notFound} description={copy.notFoundDescription}
        backLabel={t.commercialReceipt.back} backHref={TENANT_ROUTES.coreSubscription} />}
      {read.error && !read.isNotFound && <ErrorState title={copy.loadFailed} description={copy.loadFailedDescription}
        onRetry={read.reload} retryLabel={t.common.retry} />}
      {operation && <>
        <DetailSection title={copy.progress} description={copy.progressNotice} emptyValueLabel={t.detail.notRecorded} fields={[
          { label: copy.state, value: copy.status[operation.state] },
          { label: copy.operation, value: <IdentifierText>{operation.operationId}</IdentifierText> },
          { label: copy.revision, value: <IdentifierText>{operation.operationRevision}</IdentifierText> },
          { label: copy.createdAt, value: <DateTime value={operation.createdAt} /> },
          { label: copy.updatedAt, value: <DateTime value={operation.updatedAt} /> },
          { label: copy.terminalAt, value: operation.terminalAt && <DateTime value={operation.terminalAt} /> },
        ]} />
        {operation.state === "COMMITTED" && operation.committedReceiptRef && <>
          <DetailSection title={copy.projection} description={copy.projectionNotice} fields={[
            { label: copy.state, value: copy.projectionStatus[operation.projectionState] },
          ]} />
          <div><Button variant="outline" asChild><Link href={`${TENANT_ROUTES.coreSubscription}/receipts/${operation.committedReceiptRef}`}>{copy.openReceipt}</Link></Button></div>
          <CommercialReceiptPanel key={`${operation.operationId}:${operation.committedReceiptRef}`} reference={{ previewId: operation.committedReceiptRef, preparationId: operation.operationId }} />
        </>}
      </>}
    </OwnerGate>
  </div>;
}
