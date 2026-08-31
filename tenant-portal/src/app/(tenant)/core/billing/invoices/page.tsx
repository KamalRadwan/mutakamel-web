"use client";

import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import {
  Button,
  CORE_BILLING_NAV_ITEMS,
  DataTable,
  DateTime,
  Money,
  PageHeader,
  SubNav,
  type ColumnDef,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { BillingBadge } from "../../components/BillingBadge";
import { OwnerGate } from "../../components/OwnerGate";
import type { TenantInvoice } from "../billing-contract";
import { BILLING_PAGE_SIZE } from "../billing-validation";
import { useBillingTableLabels } from "../hooks/useBillingTableLabels";
import { useInvoices } from "./hooks/useInvoices";

export default function InvoicesPage() {
  return (
    <OwnerGate>
      <InvoicesWorkspace />
    </OwnerGate>
  );
}

/**
 * Every amount below is rendered by `Money` straight from its decimal string.
 * An invoice whose `canonicalUsd` is false has no USD figures at all — its
 * money lives in `legacyOriginalAmounts`, in the currency it was raised in.
 */
function InvoicesWorkspace() {
  const { t } = useI18n();
  const router = useRouter();
  const invoices = useInvoices();
  const labels = useBillingTableLabels(
    t.coreBilling.invoicesLoadFailed,
    t.coreBilling.invoicesEmpty,
  );

  const columns: ColumnDef<TenantInvoice>[] = [
    {
      id: "number",
      header: t.coreBilling.invoiceNumber,
      cell: (invoice) => <span className="font-mono text-foreground">{invoice.number}</span>,
    },
    {
      id: "status",
      header: t.common.status,
      cell: (invoice) => <BillingBadge kind="InvoiceStatus" value={invoice.status} />,
    },
    {
      id: "purpose",
      header: t.coreBilling.invoicePurpose,
      cell: (invoice) => <BillingBadge kind="InvoicePurpose" value={invoice.purpose} />,
    },
    {
      id: "total",
      header: t.coreBilling.invoiceTotal,
      numeric: true,
      cell: (invoice) =>
        invoice.totalUsd ? (
          <Money value={invoice.totalUsd} currency="USD" />
        ) : invoice.legacyOriginalAmounts ? (
          <Money
            value={invoice.legacyOriginalAmounts.total}
            currency={invoice.legacyOriginalAmounts.currencyCode}
          />
        ) : (
          "—"
        ),
    },
    {
      id: "outstanding",
      header: t.coreBilling.invoiceOutstanding,
      numeric: true,
      cell: (invoice) =>
        invoice.outstandingUsd ? <Money value={invoice.outstandingUsd} currency="USD" /> : "—",
    },
    {
      id: "dueAt",
      header: t.coreBilling.invoiceDueAt,
      cell: (invoice) =>
        invoice.dueAt ? <DateTime value={invoice.dueAt} precision="date" /> : "—",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t.coreBilling.invoicesTitle}
        description={t.coreBilling.invoicesSubtitle}
        breadcrumbs={[
          { label: t.coreBilling.title, href: TENANT_ROUTES.coreBilling },
          { label: t.coreBilling.invoicesTitle },
        ]}
        secondaryActions={
          <Button
            variant="outline"
            onClick={() => void invoices.reload()}
            disabled={invoices.isRefreshing}
          >
            <RefreshCw
              className={invoices.isRefreshing ? "size-4 animate-spin" : "size-4"}
              aria-hidden="true"
            />
            {t.coreBilling.reload}
          </Button>
        }
      />

      <SubNav items={CORE_BILLING_NAV_ITEMS} />

      <DataTable
        columns={columns}
        rows={invoices.items}
        isLoading={invoices.isLoading}
        error={invoices.error}
        onRetry={() => void invoices.reload()}
        page={{ page: invoices.page, limit: BILLING_PAGE_SIZE, total: invoices.total }}
        onPageChange={invoices.setPage}
        rowKey={(invoice) => invoice.id}
        onRowClick={(invoice) =>
          router.push(`${TENANT_ROUTES.coreBillingInvoices}/${invoice.id}`)
        }
        labels={labels}
      />
    </div>
  );
}
