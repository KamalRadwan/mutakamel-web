"use client";

import { DataTable, Money, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { useBillingTableLabels } from "../../billing/hooks/useBillingTableLabels";
import type { SubscriptionOffer } from "../subscription-offers";

type Ladder = SubscriptionOffer["ladders"][number];
type Bracket = Ladder["brackets"][number];

export function OfferPricingLadder({ ladder }: { ladder: Ladder }) {
  const { t, lang } = useI18n();
  const copy = t.subscriptionAddons;
  const labels = useBillingTableLabels(t.subscriptionOffers.loadFailed, t.subscriptionOffers.status.UNCONFIGURED);
  const cycle = t.coreBilling.enums[`BillingCycle.${ladder.billingCycle}`];
  const columns: ColumnDef<Bracket>[] = [
    { id: "from", header: copy.fromUser, numeric: true, cell: (row) => formatNumber(row.minUsers, lang) },
    { id: "to", header: copy.toUser, numeric: true, cell: (row) => row.maxUsers === null ? copy.openEnded : formatNumber(row.maxUsers, lang) },
    { id: "price", header: copy.unitPrice, numeric: true, cell: (row) => <Money value={row.unitPrice} currency="USD" maximumFractionDigits={4} /> },
  ];
  if (ladder.state !== "CONFIGURED") return <div className="flex flex-col gap-1 py-2">
    <p className="text-sm font-medium">{cycle}</p><p className="text-xs text-muted-foreground">{t.subscriptionOffers.status[ladder.state]}</p>
  </div>;
  return <details className="min-w-0 py-2">
    <summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">{cycle} — {t.subscriptionOffers.pricing}</summary>
    <div className="mt-3">
      <DataTable columns={columns} rows={ladder.brackets} rowKey={(row) => String(row.minUsers)} labels={labels} isLoading={false} showRowNumbers={false} />
    </div>
  </details>;
}
