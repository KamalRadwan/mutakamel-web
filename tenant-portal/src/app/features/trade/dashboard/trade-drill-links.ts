import type { FilterClause } from './trade-dashboard.model';

/**
 * Portal routes for the backend drill-through target codes (metric drillThroughTargetCode,
 * `TRADE_${owner}_LIST` in dashboard-catalog.ts). The portal owns its routes, so the backend
 * relativePath is ignored. An unknown code has no link.
 */
export const DRILL_TARGET_ROUTES: Readonly<Record<string, string>> = {
  TRADE_QUOTATIONS_LIST: '/trade/documents/quotations',
  TRADE_SALESORDERS_LIST: '/trade/documents/sales-orders',
  TRADE_PURCHASEORDERS_LIST: '/trade/documents/purchase-orders',
  TRADE_CATALOG_LIST: '/trade/foundation/items',
  TRADE_INVENTORY_LIST: '/trade/inventory/availability',
  TRADE_PRICING_LIST: '/trade/governance/price-books',
  TRADE_CONTROLTOWER_LIST: '/trade/automation/control-tower',
};

/** Document lists read a single `status` query parameter (document-list.ts). */
const STATUS_AWARE_TARGETS: ReadonlySet<string> = new Set([
  'TRADE_QUOTATIONS_LIST',
  'TRADE_SALESORDERS_LIST',
  'TRADE_PURCHASEORDERS_LIST',
]);

export interface DrillLink {
  path: string;
  queryParams: Record<string, string>;
}

export function drillLink(
  targetCode: string | null | undefined,
  filters?: { clauses?: readonly FilterClause[] } | null,
): DrillLink | null {
  if (!targetCode) return null;
  const path = DRILL_TARGET_ROUTES[targetCode];
  if (!path) return null;
  const queryParams: Record<string, string> = {};
  if (STATUS_AWARE_TARGETS.has(targetCode)) {
    const status = filters?.clauses?.find((c) => c.key === 'status');
    if (status && status.values.length === 1) {
      queryParams['status'] = status.values[0].toUpperCase();
    }
  }
  return { path, queryParams };
}
