import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError, newIdempotencyKey } from '../../../../shared/widgets/dashboard/analytics-api';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { ANALYTICS_PERMISSIONS_FIXTURE } from '../../../../shared/widgets/dashboard/analytics-permissions.fixture';
import { FAKE_PEOPLE } from '../../../../shared/widgets/dashboard/fake/fake-org';
import { detailIssues } from '../shared/api-error-details';
import { WIDGET_STORE } from '../shared/widget-store.fake';
import {
  cloneWidget,
  compareVersions,
  getDraft,
  getWidget,
  lifecycleImpact,
  listVersions,
  publishImpact,
  saveDraft,
  transferImpact,
} from './widgets.api';

beforeEach(() => bindAnalyticsPermissions(() => ANALYTICS_PERMISSIONS_FIXTURE));
afterEach(() => bindAnalyticsPermissions(() => []));

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
    const detail = await getWidget(widget.summary.id);
    expect(detail.usage).toHaveProperty('activeShareCount');
    expect(detail.usage.placementCount).toBeGreaterThanOrEqual(detail.usage.placements.length);
  });

  it('saving a draft keeps the widget revision and returns the full draft view', async () => {
    const widget = ownedPublished();
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
    expect(saved.draft).toMatchObject({ revision: 1, createdByUserId: expect.any(String) });
    expect(saved.draft).toHaveProperty('createdAt');
    expect(saved.draft).toHaveProperty('restoredFromVersionNumber', null);
  });

  it('a business 422 sends parallel path/code string arrays (lowercase snake codes)', async () => {
    const widget = ownedPublished();
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
    const compare = await compareVersions(widget.summary.id, 1, 2);
    expect(compare.left).toEqual(
      expect.objectContaining({ schemaVersion: expect.any(Number), provenance: expect.any(String), internalNotes: null }),
    );
    expect(compare.left).toHaveProperty('authoredByUserId');
    const missing = await rejection(compareVersions(widget.summary.id, 1, 99));
    expect([missing.status, missing.code]).toEqual([404, 'CRM_WIDGET_VERSION_NOT_FOUND']);
  });

  it('a never-published widget lists no versions with a null active version', async () => {
    const draftOnly = WIDGET_STORE.find((w) => w.summary.status === 'DRAFT');
    if (!draftOnly) return;
    const page = await listVersions(draftOnly.summary.id);
    expect(page).toMatchObject({ activeVersionNumber: null, items: [], nextBeforeVersion: null });
  });

  it('publish impact always carries dependents (report items keyed by blueprintKey) and suspendedAlertRules', async () => {
    const widget = WIDGET_STORE.find((w) => w.summary.accessLevel === 'OWNER' && w.draft && w.summary.status === 'PUBLISHED');
    if (!widget || !widget.draft) return;
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
    const impact = await transferImpact(widget.summary.id, {
      targetUserId: target.id,
      expectedWidgetRevision: widget.summary.revision,
      expectedGovernanceRevision: widget.summary.governanceRevision,
    });
    expect(impact.widget.id).toBe(widget.summary.id);
    expect(impact.target.id).toBe(target.id);
    expect(impact).toMatchObject({ sharesRevokedOnTransfer: false, dashboardOwnerAccessRestoredCount: 0 });
    expect(typeof impact.expiresAt).toBe('string');
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
    const state = await cloneWidget(widget.summary.id, null, newIdempotencyKey());
    expect(state.activeVersionNumber).toBeNull();
    expect(state.draft?.name.endsWith(' Copy')).toBe(true);
    expect(state.draft?.internalNotes).toBeNull();
  });
});
