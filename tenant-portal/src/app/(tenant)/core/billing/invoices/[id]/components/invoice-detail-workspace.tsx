"use client";

import { DetailHeader, ErrorState, NotFoundState, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { BillingBadge } from "../../../../components/BillingBadge";
import { OwnerGate } from "../../../../components/OwnerGate";
import { useInvoiceDetail } from "../hooks/useInvoiceDetail";
import { InvoicePaymentSection } from "./InvoicePaymentSection";
import { InvoiceRetainedDetails } from "./InvoiceRetainedDetails";

export function InvoiceDetailWorkspace({ invoiceId }: { invoiceId: string }) {
  const { t } = useI18n();
  const detail = useInvoiceDetail(invoiceId);
  const invoice = detail.view?.invoice;
  return <OwnerGate denied={detail.denied}>
    <div className="flex min-w-0 flex-col gap-4">
      <DetailHeader
        title={invoice ? invoice.number : t.coreBilling.invoiceTitle}
        subtitle={t.coreBilling.invoiceSubtitle}
        status={invoice ? <BillingBadge kind="InvoiceStatus" value={invoice.status} /> : undefined}
        backLabel={t.coreBilling.backToInvoices}
        backHref={TENANT_ROUTES.coreBillingInvoices}
        breadcrumbs={[
          { label: t.coreBilling.title, href: TENANT_ROUTES.coreBilling },
          { label: t.coreBilling.invoicesTitle, href: TENANT_ROUTES.coreBillingInvoices },
        ]}
      />
      {detail.isLoading && <Skeleton className="h-64 w-full" />}
      {detail.isNotFound && <NotFoundState
        title={t.coreBilling.invoiceNotFoundTitle}
        description={t.coreBilling.invoiceNotFoundDescription}
        backLabel={t.coreBilling.backToInvoices}
        backHref={TENANT_ROUTES.coreBillingInvoices}
      />}
      {detail.error && !detail.isNotFound && <ErrorState
        title={t.coreBilling.invoiceLoadFailed}
        description={detail.error.correlationId}
        onRetry={detail.reload}
        retryLabel={t.common.retry}
      />}
      {detail.view && <>
        <InvoiceRetainedDetails view={detail.view} />
        <InvoicePaymentSection invoiceId={detail.view.invoice.id} status={detail.view.invoice.status} onSettled={detail.reload} />
      </>}
    </div>
  </OwnerGate>;
}
