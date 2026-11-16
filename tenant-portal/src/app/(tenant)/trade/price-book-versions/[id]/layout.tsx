import type { ReactNode } from "react";

/**
 * Price Book Version Studio Layout (`/trade/price-book-versions/[id]`).
 *
 * Like Quotation Detail, the Version Authoring Studio embeds
 * `<RecordHistoryTab entityType="TradePriceBookVersionEntity" ... />` inline
 * inside its Governance & Audit Trail studio tab rather than wrapping the
 * studio in an outer `Record | History` tab strip.
 */
export default function PriceBookVersionLayout({ children }: { children: ReactNode }) {
  return children;
}
