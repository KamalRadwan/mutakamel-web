import { ApiError, fakeDelay, isUuidV7, pageOf, validationFailed } from './analytics-api';
import type { Catalog, Explain, Receipt, ShareTarget, SourceReadiness } from './analytics.model';
import { can } from './analytics-permissions';
import { FAKE_CATALOG } from './fake/fake-catalog';
import { FAKE_BRANCHES, FAKE_ME, FAKE_PEOPLE, FAKE_TEAMS, fakeLang } from './fake/fake-org';
import { FAKE_READINESS, FAKE_READINESS_AFFECTED, type ReadinessAffectedItem } from './fake/fake-readiness';
import { findExplain, findReceipt } from './fake/fake-receipts';
import { FAKE_ALL_STAFF_TEAM_ID, FAKE_EMPTY_TEAM_ID } from './fake/fake-results';

// {B} = /api/v1/crm. Each fake follows the crm-app controller: RequirePermissions (403 CRM_PERMISSION_DENIED) runs
// before the ValidationPipe (400 CRM_VALIDATION_FAILED), then the service codes.

export interface ReadinessDetail extends SourceReadiness {
  captureSourceKey: string | null;
  lastConfirmedAt: string | null;
  watermarkPinned: { watermark: string; firstSeenAt: string } | null;
  affected: ReadinessAffectedItem[];
  pageInfo: { limit: number; hasMore: boolean; nextCursor: string | null };
}

const SHARE_TARGETS_LIMIT_DEFAULT = 50;

function requirePermission(key: string): void {
  if (!can(key)) throw new ApiError(403, 'CRM_PERMISSION_DENIED');
}

function validateLimit(limit: number, field = 'limit'): void {
  if (!Number.isInteger(limit)) throw validationFailed(field, 'is_int');
  if (limit < 1) throw validationFailed(field, 'min');
  if (limit > 100) throw validationFailed(field, 'max');
}

// GET {B}/dashboards/catalog
export async function getCatalog(): Promise<Catalog> {
  await fakeDelay();
  const canReadCatalog = can('crm.dashboards.read') || can('crm.widgets.read');
  const metrics = canReadCatalog
    ? FAKE_CATALOG.metrics.filter((m) => (m.accessResources.includes('targets') ? can('crm.targets.read') : true))
    : [];
  return structuredClone({
    ...FAKE_CATALOG,
    metrics,
  });
}

// GET {B}/analytics/readiness?status
export async function listReadiness(status?: SourceReadiness['status']): Promise<{ items: SourceReadiness[] }> {
  await fakeDelay();
  requirePermission('crm.analytics.readiness.view');
  const items = status ? FAKE_READINESS.filter((row) => row.status === status) : FAKE_READINESS;
  return structuredClone({ items });
}

// GET {B}/analytics/readiness/:sourceKey?cursor&limit
export async function getReadiness(
  key: string,
  cursor: string | null = null,
  limit = 20,
): Promise<ReadinessDetail> {
  await fakeDelay();
  requirePermission('crm.analytics.readiness.view');
  validateLimit(limit);
  if (cursor && cursor.length > 1024) throw validationFailed('cursor', 'max_length');
  const row = FAKE_READINESS.find((item) => item.sourceKey === key);
  if (!row) {
    throw new ApiError(404, 'CRM_READINESS_SOURCE_UNKNOWN');
  }
  const allAffected = FAKE_READINESS_AFFECTED[key] ?? [];
  const page = pageOf(allAffected, cursor, limit);
  const detail: ReadinessDetail = {
    ...row,
    captureSourceKey: row.sourceKey,
    lastConfirmedAt: row.lastCheckedAt,
    watermarkPinned:
      row.stale && row.watermarkAt
        ? { watermark: row.watermarkAt, firstSeenAt: '2026-11-21T07:35:00.000Z' }
        : null,
    affected: page.items,
    pageInfo: page.pageInfo,
  };
  return structuredClone(detail);
}

/** Receipts are visible to their requester only: an unknown id is 404 `CRM_RECEIPT_NOT_FOUND`. */
function receiptOrThrow(id: string, field: string): Receipt {
  if (!isUuidV7(id)) throw validationFailed(field, 'is_uuid');
  const receipt = findReceipt(id);
  if (!receipt) throw new ApiError(404, 'CRM_RECEIPT_NOT_FOUND');
  return receipt;
}

// GET {B}/dashboards/receipts/:receiptId
export async function getReceipt(id: string): Promise<Receipt> {
  await fakeDelay();
  requirePermission('crm.dashboards.read');
  return structuredClone(receiptOrThrow(id, 'receiptId'));
}

// GET {B}/dashboards/receipts/:receiptId/explain?compareTo
export async function explainReceipt(id: string, compareTo?: string): Promise<Explain> {
  await fakeDelay();
  requirePermission('crm.dashboards.read');
  if (!isUuidV7(id)) throw validationFailed('receiptId', 'is_uuid');
  if (compareTo !== undefined && !isUuidV7(compareTo)) throw validationFailed('compareTo', 'is_uuid');
  const receipt = receiptOrThrow(id, 'receiptId');
  if (compareTo !== undefined) {
    const compared = receiptOrThrow(compareTo, 'compareTo');
    if (compared.metricKey !== receipt.metricKey) throw new ApiError(422, 'CRM_EXPLAIN_NOT_COMPARABLE');
  }
  const explain = findExplain(id);
  if (!explain) throw new ApiError(404, 'CRM_RECEIPT_NOT_FOUND');
  return structuredClone(explain);
}

/**
 * GET {B}/dashboards/share-targets | GET {B}/widgets/share-targets?search&limit&offset
 * Users (never the caller) and teams are paged separately by the same limit/offset; `nextOffset` is present only
 * while either list filled the page.
 */
export async function listShareTargets(
  kind: 'dashboards' | 'widgets',
  search = '',
  offset = 0,
  limit = SHARE_TARGETS_LIMIT_DEFAULT,
): Promise<{ items: ShareTarget[]; nextOffset?: number }> {
  await fakeDelay();
  requirePermission(kind === 'dashboards' ? 'crm.dashboards.share' : 'crm.widgets.share');
  const q = search.trim();
  if (q.length > 80) throw validationFailed('search', 'max_length');
  validateLimit(limit);
  if (!Number.isInteger(offset) || offset < 0) throw validationFailed('offset', 'min');
  if (offset > 10_000) throw validationFailed('offset', 'max');
  const lang = fakeLang();
  const needle = q.toLowerCase();
  const matches = (text: string) => !needle || text.toLowerCase().includes(needle);

  const users: ShareTarget[] = FAKE_PEOPLE.filter(
    (p) => p.id !== FAKE_ME.id && matches(`${p.name} ${p.nameAr} ${p.email}`),
  ).map((p) => ({ id: p.id, type: 'USER', name: lang === 'ar' ? p.nameAr : p.name, email: p.email, branchId: p.branchId }));

  // Fake-only teams that reach the preview limit (422 CRM_SHARE_PREVIEW_LIMIT_EXCEEDED) and the EMPTY preview state.
  const teamRows = [
    ...FAKE_TEAMS.map((t, index) => ({ id: t.id, code: `TEAM-${index + 1}`, en: t.name.en, ar: t.name.ar, branchId: t.branchId })),
    { id: FAKE_ALL_STAFF_TEAM_ID, code: 'TEAM-ALL', en: 'All staff', ar: 'جميع الموظفين', branchId: FAKE_BRANCHES[0].id },
    {
      id: FAKE_EMPTY_TEAM_ID,
      code: 'TEAM-EMPTY',
      en: 'New team (no members)',
      ar: 'فريق جديد (بلا أعضاء)',
      branchId: FAKE_BRANCHES[0].id,
    },
  ];
  const teams: ShareTarget[] = teamRows
    .filter((t) => matches(`${t.en} ${t.ar} ${t.code}`))
    .map((t) => ({ id: t.id, type: 'TEAM', name: lang === 'ar' ? t.ar : t.en, code: t.code, branchId: t.branchId }));

  const userPage = users.slice(offset, offset + limit);
  const teamPage = teams.slice(offset, offset + limit);
  const full = userPage.length === limit || teamPage.length === limit;
  return structuredClone({ items: [...userPage, ...teamPage], ...(full ? { nextOffset: offset + limit } : {}) });
}
