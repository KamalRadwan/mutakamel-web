import {
  ApiError,
  type CursorPage,
  type FlatPage,
} from '../../../../shared/widgets/dashboard/analytics-api';
import { can } from '../../../../shared/widgets/dashboard/analytics-permissions';
import type { FilterDomains } from './builder/filter-tree';
import type { SharePreview } from '../../../../shared/widgets/dashboard/analytics.model';
import { OrgApi, listPipelineOptions as listOrgPipelines, listOwnerOptions as listAnalyticsOwnerOptions } from '../../../../shared/widgets/dashboard/org.api';
import { crmHttp, crmQueries } from '../../shared/crm-http';
import { isRetryableWriteError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import type { CoreQuery, CoreWriteMethod } from '../../../../core/api/core-http';
import type {
  ApplyLifecycleBody,
  ApplyLifecycleResult,
  DashboardFilters,
  DisplaySpec,
  DraftState,
  GovernedTargetOption,
  GovernedTargetRecord,
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
  WidgetSummary,
  WidgetTabCounts,
  WidgetVersionsPage,
} from './widgets.model';

// GET {B}/widgets?access=&status=&source=&ownerUserId=&search=&cursor=&limit=  -> { items, nextCursor } (cursor = last id, limit 1..100, default 50)
export async function listWidgets(q: WidgetListQuery): Promise<CursorPage<WidgetSummary>> {
  const query = { ...q, search: q.search?.trim(), limit: q.limit ?? 50 };
  // No organization scope mode: the server applies widget visibility and dataset access.
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'widgets', query],
    queryFn: () => crmHttp().read('/widgets', query),
  });
}

// No aggregate count endpoints exist. The live library omits these controls.
export async function getWidgetTabCounts(
  _q: Pick<WidgetListQuery, 'search' | 'source' | 'ownerUserId' | 'status'>,
): Promise<WidgetTabCounts> {
  throw new ApiError(501, 'CRM_ANALYTICS_SOURCE_UNAVAILABLE');
}

export async function getWidgetUsageCounts(_ids: readonly string[]): Promise<Record<string, number>> {
  throw new ApiError(501, 'CRM_ANALYTICS_SOURCE_UNAVAILABLE');
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
  // DELETE is non-idempotent: a new action key, with no retained retry/replay state.
  await writeWidget<void>('DELETE', `/widgets/${encodeURIComponent(id)}`, undefined, newIdempotencyKey());
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

/** The widget binding currently accepts single-subject MONEY targets only (dashboard-catalog.ts). */
export async function listGovernedTargets(
  metricKey: string,
  periodGrain: 'MONTH' | 'QUARTER' | 'YEAR',
  branchId: string,
): Promise<GovernedTargetOption[]> {
  if (!branchId) return [];
  const items: GovernedTargetOption[] = [];
  for (let page = 1; ; page++) {
    const query = { branchId, metricKey, periodGrain, approvalState: 'APPROVED', page, limit: 100 };
    const result = await crmQueries().fetchQuery({
      queryKey: ['crm-analytics', 'widget-governed-targets', query],
      queryFn: () => crmHttp().read<FlatPage<GovernedTargetRecord>>('/targets', query),
    });
    for (const row of result.items) {
      if (row.approvalState !== 'APPROVED' || row.metricKey !== metricKey || row.periodGrain !== periodGrain
        || row.branchId !== branchId || !row.subjectId || row.subjectType === 'TEAM_SET'
        || row.unit !== 'MONEY' || !row.currencyCode || !/^[A-Z]{3}$/.test(row.currencyCode)) continue;
      items.push({ id: row.id, branchId: row.branchId, subjectType: row.subjectType,
        subjectId: row.subjectId, subjectName: row.subjectName ?? row.subjectId,
        currencyCode: row.currencyCode, periodGrain: row.periodGrain, periodStart: row.periodStart,
        unit: row.unit, targetValue: row.targetValue });
    }
    if (!result.hasNext) return items;
  }
}

export interface BranchOption {
  id: string;
  name: { en: string; ar: string };
}

export interface PipelineOption {
  id: string;
  nameEn: string;
  nameAr: string;
}

export async function listGrantedBranches(org: OrgApi): Promise<readonly BranchOption[]> {
  return org.listGrantedBranches();
}

export async function listPipelineOptions(): Promise<PipelineOption[]> {
  return listOrgPipelines();
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


/** Directory and catalogue reads stay at the widget API boundary. */
export async function loadFilterDomains(org: OrgApi): Promise<FilterDomains> {
  type DomainRow = { id: string; nameEn: string; nameAr: string; isActive: boolean };
  type StatusOption = { value: string; label: { en: string; ar: string } };
  const [people, sources, stages, staticData] = await Promise.all([
    can('users.user.read') ? org.listUsers() : Promise.resolve([]),
    can('crm.acquisition_sources.read') ? crmQueries().fetchQuery({
      queryKey: ['crm-analytics', 'widget-domains', 'sources'],
      queryFn: () => crmHttp().read<DomainRow[]>('/acquisition-sources'),
    }) : Promise.resolve([]),
    can('crm.pipelines.manage') ? crmQueries().fetchQuery({
      queryKey: ['crm-analytics', 'widget-domains', 'stages'],
      queryFn: () => crmHttp().read<DomainRow[]>('/opportunity-stages'),
    }) : Promise.resolve([]),
    crmQueries().fetchQuery({
      queryKey: ['crm-analytics', 'widget-domains', 'static-data'],
      queryFn: () => crmHttp().read<{ enumOptions: Record<string, StatusOption[]> }>('/static-data'),
    }),
  ]);
  const owners = people.map((person) => ({ value: person.id, labelEn: person.name, labelAr: person.nameAr }));
  return {
    'leads.status': (staticData.enumOptions?.['leadStatuses'] ?? []).map((opt) => ({
      value: opt.value, labelEn: opt.label.en, labelAr: opt.label.ar,
    })),
    'leads.sourceId': sources.filter((source) => source.isActive).map((source) => ({
      value: source.id, labelEn: source.nameEn, labelAr: source.nameAr,
    })),
    'leads.ownerUserId': owners,
    'opportunities.ownerUserId': owners,
    'opportunities.stageId': stages.filter((stage) => stage.isActive).map((stage) => ({
      value: stage.id, labelEn: stage.nameEn, labelAr: stage.nameAr,
    })),
  };
}
