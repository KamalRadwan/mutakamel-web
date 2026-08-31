"use client";

import Link from "next/link";
import {
  DataTable,
  DateTime,
  Money,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { BillingBadge } from "../../components/BillingBadge";
import { BILLING_PAGE_SIZE } from "../billing-validation";
import { useBillingTableLabels } from "../hooks/useBillingTableLabels";
import type { TenantPayment } from "../payment-contract";
import type { WalletLedgerEntry } from "../wallet-contract";
import type { usePaymentsHistory } from "../hooks/usePaymentsHistory";

export type PaymentsHistory = ReturnType<typeof usePaymentsHistory>;

/**
 * The two immutable histories, side by side.
 *
 * Every amount is rendered from its decimal string through `Money`. Nothing is
 * summed here: a column total the browser computed would disagree with the
 * server's own arithmetic in the last decimal place, and the server is right.
 */
export function PaymentsHistoryTabs({ history }: { history: PaymentsHistory }) {
  const { t } = useI18n();
  const paymentLabels = useBillingTableLabels(
    t.coreBilling.paymentsLoadFailed,
    t.coreBilling.paymentsEmpty,
  );
  const ledgerLabels = useBillingTableLabels(
    t.coreBilling.ledgerLoadFailed,
    t.coreBilling.ledgerEmpty,
  );

  const paymentColumns: ColumnDef<TenantPayment>[] = [
    {
      id: "createdAt",
      header: t.coreBilling.createdAt,
      cell: (payment) => <DateTime value={payment.createdAt} />,
    },
    {
      id: "purpose",
      header: t.coreBilling.paymentPurpose,
      cell: (payment) => <BillingBadge kind="PaymentPurpose" value={payment.purpose} />,
    },
    {
      id: "status",
      header: t.common.status,
      cell: (payment) => <BillingBadge kind="PaymentStatus" value={payment.status} />,
    },
    {
      id: "collected",
      header: t.coreBilling.collectedAmount,
      numeric: true,
      cell: (payment) => (
        <Money value={payment.providerAmount} currency={payment.providerCurrencyCode} />
      ),
    },
    {
      id: "appliedUsd",
      header: t.coreBilling.appliedUsd,
      numeric: true,
      cell: (payment) => <Money value={payment.totalAppliedUsd} currency="USD" />,
    },
    {
      id: "invoice",
      header: t.coreBilling.invoice,
      cell: (payment) =>
        payment.invoiceId ? (
          <Link
            href={`${TENANT_ROUTES.coreBillingInvoices}/${payment.invoiceId}`}
            className="text-primary underline-offset-2 hover:underline"
          >
            {t.coreBilling.openInvoice}
          </Link>
        ) : (
          "—"
        ),
    },
  ];

  const ledgerColumns: ColumnDef<WalletLedgerEntry>[] = [
    {
      id: "createdAt",
      header: t.coreBilling.createdAt,
      cell: (entry) => <DateTime value={entry.createdAt} />,
    },
    {
      id: "direction",
      header: t.coreBilling.ledgerDirection,
      cell: (entry) => <BillingBadge kind="LedgerDirection" value={entry.direction} />,
    },
    {
      id: "reason",
      header: t.coreBilling.ledgerReason,
      cell: (entry) => <BillingBadge kind="LedgerReason" value={entry.reason} />,
    },
    {
      id: "amountUsd",
      header: t.coreBilling.ledgerAmountUsd,
      numeric: true,
      cell: (entry) => <Money value={entry.amountUsd} currency="USD" />,
    },
    {
      id: "source",
      header: t.coreBilling.ledgerCollected,
      numeric: true,
      cell: (entry) => <Money value={entry.sourceAmount} currency={entry.sourceCurrencyCode} />,
    },
    {
      id: "balanceAfter",
      header: t.coreBilling.ledgerBalanceAfter,
      numeric: true,
      cell: (entry) => <Money value={entry.balanceAfterUsd} currency="USD" />,
    },
  ];

  return (
    <Tabs defaultValue="payments">
      <TabsList>
        <TabsTrigger value="payments">{t.coreBilling.paymentsTab}</TabsTrigger>
        <TabsTrigger value="ledger">{t.coreBilling.ledgerTab}</TabsTrigger>
      </TabsList>

      <TabsContent value="payments">
        <DataTable
          columns={paymentColumns}
          rows={history.payments.items}
          isLoading={history.payments.isLoading && !history.payments.hasLoaded}
          error={history.payments.error}
          onRetry={() => void history.reloadPayments()}
          page={{
            page: history.paymentsPage,
            limit: BILLING_PAGE_SIZE,
            total: history.payments.meta?.total ?? 0,
          }}
          onPageChange={history.setPaymentsPage}
          rowKey={(payment) => payment.paymentId}
          labels={paymentLabels}
        />
      </TabsContent>

      <TabsContent value="ledger">
        <DataTable
          columns={ledgerColumns}
          rows={history.ledger.items}
          isLoading={history.ledger.isLoading && !history.ledger.hasLoaded}
          error={history.ledger.error}
          onRetry={() => void history.reloadLedger()}
          page={{
            page: history.ledgerPage,
            limit: BILLING_PAGE_SIZE,
            total: history.ledger.meta?.total ?? 0,
          }}
          onPageChange={history.setLedgerPage}
          rowKey={(entry) => entry.id}
          labels={ledgerLabels}
        />
      </TabsContent>
    </Tabs>
  );
}
