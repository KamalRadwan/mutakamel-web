import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, newIdempotencyKey } from '../../../../shared/widgets/dashboard/analytics-api';
import { issueDetails } from '../shared/api-error-details';
import {
  adoptBlueprint,
  getDashboard,
  getNavigation,
  getVersionBinding,
  listBlueprints,
  listDashboards,
  previewVersionPolicy,
  runDashboard,
  saveLayout,
  setVersionPolicy,
  type NavigationQuery,
} from './dashboards.api';
import { FAKE_BRANCHES, FAKE_COMPANIES, FAKE_ME } from '../../../../shared/widgets/dashboard/fake/fake-org';
import { DASHBOARD_STORE } from './dashboards.fake';
import { LayoutSizeInvalidError, placementIdFromPath } from './layout-save';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { dashboardRun } from './dashboard-page/dashboard-test-support';

let fixtures: Record<string, unknown>;
let stub: CrmHttpStub;
let dispose: () => void;
beforeEach(() => {
  fixtures = Object.fromEntries(DASHBOARD_STORE.map(({ detail }) => [`/dashboards/${detail.id}`, structuredClone(detail)]));
  stub = new CrmHttpStub(fixtures);
  dispose = bindCrmHttpForTest(stub);
});
afterEach(() => { crmQueries().clear(); dispose(); vi.restoreAllMocks(); });

function response(data: unknown): void {
  vi.spyOn(stub, 'write').mockImplementationOnce(async (method, path, body, options) => {
    const result = await CrmHttpStub.prototype.write.call(stub, method, path, body, options);
    return { ...result, data };
  });
}

function failure(status: number, code: string, details?: Record<string, string[]>): void {
  vi.spyOn(stub, 'write').mockImplementationOnce(async (method, path, body, options) => {
    await CrmHttpStub.prototype.write.call(stub, method, path, body, options);
    throw ApiError.fromResponse(status, { errorCode: code, details });
  });
}

function readFailure(status: number, details: Record<string, string[]>): void {
  vi.spyOn(stub, 'read').mockRejectedValueOnce(ApiError.fromResponse(status, { errorCode: 'CRM_VALIDATION_FAILED', details }));
}

// Contract: crm-app src/crm/dashboards (dashboard-definitions.service.ts, dashboard-placement-version.service.ts,
// dashboard-blueprint.service.ts, layout/layout-engine.service.ts).

async function rejection(work: Promise<unknown>): Promise<ApiError> {
  try {
    await work;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ownedEditable() {
  const found = DASHBOARD_STORE.find(
    (d) => d.detail.accessLevel === 'OWNER' && !d.detail.isLayoutLocked && d.detail.kind === 'DASHBOARD' && d.detail.placements.length > 0,
  );
  if (!found) throw new Error('no owned editable dashboard in the fake store');
  return found;
}

describe('dashboard list and detail (backend shapes)', () => {
  it('seed dashboard and placement ids are UUID v7', () => {
    for (const entry of DASHBOARD_STORE) {
      expect(entry.detail.id).toMatch(UUID_V7);
      for (const placement of entry.detail.placements) expect(placement.id).toMatch(UUID_V7);
    }
  });

  it('list rows carry the stored blueprintKey (string|null) and no detail-only blueprint fields; search is 1..120 characters', async () => {
    fixtures['/dashboards'] = { items: DASHBOARD_STORE.map(({ detail: { templateVersionPolicy, blueprintRevision, ...summary } }) => summary), nextCursor: null };
    const page = await listDashboards({ limit: 100 });
    expect(stub.recordedReads().at(-1)).toMatchObject({ path: '/dashboards', query: { limit: 100 } });
    for (const item of page.items) {
      expect(item).toHaveProperty('blueprintKey');
      const stored = DASHBOARD_STORE.find((d) => d.detail.id === item.id)!;
      expect(item.blueprintKey).toBe(stored.detail.blueprintKey);
    }
    expect(page.items.some((item) => item.kind === 'REPORT' && item.blueprintKey)).toBe(true);
    expect(page.items[0]).not.toHaveProperty('templateVersionPolicy');
    const name = page.items[0].name;
    const found = await listDashboards({ search: name.slice(0, 4).toUpperCase() });
    expect(found.items.some((item) => item.id === page.items[0].id)).toBe(true);
    readFailure(400, { search: ['max_length'] });
    const tooLong = await rejection(listDashboards({ search: 'x'.repeat(121) }));
    expect([tooLong.status, tooLong.code, tooLong.details]).toEqual([400, 'CRM_VALIDATION_FAILED', { search: ['max_length'] }]);
    readFailure(400, { search: ['min_length'] });
    const blank = await rejection(listDashboards({ search: '   ' }));
    expect(blank.details).toEqual({ search: ['min_length'] });
    expect(page.items[0]).not.toHaveProperty('blueprintRevision');
  });

  it('navigation omits `search` (list route only) and answers without it', async () => {
    fixtures['/dashboards/navigation'] = { items: [{ id: ownedEditable().detail.id, name: 'Sales' }], nextCursor: null, activeDashboardId: null };
    await getNavigation({ search: 'sales' } as unknown as NavigationQuery);
    expect(stub.recordedReads().at(-1)?.query).not.toHaveProperty('search');
    const nav = await getNavigation();
    expect(nav.items.length).toBeGreaterThan(0);
  });

  it('detail placements hold no geometry and unavailable placements only id, order and reason', async () => {
    const detail = await getDashboard(ownedEditable().detail.id);
    expect(detail.placements[0]).not.toHaveProperty('x');
    expect(detail.placements[0]).not.toHaveProperty('width');
    for (const u of detail.unavailablePlacements) expect(Object.keys(u).sort()).toEqual(['id', 'reason', 'sortOrder']);
  });
});

describe('layout size errors (string-array details)', () => {
  it('a below-minimum box answers path/code/placementId/minW/minH arrays that the reader parses', async () => {
    const record = ownedEditable();
    const detail = await getDashboard(record.detail.id);
    const items = detail.layouts['desktop'].items.map((item) => ({
      placementId: item.placementId,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      zIndex: item.zIndex,
      isHidden: item.isHidden,
    }));
    const target = items[0];
    target.w = 1;
    target.h = 1;
    failure(422, 'CRM_DASHBOARD_LAYOUT_SIZE_INVALID', {
      path: ['items.0.w', 'items.0.h'], code: ['min_width', 'min_height'], placementId: [target.placementId], minW: ['16'], minH: ['10'],
    });
    const error = await rejection(
      saveLayout(detail.id, { revision: detail.revision, breakpointKey: 'desktop', items }, newIdempotencyKey()),
    );
    expect(error.code).toBe('CRM_DASHBOARD_LAYOUT_SIZE_INVALID');
    // Paths are relative to the body (`items.0.w`, never `layout.items.0.w`); one path/code pair per violation.
    expect(error.details?.['path']).toEqual(['items.0.w', 'items.0.h']);
    expect(error.details?.['code']).toEqual(['min_width', 'min_height']);
    expect(error.details?.['placementId']).toEqual([target.placementId]);
    expect(error.details?.['minW']).toEqual([expect.stringMatching(/^\d+$/)]);
    const parsed = new LayoutSizeInvalidError(error, { removedPlacementIds: [], addedIdMap: {}, revision: detail.revision });
    expect(parsed.sizeDetails.placementId).toBe(target.placementId);
    expect(parsed.sizeDetails.minW).toBeGreaterThan(1);
    expect(parsed.sizeDetails.minH).toBeGreaterThan(1);
  });

  it('the reader ignores numeric values (the shared filter would drop them)', () => {
    const numeric = new ApiError(422, 'CRM_DASHBOARD_LAYOUT_SIZE_INVALID', { minW: 16 } as Record<string, unknown>);
    const parsed = new LayoutSizeInvalidError(numeric, { removedPlacementIds: [], addedIdMap: {}, revision: 1 }, 'p-1');
    expect(parsed.sizeDetails).toEqual({ placementId: 'p-1', minW: null, minH: null });
    const strings = new ApiError(
      422,
      'CRM_DASHBOARD_LAYOUT_SIZE_INVALID',
      issueDetails([{ path: 'items.3.w', code: 'min_width', placementId: 'p-9', minW: '16', minH: '10' }]),
    );
    const read = new LayoutSizeInvalidError(strings, { removedPlacementIds: [], addedIdMap: {}, revision: 1 });
    expect(read.sizeDetails).toEqual({ placementId: 'p-9', minW: 16, minH: 10 });
  });

  it('maps a body-relative items.<n> path to the box that was sent; a known placement id wins', () => {
    const sent = [{ placementId: 'p-0' }, { placementId: 'p-1' }];
    const noId = new ApiError(422, 'CRM_DASHBOARD_LAYOUT_SIZE_INVALID', {
      path: ['items.1.w', 'items.1.h'],
      code: ['min_width', 'min_height'],
      minW: ['16'],
      minH: ['10'],
    });
    expect(placementIdFromPath(noId, sent)).toBe('p-1');
    expect(placementIdFromPath(new ApiError(422, 'X', { path: ['layout.items.1.w'], code: ['min_width'] }), sent)).toBeNull();
    const add = new ApiError(422, 'CRM_DASHBOARD_LAYOUT_SIZE_INVALID', {
      path: ['w'], code: ['min_width'], placementId: ['server-new'], minW: ['16'], minH: ['10'],
    });
    const parsed = new LayoutSizeInvalidError(add, { removedPlacementIds: [], addedIdMap: {}, revision: 1 }, 'temp-1');
    expect(parsed.sizeDetails).toEqual({ placementId: 'temp-1', minW: 16, minH: 10 });
  });
});

describe('placement version policy (backend shapes)', () => {
  it('a pinned version above the active one is 404, FOLLOW_ACTIVE with a number is 422, an unchanged confirm is a no-op', async () => {
    const record = ownedEditable();
    const placementId = record.detail.placements[0].id;
    const bindingFixture = { dashboardId: record.detail.id, placementId, widgetId: record.detail.placements[0].widgetId,
      dashboardRevision: record.detail.revision, widgetRevision: 3, governanceRevision: 2,
      versionPolicy: 'FOLLOW_ACTIVE', pinnedVersionNumber: null, activeVersionNumber: 2, selectedVersionNumber: 2,
      placement: { x: 0, y: 0, w: 16, h: 10 } };
    fixtures[`/dashboards/${record.detail.id}/placements/${placementId}/version-policy`] = bindingFixture;
    const binding = await getVersionBinding(record.detail.id, placementId);
    const base = {
      expectedDashboardRevision: binding.dashboardRevision,
      expectedWidgetRevision: binding.widgetRevision,
      expectedGovernanceRevision: binding.governanceRevision,
    };
    failure(404, 'CRM_WIDGET_VERSION_NOT_FOUND');
    const missing = await rejection(
      previewVersionPolicy(record.detail.id, placementId, { ...base, versionPolicy: 'PINNED', pinnedVersionNumber: 999 }),
    );
    expect([missing.status, missing.code]).toEqual([404, 'CRM_WIDGET_VERSION_NOT_FOUND']);
    failure(422, 'CRM_DASHBOARD_PLACEMENT_VERSION_INVALID');
    const invalid = await rejection(
      previewVersionPolicy(record.detail.id, placementId, { ...base, versionPolicy: 'FOLLOW_ACTIVE', pinnedVersionNumber: 1 }),
    );
    expect([invalid.status, invalid.code]).toEqual([422, 'CRM_DASHBOARD_PLACEMENT_VERSION_INVALID']);

    response({ current: bindingFixture, proposed: { ...bindingFixture, changed: false, layoutChanged: false, visualizationType: 'METRIC_CARD' } });
    const same = await previewVersionPolicy(record.detail.id, placementId, {
      ...base,
      versionPolicy: binding.versionPolicy,
      pinnedVersionNumber: binding.pinnedVersionNumber,
    });
    expect(same.proposed.changed).toBe(false);
    response({ ...bindingFixture, changed: false });
    const result = await setVersionPolicy(record.detail.id, placementId, {
      ...base,
      versionPolicy: binding.versionPolicy,
      pinnedVersionNumber: binding.pinnedVersionNumber,
      expectedSelectedVersionNumber: same.proposed.selectedVersionNumber,
      expectedPlacement: same.proposed.placement,
    });
    expect(result.changed).toBe(false);
    expect(result.dashboardRevision).toBe(binding.dashboardRevision);
  });
});

describe('blueprints (backend shapes)', () => {
  it('keys follow the blueprint key pattern, targets are numbers, and a replayed adoption answers created: false', async () => {
    fixtures['/dashboards/blueprints'] = { items: [{ key: 'sales-overview', definitionRevision: 1, branchSelectionRequired: false, targets: [{ widgetName: 'Sales', target: 100 }] }] };
    const { items } = await listBlueprints();
    for (const bp of items) {
      expect(bp.key).toMatch(/^[a-z][a-z0-9-]{0,79}$/);
      for (const target of bp.targets) expect(typeof target.target).toBe('number');
    }
    const bp = items.find((item) => !item.branchSelectionRequired)!;
    const body = { definitionRevision: bp.definitionRevision, name: `Adopted ${bp.key}`, ...(bp.targets.length ? { confirmTargets: true as const } : {}) };
    const adoptedId = ownedEditable().detail.id;
    response({ dashboardId: adoptedId, definitionRevision: 1, created: true });
    const first = await adoptBlueprint(bp.key, body, newIdempotencyKey());
    expect(stub.recordedWrites().at(-1)).toMatchObject({ method: 'PUT', path: `/dashboards/blueprints/${bp.key}/adoption`, body });
    expect(first.created).toBe(true);
    response({ ...first, created: false });
    const replay = await adoptBlueprint(bp.key, body, newIdempotencyKey());
    expect(replay).toEqual({ ...first, created: false });
    fixtures[`/dashboards/${adoptedId}`] = { ...ownedEditable().detail, blueprintKey: bp.key, sourceTemplateKey: null };
    const adopted = await getDashboard(first.dashboardId);
    expect(adopted).toMatchObject({ blueprintKey: bp.key, sourceTemplateKey: null });
  });
});

describe('run organization scope (engine/dashboard-organization-scope.ts)', () => {
  const owned = () => ownedEditable().detail.id;
  const shared = () => DASHBOARD_STORE.find((d) => d.detail.ownerUserId !== FAKE_ME.id && d.detail.kind === 'DASHBOARD')!.detail.id;
  const [cairo, alex, giza] = FAKE_BRANCHES.map((b) => b.id);

  it('lists the readable companies and branches (company then branch order) and echoes list filters only when sent', async () => {
    const fixture = dashboardRun();
    fixture.organizationScope.companies = FAKE_COMPANIES.map((company) => ({ id: company.id, name: company.name.en }));
    fixture.organizationScope.branches = FAKE_BRANCHES.map((branch) => ({ ...branch, name: branch.name.en, companyName: FAKE_COMPANIES.find((company) => company.id === branch.companyId)!.name.en }));
    fixture.organizationScope.branches.sort((a, b) => `${a.companyName}|${a.name}`.localeCompare(`${b.companyName}|${b.name}`));
    response(fixture);
    const run = await runDashboard(owned());
    const org = run.organizationScope;
    expect([org.companyId, org.branchId, org.partialAccess]).toEqual([null, null, false]);
    expect(org).not.toHaveProperty('companyIds');
    expect(org).not.toHaveProperty('branchIds');
    expect(org.companies.map((c) => c.id).sort()).toEqual(FAKE_COMPANIES.map((c) => c.id).sort());
    expect(org.branches).toHaveLength(FAKE_BRANCHES.length);
    const order = org.branches.map((b) => `${b.companyName}|${b.name}`);
    expect(order).toEqual([...order].sort((a, b) => a.localeCompare(b)));

    response({ ...fixture, organizationScope: { ...fixture.organizationScope, branchIds: [cairo, giza].sort() } });
    const filtered = await runDashboard(owned(), { filters: { branchIds: [giza, cairo] } });
    expect(stub.recordedWrites().at(-1)).toMatchObject({ path: `/dashboards/${owned()}/run`, body: { filters: { branchIds: [giza, cairo] }, includePopulationOptions: true } });
    expect(filtered.organizationScope.branchIds).toEqual([cairo, giza].sort());
    expect(filtered.organizationScope.branches).toHaveLength(FAKE_BRANCHES.length);
  });

  it('a shared dashboard narrows the options and reports partialAccess', async () => {
    response({ ...dashboardRun(), organizationScope: { companyId: null, branchId: null, companies: FAKE_COMPANIES, branches: FAKE_BRANCHES.slice(0, 2), partialAccess: true } });
    const org = (await runDashboard(shared())).organizationScope;
    expect(org.partialAccess).toBe(true);
    expect(org.branches.map((b) => b.id).sort()).toEqual([cairo, alex].sort());
  });

  it('a company or branch outside the readable lists answers 403 CRM_SCOPED_PERMISSION_DENIED', async () => {
    failure(403, 'CRM_SCOPED_PERMISSION_DENIED');
    const branch = await rejection(runDashboard(shared(), { filters: { branchIds: [giza] } }));
    expect([branch.status, branch.code]).toEqual([403, 'CRM_SCOPED_PERMISSION_DENIED']);
    failure(403, 'CRM_SCOPED_PERMISSION_DENIED');
    const company = await rejection(runDashboard(owned(), { filters: { companyId: '01934b10-0000-7000-8000-0000000000ff' } }));
    expect([company.status, company.code]).toEqual([403, 'CRM_SCOPED_PERMISSION_DENIED']);
  });

  it('mixed or duplicate id formats answer 422 CRM_DASHBOARD_FILTER_INVALID', async () => {
    for (const filters of [
      { branchId: cairo, branchIds: [alex] },
      { branchIds: [cairo, cairo.toUpperCase()] },
      { companyIds: [] },
      { branchIds: ['not-a-uuid'] },
    ]) {
      failure(422, 'CRM_DASHBOARD_FILTER_INVALID');
      const error = await rejection(runDashboard(owned(), { filters }));
      expect([error.status, error.code]).toEqual([422, 'CRM_DASHBOARD_FILTER_INVALID']);
    }
  });
});
