import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../shared/trade-api';
import { CATALOG, TEMPLATE_LAYOUTS } from './trade-dashboard.catalog';
import {
  FAKE_ME,
  fakeAddPlacement,
  fakeCreateDashboard,
  fakeCreateFromTemplate,
  fakeDeleteDashboard,
  fakeDuplicateDashboard,
  fakeGetCatalog,
  fakeGetDashboard,
  fakeGetDefault,
  fakeGetNavigation,
  fakeListDashboards,
  fakeListShareTargets,
  fakeListShares,
  fakeListWidgets,
  fakeRemovePlacement,
  fakeRevokeShare,
  fakeRunDashboard,
  fakeSetFavorite,
  fakeUpdateDashboard,
  fakeUpdateLayout,
  fakeUpsertShares,
  resetTradeDashboardFakeStore,
} from './trade-dashboard.fake';

const C1 = { companyId: 'c1' };

async function caught(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error('expected an error');
}

beforeEach(() => resetTradeDashboardFakeStore('returning'));

describe('trade dashboard fake: catalog follows dashboard-catalog.ts', () => {
  it('uses the backend descriptor field names and limits', async () => {
    const catalog = await fakeGetCatalog(C1);
    const metricCard = catalog.visualizations.find((v) => v.type === 'METRIC_CARD')!;
    expect(metricCard).toMatchObject({
      supportedShapes: ['SCALAR'],
      minimumWidth: 3,
      minimumHeight: 2,
      defaultWidth: 3,
      defaultHeight: 2,
      maximumWidth: 6,
      maximumHeight: 4,
      minimumSeries: 1,
      maximumSeries: 1,
      supportsPeriodComparison: true,
    });
    expect(metricCard.supportedOptionKeys.slice(0, 2)).toEqual(['prefix', 'suffix']);
    expect(catalog.limits.MAX_PLACEMENTS).toBe(20);
    expect(catalog.frontendContractVersion).toBe(1);
    expect(catalog.responsive.layoutEditing).toBe('DESKTOP_ONLY');
  });

  it('describes metrics like the backend metric() helper', () => {
    const acceptance = CATALOG.metrics.find((m) => m.key === 'trade.quotations.acceptance_rate')!;
    expect(acceptance.requiredFeatureKeys).toEqual(['trade.analytics', 'trade.sales']);
    expect(acceptance.requiredPermissions).toEqual(['trade.quotations.read']);
    expect(acceptance.supportedAggregations).toEqual(['PERCENT']);
    expect(acceptance.freshness.sourceOwner).toBe('quotations');
    expect(acceptance.drillThroughTargetCode).toBe('TRADE_QUOTATIONS_LIST');
    const exceptions = CATALOG.metrics.find((m) => m.key === 'trade.control_tower.open_exceptions')!;
    expect(exceptions.requiredFeatureKeys).toEqual(['trade.analytics']);
  });

  it('uses the backend template keys and widget codes', () => {
    const tpl = CATALOG.templates.find((t) => t.key === 'SALES_AND_QUOTES')!;
    expect(tpl.labelKey).toBe('trade.dashboard.template.SALES_AND_QUOTES.label');
    expect(tpl.requiredFeatureKeys).toEqual(['trade.analytics', 'trade.sales']);
    expect(tpl.widgetDefinitionCodes).toEqual([
      'sales_quote_count',
      'sales_quote_value',
      'sales_acceptance',
      'sales_pending_confirmation',
      'sales_quote_trend',
      'sales_quote_status',
      'sales_order_status',
      'sales_value_xy',
    ]);
    expect(TEMPLATE_LAYOUTS.TRADE_EXECUTIVE.widgets[4].dimensionKey).toBe('time');
  });
});

describe('trade dashboard fake: list and navigation shapes', () => {
  it('returns list rows with the stored filter spec and offset pagination', async () => {
    const res = await fakeListDashboards(C1, { limit: 2 });
    expect(res.items).toHaveLength(2);
    expect(res.pagination).toEqual({ limit: 2, offset: 0, nextOffset: 2 });
    const first = res.items[0];
    expect(first.id).toBe('dash-exec-1');
    expect(first.defaultFilters).toEqual({ datePreset: 'CURRENT_MONTH', comparisonMode: 'NONE' });
    expect(first).toHaveProperty('lastOpenedAt');
    expect(first.isShared).toBe(false);
  });

  it('rejects an out-of-range limit as a DTO error', async () => {
    const err = await caught(fakeListDashboards(C1, { limit: 101 }));
    expect(err.status).toBe(400);
    expect(err.code).toBe('TRADE.VALIDATION_FAILED');
    expect(Object.keys(err.details ?? {})).toEqual(['limit']);
  });

  it('rejects companyId with the CONSOLIDATED preference kind', async () => {
    const err = await caught(fakeGetNavigation(C1, { kind: 'CONSOLIDATED', companyId: 'c1' }));
    expect([err.status, err.code]).toEqual([422, 'TRADE.DASHBOARD.FILTER_INVALID']);
  });

  it('marks dashboards shared only when another user owns them', async () => {
    const nav = await fakeGetNavigation(C1, { kind: 'COMPANY', companyId: 'c1' });
    expect(nav.activeDashboardId).toBe('dash-exec-1');
    const mine = nav.items.filter((i) => i.ownerUserId === FAKE_ME.id);
    expect(mine.every((i) => !i.isShared)).toBe(true);
    expect(nav.items.find((i) => i.id === 'dash-sales-rana')!.isShared).toBe(true);
  });

  it('returns { items } for widgets, shares and { items, pagination } for share targets', async () => {
    const widgets = await fakeListWidgets(C1);
    expect(Array.isArray(widgets.items)).toBe(true);
    const shares = await fakeListShares(C1, 'dash-exec-1');
    expect(shares).toEqual({ items: [] });
    const targets = await fakeListShareTargets(C1, {});
    expect(targets.pagination).toEqual({ limit: 50, offset: 0, nextOffset: null });
    expect(targets.items[0].subjectType).toBe('TEAM');
    expect(targets.items[0].nameI18n.ar).toBeTruthy();
    expect(targets.items[0].name).toBe(targets.items[0].nameI18n.en);
  });
});

describe('trade dashboard fake: errors and status codes', () => {
  it('hides dashboards the viewer cannot see behind 404', async () => {
    const err = await caught(fakeGetDashboard(C1, 'dash-missing'));
    expect([err.status, err.code]).toEqual([404, 'TRADE.DASHBOARD.NOT_FOUND']);
  });

  it('returns 404 when a non-owner deletes', async () => {
    const err = await caught(fakeDeleteDashboard(C1, 'dash-ops-tarek', 3));
    expect([err.status, err.code]).toEqual([404, 'TRADE.DASHBOARD.NOT_FOUND']);
  });

  it('returns 403 TRANSITIVE_SHARE_FORBIDDEN when a non-owner lists shares', async () => {
    const err = await caught(fakeListShares(C1, 'dash-ops-tarek'));
    expect([err.status, err.code]).toEqual([403, 'TRADE.DASHBOARD.TRANSITIVE_SHARE_FORBIDDEN']);
  });

  it('flattens DTO failures into property-path details', async () => {
    const err = await caught(
      fakeCreateDashboard(C1, { name: '  ', scopeCoverage: 'SINGLE_COMPANY', scopeTargets: [C1] }, 'k1'),
    );
    expect([err.status, err.code]).toEqual([400, 'TRADE.VALIDATION_FAILED']);
    expect(err.details?.['name']).toEqual(['name must be longer than or equal to 1 characters']);
  });

  it('treats a multi-company dashboard with one company as FILTER_INVALID', async () => {
    const err = await caught(
      fakeCreateDashboard(
        C1,
        { name: 'Group view', scopeCoverage: 'MULTI_COMPANY_AUTHORIZED_UNION', scopeTargets: [C1] },
        'k2',
      ),
    );
    expect([err.status, err.code]).toEqual([422, 'TRADE.DASHBOARD.FILTER_INVALID']);
  });

  it('treats an unknown branch as COMPANY_BRANCH_MISMATCH', async () => {
    const err = await caught(
      fakeCreateDashboard(
        C1,
        { name: 'Branch view', scopeCoverage: 'SINGLE_COMPANY', scopeTargets: [{ companyId: 'c1', branchIds: ['b4'] }] },
        'k3',
      ),
    );
    expect([err.status, err.code]).toEqual([422, 'TRADE.DASHBOARD.COMPANY_BRANCH_MISMATCH']);
  });

  it('answers a reused idempotency key with another body with 422 MISMATCH', async () => {
    await fakeCreateDashboard(C1, { name: 'First', scopeCoverage: 'SINGLE_COMPANY', scopeTargets: [C1] }, 'same');
    const err = await caught(
      fakeCreateDashboard(C1, { name: 'Second', scopeCoverage: 'SINGLE_COMPANY', scopeTargets: [C1] }, 'same'),
    );
    expect([err.status, err.code]).toEqual([422, 'TRADE.IDEMPOTENCY.MISMATCH']);
  });

  it('checks the name before the revision on update', async () => {
    const err = await caught(fakeUpdateDashboard(C1, 'dash-purch-1', 99, { name: 'Executive overview' }));
    expect([err.status, err.code]).toEqual([409, 'TRADE.DASHBOARD.NAME_CONFLICT']);
    const stale = await caught(fakeUpdateDashboard(C1, 'dash-purch-1', 99, { name: 'Renamed' }));
    expect([stale.status, stale.code]).toEqual([409, 'TRADE.DASHBOARD.REVISION_CONFLICT']);
  });
});

describe('trade dashboard fake: run follows dashboard-execution.service.ts', () => {
  it('resolves full-company targets with every branch and a sha256 fingerprint', async () => {
    const res = await fakeRunDashboard(C1, 'dash-exec-1', {
      requestId: 'r1',
      scope: { scopeMode: 'SELECTED_SCOPES', companyScopes: [C1] },
    });
    expect(res.scope.targets).toEqual([{ companyId: 'c1', coverage: 'FULL_COMPANY', branchIds: ['b1', 'b2', 'b3'] }]);
    expect(res.scope.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(res.normalizedFilters.timeZone).toBe('UTC');
  });

  it('defaults to CURRENT_CONTEXT and honours the branch header there', async () => {
    const res = await fakeRunDashboard({ companyId: 'c1', branchId: 'b2' }, 'dash-exec-1', { requestId: 'r2' });
    expect(res.scope.mode).toBe('CURRENT_CONTEXT');
    expect(res.scope.targets).toEqual([{ companyId: 'c1', coverage: 'AUTHORIZED_SUBSET', branchIds: ['b2'] }]);
  });

  it('rejects companyScopes outside SELECTED_SCOPES and empty branch lists', async () => {
    const mixed = await caught(
      fakeRunDashboard(C1, 'dash-exec-1', {
        requestId: 'r3',
        scope: { scopeMode: 'SAVED_TARGETS', companyScopes: [C1] },
      }),
    );
    expect(mixed.code).toBe('TRADE.DASHBOARD.FILTER_INVALID');
    const empty = await caught(
      fakeRunDashboard(C1, 'dash-exec-1', {
        requestId: 'r4',
        scope: { scopeMode: 'SELECTED_SCOPES', companyScopes: [{ companyId: 'c1', branchIds: [] }] },
      }),
    );
    expect(empty.code).toBe('TRADE.DASHBOARD.FILTER_INVALID');
  });

  it('ignores dates sent with a non-custom preset', async () => {
    const res = await fakeRunDashboard(C1, 'dash-exec-1', {
      requestId: 'r5',
      scope: { scopeMode: 'SAVED_TARGETS' },
      filters: { datePreset: 'TODAY', dateFrom: '2020-01-01', dateTo: '2020-01-02' },
    });
    expect(res.normalizedFilters.dateFrom).toBe(res.normalizedFilters.today);
  });

  it('keeps unavailable placements out of the widgets map', async () => {
    const res = await fakeRunDashboard(C1, 'dash-ops-tarek', { requestId: 'r6', scope: { scopeMode: 'SAVED_TARGETS' } });
    expect(res.unavailablePlacements).toHaveLength(1);
    expect(Object.keys(res.widgets)).not.toContain('wgt-tarek-4');
    expect(res.status).toBe('PARTIAL');
    const err = await caught(
      fakeRunDashboard(C1, 'dash-ops-tarek', { requestId: 'r7', scope: { scopeMode: 'SAVED_TARGETS' }, widgetIds: ['wgt-tarek-4'] }),
    );
    expect(err.code).toBe('TRADE.DASHBOARD.WIDGET_INVALID');
  });

  it('fills owners and drill-through from the metric descriptor', async () => {
    const res = await fakeRunDashboard(C1, 'dash-exec-1', {
      requestId: 'r8',
      scope: { scopeMode: 'SELECTED_SCOPES', companyScopes: [{ companyId: 'c1', branchIds: ['b1'] }] },
    });
    const card = res.widgets['wgt-exec-1'];
    expect(card.status).toBe('READY');
    expect(card.sourceOwners).toEqual(['salesOrders']);
    expect(card.drillThrough?.targetCode).toBe('TRADE_SALESORDERS_LIST');
  });
});

describe('trade dashboard fake: company-scoped providers', () => {
  it('returns UNAVAILABLE with METRIC_PERMISSION_REQUIRED on a branch-limited target', async () => {
    await fakeAddPlacement(C1, 'dash-purch-1', { widgetId: 'wgt-lib-6' }, 'add-cs');
    const res = await fakeRunDashboard(C1, 'dash-purch-1', {
      requestId: 'r9',
      scope: { scopeMode: 'SELECTED_SCOPES', companyScopes: [{ companyId: 'c1', branchIds: ['b1'] }] },
      widgetIds: ['wgt-lib-6'],
    });
    expect(res.widgets['wgt-lib-6']).toMatchObject({
      status: 'UNAVAILABLE',
      shape: 'CATEGORY',
      errorCode: 'TRADE.DASHBOARD.METRIC_PERMISSION_REQUIRED',
      sourceOwners: [],
      partitions: [],
    });
    expect(res.widgets['wgt-lib-6'].drillThrough).toBeUndefined();
  });
});

describe('trade dashboard fake: writes', () => {
  it('returns created: false for an existing template without touching preferences', async () => {
    const res = await fakeCreateFromTemplate(C1, 'TRADE_EXECUTIVE', {}, 'tpl-1');
    expect(res.created).toBe(false);
    expect(res.dashboard.id).toBe('dash-exec-1');
    expect(res.warnings).toEqual([]);
  });

  it('creates template widgets with dimension keys and stores empty default filters for blank dashboards', async () => {
    const tpl = await fakeCreateFromTemplate(C1, 'SALES_AND_QUOTES', {}, 'tpl-2');
    expect(tpl.created).toBe(true);
    expect(tpl.dashboard.placements[0].widget.querySpec.dimensionKey).toBe('none');
    const blank = await fakeCreateDashboard(C1, { name: 'Blank', scopeCoverage: 'SINGLE_COMPANY', scopeTargets: [C1] }, 'k9');
    expect(blank.dashboard.defaultFilters).toEqual({});
  });

  it('clones widgets when duplicating', async () => {
    const res = await fakeDuplicateDashboard(C1, 'dash-sales-rana', {}, 'dup-1');
    expect(res.dashboard.name).toBe('Regional sales review Copy');
    expect(res.dashboard.placements.every((p) => p.widget.ownerUserId === FAKE_ME.id)).toBe(true);
    expect(res.dashboard.placements.some((p) => p.widgetId.startsWith('wgt-rana'))).toBe(false);
  });

  it('validates layout before the revision and keeps placement ids', async () => {
    const detail = await fakeGetDashboard(C1, 'dash-purch-1');
    const placements = detail.placements.map((p) => ({
      placementId: p.id,
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      sortOrder: p.sortOrder,
    }));
    const overlap = await caught(
      fakeUpdateLayout(C1, detail.id, 999, placements.map((p, i) => (i === 1 ? { ...p, x: 0 } : p))),
    );
    expect([overlap.status, overlap.code]).toEqual([409, 'TRADE.DASHBOARD.LAYOUT_OVERLAP']);
    const stale = await caught(fakeUpdateLayout(C1, detail.id, 999, placements));
    expect(stale.code).toBe('TRADE.DASHBOARD.REVISION_CONFLICT');
    const saved = await fakeUpdateLayout(C1, detail.id, detail.revision, placements);
    expect(saved.revision).toBe(detail.revision + 1);
  });

  it('adds a placement with id, sortOrder and replayed like the backend', async () => {
    const res = await fakeAddPlacement(C1, 'dash-purch-1', { widgetId: 'wgt-lib-1' }, 'add-1');
    expect(res.id).toBe(res.placementId);
    expect(res.sortOrder).toBe(8);
    expect(res.replayed).toBe(false);
    const again = await fakeAddPlacement(C1, 'dash-purch-1', { widgetId: 'wgt-lib-1' }, 'add-1');
    expect(again.replayed).toBe(true);
    const missing = await caught(fakeAddPlacement(C1, 'dash-purch-1', { widgetId: 'wgt-none' }, 'add-2'));
    expect([missing.status, missing.code]).toEqual([404, 'TRADE.DASHBOARD.WIDGET_NOT_FOUND']);
  });

  it('removing an unknown placement returns the current revision without a revision check', async () => {
    const res = await fakeRemovePlacement(C1, 'dash-purch-1', 'plc-none', 999);
    expect(res.revision).toBe(1);
  });

  it('upserts shares with the backend result rows and bumps the revision only on change', async () => {
    const first = await fakeUpsertShares(
      C1,
      'dash-exec-1',
      { resourceRevision: 1, changes: [{ subjectType: 'TEAM', subjectId: 'team-sales', accessLevel: 'VIEW' }] },
      'sh-1',
    );
    expect(first.resourceRevision).toBe(2);
    expect(first.changes[0]).toMatchObject({ subjectType: 'TEAM', subjectId: 'team-sales', changed: true, revision: 1 });
    const same = await fakeUpsertShares(
      C1,
      'dash-exec-1',
      { resourceRevision: 2, changes: [{ subjectType: 'TEAM', subjectId: 'team-sales', accessLevel: 'VIEW' }] },
      'sh-2',
    );
    expect(same.resourceRevision).toBe(2);
    expect(same.changes[0].changed).toBe(false);
    const self = await caught(
      fakeUpsertShares(
        C1,
        'dash-exec-1',
        { resourceRevision: 2, changes: [{ subjectType: 'USER', subjectId: FAKE_ME.id, accessLevel: 'VIEW' }] },
        'sh-3',
      ),
    );
    expect(self.code).toBe('TRADE.DASHBOARD.SHARE_TARGET_INVALID');
    const revoked = await fakeRevokeShare(C1, 'dash-exec-1', 'shr-none', 1);
    expect(revoked.revision).toBe(2);
  });

  it('reads isDefault/isFavorite for the company header context', async () => {
    await fakeSetFavorite(C1, 'dash-purch-1', { kind: 'COMPANY', companyId: 'c1' }, true, 'fav-1');
    const detail = await fakeGetDashboard(C1, 'dash-purch-1');
    expect(detail.isFavorite).toBe(true);
    const def = await fakeGetDefault(C1, { kind: 'COMPANY', companyId: 'c1' });
    expect(def.dashboard?.id).toBe('dash-exec-1');
  });
});
