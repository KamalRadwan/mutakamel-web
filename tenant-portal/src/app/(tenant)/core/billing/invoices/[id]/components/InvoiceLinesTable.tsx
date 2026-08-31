"use client";

import { DataTable, Money, type ColumnDef } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDecimalString } from "@/lib/format/number";
import { localizedValue } from "@/lib/format/localized";
import { useBillingTableLabels } from "../../../hooks/useBillingTableLabels";
import type { InvoiceLine } from "../../../billing-contract";

export interface InvoiceLinesTableProps {
  lines: InvoiceLine[];
  currency: string;
}

/**
 * The invoice's own lines, exactly as issued.
 *
 * No column is summed here. `line_total = round(quantity * unit_price, 4)` is a
 * database CHECK constraint and the invoice total is a stored column; a browser
 * that re-added them would be publishing a second, slightly different answer.
 */
export function InvoiceLinesTable({ lines, currency }: InvoiceLinesTableProps) {
  const { t, lang } = useI18n();
  const labels = useBillingTableLabels(t.coreBilling.linesLoadFailed, t.coreBilling.linesEmpty);

  const columns: ColumnDef<InvoiceLine>[] = [
    {
      id: "description",
      header: t.coreBilling.lineDescription,
      cell: (line) =>
        localizedValue(line.descriptionAr, line.descriptionEn, lang) || line.description,
    },
    {
      id: "quantity",
      header: t.coreBilling.lineQuantity,
      numeric: true,
      // `numeric(12,2)` — an exact decimal string, formatted, never parsed.
      cell: (line) =>
        formatDecimalString(line.quantity, lang, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }),
    },
    {
      id: "unitPrice",
      header: t.coreBilling.lineUnitPrice,
      numeric: true,
      cell: (line) => <Money value={line.unitPrice} currency={currency} />,
    },
    {
      id: "lineTotal",
      header: t.coreBilling.lineTotal,
      numeric: true,
      cell: (line) => <Money value={line.lineTotal} currency={currency} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={lines}
      isLoading={false}
      rowKey={(line) => line.id}
      labels={labels}
    />
  );
}
