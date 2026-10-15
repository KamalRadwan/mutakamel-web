"use client";

import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { PARTY_DOCUMENT_COUNT_KINDS } from "../../../shared/party-document-counts-contract";
import type {
  LeadDocumentCounts,
  LeadDocumentCountVisibility,
} from "../../lead-document-counts-contract";

export interface LeadCardDocumentCountsProps {
  counts: LeadDocumentCounts | undefined;
  visibility: LeadDocumentCountVisibility;
}

/**
 * The OPP / PQ / SO / INV strip. A kind the backend answered for no card is
 * not drawn; a card without its own answer shows the empty marker rather than
 * a guessed zero.
 */
export function LeadCardDocumentCounts({ counts, visibility }: LeadCardDocumentCountsProps) {
  const { t, lang } = useI18n();
  const kinds = PARTY_DOCUMENT_COUNT_KINDS.filter((kind) => visibility[kind]);
  if (kinds.length === 0) return null;

  const fullLabel = {
    opportunities: t.crmLeadViews.opportunities,
    quotations: t.crmLeads.card.quotations,
    salesOrders: t.crmLeads.card.salesOrders,
    invoices: t.crmLeads.card.invoices,
  };

  return (
    <dl className="grid grid-cols-4 gap-1">
      {kinds.map((kind) => {
        const value = counts?.[kind];
        const count = (typeof value === "number" && formatNumber(value, lang)) || "—";
        return (
          <div
            key={kind}
            title={formatTemplate(fullLabel[kind], { count })}
            className="flex min-w-0 items-center justify-between gap-1 rounded-xs bg-muted px-1.5 py-0.5 text-xs"
          >
            <dt className="truncate text-muted-foreground">{t.crmLeadViews.documentCountsShort[kind]}</dt>
            <dd className="tabular-nums text-foreground">{count}</dd>
          </div>
        );
      })}
    </dl>
  );
}
