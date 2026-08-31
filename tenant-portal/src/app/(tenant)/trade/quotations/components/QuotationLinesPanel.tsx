"use client";

import { DataTable, DetailSection, Money, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { useTradeTableLabels } from "../../documents/hooks/useTradeTableLabels";
import type { QuotationDetail, QuotationLine } from "../quotation-contract";

/**
 * The lines of the **current** revision.
 *
 * `GET /quotations/:id` returns `currentLines` only — the lines of an earlier
 * revision are not reachable through any route, so the panel says which
 * revision it is showing rather than implying it shows all of them.
 *
 * `unitPrice` and `lineTotal` are the server's own figures, written by
 * `priceLines` when the revision was created. Nothing here is recomputed.
 */
export function QuotationLinesPanel({ quotation }: { quotation: QuotationDetail }) {
  const { t } = useI18n();
  const labels = useTradeTableLabels(
    t.tradeDocuments.quotations.noLines,
    t.tradeDocuments.quotations.loadFailed,
  );

  const columns: ColumnDef<QuotationLine>[] = [
    { id: "number", header: "#", cell: (line) => line.printLineNumber },
    { id: "item", header: t.tradeDocuments.item, cell: (line) => line.descriptionSnapshot },
    {
      id: "quantity",
      header: t.tradeDocuments.quantity,
      numeric: true,
      cell: (line) => (
        <Money value={line.quantity} minimumFractionDigits={0} maximumFractionDigits={8} />
      ),
    },
    {
      id: "unitPrice",
      header: t.tradeDocuments.unitPrice,
      numeric: true,
      cell: (line) => (
        <Money
          value={line.unitPrice}
          currency={quotation.currencyCode}
          minimumFractionDigits={2}
          maximumFractionDigits={8}
        />
      ),
    },
    {
      id: "lineTotal",
      header: t.tradeDocuments.lineTotal,
      numeric: true,
      cell: (line) => (
        <Money
          value={line.lineTotal}
          currency={quotation.currencyCode}
          minimumFractionDigits={2}
          maximumFractionDigits={8}
        />
      ),
    },
  ];

  return (
    <DetailSection
      title={t.tradeDocuments.quotations.currentLines}
      emptyValueLabel={t.tradeDocuments.notRecorded}
      columns={1}
    >
      <DataTable
        columns={columns}
        rows={quotation.currentLines}
        rowKey={(line) => line.id}
        // The lines arrive inside the document's own response, so by the time
        // this panel renders there is nothing left to wait for.
        isLoading={false}
        labels={labels}
      />
    </DetailSection>
  );
}
