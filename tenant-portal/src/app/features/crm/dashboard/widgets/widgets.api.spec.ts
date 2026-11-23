import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, newIdempotencyKey } from '../../../../shared/widgets/dashboard/analytics-api';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { ANALYTICS_PERMISSIONS_FIXTURE } from '../../../../shared/widgets/dashboard/analytics-permissions.fixture';
import { FAKE_PEOPLE } from '../../../../shared/widgets/dashboard/fake/fake-org';
import type { GovernedTargetRecord } from './widgets.model';
import { OrgApi } from '../../../../shared/widgets/dashboard/org.api';
import { TestBed } from '@angular/core/testing';
import { detailIssues } from '../shared/api-error-details';
import { WIDGET_STORE } from '../shared/widget-store.fake';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { widgetDetail, widgetDraft, widgetImpact } from './builder/builder-test-support';
import { compareFixture, transferFixture } from './widget-page/governance-test-support';
import {
  cloneWidget,
  deleteWidget,
  getWidgetTabCounts,
  getWidgetUsageCounts,
  listGovernedTargets,
  listGrantedBranches,
  listPipelineOptions,
  compareVersions,
  getDraft,
  getWidget,
  lifecycleImpact,
  listVersions,
  publishImpact,
  saveDraft,
  transferImpact,
} from './widgets.api';

let stub: CrmHttpStub;
let fixtures: Record<string, unknown>;
let dispose: () => void;
beforeEach(() => {
  bindAnalyticsPermissions(() => ANALYTICS_PERMISSIONS_FIXTURE);
  fixtures = {};
  stub = new CrmHttpStub(fixtures);
  dispose = bindCrmHttpForTest(stub);
});
afterEach(() => { crmQueries().clear(); dispose(); vi.restoreAllMocks(); bindAnalyticsPermissions(() => []); });

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

// Contract: crm-app src/crm/dashboards (dashboard-widgets.service.ts, dashboard-widget-*.service.ts).

async function rejection(work: Promise<unknown>): Promise<ApiError> {
  try {
    await work;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

function ownedPublished(minVersions = 1) {
  const found = WIDGET_STORE.find(
    (w) =>
      w.summary.accessLevel === 'OWNER' &&
      w.summary.status === 'PUBLISHED' &&
      !w.draft &&
      w.versions.length >= minVersions,
  );
  if (!found) throw new Error('no owned published widget in the fake store');
  return found;
}

describe('widget detail and draft (backend shapes)', () => {
  it('detail usage: the owner gets activeShareCount and counts every placement', async () => {
    const widget = ownedPublished();
    fixtures[`/widgets/${widget.summary.id}`] = widgetDetail();
    const detail = await getWidget(widget.summary.id);
    expect(stub.recordedReads().at(-1)?.path).toBe(`/widgets/${widget.summary.id}`);
    expect(detail.usage).toHaveProperty('activeShareCount');
    expect(detail.usage.placementCount).toBeGreaterThanOrEqual(detail.usage.placements.length);
  });

  it('saving a draft keeps the widget revision and returns the full draft view', async () => {
    const widget = ownedPublished();
    fixtures[`/widgets/${widget.summary.id}/draft`] = widgetDraft();
    const savedFixture = widgetDraft();
    savedFixture.draft!.revision = 1;
    response(savedFixture);
    const before = await getDraft(widget.summary.id);
    const saved = await saveDraft(widget.summary.id, {
      name: 'Draft rename',
      visualizationType: widget.summary.visualizationType!,
      querySpec: structuredClone(widget.summary.querySpec!),
      displaySpec: structuredClone(widget.summary.displaySpec ?? {}),
      expectedWidgetRevision: before.widgetRevision,
      expectedDraftId: null,
      expectedDraftRevision: 0,
    });
    expect(saved.widgetRevision).toBe(before.widgetRevision);
    expect(stub.recordedWrites().at(-1)).toMatchObject({ method: 'PATCH', path: `/widgets/${widget.summary.id}`, body: { name: 'Draft rename' } });
    expect(saved.draft).toMatchObject({ revision: 1, createdByUserId: expect.any(String) });
    expect(saved.draft).toHaveProperty('createdAt');
    expect(saved.draft).toHaveProperty('restoredFromVersionNumber', null);
  });

  it('a business 422 sends parallel path/code string arrays (lowercase snake codes)', async () => {
    const widget = ownedPublished();
    failure(422, 'CRM_WIDGET_METRIC_INVALID', { path: ['querySpec.series.0.metricKey'], code: ['unknown'] });
    const error = await rejection(
      saveDraft(widget.summary.id, {
        name: 'x',
        visualizationType: widget.summary.visualizationType!,
        querySpec: { ...structuredClone(widget.summary.querySpec!), series: [{ metricKey: 'crm.unknown.metric' }] },
        displaySpec: {},
        expectedWidgetRevision: widget.summary.revision,
        expectedDraftId: widget.draft?.draftId ?? null,
        expectedDraftRevision: widget.draft?.revision ?? 0,
      }),
    );
    expect(error.code).toBe('CRM_WIDGET_METRIC_INVALID');
    expect(detailIssues(error)).toEqual([{ path: 'querySpec.series.0.metricKey', code: 'unknown' }]);
    expect(Object.values(error.details ?? {}).every((v) => Array.isArray(v) && v.every((i) => typeof i === 'string'))).toBe(true);
  });
});

describe('widget versions and publication (backend shapes)', () => {
  it('compare returns the full version rows and 404s a version above the active one', async () => {
    const widget = ownedPublished(2);
    response(compareFixture());
    const compare = await compareVersions(widget.summary.id, 1, 2);
    expect(compare.left).toEqual(
      expect.objectContaining({ schemaVersion: expect.any(Number), provenance: expect.any(String), internalNotes: null }),
    );
    expect(compare.left).toHaveProperty('authoredByUserId');
    expect(stub.recordedWrites().at(-1)).toMatchObject({ path: `/widgets/${widget.summary.id}/versions/compare`, body: { leftVersionNumber: 1, rightVersionNumber: 2 } });
    failure(404, 'CRM_WIDGET_VERSION_NOT_FOUND');
    const missing = await rejection(compareVersions(widget.summary.id, 1, 99));
    expect([missing.status, missing.code]).toEqual([404, 'CRM_WIDGET_VERSION_NOT_FOUND']);
  });

  it('a never-published widget lists no versions with a null active version', async () => {
    const draftOnly = WIDGET_STORE.find((w) => w.summary.status === 'DRAFT');
    if (!draftOnly) return;
    fixtures[`/widgets/${draftOnly.summary.id}/versions`] = { activeVersionNumber: null, items: [], nextBeforeVersion: null };
    const page = await listVersions(draftOnly.summary.id);
    expect(page).toMatchObject({ activeVersionNumber: null, items: [], nextBeforeVersion: null });
  });

  it('publish impact always carries dependents (report items keyed by blueprintKey) and suspendedAlertRules', async () => {
    const widget = WIDGET_STORE.find((w) => w.summary.accessLevel === 'OWNER' && w.draft && w.summary.status === 'PUBLISHED');
    if (!widget || !widget.draft) return;
    response(widgetImpact());
    const impact = await publishImpact(widget.summary.id, {
      expectedWidgetRevision: widget.summary.revision,
      expectedGovernanceRevision: widget.summary.governanceRevision,
      expectedDraftId: widget.draft.draftId,
      expectedDraftRevision: widget.draft.revision,
    });
    expect(impact.dependents.reports).toHaveProperty('items');
    expect(impact.suspendedAlertRules).toEqual({ count: expect.any(Number), items: expect.any(Array) });
  });
});

describe('widget lifecycle, transfer and clone (backend shapes)', () => {
  it('lifecycle impact for a head already in the target state is 409 IMPACT_STALE', async () => {
    const widget = ownedPublished();
    failure(409, 'CRM_WIDGET_LIFECYCLE_IMPACT_STALE');
    const error = await rejection(
      lifecycleImpact(widget.summary.id, {
        action: 'RESTORE',
        expectedWidgetRevision: widget.summary.revision,
        expectedGovernanceRevision: widget.summary.governanceRevision,
      }),
    );
    expect([error.status, error.code]).toEqual([409, 'CRM_WIDGET_LIFECYCLE_IMPACT_STALE']);
  });

  it('transfer impact names the widget head, the target and the O-7 flag; a stale head is IMPACT_STALE', async () => {
    const widget = ownedPublished();
    const target = FAKE_PEOPLE.find((p) => p.id !== widget.summary.ownerUserId)!;
    const impactFixture = transferFixture();
    impactFixture.widget.id = widget.summary.id;
    impactFixture.target.id = target.id;
    response(impactFixture);
    const impact = await transferImpact(widget.summary.id, {
      targetUserId: target.id,
      expectedWidgetRevision: widget.summary.revision,
      expectedGovernanceRevision: widget.summary.governanceRevision,
    });
    expect(impact.widget.id).toBe(widget.summary.id);
    expect(impact.target.id).toBe(target.id);
    expect(impact).toMatchObject({ sharesRevokedOnTransfer: false, dashboardOwnerAccessRestoredCount: 0 });
    expect(typeof impact.expiresAt).toBe('string');
    failure(409, 'CRM_WIDGET_TRANSFER_IMPACT_STALE');
    const stale = await rejection(
      transferImpact(widget.summary.id, {
        targetUserId: target.id,
        expectedWidgetRevision: widget.summary.revision + 5,
        expectedGovernanceRevision: widget.summary.governanceRevision,
      }),
    );
    expect([stale.status, stale.code]).toEqual([409, 'CRM_WIDGET_TRANSFER_IMPACT_STALE']);
  });

  it('clone copies the active publication and answers the new draft state', async () => {
    const widget = ownedPublished();
    const clone = widgetDraft();
    clone.activeVersionNumber = null;
    clone.draft!.name = `${widget.summary.name} Copy`;
    response(clone);
    const state = await cloneWidget(widget.summary.id, null, newIdempotencyKey());
    expect(state.activeVersionNumber).toBeNull();
    expect(stub.recordedWrites().at(-1)).toMatchObject({ method: 'POST', path: `/widgets/${widget.summary.id}/clone`, body: {} });
    expect(state.draft?.name.endsWith(' Copy')).toBe(true);
    expect(state.draft?.internalNotes).toBeNull();
  });
});


describe('live widget integration', () => {
  const branchId = '019a9d10-0000-7000-8000-000000000101';
  const metricKey = 'crm.opportunities.won_value';
  const target = (changes: Partial<GovernedTargetRecord> = {}): GovernedTargetRecord => ({
    id: 'target-1', branchId, subjectType: 'BRANCH', subjectId: branchId, subjectName: null,
    metricKey, currencyCode: 'EGP', periodGrain: 'MONTH', periodStart: '2026-11-01',
    unit: 'MONEY', targetValue: '12500.50', approvalState: 'APPROVED', ...changes,
  });

  it('deletes a server widget absent from the local store and preserves 204', async () => {
    await expect(deleteWidget('server/id')).resolves.toBeUndefined();
    expect(stub.recordedWrites()).toEqual([expect.objectContaining({
      method: 'DELETE', path: '/widgets/server%2Fid', body: undefined,
    })]);
  });

  it.each(['CRM_WIDGET_LIFECYCLE_FORBIDDEN', 'CRM_WIDGET_LIFECYCLE_INVALID', 'CRM_WIDGET_NOT_FOUND'])
    ('propagates delete failure %s without replay', async (code) => {
      failure(422, code);
      await expect(deleteWidget('server-id')).rejects.toMatchObject({ code });
      expect(stub.recordedWrites()).toHaveLength(1);
    });

  it('never reuses a failed delete action key', async () => {
    failure(503, 'GW.UPSTREAM.UNAVAILABLE');
    await expect(deleteWidget('server-id')).rejects.toMatchObject({ status: 503 });
    await deleteWidget('server-id');
    const keys = stub.recordedWrites().map((write) => write.options.key);
    expect(new Set(keys).size).toBe(2);
  });

  it('loads every target page with the selected branch and narrows the binding explicitly', async () => {
    const read = vi.spyOn(stub, 'read');
    read.mockResolvedValueOnce({ items: [target(), target({ id: 'set', subjectType: 'TEAM_SET', branchId: null, subjectId: null }),
      target({ id: 'count', unit: 'COUNT', currencyCode: null }), target({ id: 'rate', unit: 'PERCENT', currencyCode: null }),
      target({ id: 'draft', approvalState: 'DRAFT' })], hasNext: true });
    read.mockResolvedValueOnce({ items: [target({ id: 'target-2', subjectName: 'Sales' })], hasNext: false });
    const items = await listGovernedTargets(metricKey, 'MONTH', branchId);
    expect(items.map((item) => item.id)).toEqual(['target-1', 'target-2']);
    expect(items[0]).toMatchObject({ subjectName: branchId, targetValue: '12500.50' });
    expect(read.mock.calls.map((call) => call[1])).toEqual([1, 2].map((page) => ({
      branchId, metricKey, periodGrain: 'MONTH', approvalState: 'APPROVED', page, limit: 100,
    })));
  });

  it('does not request targets without a selected branch', async () => {
    await expect(listGovernedTargets(metricKey, 'MONTH', '')).resolves.toEqual([]);
    expect(stub.recordedReads()).toEqual([]);
  });

  it.each([403, 422, 503])('propagates target %s failures without substituting rows', async (status) => {
    vi.spyOn(stub, 'read').mockRejectedValueOnce(new ApiError(status, 'CRM_TARGET_SOURCE_NOT_READY'));
    await expect(listGovernedTargets(metricKey, 'MONTH', branchId)).rejects.toMatchObject({ status });
  });

  it('uses actual pipeline IDs and bilingual names', async () => {
    fixtures['/pipelines'] = [{ id: 'pipeline-from-server', code: 'NEW', nameEn: 'New sales', nameAr: 'مبيعات جديدة' }];
    await expect(listPipelineOptions()).resolves.toEqual(fixtures['/pipelines']);
  });

  it('delegates branches to the authorized organization directory', async () => {
    const rows = [{ id: branchId, companyId: 'company', name: { en: 'Branch', ar: 'الفرع' } }];
    TestBed.configureTestingModule({});
    const org = TestBed.inject(OrgApi);
    vi.spyOn(org, 'listGrantedBranches').mockResolvedValue(rows);
    await expect(listGrantedBranches(org)).resolves.toEqual(rows);
    TestBed.resetTestingModule();
  });

  it('keeps both unavailable aggregate contracts isolated without requests or fabricated counts', async () => {
    await expect(getWidgetTabCounts({})).rejects.toMatchObject({ code: 'CRM_ANALYTICS_SOURCE_UNAVAILABLE' });
    await expect(getWidgetUsageCounts(['server-id'])).rejects.toMatchObject({ code: 'CRM_ANALYTICS_SOURCE_UNAVAILABLE' });
    expect(stub.recordedReads()).toEqual([]);
  });
});
