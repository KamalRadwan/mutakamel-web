import {
  ApiError,
  type CursorPage,
  fakeDelay,
} from '../../../../shared/widgets/dashboard/analytics-api';
import type { SharePreview } from '../../../../shared/widgets/dashboard/analytics.model';
import { can, scopeLevels } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { listOwnerOptions as listAnalyticsOwnerOptions } from '../../../../shared/widgets/dashboard/org.api';
import { crmHttp, crmQueries } from '../../shared/crm-http';
import { isRetryableWriteError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import type { CoreQuery, CoreWriteMethod } from '../../../../core/api/core-http';
import { FAKE_BRANCHES, FAKE_ME, FAKE_PEOPLE } from '../../../../shared/widgets/dashboard/fake/fake-org';
import { WIDGET_STORE, type StoredWidget } from '../shared/widget-store.fake';
import { deleteUsage, ensureUsageFor, fakeGovernedTargets, getUsageSummaryCounts, personName, personTeamId } from './widgets.fake';
import type {
  ApplyLifecycleBody,
  ApplyLifecycleResult,
  DashboardFilters,
  DisplaySpec,
  DraftState,
  GovernedTargetOption,
  LifecycleImpact,
  LifecycleImpactBody,
  PanelOutcome,
  PublishImpact,
  PublishImpactBody,
  PublishWidgetBody,
  PublishWidgetResult,
  QuerySpec,
  RestoreVersionBody,
  RestoreVersionResult,
  Share,
  ShareListItem,
  TransferImpact,
  TransferImpactBody,
  TransferWidgetBody,
  TransferWidgetResult,
  VersionCompare,
  Visualization,
  WidgetBody,
  WidgetDetail,
  WidgetExecution,
  WidgetListQuery,
  WidgetSourceResource,
  WidgetSummary,
  WidgetTabCounts,
  WidgetVersionsPage,
} from './widgets.model';

function findStoredWidget(id: string): StoredWidget {
  const widget = WIDGET_STORE.find((item) => item.summary.id === id);
  if (!widget || !isVisibleToViewer(widget)) {
    throw new ApiError(404, 'CRM_WIDGET_NOT_FOUND');
  }
  return widget;
}

function isVisibleToViewer(widget: StoredWidget): boolean {
  const s = widget.summary;
  if (s.status === 'PUBLISHED') return true;
  if (s.ownerUserId === FAKE_ME.id) return true;
  if (s.isShared) return true;
  const myTeamId = personTeamId(FAKE_ME.id);
  return widget.shares.some(
    (share) =>
      (share.subjectType === 'USER' && share.subjectId === FAKE_ME.id) ||
      (share.subjectType === 'TEAM' && myTeamId !== null && share.subjectId === myTeamId),
  );
}

function isSharedWithViewer(widget: StoredWidget): boolean {
  const s = widget.summary;
  if (s.ownerUserId === FAKE_ME.id) return false;
  const myTeamId = personTeamId(FAKE_ME.id);
  const directGrant = widget.shares.some(
    (share) =>
      (share.subjectType === 'USER' && share.subjectId === FAKE_ME.id) ||
      (share.subjectType === 'TEAM' && myTeamId !== null && share.subjectId === myTeamId),
  );
  return directGrant || s.isShared;
}

function localizedSummary(summary: WidgetSummary): WidgetSummary {
  return {
    ...summary,
    ownerName: personName(summary.ownerUserId, summary.ownerName),
  };
}

function compareNewest(a: WidgetSummary, b: WidgetSummary): number {
  const byUpdate = b.updatedAt.localeCompare(a.updatedAt);
  if (byUpdate !== 0) return byUpdate;
  const byCreate = b.createdAt.localeCompare(a.createdAt);
  if (byCreate !== 0) return byCreate;
  return b.id.localeCompare(a.id);
}

function filterWidgetsList(
  q: Pick<WidgetListQuery, 'search' | 'access' | 'status' | 'source' | 'ownerUserId'>,
): WidgetSummary[] {
  const search = q.search?.trim() ?? '';
  if (search.length > 120) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', { search: ['max_length'] });
  }
  const searchLower = search.toLowerCase();
  const myTeamId = personTeamId(FAKE_ME.id);

  return WIDGET_STORE.filter((widget) => {
    if (!isVisibleToViewer(widget)) return false;
    const s = widget.summary;

    if (q.access === 'OWNED' && s.ownerUserId !== FAKE_ME.id) return false;
    if (q.access === 'SHARED' && !isSharedWithViewer(widget)) return false;
    if (q.access === 'TEAM' && (!myTeamId || personTeamId(s.ownerUserId) !== myTeamId)) return false;

    if (q.status && s.status !== q.status) return false;
    if (q.source && !s.sourceResources.includes(q.source as WidgetSourceResource)) return false;
    if (q.ownerUserId && s.ownerUserId !== q.ownerUserId) return false;

    if (searchLower && !s.name.toLowerCase().includes(searchLower)) {
      return false;
    }
    return true;
  })
    .map((widget) => localizedSummary(widget.summary))
    .sort(compareNewest);
}

// GET {B}/widgets?access=&status=&source=&ownerUserId=&search=&cursor=&limit=  -> { items, nextCursor } (cursor = last id, limit 1..100, default 50)
export async function listWidgets(q: WidgetListQuery): Promise<CursorPage<WidgetSummary>> {
  const query = { ...q, search: q.search?.trim(), limit: q.limit ?? 50 };
  // No organization scope mode: the server applies widget visibility and dataset access.
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'widgets', query],
    queryFn: () => crmHttp().read('/widgets', query),
  });
}

// FAKE-ONLY, no backend route. Kept for API compatibility; the live library shows no tab counts.
export async function getWidgetTabCounts(
  q: Pick<WidgetListQuery, 'search' | 'source' | 'ownerUserId' | 'status'>,
): Promise<WidgetTabCounts> {
  await fakeDelay(120);
  if (!can('crm.widgets.read')) {
    throw new ApiError(403, 'CRM_PERMISSION_DENIED');
  }
  const base = {
    ...(q.search ? { search: q.search } : {}),
    ...(q.source ? { source: q.source } : {}),
    ...(q.ownerUserId ? { ownerUserId: q.ownerUserId } : {}),
  };
  return {
    mine: filterWidgetsList({ ...base, access: 'OWNED', ...(q.status ? { status: q.status } : {}) }).length,
    shared: filterWidgetsList({ ...base, access: 'SHARED', ...(q.status ? { status: q.status } : {}) }).length,
    published: filterWidgetsList({ ...base, status: 'PUBLISHED' }).length,
  };
}

// FAKE-ONLY, no backend route. Kept for API compatibility; the live library shows no usage pills.
export async function getWidgetUsageCounts(ids: readonly string[]): Promise<Record<string, number>> {
  await fakeDelay(80);
  const counts: Record<string, number> = {};
  for (const id of ids) {
    const widget = WIDGET_STORE.find((item) => item.summary.id === id);
    counts[id] = widget ? getUsageSummaryCounts(widget).dashboardCount : 0;
  }
  return counts;
}

// GET {B}/widgets/owner-options
export async function listOwnerOptions(search = ''): Promise<CursorPage<{ id: string; name: string }>> {
  const page = await listAnalyticsOwnerOptions(search.trim(), null, 50);
  return { ...page, items: page.items.map((owner) => ({ id: owner.id, name: owner.name ?? owner.id })) };
}

// Widget routes have no organization scope mode; dataset access is resolved by the server.
const pendingDraftWrites = new Map<string, { bodyJson: string; key: string }>();

async function writeWidget<T>(
  method: CoreWriteMethod, path: string, body: unknown, key?: string,
  options: { ifMatch?: string; query?: CoreQuery } = {},
): Promise<T> {
  const bodyJson = JSON.stringify({ method, body, ...options });
  const previous = pendingDraftWrites.get(path);
  const action = previous?.bodyJson === bodyJson ? previous : { bodyJson, key: key ?? newIdempotencyKey() };
  if (!key) pendingDraftWrites.set(path, action);
  await crmQueries().cancelQueries({ queryKey: ['crm-analytics', 'widgets'] });
  try {
    const result = await crmHttp().write<T>(method, path, body, { key: key ?? action.key, ...options });
    if (result.etag) widgetShareEtags.set(path, result.etag);
    if (pendingDraftWrites.get(path) === action) pendingDraftWrites.delete(path);
    await crmQueries().invalidateQueries({ queryKey: ['crm-analytics'] });
    return result.data;
  } catch (error) {
    if (!isRetryableWriteError(error) && !(error instanceof ApiError && error.status === 401)
      && pendingDraftWrites.get(path) === action) pendingDraftWrites.delete(path);
    throw error;
  }
}

// READ_HEAVY, no organization scope: run only when the user opens or refreshes an impact/compare step.
function readWidgetImpact<T>(id: string, operation: string, body: object): Promise<T> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'widgets', id, 'impact', operation, body],
    staleTime: 0,
    queryFn: async () => (await crmHttp().write<T>('POST',
      `/widgets/${encodeURIComponent(id)}/${operation}`, body, { key: newIdempotencyKey() })).data,
  });
}

const widgetShareEtags = new Map<string, string>();

function rememberWidgetShare(id: string, share: Share): void {
  const revision = (share as Share & { revision?: number }).revision;
  if (revision !== undefined) widgetShareEtags.set(
    `/widgets/${encodeURIComponent(id)}/shares/${encodeURIComponent(share.id)}`,
    `"widget-share:${share.id}:${revision}"`,
  );
}

function loadedWidgetShareEtag(id: string, shareId: string, revision?: number): string {
  const token = revision === undefined
    ? widgetShareEtags.get(`/widgets/${encodeURIComponent(id)}/shares/${encodeURIComponent(shareId)}`)
    : `"widget-share:${shareId}:${revision}"`;
  if (!token) throw new ApiError(409, 'CRM_SHARE_REVISION_STALE');
  return token;
}

// GET {B}/widgets/:id?usageCursor=
export async function getWidget(id: string, usageCursor: string | null = null): Promise<WidgetDetail> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'widgets', id, 'detail', usageCursor],
    staleTime: 0,
    queryFn: () => crmHttp().read(`/widgets/${encodeURIComponent(id)}`, { usageCursor }),
  });
}

// POST {B}/widgets  201 (header x-idempotency-key: the gateway requires it on this WRITE_SENSITIVE row; crm-app ignores it)
export async function createWidget(
  body: WidgetBody,
  key: string,
): Promise<DraftState & { activeVersionNumber: null }> {
  return writeWidget('POST', '/widgets', body, key);
}

// GET {B}/widgets/:id/draft
export async function getDraft(id: string): Promise<DraftState> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'widgets', id, 'draft'],
    staleTime: 0,
    queryFn: () => crmHttp().read(`/widgets/${encodeURIComponent(id)}/draft`),
  });
}

// PATCH {B}/widgets/:id  (saves the working draft)
export async function saveDraft(
  id: string,
  body: WidgetBody & {
    expectedWidgetRevision: number;
    expectedDraftId: string | null;
    expectedDraftRevision: number;
  },
): Promise<DraftState> {
  return writeWidget('PATCH', `/widgets/${encodeURIComponent(id)}`, body);
}

// POST {B}/widgets/:id/draft/discard  200
export async function discardDraft(
  id: string,
  body: { expectedWidgetRevision: number; expectedDraftId: string; expectedDraftRevision: number },
): Promise<DraftState> {
  return writeWidget('POST', `/widgets/${encodeURIComponent(id)}/draft/discard`, body);
}

// POST {B}/widgets/preview
type PreviewBody = {
  name: string;
  visualizationType: Visualization;
  querySpec: QuerySpec;
  displaySpec?: DisplaySpec;
  filters?: DashboardFilters;
  refresh?: boolean;
};
type PreviewResult = WidgetExecution & { panels: PanelOutcome[]; receipts: { runId: string; receiptIds: string[] } };

export function previewWidget(body: PreviewBody, _signal?: AbortSignal): Promise<PreviewResult> {
  // READ_HEAVY: only an explicit preview request runs this query; no transport cancellation or polling.
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'widget-preview', body],
    staleTime: 0,
    queryFn: async () => (await crmHttp().write<PreviewResult>('POST', '/widgets/preview', body,
      { key: newIdempotencyKey() })).data,
  });
}

// POST {B}/widgets/:id/publish-impact  200
export async function publishImpact(id: string, body: PublishImpactBody): Promise<PublishImpact> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'widget-publish-impact', id, body],
    staleTime: 0,
    queryFn: async () => (await crmHttp().write<PublishImpact>('POST',
      `/widgets/${encodeURIComponent(id)}/publish-impact`, body, { key: newIdempotencyKey() })).data,
  });
}

// POST {B}/widgets/:id/publish  200 (header x-idempotency-key, checked by crm-app; the gateway row is idempotent:false)
export async function publishWidget(
  id: string,
  body: PublishWidgetBody,
  key: string,
): Promise<PublishWidgetResult> {
  return writeWidget('POST', `/widgets/${encodeURIComponent(id)}/publish`, body, key);
}

// GET {B}/widgets/:id/versions
export async function listVersions(id: string, beforeVersion?: number): Promise<WidgetVersionsPage> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'widgets', id, 'versions', beforeVersion],
    staleTime: 0,
    queryFn: () => crmHttp().read(`/widgets/${encodeURIComponent(id)}/versions`, { beforeVersion }),
  });
}

// POST {B}/widgets/:id/versions/compare  body { leftVersionNumber, rightVersionNumber }  200
export async function compareVersions(id: string, left: number, right: number): Promise<VersionCompare> {
  return readWidgetImpact(id, 'versions/compare', { leftVersionNumber: left, rightVersionNumber: right });
}

// POST {B}/widgets/:id/versions/restore-draft  200
export async function restoreVersionToDraft(id: string, body: RestoreVersionBody): Promise<RestoreVersionResult> {
  return writeWidget('POST', `/widgets/${encodeURIComponent(id)}/versions/restore-draft`, body);
}

// POST {B}/widgets/:id/lifecycle-impact  200
export async function lifecycleImpact(id: string, body: LifecycleImpactBody): Promise<LifecycleImpact> {
  return readWidgetImpact(id, 'lifecycle-impact', body);
}

// POST {B}/widgets/:id/lifecycle  200
export async function applyLifecycle(id: string, body: ApplyLifecycleBody): Promise<ApplyLifecycleResult> {
  return writeWidget('POST', `/widgets/${encodeURIComponent(id)}/lifecycle`, body);
}

// DELETE {B}/widgets/:id  204
export async function deleteWidget(id: string): Promise<void> {
  await fakeDelay();
  const widget = findStoredWidget(id);
  if (!can('crm.widgets.delete') || widget.summary.accessLevel !== 'OWNER') {
    throw new ApiError(403, 'CRM_WIDGET_LIFECYCLE_FORBIDDEN');
  }
  const placements = ensureUsageFor(widget);
  if (
    (widget.summary.status !== 'DRAFT' && widget.summary.status !== 'ARCHIVED') ||
    placements.length > 0
  ) {
    throw new ApiError(422, 'CRM_WIDGET_LIFECYCLE_INVALID');
  }

  const idx = WIDGET_STORE.findIndex((item) => item.summary.id === id);
  if (idx !== -1) {
    WIDGET_STORE.splice(idx, 1);
  }
  deleteUsage(id);
}

// POST {B}/widgets/:id/clone  201 (header x-idempotency-key: gateway-enforced)
export async function cloneWidget(id: string, name: string | null, key: string): Promise<DraftState> {
  return writeWidget('POST', `/widgets/${encodeURIComponent(id)}/clone`, name === null ? {} : { name }, key);
}

// GET {B}/widgets/:id/ownership-transfer/targets?search=&cursor=&limit= (limit max 50)
export async function listTransferTargets(
  id: string,
  search = '',
): Promise<CursorPage<{ id: string; name: string }>> {
  const query = { search: search.trim(), limit: 50 };
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'widgets', id, 'transfer-targets', query],
    staleTime: 0,
    queryFn: () => crmHttp().read(`/widgets/${encodeURIComponent(id)}/ownership-transfer/targets`, query),
  });
}

// POST {B}/widgets/:id/ownership-transfer/impact  200
export async function transferImpact(id: string, body: TransferImpactBody): Promise<TransferImpact> {
  return readWidgetImpact(id, 'ownership-transfer/impact', body);
}

// PATCH {B}/widgets/:id/ownership-transfer
export async function transferWidget(id: string, body: TransferWidgetBody): Promise<TransferWidgetResult> {
  return writeWidget('PATCH', `/widgets/${encodeURIComponent(id)}/ownership-transfer`, body);
}

// GET {B}/widgets/:id/shares
export async function listWidgetShares(id: string): Promise<ShareListItem[]> {
  const shares = await crmQueries().fetchQuery<ShareListItem[]>({
    queryKey: ['crm-analytics', 'widgets', id, 'shares'],
    staleTime: 0,
    queryFn: () => crmHttp().read(`/widgets/${encodeURIComponent(id)}/shares`),
  });
  for (const share of shares) rememberWidgetShare(id, share);
  return shares;
}

// POST {B}/widgets/:id/shares  201 (header x-idempotency-key: gateway-enforced)
export async function addWidgetShare(
  id: string,
  body: { subjectType: 'USER' | 'TEAM'; subjectId: string; accessLevel: 'VIEW' | 'EDIT'; expiresAt?: string | null },
  key: string,
): Promise<Share> {
  const share = await writeWidget<Share>('POST', `/widgets/${encodeURIComponent(id)}/shares`, body, key);
  rememberWidgetShare(id, share);
  return share;
}

// PATCH {B}/widgets/:id/shares/:shareId
export async function updateWidgetShare(
  id: string,
  shareId: string,
  body: { revision?: number; accessLevel?: 'VIEW' | 'EDIT'; expiresAt?: string | null },
): Promise<Share> {
  const path = `/widgets/${encodeURIComponent(id)}/shares/${encodeURIComponent(shareId)}`;
  const share = await writeWidget<Share>('PATCH', path, body, undefined,
    { ifMatch: loadedWidgetShareEtag(id, shareId, body.revision) });
  rememberWidgetShare(id, share);
  return share;
}

// DELETE {B}/widgets/:id/shares/:shareId?reason=  204
export async function revokeWidgetShare(
  id: string,
  shareId: string,
  reason: 'OWNER_REVOKED' | 'ADMIN_REVOKED',
): Promise<void> {
  await writeWidget('DELETE', `/widgets/${encodeURIComponent(id)}/shares/${encodeURIComponent(shareId)}`,
    undefined, undefined, { ifMatch: loadedWidgetShareEtag(id, shareId), query: { reason } });
}

// GET {B}/targets?metricKey=&periodGrain=&approvalState=APPROVED
export async function listGovernedTargets(
  metricKey: string,
  periodGrain: 'MONTH' | 'QUARTER' | 'YEAR',
): Promise<GovernedTargetOption[]> {
  await fakeDelay();
  if (!can('crm.targets.read')) {
    throw new ApiError(403, 'CRM_PERMISSION_DENIED');
  }
  return structuredClone(fakeGovernedTargets(metricKey, periodGrain));
}

export interface BranchOption {
  id: string;
  name: { en: string; ar: string };
}

export interface PipelineOption {
  id: string;
  key: 'standard' | 'corporate' | 'renewals';
}

// TODO(Phase 5): GET {B}/org/branches limited to the caller's branch grants. The fake mirrors that
// rule: callers with company-wide scope see every branch, everyone else only their own.
export async function listGrantedBranches(): Promise<BranchOption[]> {
  await fakeDelay(60);
  if (!can('crm.widgets.read')) {
    throw new ApiError(403, 'CRM_PERMISSION_DENIED');
  }
  const allBranches = scopeLevels().includes('all');
  const ownBranchId = FAKE_PEOPLE.find((p) => p.id === FAKE_ME.id)?.branchId ?? null;
  return structuredClone(FAKE_BRANCHES.filter((b) => allBranches || b.id === ownBranchId));
}

// TODO(Phase 5): replace with the CRM pipelines endpoint; these ids are fake-only.
export async function listPipelineOptions(): Promise<PipelineOption[]> {
  await fakeDelay(60);
  return [
    { id: '01934b10-0000-7000-8000-000000000401', key: 'standard' },
    { id: '01934b10-0000-7000-8000-000000000402', key: 'corporate' },
    { id: '01934b10-0000-7000-8000-000000000403', key: 'renewals' },
  ];
}

// GET {B}/widgets/:id/shares/preview?subjectType=USER|TEAM&subjectId=
export async function previewWidgetShare(
  id: string,
  subjectType: 'USER' | 'TEAM',
  subjectId: string,
): Promise<SharePreview> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'widgets', id, 'share-preview', subjectType, subjectId],
    staleTime: 0,
    queryFn: () => crmHttp().read(`/widgets/${encodeURIComponent(id)}/shares/preview`, { subjectType, subjectId }),
  });
}

// TODO(Phase 5): fake-only synchronous lookup. The live share list must return the sharer's display name.
export function userDisplayName(userId: string, lang: 'ar' | 'en'): string | null {
  const person = FAKE_PEOPLE.find((item) => item.id === userId);
  if (!person) return null;
  return lang === 'ar' ? person.nameAr : person.name;
}
