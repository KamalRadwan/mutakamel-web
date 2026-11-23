import { type Type } from '@angular/core';
import { type ComponentFixture } from '@angular/core/testing';
import { type CoreQuery, type CoreWriteMethod, type CoreWriteResult } from '../../../../../core/api/core-http';
import { type CrmReadOptions, type CrmWriteOptions } from '../../../shared/crm-http';
import { CrmHttpStub } from '../../../shared/testing/crm-http-testing';
import { setupWidgetTest, widgetCatalog, widgetDetail, widgetDraft, widgetId } from '../builder/builder-test-support';
import type { LifecycleImpact, TransferImpact, VersionCompare } from '../widgets.model';
import widgetsEn from '../../../../../../../public/i18n/crm-widgets/en.json';
import widgetsAr from '../../../../../../../public/i18n/crm-widgets/ar.json';
import shareEn from '../../../../../../../public/i18n/crm-dash-share/en.json';
import shareAr from '../../../../../../../public/i18n/crm-dash-share/ar.json';

export { widgetDetail, widgetDraft, widgetId };
export const targetId = '019a9d10-0000-7000-8000-000000000098';
export const impactId = '019a9d10-0000-7000-8000-000000000097';
export const shareId = '019a9d10-0000-7000-8000-000000000096';
export const widgetPath = `/widgets/${widgetId}`;
export const versionPage = { widgetId, widgetRevision: 7, activeVersionNumber: 2,
  items: [2, 1].map((versionNumber) => ({ versionNumber, name: `Leads ${versionNumber}`,
    publishedAt: '2026-11-23T10:00:00Z', provenance: 'PUBLISH' })), nextBeforeVersion: null };
export const share = { id: shareId, subjectType: 'USER' as const, subjectId: targetId, accessLevel: 'VIEW' as const,
  effectiveAccessLevel: 'VIEW', subjectName: 'Recipient', subjectEmail: null, context: '', effectiveAccessSource: 'Direct grant',
  sharedByUserId: widgetDetail().ownerUserId, revision: 4, expiresAt: null,
  createdAt: '2026-11-23T10:00:00Z', updatedAt: '2026-11-23T10:00:00Z' };

export function lifecycleFixture(action: 'ARCHIVE' | 'RESTORE' = 'ARCHIVE'): LifecycleImpact {
  return { widgetId, impactId, action, expiresAt: '2026-11-23T10:10:00Z', widgetRevision: 7, governanceRevision: 3,
    activeVersionNumber: 2, hiddenPlacementCount: 3,
    placements: Array.from({ length: 6 }, (_, i) => ({ dashboardId: `dashboard-${i}`, dashboardName: `Sales ${i}`,
      dashboardRevision: 8, placementId: `placement-${i}`, versionPolicy: 'FOLLOW_ACTIVE', versionNumber: 2, eligibleToResume: i === 0 })),
    alertRules: { effect: action === 'ARCHIVE' ? 'WILL_SUSPEND' : 'OWNER_MUST_RESUME', count: 2,
      items: ['Revenue alert', 'Leads alert'].map((name, i) => ({ id: `rule-${i}`, name, enabled: true, suspendedReason: null })) } };
}

export function transferFixture(): TransferImpact {
  return { impactId, expiresAt: '2026-11-23T10:10:00Z', widget: { id: widgetId,
    name: 'Leads', ownerUserId: widgetDetail().ownerUserId, ownerName: 'Owner', widgetRevision: 7,
    governanceRevision: 3, activeVersionNumber: 2, draftRevision: null, archived: false },
    target: { id: targetId, name: 'Recipient' }, affectedPlacementCount: 6, retainedShareCount: 1,
    dashboardOwnerAccessLostCount: 2, dashboardOwnerAccessRestoredCount: 0,
    dashboardReadersMayNeedShareCount: 2, sharesRevokedOnTransfer: false };
}

export function compareFixture(): VersionCompare {
  const draft = widgetDraft().draft!;
  const snapshot = { versionNumber: 1, name: 'Original leads', visualizationType: draft.visualizationType!,
    schemaVersion: 1, querySpec: draft.querySpec, displaySpec: {}, publishedAt: '2026-11-23T10:00:00Z',
    provenance: 'PUBLISH', description: null, internalNotes: null, changeSummary: null, restoredFromVersionNumber: null,
    authoredByUserId: widgetDetail().ownerUserId };
  return { widgetId, widgetRevision: 7, governanceRevision: 3, activeVersionNumber: 2, archived: false,
    left: snapshot, right: { ...snapshot, versionNumber: 2, name: 'Current leads' }, changedSections: ['NAME'],
    restoreState: 'AVAILABLE', proof: { impactId, expiresAt: '2026-11-23T10:10:00Z' } };
}

export class GovernanceHttpStub extends CrmHttpStub {
  detail = widgetDetail();
  draft = widgetDraft();
  readFailures = new Map<string, unknown>();
  respond: (path: string, body: unknown) => unknown | Promise<unknown> = (path, body) => {
    if (path.endsWith('/lifecycle-impact')) return lifecycleFixture((body as { action: 'ARCHIVE' | 'RESTORE' }).action);
    if (path.endsWith('/versions/compare')) return compareFixture();
    if (path.endsWith('/ownership-transfer/impact')) return transferFixture();
    if (path.includes('/shares')) return { ...share, revision: 5 };
    return this.draft;
  };

  constructor() {
    super({ '/widgets/catalog': widgetCatalog, [widgetPath]: widgetDetail(),
      [`${widgetPath}/versions`]: versionPage, [`${widgetPath}/shares`]: [share],
      [`${widgetPath}/ownership-transfer/targets`]: { items: [{ id: targetId, name: 'Recipient' }], nextCursor: null },
      [`${widgetPath}/shares/preview`]: { subjectId: targetId, viewers: [] } });
  }

  override async read<T>(path: string, query?: CoreQuery, options?: CrmReadOptions): Promise<T> {
    const result = await super.read<T>(path, query, options);
    if (this.readFailures.has(path)) throw this.readFailures.get(path);
    return path === widgetPath ? structuredClone(this.detail) as T : result;
  }

  override async write<T>(method: CoreWriteMethod, path: string, body: unknown, options: CrmWriteOptions): Promise<CoreWriteResult<T>> {
    await super.write(method, path, body, options);
    return { status: method === 'DELETE' ? 204 : 200, data: await this.respond(path, body) as T,
      etag: path.includes('/shares/') && method === 'PATCH' ? `"widget-share:${shareId}:5"` : null, location: null };
  }
}

export function setupGovernanceTest(language: 'en' | 'ar', theme: string, stub = new GovernanceHttpStub()) {
  const setup = setupWidgetTest(language, theme, stub);
  setup.permissions.push('crm.widgets.delete', 'crm.widgets.share', 'crm.widgets.transfer_ownership');
  const widgets = language === 'ar' ? widgetsAr : widgetsEn;
  const shares = language === 'ar' ? shareAr : shareEn;
  setup.transloco.setTranslation(widgets, `crm-widgets/${language}`);
  setup.transloco.setTranslation(shares, `crm-dash-share/${language}`);
  setup.transloco.setTranslation({ widgets, share: shares }, language, { merge: true });
  return { ...setup, stub, create<T>(component: Type<T>) { return setup.create(component); } };
}

export async function render<T>(fixture: ComponentFixture<T>): Promise<void> {
  fixture.detectChanges();
  // Query promises run outside Angular's pending-task tracker.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await fixture.whenStable();
  fixture.detectChanges();
}
