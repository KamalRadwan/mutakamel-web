"use client";

import { DeletionBlockerDialog } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { partyDisplayName } from "../../documents/trade-document-contract";
import type { Quotation } from "../quotation-contract";

export interface QuotationDeleteGuardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: Quotation | null;
}

/**
 * Centered Immutability / Delete Blocker Modal (`DeletionBlockerDialog`).
 *
 * Trade commercial documents have zero SQL `DELETE` routes by design (append-only
 * commercial audit ledger). Attempting to delete an `ACCEPTED`, `REJECTED`, or
 * `CANCELLED` quotation displays the structured 409 governance explanation and
 * links directly to Sales Orders when accepted.
 */
export function QuotationDeleteGuardModal({
  open,
  onOpenChange,
  quotation,
}: QuotationDeleteGuardModalProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const qCopy = td.quotations;

  if (!quotation) return null;

  const ref = quotation.documentNumber ?? quotation.draftReference ?? quotation.id;
  const party = partyDisplayName(quotation.partySnapshot);
  const recordName = party ? `${ref} · ${party}` : ref;

  const blockers = [
    {
      id: "append-only-ledger",
      label: qCopy.deleteBlockerImmutability,
    },
    ...(quotation.lifecycleStatus === "ACCEPTED"
      ? [
          {
            id: "accepted-lineage",
            label: qCopy.deleteBlockerAccepted,
          },
          {
            id: "sales-orders-link",
            label: qCopy.deleteBlockerSalesOrdersLabel,
            href: TENANT_ROUTES.tradeSalesOrders,
          },
        ]
      : []),
  ];

  return (
    <DeletionBlockerDialog
      open={open}
      onOpenChange={onOpenChange}
      recordName={recordName}
      blockers={blockers}
      labels={{
        title: qCopy.deleteBlockedTitle,
        description: qCopy.deleteBlockedDescription,
        blockersHeading: qCopy.deleteBlockedHeading,
        view: qCopy.deleteBlockerViewSalesOrders,
        close: t.common.close,
      }}
    />
  );
}
