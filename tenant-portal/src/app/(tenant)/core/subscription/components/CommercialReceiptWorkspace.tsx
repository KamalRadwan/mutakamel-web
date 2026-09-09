"use client";

import { Button, DetailHeader, ErrorState, NotFoundState, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { OwnerGate } from "../../components/OwnerGate";
import type { CommercialReceiptReference } from "../commercial-apply";
import { useCommercialReceipt } from "../hooks/useCommercialReceipt";
import { CommercialReceiptDetails } from "./CommercialReceiptDetails";

export function CommercialReceiptWorkspace({ reference }: { reference: CommercialReceiptReference }) {
  const { t } = useI18n();
  const copy = t.commercialReceipt;
  const read = useCommercialReceipt(reference);
  return <div className="flex min-w-0 flex-col gap-4">
    <DetailHeader title={copy.title} subtitle={copy.description} backLabel={copy.back} backHref={TENANT_ROUTES.coreSubscription}
      breadcrumbs={[{ label: t.nav.coreSubscription, href: TENANT_ROUTES.coreSubscription }]}
      secondaryActions={<Button variant="outline" onClick={read.reload} disabled={read.isLoading}>{t.coreBilling.reload}</Button>} />
    <ReceiptResult read={read} />
  </div>;
}

/** Only verified operation status supplies this preparation pin. */
export function CommercialReceiptPanel({ reference }: { reference: CommercialReceiptReference }) {
  const { t } = useI18n();
  const read = useCommercialReceipt(reference);
  return <section className="flex min-w-0 flex-col gap-4" aria-label={t.commercialReceipt.title}>
    <h2 className="text-sm font-semibold">{t.commercialReceipt.title}</h2>
    <ReceiptResult read={read} />
  </section>;
}

function ReceiptResult({ read }: { read: ReturnType<typeof useCommercialReceipt> }) {
  const { t } = useI18n();
  const copy = t.commercialReceipt;
  return <OwnerGate denied={read.denied}>
      {read.isLoading && <div role="status" aria-label={copy.loading} aria-busy="true"><Skeleton className="h-64 w-full" /></div>}
      {read.isNotFound && <NotFoundState title={copy.notFound} description={copy.notFoundDescription}
        backLabel={copy.back} backHref={TENANT_ROUTES.coreSubscription} />}
      {read.error && !read.isNotFound && <ErrorState title={copy.loadFailed} description={copy.loadFailedDescription}
        onRetry={read.reload} retryLabel={t.common.retry} />}
      {read.receipt && <CommercialReceiptDetails receipt={read.receipt} />}
  </OwnerGate>;
}
