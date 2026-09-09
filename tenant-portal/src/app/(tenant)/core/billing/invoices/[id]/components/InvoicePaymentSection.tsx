"use client";

import { AmbiguousOutcomePanel, Skeleton } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useInvoicePayment } from "../hooks/useInvoicePayment";
import { ActiveIntentPanel } from "./ActiveIntentPanel";
import { QuotePanel } from "./QuotePanel";

/** payments.service.ts OPEN_INVOICE_STATUSES; payment contracts remain unchanged. */
const PAYABLE_STATUSES = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"];

export function InvoicePaymentSection({ invoiceId, status, onSettled }: { invoiceId: string; status: string; onSettled: () => void }) {
  const { t } = useI18n();
  const payment = useInvoicePayment(invoiceId, onSettled);
  return <>
    {payment.ambiguousKey && <AmbiguousOutcomePanel
      operation={t.coreBilling.intentOperation}
      idempotencyKey={payment.ambiguousKey}
      description={t.coreBilling.intentAmbiguous}
      onRetry={() => void payment.startPayment(payment.ambiguousKey ?? undefined)}
      onDismiss={payment.dismissAmbiguous}
      retrying={payment.isStarting}
      labels={{ title: t.coreBilling.ambiguousTitle, operation: t.coreBilling.ambiguousOperation,
        idempotencyKey: t.coreBilling.ambiguousKey, correlationId: t.errors.reference, retry: t.common.retry, dismiss: t.common.dismiss }}
    />}
    {payment.isLoading ? <Skeleton className="h-40 w-full" /> : payment.active ? <ActiveIntentPanel
      active={payment.active} payment={payment.payment} pollsExhausted={payment.pollsExhausted}
      onRefresh={() => void payment.refreshStatus()}
    /> : PAYABLE_STATUSES.includes(status) ? <QuotePanel
      currencies={payment.currencies} currenciesFailed={payment.currenciesFailed}
      currencyCode={payment.currencyCode} onCurrencyChange={payment.setCurrencyCode}
      quote={payment.quote} quoteError={payment.quoteError} isQuoting={payment.isQuoting} isStarting={payment.isStarting}
      onRequestQuote={() => void payment.requestQuote(payment.currencyCode)}
      onStartPayment={() => void payment.startPayment()}
    /> : null}
  </>;
}
