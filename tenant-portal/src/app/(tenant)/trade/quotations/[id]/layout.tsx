import type { ReactNode } from "react";

/**
 * Quotation Detail Layout (`/trade/quotations/[id]`).
 *
 * Unlike generic settings detail pages that hide `History` behind an outer
 * `Record | History` tab bar, the Quotation 360° dossier renders
 * `<RecordHistoryTab entityType="TradeQuotationEntity" ... />` **inline**
 * directly inside the dossier workspace alongside Priced Lines, Terms, PDF, and
 * Revisions.
 */
export default function QuotationDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
