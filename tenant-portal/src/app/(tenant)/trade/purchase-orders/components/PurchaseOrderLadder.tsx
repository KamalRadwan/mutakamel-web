"use client";

import { Card, CardContent, CardHeader, CardTitle, Stepper, type StepperStep } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { PurchaseOrder } from "../purchase-order-contract";

/**
 * The approval ladder, as a **position** rather than a history.
 *
 * There is no route that returns the approval instance or its steps: `GET
 * /purchase-orders/:id` answers `{ ...order, lines }` and nothing else, and the
 * `trade_approval_instances` and `trade_approval_steps` rows are written and
 * never read back over HTTP. So this is a `Stepper` showing where the order
 * stands, not a `Timeline` of who did what and when — which the order row
 * genuinely cannot say. Recorded as Q82.
 *
 * The gap is worst at `withdraw`: it resets the order's `approval_status` to
 * `NOT_REQUIRED` rather than `WITHDRAWN`, so a withdrawn order is
 * indistinguishable from one that was never submitted. The step row keeps that
 * history, and nothing can read it.
 */
export function PurchaseOrderLadder({ order }: { order: PurchaseOrder }) {
  const { t } = useI18n();

  const steps: StepperStep[] = [
    {
      id: "draft",
      label: t.tradeDocuments.purchaseOrders.ladderDraft,
      state: order.lifecycleStatus === "DRAFT" && order.approvalStatus === "NOT_REQUIRED"
        ? "current"
        : "complete",
    },
    {
      id: "pending",
      label: t.tradeDocuments.purchaseOrders.ladderPending,
      state:
        order.approvalStatus === "PENDING"
          ? "current"
          : ["APPROVED", "REJECTED"].includes(order.approvalStatus)
            ? "complete"
            : "upcoming",
    },
    {
      id: "decided",
      label: t.tradeDocuments.purchaseOrders.ladderDecided,
      state:
        order.approvalStatus === "REJECTED"
          ? "invalid"
          : order.approvalStatus === "APPROVED"
            ? order.lifecycleStatus === "CONFIRMED"
              ? "complete"
              : "current"
            : "upcoming",
    },
    {
      id: "confirmed",
      label: t.tradeDocuments.purchaseOrders.ladderConfirmed,
      state:
        order.lifecycleStatus === "CONFIRMED"
          ? "complete"
          : order.lifecycleStatus === "CANCELLED"
            ? "invalid"
            : "upcoming",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.tradeDocuments.purchaseOrders.ladderTitle}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Stepper steps={steps} label={t.tradeDocuments.purchaseOrders.ladderTitle} />
        <p className="text-xs text-muted-foreground">
          {t.tradeDocuments.purchaseOrders.ladderNote}
        </p>
      </CardContent>
    </Card>
  );
}
