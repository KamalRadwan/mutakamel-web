import type { CoreQuery } from '../../../core/api/core-http';
import {
  assertBodyBooleans,
  assertIdempotencyKey,
  ifMatch,
  newIdempotencyKey,
  parseIfMatch,
  scopeFor,
  type TradeContext,
} from '../shared/trade-api';
import { tradeHttp } from '../shared/trade-http';
import type {
  AddPlacementBody,
  AddPlacementResponse,
  Catalog,
  CreateDashboardBody,
  CreateDashboardResponse,
  CreateFromTemplateBody,
  CreateFromTemplateResponse,
  DashboardDetail,
  DashboardFilters,
  DashboardListRow,
  DefaultResult,
  DuplicateDashboardBody,
  DuplicateDashboardResponse,
  LayoutPlacementInput,
  ListDashboardsQuery,
  ListDashboardsResponse,
  ListShareTargetsQuery,
  Navigation,
  PreferenceContext,
  PreferenceQuery,
  PreferenceRow,
  RunRequest,
  RunResult,
  RuntimeCompanyScope,
  ScopeTargetRef,
  ShareChangeInput,
  ShareListResponse,
  ShareTargetListResponse,
  TemplateKey,
  UpdateDashboardBody,
  UpsertSharesBody,
  UpsertSharesResponse,
  WidgetListResponse,
} from './trade-dashboard.model';

export type {
  AddPlacementBody,
  AddPlacementResponse,
  CreateDashboardResponse,
  CreateFromTemplateBody,
  CreateFromTemplateResponse,
  DashboardListRow,
  DuplicateDashboardBody,
  DuplicateDashboardResponse,
  LayoutPlacementInput,
  ListDashboardsQuery,
  ListDashboardsResponse,
  ListShareTargetsQuery,
  PreferenceQuery,
  ShareChangeInput,
  UpdateDashboardBody,
  UpsertSharesBody,
  UpsertSharesResponse,
};

export type { ShareChangeResult } from './trade-dashboard.model';

// Dashboard routes use OPTIONAL scope: forward each company/branch supplied by the caller.
function dashboardScope(ctx: TradeContext): TradeContext | undefined {
  return scopeFor(ctx, 'OPTIONAL');
}

function parseEtagRevision(etag: string | null): number {
  return parseIfMatch(etag);
}

function buildPreferenceQuery(query: PreferenceQuery | PreferenceContext | undefined): CoreQuery | undefined {
  if (!query) return undefined;
  const params: CoreQuery = {};
  if (query.kind !== undefined) params['kind'] = query.kind;
  if (query.companyId && query.kind !== 'CONSOLIDATED') params['companyId'] = query.companyId;
  return Object.keys(params).length > 0 ? params : undefined;
}

function buildListDashboardsQuery(query: ListDashboardsQuery): CoreQuery | undefined {
  const params: CoreQuery = {};
  if (query.kind !== undefined) params['kind'] = query.kind;
  if (query.companyId && query.kind !== 'CONSOLIDATED') params['companyId'] = query.companyId;
  if (query.limit !== undefined) params['limit'] = query.limit;
  if (query.offset !== undefined) params['offset'] = query.offset;
  return Object.keys(params).length > 0 ? params : undefined;
}

function buildShareTargetsQuery(query: ListShareTargetsQuery): CoreQuery | undefined {
  const params: CoreQuery = {};
  const trimmed = query.search?.trim();
  if (trimmed) params['search'] = trimmed;
  if (query.limit !== undefined) params['limit'] = query.limit;
  if (query.offset !== undefined) params['offset'] = query.offset;
  return Object.keys(params).length > 0 ? params : undefined;
}

function sanitizeFilters(filters: DashboardFilters): DashboardFilters {
  return {
    ...(filters.datePreset !== undefined ? { datePreset: filters.datePreset } : {}),
    ...(filters.dateFrom !== undefined ? { dateFrom: filters.dateFrom } : {}),
    ...(filters.dateTo !== undefined ? { dateTo: filters.dateTo } : {}),
    ...(filters.comparisonMode !== undefined ? { comparisonMode: filters.comparisonMode } : {}),
    ...(filters.currencyCodes !== undefined ? { currencyCodes: [...filters.currencyCodes] } : {}),
    ...(filters.itemIds !== undefined ? { itemIds: [...filters.itemIds] } : {}),
    ...(filters.clauses !== undefined
      ? { clauses: filters.clauses.map((c) => ({ key: c.key, values: [...c.values] })) }
      : {}),
  };
}

function sanitizePreferenceContext(context: PreferenceContext): PreferenceContext {
  return {
    kind: context.kind,
    ...(context.kind === 'COMPANY' && context.companyId ? { companyId: context.companyId } : {}),
  };
}

function sanitizeScopeTargets(targets: readonly ScopeTargetRef[]): ScopeTargetRef[] {
  return targets.map((t) => ({
    companyId: t.companyId,
    ...(t.branchIds !== undefined ? { branchIds: [...t.branchIds] } : {}),
  }));
}

function sanitizeRuntimeScopes(scopes: readonly RuntimeCompanyScope[]): RuntimeCompanyScope[] {
  return scopes.map((s) => ({
    companyId: s.companyId,
    ...(s.branchIds !== undefined ? { branchIds: [...s.branchIds] } : {}),
    ...(s.channelIds !== undefined ? { channelIds: [...s.channelIds] } : {}),
    ...(s.fulfillmentNodeIds !== undefined ? { fulfillmentNodeIds: [...s.fulfillmentNodeIds] } : {}),
  }));
}

// GET /api/tenant/trade/v1/dashboards/catalog
export function getCatalog(ctx: TradeContext): Promise<Catalog> {
  return tradeHttp().read<Catalog>('/dashboards/catalog', undefined, { scope: dashboardScope(ctx) });
}

// GET /api/tenant/trade/v1/dashboards/navigation?kind&companyId
export function getNavigation(ctx: TradeContext, query: PreferenceQuery | PreferenceContext): Promise<Navigation> {
  return tradeHttp().read<Navigation>('/dashboards/navigation', buildPreferenceQuery(query), {
    scope: dashboardScope(ctx),
  });
}

// GET /api/tenant/trade/v1/dashboards/default?kind&companyId
export function getDefault(ctx: TradeContext, query: PreferenceQuery | PreferenceContext): Promise<DefaultResult> {
  return tradeHttp().read<DefaultResult>('/dashboards/default', buildPreferenceQuery(query), {
    scope: dashboardScope(ctx),
  });
}

// GET /api/tenant/trade/v1/dashboards?kind&companyId&limit&offset -> { items, pagination }
export function listDashboards(
  ctx: TradeContext,
  query: ListDashboardsQuery = {},
): Promise<ListDashboardsResponse> {
  return tradeHttp().read<ListDashboardsResponse>('/dashboards', buildListDashboardsQuery(query), {
    scope: dashboardScope(ctx),
  });
}

// GET /api/tenant/trade/v1/dashboards/:id (ETag: "<revision>")
export function getDashboard(ctx: TradeContext, id: string): Promise<DashboardDetail> {
  return tradeHttp().read<DashboardDetail>(`/dashboards/${encodeURIComponent(id)}`, undefined, {
    scope: dashboardScope(ctx),
  });
}

// POST /api/tenant/trade/v1/dashboards/from-template/:templateKey (201 created, 200 existing)
// Headers: x-idempotency-key, Accept-Language
export async function createFromTemplate(
  ctx: TradeContext,
  key: TemplateKey | string,
  body: CreateFromTemplateBody = {},
  idem: string,
  _lang = 'en',
): Promise<CreateFromTemplateResponse> {
  const payload: CreateFromTemplateBody = {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.defaultFilters !== undefined ? { defaultFilters: sanitizeFilters(body.defaultFilters) } : {}),
    ...(body.preferenceContext !== undefined
      ? { preferenceContext: sanitizePreferenceContext(body.preferenceContext) }
      : {}),
  };
  const { data } = await tradeHttp().write<CreateFromTemplateResponse>(
    'POST',
    `/dashboards/from-template/${encodeURIComponent(key)}`,
    payload,
    { key: assertIdempotencyKey(idem), scope: dashboardScope(ctx) },
  );
  return data;
}

// POST /api/tenant/trade/v1/dashboards (201)
// Headers: x-idempotency-key
export async function createDashboard(
  ctx: TradeContext,
  body: CreateDashboardBody,
  idem: string,
): Promise<CreateDashboardResponse> {
  const payload: CreateDashboardBody = {
    name: body.name,
    ...(body.description !== undefined ? { description: body.description } : {}),
    scopeCoverage: body.scopeCoverage,
    scopeTargets: sanitizeScopeTargets(body.scopeTargets),
    ...(body.defaultFilters !== undefined ? { defaultFilters: sanitizeFilters(body.defaultFilters) } : {}),
  };
  const { data } = await tradeHttp().write<CreateDashboardResponse>(
    'POST',
    '/dashboards',
    payload,
    { key: assertIdempotencyKey(idem), scope: dashboardScope(ctx) },
  );
  return data;
}

// PATCH /api/tenant/trade/v1/dashboards/:id
// Headers: If-Match: "<revision>"
export async function updateDashboard(
  ctx: TradeContext,
  id: string,
  revision: number,
  patch: UpdateDashboardBody,
): Promise<DashboardDetail> {
  const payload: UpdateDashboardBody = {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.scopeCoverage !== undefined ? { scopeCoverage: patch.scopeCoverage } : {}),
    ...(patch.scopeTargets !== undefined ? { scopeTargets: sanitizeScopeTargets(patch.scopeTargets) } : {}),
    ...(patch.defaultFilters !== undefined ? { defaultFilters: sanitizeFilters(patch.defaultFilters) } : {}),
  };
  const { data } = await tradeHttp().write<DashboardDetail>(
    'PATCH',
    `/dashboards/${encodeURIComponent(id)}`,
    payload,
    {
      key: newIdempotencyKey(),
      ifMatch: ifMatch(revision),
      scope: dashboardScope(ctx),
    },
  );
  return data;
}

// DELETE /api/tenant/trade/v1/dashboards/:id (204)
// Headers: If-Match: "<revision>"
export async function deleteDashboard(ctx: TradeContext, id: string, revision: number): Promise<void> {
  await tradeHttp().write<void>(
    'DELETE',
    `/dashboards/${encodeURIComponent(id)}`,
    undefined,
    {
      key: newIdempotencyKey(),
      ifMatch: ifMatch(revision),
      scope: dashboardScope(ctx),
    },
  );
}

// POST /api/tenant/trade/v1/dashboards/:id/duplicate (201)
// Headers: x-idempotency-key
export async function duplicateDashboard(
  ctx: TradeContext,
  id: string,
  body: DuplicateDashboardBody = {},
  idem: string,
): Promise<DuplicateDashboardResponse> {
  const payload: DuplicateDashboardBody = {
    ...(body.name !== undefined ? { name: body.name } : {}),
  };
  const { data } = await tradeHttp().write<DuplicateDashboardResponse>(
    'POST',
    `/dashboards/${encodeURIComponent(id)}/duplicate`,
    payload,
    { key: assertIdempotencyKey(idem), scope: dashboardScope(ctx) },
  );
  return data;
}

// POST /api/tenant/trade/v1/dashboards/:id/set-default { context } (200)
// Headers: x-idempotency-key
export async function setDefault(
  ctx: TradeContext,
  id: string,
  context: PreferenceContext,
  idem: string,
): Promise<PreferenceRow> {
  const payload = { context: sanitizePreferenceContext(context) };
  const { data } = await tradeHttp().write<PreferenceRow>(
    'POST',
    `/dashboards/${encodeURIComponent(id)}/set-default`,
    payload,
    { key: assertIdempotencyKey(idem), scope: dashboardScope(ctx) },
  );
  return data;
}

// POST /api/tenant/trade/v1/dashboards/:id/set-favorite { context, favorite } (200)
// Headers: x-idempotency-key
export async function setFavorite(
  ctx: TradeContext,
  id: string,
  context: PreferenceContext,
  favorite: boolean,
  idem: string,
): Promise<PreferenceRow> {
  assertBodyBooleans({ favorite }, ['favorite']);
  const payload = {
    context: sanitizePreferenceContext(context),
    favorite,
  };
  const { data } = await tradeHttp().write<PreferenceRow>(
    'POST',
    `/dashboards/${encodeURIComponent(id)}/set-favorite`,
    payload,
    { key: assertIdempotencyKey(idem), scope: dashboardScope(ctx) },
  );
  return data;
}

// PATCH /api/tenant/trade/v1/dashboards/:id/layout { placements }
// Headers: If-Match: "<revision>"
export async function updateLayout(
  ctx: TradeContext,
  id: string,
  revision: number,
  placements: LayoutPlacementInput[],
): Promise<DashboardDetail> {
  const payload = {
    placements: placements.map((p) => ({
      placementId: p.placementId,
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      sortOrder: p.sortOrder,
    })),
  };
  const { data } = await tradeHttp().write<DashboardDetail>(
    'PATCH',
    `/dashboards/${encodeURIComponent(id)}/layout`,
    payload,
    {
      key: newIdempotencyKey(),
      ifMatch: ifMatch(revision),
      scope: dashboardScope(ctx),
    },
  );
  return data;
}

// POST /api/tenant/trade/v1/dashboards/:id/run (200; requestId in the body)
export async function runDashboard(ctx: TradeContext, id: string, req: RunRequest): Promise<RunResult> {
  const payload: RunRequest = {
    requestId: req.requestId,
    ...(req.scope !== undefined
      ? {
          scope: {
            scopeMode: req.scope.scopeMode,
            ...(req.scope.companyScopes !== undefined
              ? { companyScopes: sanitizeRuntimeScopes(req.scope.companyScopes) }
              : {}),
          },
        }
      : {}),
    ...(req.filters !== undefined ? { filters: sanitizeFilters(req.filters) } : {}),
    ...(req.widgetIds !== undefined ? { widgetIds: [...req.widgetIds] } : {}),
  };
  const { data } = await tradeHttp().write<RunResult>(
    'POST',
    `/dashboards/${encodeURIComponent(id)}/run`,
    payload,
    { key: newIdempotencyKey(), scope: dashboardScope(ctx) },
  );
  return data;
}

// POST /api/tenant/trade/v1/dashboards/:id/placements (201)
// Headers: x-idempotency-key
export async function addPlacement(
  ctx: TradeContext,
  id: string,
  body: AddPlacementBody,
  idem: string,
): Promise<AddPlacementResponse> {
  const payload: AddPlacementBody = {
    widgetId: body.widgetId,
    ...(body.x !== undefined ? { x: body.x } : {}),
    ...(body.y !== undefined ? { y: body.y } : {}),
    ...(body.width !== undefined ? { width: body.width } : {}),
    ...(body.height !== undefined ? { height: body.height } : {}),
    ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
  };
  const { data } = await tradeHttp().write<AddPlacementResponse>(
    'POST',
    `/dashboards/${encodeURIComponent(id)}/placements`,
    payload,
    { key: assertIdempotencyKey(idem), scope: dashboardScope(ctx) },
  );
  return data;
}

// DELETE /api/tenant/trade/v1/dashboards/:id/placements/:placementId (204; revision from ETag)
// Headers: If-Match: "<revision>"
export async function removePlacement(
  ctx: TradeContext,
  id: string,
  placementId: string,
  revision: number,
): Promise<{ revision: number }> {
  const res = await tradeHttp().write<void>(
    'DELETE',
    `/dashboards/${encodeURIComponent(id)}/placements/${encodeURIComponent(placementId)}`,
    undefined,
    {
      key: newIdempotencyKey(),
      ifMatch: ifMatch(revision),
      scope: dashboardScope(ctx),
    },
  );
  return { revision: parseEtagRevision(res.etag) };
}

// GET /api/tenant/trade/v1/dashboards/:id/shares -> { items }
export function listShares(ctx: TradeContext, id: string): Promise<ShareListResponse> {
  return tradeHttp().read<ShareListResponse>(
    `/dashboards/${encodeURIComponent(id)}/shares`,
    undefined,
    { scope: dashboardScope(ctx) },
  );
}

// POST /api/tenant/trade/v1/dashboards/:id/shares/bulk-upsert (200)
// Headers: x-idempotency-key
export async function upsertShares(
  ctx: TradeContext,
  id: string,
  body: UpsertSharesBody,
  idem: string,
): Promise<UpsertSharesResponse> {
  const payload: UpsertSharesBody = {
    resourceRevision: body.resourceRevision,
    changes: body.changes.map((c) => ({
      subjectType: c.subjectType,
      subjectId: c.subjectId,
      accessLevel: c.accessLevel,
      ...(c.expiresAt !== undefined ? { expiresAt: c.expiresAt } : {}),
    })),
  };
  const { data } = await tradeHttp().write<UpsertSharesResponse>(
    'POST',
    `/dashboards/${encodeURIComponent(id)}/shares/bulk-upsert`,
    payload,
    { key: assertIdempotencyKey(idem), scope: dashboardScope(ctx) },
  );
  return data;
}

// DELETE /api/tenant/trade/v1/dashboards/:id/shares/:shareId (204; revision from ETag)
// Headers: If-Match: "<revision>"
export async function revokeShare(
  ctx: TradeContext,
  id: string,
  shareId: string,
  revision: number,
): Promise<{ revision: number }> {
  const res = await tradeHttp().write<void>(
    'DELETE',
    `/dashboards/${encodeURIComponent(id)}/shares/${encodeURIComponent(shareId)}`,
    undefined,
    {
      key: newIdempotencyKey(),
      ifMatch: ifMatch(revision),
      scope: dashboardScope(ctx),
    },
  );
  return { revision: parseEtagRevision(res.etag) };
}

// GET /api/tenant/trade/v1/dashboards/share-targets?search&limit&offset -> { items, pagination }
export function listShareTargets(
  ctx: TradeContext,
  query: ListShareTargetsQuery = {},
): Promise<ShareTargetListResponse> {
  return tradeHttp().read<ShareTargetListResponse>(
    '/dashboards/share-targets',
    buildShareTargetsQuery(query),
    { scope: dashboardScope(ctx) },
  );
}

// GET /api/tenant/trade/v1/widgets -> { items } (at most 500, no paging)
export function listWidgets(ctx: TradeContext): Promise<WidgetListResponse> {
  return tradeHttp().read<WidgetListResponse>('/widgets', undefined, { scope: dashboardScope(ctx) });
}
