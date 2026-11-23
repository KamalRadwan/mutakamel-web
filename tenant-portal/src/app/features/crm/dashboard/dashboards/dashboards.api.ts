import type {
  CrossFilter,
  DashboardFilters,
  DashboardRun,
  RuntimeFilters,
  Share,
  ShareListItem,
  SharePreview,
} from '../../../../shared/widgets/dashboard/analytics.model';
import {
  ApiError,
  raceAbort,
  type CursorPage,
} from '../../../../shared/widgets/dashboard/analytics-api';
import { isRetryableWriteError } from '../../../../core/api/api-errors';
import type { CoreWriteMethod, CoreQuery } from '../../../../core/api/core-http';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { crmHttp, crmQueries } from '../../shared/crm-http';
import type { WidgetSummary } from '../shared/widget.model';
import type {
  BlueprintItem,
  BlueprintAdoptionResult,
  DashboardDetail,
  DashboardSummary,
  DrillResult,
  EmbeddedWidget,
  NavigationItem,
  Placement,
  ScopeInspector,
  VersionBinding,
  VersionBindingResult,
  VersionPolicyProposal,
} from './dashboards.model';

interface WriteIntent {
  bodyJson: string;
  key: string;
}
const retryWrites = new Map<string, WriteIntent>();
const shareEtags = new Map<string, string>();
const etag = (kind: string, id: string, revision: number) => `"${kind}:${id}:${revision}"`;

// These gateway rows have no organization scope mode. The server resolves definition and dataset access.
async function writeLibrary<T>(
  method: CoreWriteMethod,
  path: string,
  body: unknown,
  key?: string,
  options: { ifMatch?: string; query?: CoreQuery } = {},
): Promise<T> {
  const queries = crmQueries();
  const action = `${method}:${path}`;
  const bodyJson = JSON.stringify({ body, ...options });
  const previous = retryWrites.get(action);
  const intent = {
    bodyJson,
    key: key ?? (previous?.bodyJson === bodyJson ? previous.key : newIdempotencyKey()),
  };
  await queries.cancelQueries({ queryKey: ['crm-analytics'] });
  try {
    const result = await crmHttp().write<T>(method, path, body, { key: intent.key, ...options });
    retryWrites.delete(action);
    if (result.etag) shareEtags.set(path, result.etag);
    return result.data;
  } catch (error) {
    if (isRetryableWriteError(error) || (error instanceof ApiError && error.status === 401))
      retryWrites.set(action, intent);
    else retryWrites.delete(action);
    throw error;
  } finally {
    await queries.invalidateQueries({ queryKey: ['crm-analytics'] });
  }
}

function dashboardPath(id: string): string {
  return `/dashboards/${encodeURIComponent(id)}`;
}
function placementPath(id: string, placementId: string): string {
  return `${dashboardPath(id)}/placements/${encodeURIComponent(placementId)}`;
}
function rememberShare(id: string, share: Share): void {
  const revision = (share as Share & { revision?: number }).revision;
  if (revision !== undefined)
    shareEtags.set(
      `${dashboardPath(id)}/shares/${encodeURIComponent(share.id)}`,
      etag('dashboard-share', share.id, revision),
    );
}
function loadedShareEtag(id: string, shareId: string, revision?: number): string {
  const token =
    revision === undefined
      ? shareEtags.get(`${dashboardPath(id)}/shares/${encodeURIComponent(shareId)}`)
      : etag('dashboard-share', shareId, revision);
  if (!token) throw new ApiError(409, 'CRM_SHARE_REVISION_STALE');
  return token;
}

export type NavigationQuery = {
  kind?: 'DASHBOARD' | 'REPORT';
  cursor?: string | null;
  limit?: number;
};

export async function listDashboards(
  q: {
    kind?: 'DASHBOARD' | 'REPORT';
    cursor?: string | null;
    limit?: number;
    search?: string;
  } = {},
): Promise<CursorPage<DashboardSummary>> {
  const query = { kind: 'DASHBOARD', search: q.search, cursor: q.cursor, limit: q.limit ?? 50 };
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'dashboards', 'library', query],
    queryFn: () => crmHttp().read('/dashboards', query),
  });
}

export async function getNavigation(q: NavigationQuery = {}): Promise<{
  items: NavigationItem[];
  nextCursor: string | null;
  activeDashboardId: string | null;
}> {
  const query = { kind: q.kind ?? 'DASHBOARD', cursor: q.cursor, limit: q.limit ?? 50 };
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'dashboards', 'navigation', query],
    queryFn: () => crmHttp().read('/dashboards/navigation', query),
  });
}

export async function getDefaultDashboard(): Promise<DashboardDetail> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'dashboards', 'default'],
    queryFn: () => crmHttp().read('/dashboards/default'),
  });
}

export async function getDashboard(id: string): Promise<DashboardDetail> {
  // No organization scope headers: the server resolves this definition's access.
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'dashboard', id],
    queryFn: () => crmHttp().read(`/dashboards/${encodeURIComponent(id)}`),
    staleTime: 0,
    retry: false,
  });
}

export async function createDashboard(
  body: {
    name: string;
    description?: string | null;
    defaultFilters?: DashboardFilters;
    templateKey?: string;
    layoutCollisionMode?: DashboardDetail['layoutCollisionMode'];
  },
  key: string,
): Promise<DashboardDetail> {
  return writeLibrary('POST', '/dashboards', body, key);
}

export async function createDashboardFromTemplate(
  templateKey: string,
  body: { name?: string; description?: string | null; defaultFilters?: DashboardFilters },
  key: string,
): Promise<DashboardDetail> {
  return writeLibrary(
    'PUT',
    `/dashboards/from-template/${encodeURIComponent(templateKey)}`,
    body,
    key,
  );
}

export async function patchDashboard(
  id: string,
  body: {
    revision: number;
    name?: string;
    description?: string | null;
    defaultFilters?: DashboardFilters;
    layoutCollisionMode?: DashboardDetail['layoutCollisionMode'];
    isLayoutLocked?: boolean;
  },
): Promise<DashboardDetail> {
  return writeLibrary('PATCH', dashboardPath(id), body, undefined, {
    ifMatch: etag('dashboard', id, body.revision),
  });
}

export async function deleteDashboard(id: string): Promise<void> {
  await writeLibrary('DELETE', dashboardPath(id), undefined);
}

export async function duplicateDashboard(
  id: string,
  name: string | null,
  key: string,
): Promise<
  DashboardDetail & {
    duplication: { omittedUnavailableWidgetCount?: number; warnings: string[] };
  }
> {
  return writeLibrary('POST', `${dashboardPath(id)}/duplicate`, name === null ? {} : { name }, key);
}

export async function setDefaultDashboard(id: string, key: string): Promise<DashboardDetail> {
  return writeLibrary('PUT', `/dashboards/${encodeURIComponent(id)}/default`, undefined, key);
}

export async function setFavoriteDashboard(
  id: string,
  favorite: boolean,
  key: string,
): Promise<DashboardDetail> {
  return writeLibrary('PUT', `/dashboards/${encodeURIComponent(id)}/favorite`, { favorite }, key);
}

export function runDashboard(
  id: string,
  body: {
    filters?: RuntimeFilters;
    crossFilters?: CrossFilter[];
    widgetIds?: string[];
    refresh?: boolean;
  } = {},
  signal?: AbortSignal,
): Promise<DashboardRun> {
  const request = { ...body, includePopulationOptions: true };
  const key = newIdempotencyKey();
  // READ_HEAVY, no organization headers. Only the caller's explicit action starts a run.
  return raceAbort(
    () =>
      crmQueries().fetchQuery({
        queryKey: ['crm-analytics', 'dashboard-run', id, request],
        queryFn: async () =>
          (
            await crmHttp().write<DashboardRun>(
              'POST',
              `/dashboards/${encodeURIComponent(id)}/run`,
              request,
              { key },
            )
          ).data,
        staleTime: 0,
        retry: false,
      }),
    signal,
  );
}

export async function saveLayout(
  id: string,
  body: {
    revision: number;
    breakpointKey: 'desktop';
    items: {
      placementId: string;
      x: number;
      y: number;
      w: number;
      h: number;
      zIndex: number;
      isHidden: boolean;
    }[];
  },
  key: string,
): Promise<DashboardDetail & { adjusted: boolean }> {
  return writeLibrary('PUT', `${dashboardPath(id)}/layout`, body, key, {
    ifMatch: etag('dashboard', id, body.revision),
  });
}

export async function addPlacement(
  id: string,
  body: { widgetId: string; x?: number; y?: number; w?: number; h?: number },
  key: string,
): Promise<
  Placement & {
    x: number;
    y: number;
    w: number;
    h: number;
    dashboardRevision: number;
  }
> {
  const result = await writeLibrary<
    Omit<Placement, 'sortOrder'> & {
      x: number;
      y: number;
      w: number;
      h: number;
      dashboardRevision: number;
    }
  >('POST', `${dashboardPath(id)}/placements`, body, key);
  // The create response has no sortOrder; GET detail remains the authority for persisted ordering.
  return { ...result, sortOrder: 0 };
}

export async function removePlacement(
  id: string,
  placementId: string,
): Promise<{ dashboardRevision: number }> {
  return writeLibrary('DELETE', placementPath(id, placementId), undefined);
}

export async function getVersionBinding(id: string, placementId: string): Promise<VersionBinding> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'version-policy', id, placementId],
    queryFn: () => crmHttp().read(`${placementPath(id, placementId)}/version-policy`),
    staleTime: 0,
  });
}

export async function previewVersionPolicy(
  id: string,
  placementId: string,
  body: {
    versionPolicy: 'FOLLOW_ACTIVE' | 'PINNED';
    pinnedVersionNumber: number | null;
    expectedDashboardRevision: number;
    expectedWidgetRevision: number;
    expectedGovernanceRevision: number;
  },
): Promise<{ current: VersionBinding; proposed: VersionPolicyProposal }> {
  const key = newIdempotencyKey();
  // READ_HEAVY: only an explicit preview, no mutation invalidation or polling.
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'version-policy-impact', id, placementId, body],
    queryFn: async () =>
      (
        await crmHttp().write<{ current: VersionBinding; proposed: VersionPolicyProposal }>(
          'POST',
          `${placementPath(id, placementId)}/version-policy/impact`,
          body,
          { key },
        )
      ).data,
    staleTime: 0,
    retry: false,
  });
}

export async function setVersionPolicy(
  id: string,
  placementId: string,
  body: {
    versionPolicy: 'FOLLOW_ACTIVE' | 'PINNED';
    pinnedVersionNumber: number | null;
    expectedDashboardRevision: number;
    expectedWidgetRevision: number;
    expectedGovernanceRevision: number;
    expectedSelectedVersionNumber: number;
    expectedPlacement: { x: number; y: number; w: number; h: number };
  },
): Promise<VersionBindingResult> {
  return writeLibrary('PATCH', `${placementPath(id, placementId)}/version-policy`, body);
}

export function drilldown(
  id: string,
  widgetId: string,
  body: {
    pointKey: string;
    seriesKey?: string;
    cursor?: string | null;
    limit?: number;
    filters?: RuntimeFilters;
  },
  signal?: AbortSignal,
): Promise<DrillResult> {
  const { cursor, ...selection } = body;
  const request = { ...selection, ...(cursor ? { cursor } : {}) };
  const key = newIdempotencyKey();
  // READ_HEAVY, no organization headers. Null is the first page, not a wire cursor.
  return raceAbort(
    () =>
      crmQueries().fetchQuery({
        queryKey: ['crm-analytics', 'dashboard-drilldown', id, widgetId, request],
        queryFn: async () =>
          (
            await crmHttp().write<DrillResult>(
              'POST',
              `/dashboards/${encodeURIComponent(id)}/widgets/${encodeURIComponent(widgetId)}/drilldown`,
              request,
              { key },
            )
          ).data,
        staleTime: 0,
        retry: false,
      }),
    signal,
  );
}

export async function getScopeInspector(id: string): Promise<ScopeInspector> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'scope-inspector', id],
    queryFn: () => crmHttp().read(`${dashboardPath(id)}/scope-inspector`),
    staleTime: 0,
  });
}

export async function listBlueprints(branchId?: string): Promise<{ items: BlueprintItem[] }> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'dashboards', 'blueprints', branchId],
    queryFn: () => crmHttp().read('/dashboards/blueprints', { branchId }),
  });
}

export async function adoptBlueprint(
  key: string,
  body: { definitionRevision: number; branchId?: string; confirmTargets?: true; name?: string },
  idemKey: string,
): Promise<BlueprintAdoptionResult> {
  return writeLibrary(
    'PUT',
    `/dashboards/blueprints/${encodeURIComponent(key)}/adoption`,
    body,
    idemKey,
  );
}

export async function listDashboardShares(id: string): Promise<ShareListItem[]> {
  const shares = await crmQueries().fetchQuery<ShareListItem[]>({
    queryKey: ['crm-analytics', 'dashboard-shares', id],
    queryFn: () => crmHttp().read(`${dashboardPath(id)}/shares`),
    staleTime: 0,
  });
  for (const share of shares) rememberShare(id, share);
  return shares;
}

export async function addDashboardShare(
  id: string,
  body: {
    subjectType: 'USER' | 'TEAM';
    subjectId: string;
    accessLevel: 'VIEW' | 'EDIT';
    expiresAt?: string | null;
  },
  key: string,
): Promise<Share> {
  const share = await writeLibrary<Share>('POST', `${dashboardPath(id)}/shares`, body, key);
  rememberShare(id, share);
  return share;
}

export async function updateDashboardShare(
  id: string,
  shareId: string,
  body: {
    revision?: number;
    accessLevel?: 'VIEW' | 'EDIT';
    expiresAt?: string | null;
  },
): Promise<Share> {
  const share = await writeLibrary<Share>(
    'PATCH',
    `${dashboardPath(id)}/shares/${encodeURIComponent(shareId)}`,
    body,
    undefined,
    { ifMatch: loadedShareEtag(id, shareId, body.revision) },
  );
  rememberShare(id, share);
  return share;
}

export async function revokeDashboardShare(
  id: string,
  shareId: string,
  reason: 'OWNER_REVOKED' | 'ADMIN_REVOKED',
): Promise<void> {
  await writeLibrary(
    'DELETE',
    `${dashboardPath(id)}/shares/${encodeURIComponent(shareId)}`,
    undefined,
    undefined,
    { ifMatch: loadedShareEtag(id, shareId), query: { reason } },
  );
}

export async function listAddableWidgets(
  q: { search?: string; cursor?: string | null; limit?: number } = {},
): Promise<CursorPage<EmbeddedWidget & { accessLevel: 'OWNER' | 'EDIT' | 'VIEW' }>> {
  const query = { ...q, status: 'PUBLISHED', limit: q.limit ?? 20 };
  const page = await crmQueries().fetchQuery<CursorPage<WidgetSummary>>({
    queryKey: ['crm-analytics', 'addable-widgets', query],
    queryFn: () => crmHttp().read('/widgets', query),
    staleTime: 0,
  });
  return {
    ...page,
    items: page.items.flatMap((widget) =>
      widget.visualizationType &&
      widget.querySpec &&
      widget.displaySpec &&
      widget.schemaVersion !== null &&
      widget.versionNumber !== null
        ? [
            {
              ...widget,
              visualizationType: widget.visualizationType,
              querySpec: widget.querySpec,
              displaySpec: widget.displaySpec,
              schemaVersion: widget.schemaVersion,
              versionNumber: widget.versionNumber,
            },
          ]
        : [],
    ),
  };
}

export async function previewDashboardShare(
  id: string,
  subjectType: 'USER' | 'TEAM',
  subjectId: string,
): Promise<SharePreview> {
  return crmQueries().fetchQuery({
    queryKey: ['crm-analytics', 'dashboard-share-preview', id, subjectType, subjectId],
    queryFn: () =>
      crmHttp().read(`${dashboardPath(id)}/shares/preview`, { subjectType, subjectId }),
    staleTime: 0,
  });
}

export interface DashboardOwnershipTransfer {
  resourceType: 'DASHBOARD' | 'WIDGET';
  id: string;
  name: string | null;
  ownerUserId: string;
  previousOwnerUserId: string;
  revision: number;
  governanceRevision?: number;
  renamedFrom?: string;
  revokedShareCount: number;
  retainedShareCount: number;
  ownerReviewId: string | null;
}
export async function transferDashboardOwnership(
  id: string,
  body: {
    revision: number;
    toOwnerUserId: string;
    reason: string;
    ownerReviewId?: string;
  },
  key: string,
): Promise<DashboardOwnershipTransfer> {
  return writeLibrary('POST', `${dashboardPath(id)}/ownership-transfer`, body, key, {
    ifMatch: etag('dashboard', id, body.revision),
  });
}
