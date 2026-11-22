import type { TradeContext } from '../shared/trade-api';
import {
  fakeAddPlacement,
  fakeCreateDashboard,
  fakeCreateFromTemplate,
  fakeDeleteDashboard,
  fakeDuplicateDashboard,
  fakeGetCatalog,
  fakeGetDashboard,
  fakeGetDefault,
  fakeGetNavigation,
  fakeListDashboards,
  fakeListShareTargets,
  fakeListShares,
  fakeListWidgets,
  fakeRemovePlacement,
  fakeRevokeShare,
  fakeRunDashboard,
  fakeSetDefault,
  fakeSetFavorite,
  fakeUpdateDashboard,
  fakeUpdateLayout,
  fakeUpsertShares,
  type AddPlacementBody,
  type AddPlacementResponse,
  type CreateDashboardResponse,
  type CreateFromTemplateBody,
  type CreateFromTemplateResponse,
  type DashboardListRow,
  type DuplicateDashboardBody,
  type DuplicateDashboardResponse,
  type LayoutPlacementInput,
  type ListDashboardsQuery,
  type ListDashboardsResponse,
  type ListShareTargetsQuery,
  type PreferenceQuery,
  type ShareChangeInput,
  type ShareChangeResult,
  type UpdateDashboardBody,
  type UpsertSharesBody,
  type UpsertSharesResponse,
} from './trade-dashboard.fake';
import type {
  Catalog,
  CreateDashboardBody,
  DashboardDetail,
  Navigation,
  DefaultResult,
  PreferenceContext,
  PreferenceRow,
  RunRequest,
  RunResult,
  ShareListResponse,
  ShareTargetListResponse,
  TemplateKey,
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
  ShareChangeResult,
  UpdateDashboardBody,
  UpsertSharesBody,
  UpsertSharesResponse,
};

/*
 * Backend: trade-app/src/modules/dashboards (dashboard.controller.ts, widget.controller.ts).
 * Every route is DASHBOARD_CONTEXT: x-mutakamel-company-id and x-mutakamel-branch-id are both
 * optional (gateway OPTIONAL_COMPANY_BRANCH; a branch needs its company). The branch header only
 * changes CURRENT_CONTEXT runs and the from-template target. The page never relies on that: it
 * sends the company header only and puts the branch in the run body (SELECTED_SCOPES), so the
 * wrappers drop branchId. companyId in the query (navigation/default/list) is accepted; it must
 * not be combined with kind=CONSOLIDATED (422 TRADE.DASHBOARD.FILTER_INVALID).
 */
function companyOnlyContext(ctx: TradeContext): TradeContext {
  return ctx.companyId ? { companyId: ctx.companyId } : {};
}

// GET /api/tenant/trade/v1/dashboards/catalog
export function getCatalog(ctx: TradeContext): Promise<Catalog> {
  return fakeGetCatalog(companyOnlyContext(ctx));
}

// GET /api/tenant/trade/v1/dashboards/navigation?kind&companyId
export function getNavigation(ctx: TradeContext, query: PreferenceQuery | PreferenceContext): Promise<Navigation> {
  return fakeGetNavigation(companyOnlyContext(ctx), query);
}

// GET /api/tenant/trade/v1/dashboards/default?kind&companyId
export function getDefault(ctx: TradeContext, query: PreferenceQuery | PreferenceContext): Promise<DefaultResult> {
  return fakeGetDefault(companyOnlyContext(ctx), query);
}

// GET /api/tenant/trade/v1/dashboards?kind&companyId&limit&offset -> { items, pagination }
export function listDashboards(
  ctx: TradeContext,
  query: ListDashboardsQuery = {},
): Promise<ListDashboardsResponse> {
  return fakeListDashboards(companyOnlyContext(ctx), query);
}

// GET /api/tenant/trade/v1/dashboards/:id (ETag: "<revision>")
export function getDashboard(ctx: TradeContext, id: string): Promise<DashboardDetail> {
  return fakeGetDashboard(companyOnlyContext(ctx), id);
}

// POST /api/tenant/trade/v1/dashboards/from-template/:templateKey (201 created, 200 existing)
// Headers: x-idempotency-key, Accept-Language
export function createFromTemplate(
  ctx: TradeContext,
  key: TemplateKey | string,
  body: CreateFromTemplateBody = {},
  idem: string,
  lang = 'en',
): Promise<CreateFromTemplateResponse> {
  return fakeCreateFromTemplate(companyOnlyContext(ctx), key, body, idem, lang);
}

// POST /api/tenant/trade/v1/dashboards (201)
// Headers: x-idempotency-key
export function createDashboard(
  ctx: TradeContext,
  body: CreateDashboardBody,
  idem: string,
): Promise<CreateDashboardResponse> {
  return fakeCreateDashboard(companyOnlyContext(ctx), body, idem);
}

// PATCH /api/tenant/trade/v1/dashboards/:id
// Headers: If-Match: "<revision>"
export function updateDashboard(
  ctx: TradeContext,
  id: string,
  revision: number,
  patch: UpdateDashboardBody,
): Promise<DashboardDetail> {
  return fakeUpdateDashboard(companyOnlyContext(ctx), id, revision, patch);
}

// DELETE /api/tenant/trade/v1/dashboards/:id (204)
// Headers: If-Match: "<revision>"
export function deleteDashboard(ctx: TradeContext, id: string, revision: number): Promise<void> {
  return fakeDeleteDashboard(companyOnlyContext(ctx), id, revision);
}

// POST /api/tenant/trade/v1/dashboards/:id/duplicate (201)
// Headers: x-idempotency-key
export function duplicateDashboard(
  ctx: TradeContext,
  id: string,
  body: DuplicateDashboardBody = {},
  idem: string,
): Promise<DuplicateDashboardResponse> {
  return fakeDuplicateDashboard(companyOnlyContext(ctx), id, body, idem);
}

// POST /api/tenant/trade/v1/dashboards/:id/set-default { context } (200)
// Headers: x-idempotency-key
export function setDefault(
  ctx: TradeContext,
  id: string,
  context: PreferenceContext,
  idem: string,
): Promise<PreferenceRow> {
  return fakeSetDefault(companyOnlyContext(ctx), id, context, idem);
}

// POST /api/tenant/trade/v1/dashboards/:id/set-favorite { context, favorite } (200)
// Headers: x-idempotency-key
export function setFavorite(
  ctx: TradeContext,
  id: string,
  context: PreferenceContext,
  favorite: boolean,
  idem: string,
): Promise<PreferenceRow> {
  return fakeSetFavorite(companyOnlyContext(ctx), id, context, favorite, idem);
}

// PATCH /api/tenant/trade/v1/dashboards/:id/layout { placements }
// Headers: If-Match: "<revision>"
export function updateLayout(
  ctx: TradeContext,
  id: string,
  revision: number,
  placements: LayoutPlacementInput[],
): Promise<DashboardDetail> {
  return fakeUpdateLayout(companyOnlyContext(ctx), id, revision, placements);
}

// POST /api/tenant/trade/v1/dashboards/:id/run (200; no x-idempotency-key, requestId in the body)
export function runDashboard(ctx: TradeContext, id: string, req: RunRequest): Promise<RunResult> {
  return fakeRunDashboard(companyOnlyContext(ctx), id, req);
}

// POST /api/tenant/trade/v1/dashboards/:id/placements (201)
// Headers: x-idempotency-key
export function addPlacement(
  ctx: TradeContext,
  id: string,
  body: AddPlacementBody,
  idem: string,
): Promise<AddPlacementResponse> {
  return fakeAddPlacement(companyOnlyContext(ctx), id, body, idem);
}

// DELETE /api/tenant/trade/v1/dashboards/:id/placements/:placementId (204; revision from ETag)
// Headers: If-Match: "<revision>"
export function removePlacement(
  ctx: TradeContext,
  id: string,
  placementId: string,
  revision: number,
): Promise<{ revision: number }> {
  return fakeRemovePlacement(companyOnlyContext(ctx), id, placementId, revision);
}

// GET /api/tenant/trade/v1/dashboards/:id/shares -> { items }
export function listShares(ctx: TradeContext, id: string): Promise<ShareListResponse> {
  return fakeListShares(companyOnlyContext(ctx), id);
}

// POST /api/tenant/trade/v1/dashboards/:id/shares/bulk-upsert (200)
// Headers: x-idempotency-key
export function upsertShares(
  ctx: TradeContext,
  id: string,
  body: UpsertSharesBody,
  idem: string,
): Promise<UpsertSharesResponse> {
  return fakeUpsertShares(companyOnlyContext(ctx), id, body, idem);
}

// DELETE /api/tenant/trade/v1/dashboards/:id/shares/:shareId (204; revision from ETag)
// Headers: If-Match: "<revision>"
export function revokeShare(
  ctx: TradeContext,
  id: string,
  shareId: string,
  revision: number,
): Promise<{ revision: number }> {
  return fakeRevokeShare(companyOnlyContext(ctx), id, shareId, revision);
}

// GET /api/tenant/trade/v1/dashboards/share-targets?search&limit&offset -> { items, pagination }
export function listShareTargets(
  ctx: TradeContext,
  query: ListShareTargetsQuery = {},
): Promise<ShareTargetListResponse> {
  return fakeListShareTargets(companyOnlyContext(ctx), query);
}

// GET /api/tenant/trade/v1/widgets -> { items } (at most 500, no paging)
export function listWidgets(ctx: TradeContext): Promise<WidgetListResponse> {
  return fakeListWidgets(companyOnlyContext(ctx));
}
