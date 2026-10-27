"use client";

import Link from "next/link";
import { FileCheck, FileSpreadsheet, FileText, Target } from "lucide-react";
import { cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import {
  buildPartyDocumentHref,
  type PartyDocumentCountKind,
  type PartyDocumentCountVisibility,
  type PartyDocumentCounts,
} from "../../../shared/party-document-counts-contract";

interface CustomerGridDocumentCountsProps {
  customerId: string;
  partyId: string;
  counts: PartyDocumentCounts | undefined;
  visibility?: PartyDocumentCountVisibility;
}

const DOCUMENT_CELLS: ReadonlyArray<{
  kind: PartyDocumentCountKind;
  code: "opp" | "pq" | "so" | "inv";
  icon: typeof Target;
}> = [
  { kind: "opportunities", code: "opp", icon: Target },
  { kind: "quotations", code: "pq", icon: FileText },
  { kind: "salesOrders", code: "so", icon: FileSpreadsheet },
  { kind: "invoices", code: "inv", icon: FileCheck },
];

export function CustomerGridDocumentCounts({
  customerId,
  partyId,
  counts,
  visibility,
}: CustomerGridDocumentCountsProps) {
  const { t, lang } = useI18n();
  const relatedDict = t.crmLeadDetail.related;
  const shortLabels: Record<PartyDocumentCountKind, string> = {
    opportunities: t.crmCustomerProfiles.ui.card.opps,
    quotations: t.crmCustomerProfiles.ui.card.quotes,
    salesOrders: t.crmCustomerProfiles.ui.card.orders,
    invoices: t.crmCustomerProfiles.ui.card.invoices,
  };

  const visibleCells = DOCUMENT_CELLS.filter(
    (cell) => visibility?.[cell.kind] !== false,
  );
  if (visibleCells.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label={relatedDict.groupLabel}
      className="grid grid-cols-4 gap-1.5"
      onClick={(event) => event.stopPropagation()}
    >
      {visibleCells.map((cell) => {
        const CellIcon = cell.icon;
        const raw = counts?.[cell.kind] ?? 0;
        const displayValue = formatNumber(raw, lang);
        const fullLabel = relatedDict.labels[cell.kind];
        const accessibleLabel = formatTemplate(relatedDict.labelWithCount, {
          name: fullLabel,
          count: displayValue,
        });

        return (
          <Link
            key={cell.kind}
            href={buildPartyDocumentHref(cell.kind, partyId)}
            aria-label={accessibleLabel}
            title={accessibleLabel}
            data-testid={`customer-card-${cell.code}-${customerId}`}
            className="flex min-w-0 flex-col gap-0.5 rounded-md border border-line-card bg-surface-subtle px-2 py-1 transition-colors hover:border-line-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex min-w-0 items-center gap-1 text-badge font-medium text-muted-foreground">
              <CellIcon className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{shortLabels[cell.kind]}</span>
            </span>
            <span
              className={cn(
                "text-caption font-bold tabular-nums",
                raw > 0 ? "text-primary" : "text-foreground",
              )}
            >
              {displayValue}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
