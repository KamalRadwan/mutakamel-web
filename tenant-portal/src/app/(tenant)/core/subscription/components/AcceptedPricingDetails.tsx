"use client";

import { DataTable, Money, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { useBillingTableLabels } from "../../billing/hooks/useBillingTableLabels";
import type { AcceptedPricing } from "../subscription-pricing";

type Bracket = AcceptedPricing["breakdown"][number];

export function AcceptedPricingDetails({ pricing }: { pricing: AcceptedPricing }) {
  const { t, lang } = useI18n();
  const copy = t.subscriptionAddons;
  const labels = useBillingTableLabels(copy.pricingUnavailable, copy.pricingUnavailable);
  const columns: ColumnDef<Bracket>[] = [
    { id: "from", header: copy.fromUser, numeric: true, cell: (row) => formatNumber(row.minUsers, lang) },
    { id: "to", header: copy.toUser, numeric: true, cell: (row) => row.maxUsers === null ? copy.openEnded : formatNumber(row.maxUsers, lang) },
    { id: "charged", header: copy.chargedUsers, numeric: true, cell: (row) => formatNumber(row.chargedUsers, lang) },
    { id: "price", header: copy.unitPrice, numeric: true, cell: (row) => <Money value={row.unitPriceUsd} currency="USD" maximumFractionDigits={4} /> },
    { id: "amount", header: copy.amount, numeric: true, cell: (row) => <Money value={row.amountUsd} currency="USD" maximumFractionDigits={4} /> },
  ];
  return (
    <details className="rounded-md border border-border p-3">
      <summary className="cursor-pointer text-xs font-medium focus-visible:outline-2 focus-visible:outline-ring">{copy.acceptedBreakdown}</summary>
      <div className="mt-3">
        <DataTable columns={columns} rows={pricing.breakdown} rowKey={(row) => String(row.minUsers)} isLoading={false} labels={labels} showRowNumbers={false} />
      </div>
    </details>
  );
}
