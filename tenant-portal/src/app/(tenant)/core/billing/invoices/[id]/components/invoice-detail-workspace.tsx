"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import {
  AmbiguousOutcomePanel,
  DateTime,
  DegradedBanner,
  DetailHeader,
  DetailSection,
  EmptyState,
  ErrorState,
  Money,
  NotFoundState,
  Skeleton,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { BillingBadge } from "../../../../components/BillingBadge";
import type { TenantInvoice } from "../../../billing-contract";
import { useInvoiceDetail } from "../hooks/useInvoiceDetail";
import { useInvoicePayment } from "../hooks/useInvoicePayment";
import { ActiveIntentPanel } from "./ActiveIntentPanel";
import { InvoiceLinesTable } from "./InvoiceLinesTable";
import { QuotePanel } from "./QuotePanel";

/** `OPEN_INVOICE_STATUSES` in `payments.service.ts` — the only payable states. */
const PAYABLE_STATUSES = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"];

export function InvoiceDetailWorkspace({ invoiceId }: { invoiceId: string }) {
  const { t } = useI18n();
  const detail = useInvoiceDetail(invoiceId);
  const reloadInvoice = detail.reload;
  const payment = useInvoicePayment(invoiceId, reloadInvoice);
  const [currencyCode, setCurrencyCode] = useState("USD");

  const invoice = detail.invoice;

  return (
    <div className="flex flex-col gap-4">
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

      {detail.isNotFound && (
        <NotFoundState
          title={t.coreBilling.invoiceNotFoundTitle}
          description={t.coreBilling.invoiceNotFoundDescription}
          backLabel={t.coreBilling.backToInvoices}
          backHref={TENANT_ROUTES.coreBillingInvoices}
        />
      )}

      {detail.error && !detail.isNotFound && (
        <ErrorState
          title={t.coreBilling.invoiceLoadFailed}
          description={detail.error.correlationId}
          onRetry={reloadInvoice}
          retryLabel={t.common.retry}
        />
      )}

      {invoice && (
        <>
          <InvoiceFacts invoice={invoice} />

          {!invoice.canonicalUsd && <DegradedBanner message={t.coreBilling.legacyInvoiceNotice} />}

          {invoice.lines && invoice.lines.length > 0 ? (
            <InvoiceLinesTable
              lines={invoice.lines}
              currency={invoice.canonicalUsd ? "USD" : invoice.currencyCode}
            />
          ) : (
            <EmptyState
              icon={FileText}
              title={t.coreBilling.linesEmpty}
              description={t.coreBilling.linesEmptyDescription}
            />
          )}

          {payment.ambiguousKey && (
            <AmbiguousOutcomePanel
              operation={t.coreBilling.intentOperation}
              idempotencyKey={payment.ambiguousKey}
              description={t.coreBilling.intentAmbiguous}
              onRetry={() => void payment.startPayment(payment.ambiguousKey ?? undefined)}
              onDismiss={payment.dismissAmbiguous}
              retrying={payment.isStarting}
              labels={{
                title: t.coreBilling.ambiguousTitle,
                operation: t.coreBilling.ambiguousOperation,
                idempotencyKey: t.coreBilling.ambiguousKey,
                correlationId: t.errors.reference,
                retry: t.common.retry,
                dismiss: t.common.dismiss,
              }}
            />
          )}

          {payment.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : payment.active ? (
            <ActiveIntentPanel
              active={payment.active}
              payment={payment.payment}
              pollsExhausted={payment.pollsExhausted}
              onRefresh={() => void payment.refreshStatus()}
            />
          ) : PAYABLE_STATUSES.includes(invoice.status) ? (
            <QuotePanel
              currencies={payment.currencies}
              currenciesFailed={payment.currenciesFailed}
              currencyCode={currencyCode}
              onCurrencyChange={setCurrencyCode}
              quote={payment.quote}
              quoteError={payment.quoteError}
              isQuoting={payment.isQuoting}
              isStarting={payment.isStarting}
              onRequestQuote={() => void payment.requestQuote(currencyCode)}
              onStartPayment={() => void payment.startPayment()}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function InvoiceFacts({ invoice }: { invoice: TenantInvoice }) {
  const { t } = useI18n();
  const legacy = invoice.legacyOriginalAmounts;

  return (
    <DetailSection
      title={t.coreBilling.invoiceFacts}
      emptyValueLabel={t.coreBilling.notSet}
      fields={[
        {
          label: t.coreBilling.invoicePurpose,
          value: <BillingBadge kind="InvoicePurpose" value={invoice.purpose} />,
        },
        {
          label: t.coreBilling.invoicePeriod,
          value:
            invoice.periodStart && invoice.periodEnd ? (
              <span className="flex flex-wrap items-center gap-1">
                <DateTime value={invoice.periodStart} precision="date" />
                <span aria-hidden="true">–</span>
                <DateTime value={invoice.periodEnd} precision="date" />
              </span>
            ) : null,
        },
        {
          label: t.coreBilling.invoiceIssuedAt,
          value: invoice.issuedAt ? <DateTime value={invoice.issuedAt} precision="date" /> : null,
        },
        {
          label: t.coreBilling.invoiceDueAt,
          value: invoice.dueAt ? <DateTime value={invoice.dueAt} precision="date" /> : null,
        },
        {
          label: t.coreBilling.invoicePaidAt,
          value: invoice.paidAt ? <DateTime value={invoice.paidAt} precision="date" /> : null,
        },
        {
          label: t.coreBilling.invoiceSubtotal,
          value: invoice.subtotalUsd ? (
            <Money value={invoice.subtotalUsd} currency="USD" />
          ) : legacy ? (
            <Money value={legacy.subtotal} currency={legacy.currencyCode} />
          ) : null,
        },
        {
          label: t.coreBilling.invoiceTax,
          value: invoice.taxTotalUsd ? (
            <Money value={invoice.taxTotalUsd} currency="USD" />
          ) : legacy ? (
            <Money value={legacy.taxTotal} currency={legacy.currencyCode} />
          ) : null,
        },
        {
          label: t.coreBilling.invoiceTotal,
          value: invoice.totalUsd ? (
            <Money value={invoice.totalUsd} currency="USD" />
          ) : legacy ? (
            <Money value={legacy.total} currency={legacy.currencyCode} />
          ) : null,
        },
        {
          label: t.coreBilling.invoicePaid,
          value: invoice.amountPaidUsd ? (
            <Money value={invoice.amountPaidUsd} currency="USD" />
          ) : null,
        },
        {
          label: t.coreBilling.invoiceOutstanding,
          value: invoice.outstandingUsd ? (
            <Money value={invoice.outstandingUsd} currency="USD" />
          ) : null,
        },
      ]}
    />
  );
}
