"use client";

import { DetailSection, Money } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

export interface TradeDocumentTotalsProps {
  /** The eight authored figures, exactly as they arrived. */
  totals: Record<string, string>;
  currencyCode: string;
  title: string;
  description?: string;
}

// The eight keys `FinancialTotalsDto` and `OrderTotalsEvidenceDto` both carry,
// in the order the DTOs declare them.
const TOTAL_KEYS = [
  "subtotal",
  "discountTotal",
  "chargeTotal",
  "taxTotal",
  "roundingTotal",
  "grandTotal",
  "amountPaid",
  "amountDue",
] as const;

/**
 * Renders a document's totals from decimal strings.
 *
 * Every value goes through `Money`, which formats the digits through `Intl`
 * with no float round-trip. `Number("9007199254740993.15")` loses precision
 * silently, and `numeric(24,8)` reaches ten times that — so a total on a large
 * document would be wrong by cents with nothing anywhere reporting it.
 *
 * A key the server did not send renders as absent rather than as zero. A
 * missing figure and a figure that is genuinely zero are different facts, and
 * a fresh purchase-quotation draft legitimately carries the second.
 */
export function TradeDocumentTotals({
  totals,
  currencyCode,
  title,
  description,
}: TradeDocumentTotalsProps) {
  const { t } = useI18n();

  return (
    <DetailSection
      title={title}
      description={description}
      emptyValueLabel={t.tradeDocuments.notRecorded}
      columns={2}
      fields={TOTAL_KEYS.map((key) => ({
        label: t.tradeDocuments.totals[key],
        value:
          totals[key] === undefined ? null : (
            <Money
              value={totals[key]}
              currency={currencyCode}
              minimumFractionDigits={2}
              maximumFractionDigits={8}
            />
          ),
      }))}
    />
  );
}
