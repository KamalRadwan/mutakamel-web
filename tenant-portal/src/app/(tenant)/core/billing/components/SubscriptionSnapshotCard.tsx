"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { Button, DateTime, DetailSection, EmptyState, Money } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { BillingBadge } from "../../components/BillingBadge";
import type { BillingSubscriptionSummary, TenantInvoice } from "../billing-contract";

export interface SubscriptionSnapshotCardProps {
  subscription: BillingSubscriptionSummary;
  outstandingInvoice: TenantInvoice | null;
}

/**
 * The subscription half of `GET /billing/summary`, plus the collection state.
 *
 * `accessMode` is the server's own derivation (`deriveAccessMode` in
 * `tenant-billing.service.ts`), not something re-inferred from the status name
 * here — an ACTIVE subscription whose period has expired is READ_ONLY, and only
 * the server knows the clock it measured that against.
 */
export function SubscriptionSnapshotCard({
  subscription,
  outstandingInvoice,
}: SubscriptionSnapshotCardProps) {
  const { t } = useI18n();

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <DetailSection
        title={t.coreBilling.subscriptionTitle}
        emptyValueLabel={t.coreBilling.notSet}
        fields={[
          {
            label: t.common.status,
            value: <BillingBadge kind="SubscriptionStatus" value={subscription.status} />,
          },
          {
            label: t.coreBilling.accessMode,
            value: subscription.accessMode ? (
              <BillingBadge kind="AccessMode" value={subscription.accessMode} />
            ) : null,
          },
          {
            label: t.coreBilling.billingCycle,
            value: subscription.billingCycle ? (
              <BillingBadge kind="BillingCycle" value={subscription.billingCycle} />
            ) : null,
          },
          {
            label: t.coreBilling.subscriptionTotal,
            value: subscription.totalPriceUsd ? (
              <Money value={subscription.totalPriceUsd} currency="USD" />
            ) : null,
          },
          {
            label: t.coreBilling.currentPeriodEnd,
            value: <DateTime value={subscription.currentPeriodEnd} precision="date" />,
          },
          {
            label: t.coreBilling.trialEndsAt,
            value: subscription.trialEndsAt ? (
              <DateTime value={subscription.trialEndsAt} precision="date" />
            ) : null,
          },
        ]}
      >
        <Button variant="outline" size="sm" asChild className="self-start">
          <Link href={TENANT_ROUTES.coreSubscription}>{t.coreBilling.manageSubscription}</Link>
        </Button>
      </DetailSection>

      <DetailSection
        title={t.coreBilling.collectionTitle}
        description={t.coreBilling.collectionDescription}
        emptyValueLabel={t.coreBilling.notSet}
        fields={
          outstandingInvoice
            ? [
                {
                  label: t.coreBilling.invoiceNumber,
                  value: <span className="font-mono">{outstandingInvoice.number}</span>,
                },
                {
                  label: t.common.status,
                  value: <BillingBadge kind="InvoiceStatus" value={outstandingInvoice.status} />,
                },
                {
                  label: t.coreBilling.invoiceOutstanding,
                  value: outstandingInvoice.outstandingUsd ? (
                    <Money value={outstandingInvoice.outstandingUsd} currency="USD" />
                  ) : null,
                },
                {
                  label: t.coreBilling.invoiceDueAt,
                  value: outstandingInvoice.dueAt ? (
                    <DateTime value={outstandingInvoice.dueAt} precision="date" />
                  ) : null,
                },
              ]
            : undefined
        }
      >
        {outstandingInvoice ? (
          <Button variant="outline" size="sm" asChild className="self-start">
            <Link href={`${TENANT_ROUTES.coreBillingInvoices}/${outstandingInvoice.id}`}>
              {t.coreBilling.settleInvoice}
            </Link>
          </Button>
        ) : (
          // Nothing failed and nothing is missing — there is simply no money
          // owed. An error surface here would train people to ignore red.
          <EmptyState
            icon={FileText}
            title={t.coreBilling.noOutstandingTitle}
            description={t.coreBilling.noOutstandingDescription}
          />
        )}
      </DetailSection>
    </div>
  );
}
