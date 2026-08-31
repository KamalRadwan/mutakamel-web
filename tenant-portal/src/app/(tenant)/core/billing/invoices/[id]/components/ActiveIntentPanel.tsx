"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DateTime,
  DegradedBanner,
  Money,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { BillingBadge } from "../../../../components/BillingBadge";
import type { ActiveInvoicePaymentIntent, TenantPayment } from "../../../payment-contract";

export interface ActiveIntentPanelProps {
  active: ActiveInvoicePaymentIntent;
  payment: TenantPayment | null;
  pollsExhausted: boolean;
  onRefresh: () => void;
}

/**
 * The authoritative view of an open collection hold.
 *
 * Everything rendered here comes from `GET .../payment-intents/active` and
 * `GET /billing/payments/:paymentId`. Nothing comes from the redirect the
 * provider sends the owner back with: **a URL success is never settlement
 * authority**, and an invoice is never marked paid because a query string said
 * so. The panel polls those two routes and reports exactly what they answer.
 */
export function ActiveIntentPanel({
  active,
  payment,
  pollsExhausted,
  onRefresh,
}: ActiveIntentPanelProps) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>{t.coreBilling.activeIntentTitle}</CardTitle>
        <BillingBadge kind="PaymentStatus" value={active.status} />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{t.coreBilling.settlementAuthorityNote}</p>

        <dl className="grid gap-3 sm:grid-cols-2">
          <IntentFigure
            label={t.coreBilling.recoveryAction}
            value={<BillingBadge kind="PaymentRecoveryAction" value={active.recoveryAction} />}
          />
          <IntentFigure
            label={t.coreBilling.intentExpiresAt}
            value={active.expiresAt ? <DateTime value={active.expiresAt} /> : "—"}
          />
          <IntentFigure
            label={t.coreBilling.paymentId}
            value={<span className="font-mono">{active.paymentId}</span>}
          />
          {payment && (
            <IntentFigure
              label={t.coreBilling.collectedAmount}
              value={
                <Money value={payment.providerAmount} currency={payment.providerCurrencyCode} />
              }
            />
          )}
          {payment && (
            <IntentFigure
              label={t.coreBilling.appliedUsd}
              value={<Money value={payment.totalAppliedUsd} currency="USD" />}
            />
          )}
          {payment?.invoiceStatus && (
            <IntentFigure
              label={t.coreBilling.invoiceStatus}
              value={<BillingBadge kind="InvoiceStatus" value={payment.invoiceStatus} />}
            />
          )}
        </dl>

        {pollsExhausted && <DegradedBanner message={t.coreBilling.pollingStopped} />}

        <div className="flex flex-wrap items-center gap-2">
          {active.checkoutUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={active.checkoutUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" aria-hidden="true" />
                {t.coreBilling.continueCheckout}
              </a>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {t.coreBilling.checkStatus}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IntentFigure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-xs text-foreground">{value}</dd>
    </div>
  );
}
