"use client";

import { DetailSection } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TradeStatusBadge } from "../../documents/components/TradeStatusBadge";
import type { SalesOrderDetail } from "../sales-order-contract";

/**
 * The four independent status axes, side by side.
 *
 * One badge would be a lie: an order can be `CONFIRMED` on the lifecycle axis,
 * `HELD` on the hold axis, `PARTIALLY_FULFILLED` on fulfilment and `NOT_BILLED`
 * on billing, all at once, and collapsing that into a single word loses the
 * three facts a person actually needs.
 */
export function SalesOrderAxes({ order }: { order: SalesOrderDetail }) {
  const { t } = useI18n();

  return (
    <DetailSection
      title={t.tradeDocuments.statusTitle}
      description={t.tradeDocuments.salesOrders.axesNote}
      emptyValueLabel={t.tradeDocuments.notRecorded}
      fields={[
        {
          label: t.tradeDocuments.salesOrders.lifecycleAxis,
          value: (
            <TradeStatusBadge kind="TradeSalesOrderStatus" value={order.lifecycleStatus} />
          ),
        },
        {
          label: t.tradeDocuments.salesOrders.confirmationAxis,
          value: (
            <TradeStatusBadge kind="TradeConfirmationStatus" value={order.confirmationStatus} />
          ),
        },
        {
          label: t.tradeDocuments.salesOrders.holdAxis,
          value: <TradeStatusBadge kind="TradeHoldStatus" value={order.holdStatus} />,
        },
        {
          label: t.tradeDocuments.salesOrders.fulfillmentAxis,
          value: (
            <TradeStatusBadge kind="TradeFulfillmentStatus" value={order.fulfillmentStatus} />
          ),
        },
        {
          label: t.tradeDocuments.salesOrders.billingAxis,
          value: <TradeStatusBadge kind="TradeBillingStatus" value={order.billingStatus} />,
        },
      ]}
    />
  );
}
