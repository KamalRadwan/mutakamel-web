import { describe, expect, it, vi } from 'vitest';
import { ApiError, newIdempotencyKey } from '../shared/trade-api';
import { bindTradeHttpForTest } from '../shared/trade-http';
import { TradeHttpStub } from '../shared/testing/trade-http-testing';
import {
  addPlacement,
  createDashboard,
  createFromTemplate,
  deleteDashboard,
  duplicateDashboard,
  getCatalog,
  getDashboard,
  getDefault,
  getNavigation,
  listDashboards,
  listShares,
  listShareTargets,
  listWidgets,
  removePlacement,
  revokeShare,
  runDashboard,
  setDefault,
  setFavorite,
  updateDashboard,
  updateLayout,
  upsertShares,
  type AddPlacementResponse,
  type CreateDashboardResponse,
  type CreateFromTemplateResponse,
  type DuplicateDashboardResponse,
  type ListDashboardsResponse,
  type UpsertSharesResponse,
} from './trade-dashboard.api';
import type {
  Catalog,
  DashboardDetail,
  DefaultResult,
  Navigation,
  PreferenceRow,
  RunResult,
  ShareListResponse,
  ShareTargetListResponse,
  WidgetListResponse,
} from './trade-dashboard.model';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMPANY_ID = '01900000-0000-7000-8000-000000000001';
const BRANCH_ID = '01900000-0000-7000-8000-000000000002';
const DASH_ID = '01900000-0000-7000-8000-000000000010';
const WIDGET_ID = '01900000-0000-7000-8000-000000000020';
const PLACEMENT_ID = '01900000-0000-7000-8000-000000000030';
const SHARE_ID = '01900000-0000-7000-8000-000000000040';
const USER_ID = '01900000-0000-7000-8000-000000000050';

function makeDetail(overrides: Partial<DashboardDetail> = {}): DashboardDetail {
  return {
    id: DASH_ID,
    ownerUserId: USER_ID,
    ownerName: 'Rana Mansour',
    name: 'Executive Overview',
    description: null,
    scopeCoverage: 'SINGLE_COMPANY',
    scopeTargets: [{ companyId: COMPANY_ID }],
    defaultFilters: { datePreset: 'CURRENT_MONTH', comparisonMode: 'NONE' },
    sourceTemplateKey: 'TRADE_EXECUTIVE',
    definitionSchemaVersion: 1,
    revision: 3,
    accessLevel: 'OWNER',
    isShared: false,
    isDefault: true,
    isFavorite: false,
    createdAt: '2026-11-23T09:00:00.000Z',
    updatedAt: '2026-11-23T10:00:00.000Z',
    placements: [],
    unavailablePlacements: [],
    responsive: { canonicalLayout: 'DESKTOP_12', derivedLayouts: ['DESKTOP_12', 'TABLET_6', 'MOBILE_1'] },
    ...overrides,
  };
}

describe('trade-dashboard.api (TradeHttpStub)', () => {
  it('getCatalog calls GET /dashboards/catalog with OPTIONAL scope and unwraps catalog', async () => {
    const catalog = { catalogVersion: 1, frontendContractVersion: 1 } as unknown as Catalog;
    const stub = new TradeHttpStub({ 'GET /dashboards/catalog': catalog });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(getCatalog({ companyId: COMPANY_ID, branchId: BRANCH_ID })).resolves.toEqual(catalog);
      expect(stub.recordedReads()[0]).toEqual({
        path: '/dashboards/catalog',
        query: undefined,
        scope: { companyId: COMPANY_ID, branchId: BRANCH_ID },
      });

      await getCatalog({});
      expect(stub.recordedReads()[1].scope).toEqual({});
    } finally {
      dispose();
    }
  });

  it('getNavigation calls GET /dashboards/navigation with PreferenceQuery and omits companyId when CONSOLIDATED', async () => {
    const nav: Navigation = {
      items: [],
      activeDashboardId: null,
      preferenceContext: { kind: 'COMPANY', companyId: COMPANY_ID },
      capabilities: { canEditLayout: true, canonicalColumns: 12, responsiveLayouts: ['DESKTOP_12'] },
    };
    const stub = new TradeHttpStub({ 'GET /dashboards/navigation': nav });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(getNavigation({ companyId: COMPANY_ID }, { kind: 'COMPANY', companyId: COMPANY_ID })).resolves.toEqual(nav);
      expect(stub.recordedReads()[0]).toEqual({
        path: '/dashboards/navigation',
        query: { kind: 'COMPANY', companyId: COMPANY_ID },
        scope: { companyId: COMPANY_ID },
      });

      await getNavigation({}, { kind: 'CONSOLIDATED', companyId: COMPANY_ID });
      expect(stub.recordedReads()[1]).toEqual({
        path: '/dashboards/navigation',
        query: { kind: 'CONSOLIDATED' },
        scope: {},
      });
    } finally {
      dispose();
    }
  });

  it('getDefault calls GET /dashboards/default with PreferenceQuery and OPTIONAL scope', async () => {
    const def: DefaultResult = {
      dashboard: null,
      ensureTemplate: { templateKey: 'TRADE_EXECUTIVE', preferenceContext: { kind: 'COMPANY', companyId: COMPANY_ID } },
    };
    const stub = new TradeHttpStub({ 'GET /dashboards/default': def });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(
        getDefault({ companyId: COMPANY_ID, branchId: BRANCH_ID }, { kind: 'COMPANY', companyId: COMPANY_ID }),
      ).resolves.toEqual(def);
      expect(stub.recordedReads()[0]).toEqual({
        path: '/dashboards/default',
        query: { kind: 'COMPANY', companyId: COMPANY_ID },
        scope: { companyId: COMPANY_ID, branchId: BRANCH_ID },
      });
    } finally {
      dispose();
    }
  });

  it('listDashboards calls GET /dashboards with offset pagination and no total', async () => {
    const res: ListDashboardsResponse = {
      items: [
        {
          id: DASH_ID,
          name: 'Sales',
          sourceTemplateKey: null,
          isDefault: false,
          isFavorite: true,
          isShared: false,
          accessLevel: 'OWNER',
          ownerUserId: USER_ID,
          ownerName: 'Rana',
          revision: 1,
          updatedAt: '2026-11-23T10:00:00.000Z',
          description: null,
          scopeCoverage: 'SINGLE_COMPANY',
          defaultFilters: {},
          definitionSchemaVersion: 1,
          createdAt: '2026-11-23T09:00:00.000Z',
          lastOpenedAt: null,
        },
      ],
      pagination: { limit: 25, offset: 50, nextOffset: 75 },
    };
    const stub = new TradeHttpStub({ 'GET /dashboards': res });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const actual = await listDashboards(
        { companyId: COMPANY_ID, branchId: BRANCH_ID },
        { kind: 'COMPANY', companyId: COMPANY_ID, limit: 25, offset: 50 },
      );
      expect(actual).toEqual(res);
      expect('total' in actual.pagination).toBe(false);
      expect(stub.recordedReads()[0]).toEqual({
        path: '/dashboards',
        query: { kind: 'COMPANY', companyId: COMPANY_ID, limit: 25, offset: 50 },
        scope: { companyId: COMPANY_ID, branchId: BRANCH_ID },
      });
    } finally {
      dispose();
    }
  });

  it('getDashboard calls GET /dashboards/:id and propagates 403', async () => {
    const detail = makeDetail();
    const stub = new TradeHttpStub({ 'GET /dashboards/:id': detail });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(getDashboard({ companyId: COMPANY_ID }, DASH_ID)).resolves.toEqual(detail);
      expect(stub.recordedReads()[0]).toEqual({
        path: `/dashboards/${DASH_ID}`,
        query: undefined,
        scope: { companyId: COMPANY_ID },
      });

      const forbidden = new ApiError(403, 'TRADE.DASHBOARD.SCOPE_DENIED');
      stub.register('GET', '/dashboards/:id', forbidden);
      await expect(getDashboard({ companyId: COMPANY_ID }, DASH_ID)).rejects.toBe(forbidden);
    } finally {
      dispose();
    }
  });

  it('createFromTemplate sends POST /dashboards/from-template/:key with key (gateway-unenforced) and whitelisted body', async () => {
    const created: CreateFromTemplateResponse = {
      created: true,
      replayed: false,
      warnings: [],
      dashboard: makeDetail(),
    };
    const stub = new TradeHttpStub({ 'POST /dashboards/from-template/:templateKey': created });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const key = newIdempotencyKey();
      const res = await createFromTemplate(
        { companyId: COMPANY_ID, branchId: BRANCH_ID },
        'TRADE_EXECUTIVE',
        { name: 'My Exec', preferenceContext: { kind: 'COMPANY', companyId: COMPANY_ID }, extraUi: 'drop' } as never,
        key,
        'ar',
      );
      expect(res).toEqual(created);
      expect(stub.recordedWrites()[0]).toEqual({
        method: 'POST',
        path: '/dashboards/from-template/TRADE_EXECUTIVE',
        body: { name: 'My Exec', preferenceContext: { kind: 'COMPANY', companyId: COMPANY_ID } },
        key,
        ifMatch: undefined,
        scope: { companyId: COMPANY_ID, branchId: BRANCH_ID },
        query: undefined,
      });
      await expect(createFromTemplate({}, 'TRADE_EXECUTIVE', {}, '')).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.IDEMPOTENCY.KEY_MISSING',
      });
    } finally {
      dispose();
    }
  });

  it('createDashboard sends POST /dashboards with key (gateway-unenforced), whitelisted body, and propagates field details', async () => {
    const created: CreateDashboardResponse = { created: true, replayed: false, dashboard: makeDetail() };
    const stub = new TradeHttpStub({ 'POST /dashboards': created });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const key = newIdempotencyKey();
      const res = await createDashboard(
        { companyId: COMPANY_ID },
        {
          name: 'Sales Board',
          description: 'Q4',
          scopeCoverage: 'SINGLE_COMPANY',
          scopeTargets: [{ companyId: COMPANY_ID, uiExtra: true } as never],
          uiOnly: 'drop-me',
        } as never,
        key,
      );
      expect(res).toEqual(created);
      expect(stub.recordedWrites()[0]).toEqual({
        method: 'POST',
        path: '/dashboards',
        body: {
          name: 'Sales Board',
          description: 'Q4',
          scopeCoverage: 'SINGLE_COMPANY',
          scopeTargets: [{ companyId: COMPANY_ID }],
        },
        key,
        ifMatch: undefined,
        scope: { companyId: COMPANY_ID },
        query: undefined,
      });

      const validationErr = new ApiError(400, 'TRADE.VALIDATION_FAILED', {
        name: ['name must be shorter than or equal to 120 characters'],
      });
      stub.register('POST', '/dashboards', validationErr);
      await expect(
        createDashboard(
          { companyId: COMPANY_ID },
          { name: 'x', scopeCoverage: 'SINGLE_COMPANY', scopeTargets: [{ companyId: COMPANY_ID }] },
          newIdempotencyKey(),
        ),
      ).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.VALIDATION_FAILED',
        details: { name: ['name must be shorter than or equal to 120 characters'] },
      });
    } finally {
      dispose();
    }
  });

  it('updateDashboard sends PATCH /dashboards/:id with If-Match, key, and whitelisted body', async () => {
    const updated = makeDetail({ revision: 4, name: 'Renamed' });
    const stub = new TradeHttpStub({ 'PATCH /dashboards/:id': updated });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const res = await updateDashboard(
        { companyId: COMPANY_ID },
        DASH_ID,
        3,
        { name: 'Renamed', description: 'Updated', extraField: 'strip' } as never,
      );
      expect(res).toEqual(updated);
      const write = stub.recordedWrites()[0];
      expect(write).toMatchObject({
        method: 'PATCH',
        path: `/dashboards/${DASH_ID}`,
        body: { name: 'Renamed', description: 'Updated' },
        ifMatch: '"3"',
        scope: { companyId: COMPANY_ID },
      });
      expect(write.key).toMatch(UUID_V7_REGEX);
    } finally {
      dispose();
    }
  });

  it('deleteDashboard sends DELETE /dashboards/:id with If-Match, key, and undefined body', async () => {
    const stub = new TradeHttpStub({ 'DELETE /dashboards/:id': undefined });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(deleteDashboard({ companyId: COMPANY_ID }, DASH_ID, 5)).resolves.toBeUndefined();
      const write = stub.recordedWrites()[0];
      expect(write).toMatchObject({
        method: 'DELETE',
        path: `/dashboards/${DASH_ID}`,
        body: undefined,
        ifMatch: '"5"',
        scope: { companyId: COMPANY_ID },
      });
      expect(write.key).toMatch(UUID_V7_REGEX);
    } finally {
      dispose();
    }
  });

  it('duplicateDashboard sends POST /dashboards/:id/duplicate with key (gateway-unenforced)', async () => {
    const dup: DuplicateDashboardResponse = {
      replayed: false,
      duplication: { omittedUnavailableWidgetCount: 1 },
      dashboard: makeDetail(),
    };
    const stub = new TradeHttpStub({ 'POST /dashboards/:id/duplicate': dup });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const key = newIdempotencyKey();
      await expect(
        duplicateDashboard({ companyId: COMPANY_ID }, DASH_ID, { name: 'Copy', extra: 1 } as never, key),
      ).resolves.toEqual(dup);
      expect(stub.recordedWrites()[0]).toEqual({
        method: 'POST',
        path: `/dashboards/${DASH_ID}/duplicate`,
        body: { name: 'Copy' },
        key,
        ifMatch: undefined,
        scope: { companyId: COMPANY_ID },
        query: undefined,
      });
    } finally {
      dispose();
    }
  });

  it('setDefault and setFavorite send key (gateway-unenforced) and validate favorite boolean', async () => {
    const row: PreferenceRow = {
      id: 'pref-1',
      dashboardId: DASH_ID,
      isDefault: true,
      isFavorite: true,
      revision: 2,
      replayed: false,
    };
    const stub = new TradeHttpStub({
      'POST /dashboards/:id/set-default': row,
      'POST /dashboards/:id/set-favorite': row,
    });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const key1 = newIdempotencyKey();
      await expect(
        setDefault({ companyId: COMPANY_ID }, DASH_ID, { kind: 'CONSOLIDATED', companyId: COMPANY_ID }, key1),
      ).resolves.toEqual(row);
      expect(stub.recordedWrites()[0]).toEqual({
        method: 'POST',
        path: `/dashboards/${DASH_ID}/set-default`,
        body: { context: { kind: 'CONSOLIDATED' } },
        key: key1,
        ifMatch: undefined,
        scope: { companyId: COMPANY_ID },
        query: undefined,
      });

      const key2 = newIdempotencyKey();
      await expect(
        setFavorite({ companyId: COMPANY_ID }, DASH_ID, { kind: 'COMPANY', companyId: COMPANY_ID }, true, key2),
      ).resolves.toEqual(row);
      expect(stub.recordedWrites()[1]).toEqual({
        method: 'POST',
        path: `/dashboards/${DASH_ID}/set-favorite`,
        body: { context: { kind: 'COMPANY', companyId: COMPANY_ID }, favorite: true },
        key: key2,
        ifMatch: undefined,
        scope: { companyId: COMPANY_ID },
        query: undefined,
      });

      await expect(
        setFavorite({ companyId: COMPANY_ID }, DASH_ID, { kind: 'COMPANY', companyId: COMPANY_ID }, 'true' as never, key2),
      ).rejects.toMatchObject({ status: 400, code: 'TRADE.VALIDATION_FAILED' });
    } finally {
      dispose();
    }
  });

  it('updateLayout sends PATCH /dashboards/:id/layout with If-Match and propagates 409 conflict', async () => {
    const updated = makeDetail({ revision: 4 });
    const stub = new TradeHttpStub({ 'PATCH /dashboards/:id/layout': updated });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const res = await updateLayout({ companyId: COMPANY_ID }, DASH_ID, 3, [
        { placementId: PLACEMENT_ID, x: 0, y: 0, width: 6, height: 4, sortOrder: 0, uiFlag: true } as never,
      ]);
      expect(res).toEqual(updated);
      const write = stub.recordedWrites()[0];
      expect(write).toMatchObject({
        method: 'PATCH',
        path: `/dashboards/${DASH_ID}/layout`,
        body: { placements: [{ placementId: PLACEMENT_ID, x: 0, y: 0, width: 6, height: 4, sortOrder: 0 }] },
        ifMatch: '"3"',
        scope: { companyId: COMPANY_ID },
      });
      expect(write.key).toMatch(UUID_V7_REGEX);

      const conflict = new ApiError(409, 'TRADE.DASHBOARD.REVISION_CONFLICT');
      stub.register('PATCH', '/dashboards/:id/layout', conflict);
      await expect(updateLayout({ companyId: COMPANY_ID }, DASH_ID, 3, [])).rejects.toBe(conflict);
    } finally {
      dispose();
    }
  });

  it('runDashboard posts POST /dashboards/:id/run with requestId and no idempotency key', async () => {
    const runResult = { dashboardId: DASH_ID, status: 'COMPLETE', widgets: {} } as unknown as RunResult;
    const stub = new TradeHttpStub({ 'POST /dashboards/:id/run': runResult });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const reqId = newIdempotencyKey();
      const res = await runDashboard(
        { companyId: COMPANY_ID, branchId: BRANCH_ID },
        DASH_ID,
        {
          requestId: reqId,
          scope: { scopeMode: 'SELECTED_SCOPES', companyScopes: [{ companyId: COMPANY_ID, branchIds: [BRANCH_ID] }] },
          filters: { datePreset: 'CURRENT_MONTH', comparisonMode: 'NONE' },
          widgetIds: [WIDGET_ID],
        },
      );
      expect(res).toEqual(runResult);
      expect(stub.recordedWrites()[0].key).toBeUndefined();
      expect(stub.recordedWrites()[0]).toMatchObject({
        method: 'POST',
        path: `/dashboards/${DASH_ID}/run`,
        body: {
          requestId: reqId,
          scope: { scopeMode: 'SELECTED_SCOPES', companyScopes: [{ companyId: COMPANY_ID, branchIds: [BRANCH_ID] }] },
          filters: { datePreset: 'CURRENT_MONTH', comparisonMode: 'NONE' },
          widgetIds: [WIDGET_ID],
        },
        ifMatch: undefined,
        scope: { companyId: COMPANY_ID, branchId: BRANCH_ID },
      });
    } finally {
      dispose();
    }
  });

  it('addPlacement sends POST /dashboards/:id/placements with key (gateway-unenforced)', async () => {
    const added: AddPlacementResponse = {
      id: PLACEMENT_ID,
      placementId: PLACEMENT_ID,
      widgetId: WIDGET_ID,
      dashboardRevision: 4,
      x: 0,
      y: 0,
      width: 3,
      height: 2,
      sortOrder: 0,
      replayed: false,
    };
    const stub = new TradeHttpStub({ 'POST /dashboards/:id/placements': added });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const key = newIdempotencyKey();
      await expect(
        addPlacement({ companyId: COMPANY_ID }, DASH_ID, { widgetId: WIDGET_ID, extra: 1 } as never, key),
      ).resolves.toEqual(added);
      expect(stub.recordedWrites()[0]).toEqual({
        method: 'POST',
        path: `/dashboards/${DASH_ID}/placements`,
        body: { widgetId: WIDGET_ID },
        key,
        ifMatch: undefined,
        scope: { companyId: COMPANY_ID },
        query: undefined,
      });
    } finally {
      dispose();
    }
  });

  it('removePlacement sends DELETE /dashboards/:id/placements/:placementId with If-Match and parses ETag revision', async () => {
    const stub = new TradeHttpStub();
    const writeSpy = vi.spyOn(stub, 'write').mockResolvedValueOnce({
      status: 204,
      data: undefined,
      etag: '"9"',
      location: null,
    });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(removePlacement({ companyId: COMPANY_ID }, DASH_ID, PLACEMENT_ID, 3)).resolves.toEqual({
        revision: 9,
      });
      expect(writeSpy.mock.calls[0][0]).toBe('DELETE');
      expect(writeSpy.mock.calls[0][1]).toBe(`/dashboards/${DASH_ID}/placements/${PLACEMENT_ID}`);
      expect(writeSpy.mock.calls[0][2]).toBeUndefined();
      expect(writeSpy.mock.calls[0][3].ifMatch).toBe('"3"');
      expect(writeSpy.mock.calls[0][3].key).toMatch(UUID_V7_REGEX);

      writeSpy.mockResolvedValueOnce({ status: 204, data: undefined, etag: null, location: null });
      await expect(removePlacement({ companyId: COMPANY_ID }, DASH_ID, PLACEMENT_ID, 9)).rejects.toMatchObject({
        code: 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED',
      });
    } finally {
      dispose();
    }
  });

  it('listShares, upsertShares, and revokeShare send correct methods, keys, If-Match, and ETag revision', async () => {
    const sharesRes: ShareListResponse = { items: [] };
    const upsertRes: UpsertSharesResponse = { resourceRevision: 6, changes: [], replayed: false };
    const stub = new TradeHttpStub({
      'GET /dashboards/:id/shares': sharesRes,
      'POST /dashboards/:id/shares/bulk-upsert': upsertRes,
    });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(listShares({ companyId: COMPANY_ID }, DASH_ID)).resolves.toEqual(sharesRes);
      expect(stub.recordedReads()[0]).toEqual({
        path: `/dashboards/${DASH_ID}/shares`,
        query: undefined,
        scope: { companyId: COMPANY_ID },
      });

      const key = newIdempotencyKey();
      await expect(
        upsertShares(
          { companyId: COMPANY_ID },
          DASH_ID,
          {
            resourceRevision: 5,
            changes: [{ subjectType: 'USER', subjectId: USER_ID, accessLevel: 'EDIT', uiName: 'x' } as never],
          },
          key,
        ),
      ).resolves.toEqual(upsertRes);
      expect(stub.recordedWrites()[0]).toEqual({
        method: 'POST',
        path: `/dashboards/${DASH_ID}/shares/bulk-upsert`,
        body: {
          resourceRevision: 5,
          changes: [{ subjectType: 'USER', subjectId: USER_ID, accessLevel: 'EDIT' }],
        },
        key,
        ifMatch: undefined,
        scope: { companyId: COMPANY_ID },
        query: undefined,
      });

      const writeSpy = vi.spyOn(stub, 'write').mockResolvedValueOnce({
        status: 204,
        data: undefined,
        etag: '"7"',
        location: null,
      });
      await expect(revokeShare({ companyId: COMPANY_ID }, DASH_ID, SHARE_ID, 6)).resolves.toEqual({ revision: 7 });
      expect(writeSpy.mock.calls[0][0]).toBe('DELETE');
      expect(writeSpy.mock.calls[0][1]).toBe(`/dashboards/${DASH_ID}/shares/${SHARE_ID}`);
      expect(writeSpy.mock.calls[0][3].ifMatch).toBe('"6"');
    } finally {
      dispose();
    }
  });

  it('listShareTargets calls GET /dashboards/share-targets with backend {subjectType, subjectId, name, status} shape and offset pagination', async () => {
    const targetsRes: ShareTargetListResponse = {
      items: [{ subjectType: 'USER', subjectId: USER_ID, name: 'Rana Mansour', status: 'ACTIVE' }],
      pagination: { limit: 20, offset: 0, nextOffset: null },
    };
    const stub = new TradeHttpStub({ 'GET /dashboards/share-targets': targetsRes });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(
        listShareTargets({ companyId: COMPANY_ID }, { search: '  Rana  ', limit: 20, offset: 0 }),
      ).resolves.toEqual(targetsRes);
      expect(stub.recordedReads()[0]).toEqual({
        path: '/dashboards/share-targets',
        query: { search: 'Rana', limit: 20, offset: 0 },
        scope: { companyId: COMPANY_ID },
      });

      await listShareTargets({}, { search: '   ' });
      expect(stub.recordedReads()[1]).toEqual({
        path: '/dashboards/share-targets',
        query: undefined,
        scope: {},
      });
    } finally {
      dispose();
    }
  });

  it('listWidgets calls catalogue read GET /widgets only (no paging)', async () => {
    const widgetsRes: WidgetListResponse = { items: [] };
    const stub = new TradeHttpStub({ 'GET /widgets': widgetsRes });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(listWidgets({ companyId: COMPANY_ID, branchId: BRANCH_ID })).resolves.toEqual(widgetsRes);
      expect(stub.recordedReads()[0]).toEqual({
        path: '/widgets',
        query: undefined,
        scope: { companyId: COMPANY_ID, branchId: BRANCH_ID },
      });
    } finally {
      dispose();
    }
  });
});
