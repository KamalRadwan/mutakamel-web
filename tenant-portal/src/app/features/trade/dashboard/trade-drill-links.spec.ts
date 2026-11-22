import { describe, expect, it } from 'vitest';
import { CATALOG } from './trade-dashboard.catalog';
import { DRILL_TARGET_ROUTES, drillLink } from './trade-drill-links';

describe('drillLink', () => {
  it('maps every catalog drill target code to a portal route', () => {
    const codes = new Set(CATALOG.metrics.map((m) => m.drillThroughTargetCode).filter(Boolean));
    for (const code of codes) {
      expect(DRILL_TARGET_ROUTES[code!]).toMatch(/^\/trade\//);
    }
  });

  it('builds document list links with a single status filter', () => {
    expect(drillLink('TRADE_QUOTATIONS_LIST', { clauses: [{ key: 'status', values: ['accepted'] }] })).toEqual({
      path: '/trade/documents/quotations',
      queryParams: { status: 'ACCEPTED' },
    });
    expect(drillLink('TRADE_SALESORDERS_LIST', { clauses: [{ key: 'status', values: ['A', 'B'] }] })).toEqual({
      path: '/trade/documents/sales-orders',
      queryParams: {},
    });
  });

  it('ignores filters for lists that do not read them', () => {
    expect(drillLink('TRADE_PRICING_LIST', { clauses: [{ key: 'status', values: ['X'] }] })).toEqual({
      path: '/trade/governance/price-books',
      queryParams: {},
    });
    expect(drillLink('TRADE_CONTROLTOWER_LIST')?.path).toBe('/trade/automation/control-tower');
  });

  it('returns null for unknown or missing codes', () => {
    expect(drillLink('TRADE_UNKNOWN_LIST')).toBeNull();
    expect(drillLink(undefined)).toBeNull();
  });
});
