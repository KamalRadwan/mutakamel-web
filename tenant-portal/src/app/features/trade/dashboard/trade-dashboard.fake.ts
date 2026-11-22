import { FAKE_COMPANIES } from '../../../core/scope/scope.fake';
import { ApiError, fakeDelay, fakeId, type TradeContext } from '../shared/trade-api';
import { TRADE_FAKE_DB, clone, nowIso } from '../shared/trade-foundation.fake';
import {
  CATALOG,
  COMPANY_SCOPED_METRICS,
  DASHBOARD_LIMITS,
  METRIC_BY_KEY,
  TEMPLATE_LAYOUTS,
  VIZ_BY_TYPE,
  type TemplateWidgetPlacementSpec,
} from './trade-dashboard.catalog';
import type {
  AccessLevel,
  Catalog,
  CreateDashboardBody,
  DashboardDetail,
  DashboardFilters,
  DashboardWarning,
  DatePreset,
  DefaultResult,
  FilterClause,
  MetricDescriptor,
  NavItem,
  Navigation,
  Partition,
  Placement,
  Point,
  PreferenceContext,
  PreferenceRow,
  QuerySpec,
  ResolvedScopeTarget,
  RunRequest,
  RunResult,
  RuntimeCompanyScope,
  ScopeCoverage,
  ScopeMode,
  ScopeTargetRef,
  Share,
  ShareListResponse,
  ShareTarget,
  ShareTargetListResponse,
  TemplateKey,
  TradeViz,
  UnavailablePlacement,
  WidgetListItem,
  WidgetListResponse,
  WidgetResult,
  WidgetSummary,
} from './trade-dashboard.model';

export interface FakeTeam {
  id: string;
  name: string;
  nameI18n: { en: string; ar: string };
  status: 'ACTIVE' | 'INACTIVE';
}

// DashboardPreferenceQueryDto (dto/dashboard.dto.ts:574).
export interface PreferenceQuery {
  kind?: PreferenceContext['kind'];
  companyId?: string;
}

// DashboardListQueryDto (dto/dashboard.dto.ts:644): limit 1..100 (default 50), offset >= 0.
export interface ListDashboardsQuery extends PreferenceQuery {
  limit?: number;
  offset?: number;
}

// accessibleDashboards row (dashboard-access.service.ts:53); target contract: defaultFilters in the
// detail's mapped shape (comparisonMode).
export interface DashboardListRow extends NavItem {
  description: string | null;
  scopeCoverage: ScopeCoverage;
  defaultFilters: DashboardFilters;
  definitionSchemaVersion: number;
  createdAt: string;
  lastOpenedAt: string | null;
}

export interface ListDashboardsResponse {
  items: DashboardListRow[];
  pagination: {
    limit: number;
    offset: number;
    nextOffset: number | null;
  };
}

// CreateDashboardFromTemplateDto (dto/dashboard.dto.ts:303).
export interface CreateFromTemplateBody {
  name?: string;
  description?: string;
  defaultFilters?: DashboardFilters;
  preferenceContext?: PreferenceContext;
}

export interface CreateFromTemplateResponse {
  created: boolean;
  replayed: boolean;
  warnings: DashboardWarning[];
  dashboard: DashboardDetail;
}

export interface CreateDashboardResponse {
  created: true;
  replayed: boolean;
  dashboard: DashboardDetail;
}

// UpdateDashboardDto (dto/dashboard.dto.ts:330); null clears the description.
export type UpdateDashboardBody = Partial<Omit<CreateDashboardBody, 'description'>> & {
  description?: string | null;
};

export interface DuplicateDashboardBody {
  name?: string;
}

export interface DuplicateDashboardResponse {
  replayed: boolean;
  duplication: {
    omittedUnavailableWidgetCount: number;
  };
  dashboard: DashboardDetail;
}

// LayoutPlacementDto (dto/dashboard.dto.ts:463).
export interface LayoutPlacementInput {
  placementId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sortOrder: number;
}

// CreatePlacementDto (dto/dashboard.dto.ts:428).
export interface AddPlacementBody {
  widgetId: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  sortOrder?: number;
}

// addPlacement result (dashboard-widget.service.ts:695).
export interface AddPlacementResponse {
  id: string;
  placementId: string;
  widgetId: string;
  dashboardRevision: number;
  x: number;
  y: number;
  width: number;
  height: number;
  sortOrder: number;
  replayed: boolean;
}

// ShareChangeDto (dto/dashboard.dto.ts:595).
export interface ShareChangeInput {
  subjectType: 'USER' | 'TEAM';
  subjectId: string;
  accessLevel: 'VIEW' | 'EDIT';
  expiresAt?: string;
}

export interface UpsertSharesBody {
  resourceRevision: number;
  changes: ShareChangeInput[];
}

// bulkUpsert result row (dashboard-share.service.ts): no subject name or status.
export interface ShareChangeResult {
  shareId: string;
  subjectType: 'USER' | 'TEAM';
  subjectId: string;
  accessLevel: 'VIEW' | 'EDIT';
  expiresAt?: string;
  revision: number;
  changed: boolean;
}

export interface UpsertSharesResponse {
  resourceRevision: number;
  changes: ShareChangeResult[];
  replayed: boolean;
}

// ShareTargetsQueryDto (dto/dashboard.dto.ts:623): limit 1..100 (default 50).
export interface ListShareTargetsQuery {
  search?: string;
  limit?: number;
  offset?: number;
}

export const FAKE_ME = TRADE_FAKE_DB.owners[0];

const OWNER_RANA = TRADE_FAKE_DB.owners[1];
const OWNER_TAREK = TRADE_FAKE_DB.owners[2];

export const FAKE_TEAMS: readonly FakeTeam[] = [
  { id: 'team-sales', name: 'Sales team', nameI18n: { en: 'Sales team', ar: 'فريق المبيعات' }, status: 'ACTIVE' },
  {
    id: 'team-purchasing',
    name: 'Purchasing team',
    nameI18n: { en: 'Purchasing team', ar: 'فريق المشتريات' },
    status: 'ACTIVE',
  },
  { id: 'team-management', name: 'Management', nameI18n: { en: 'Management', ar: 'الإدارة' }, status: 'ACTIVE' },
];

export let FAKE_SEED_MODE: 'returning' | 'first-visit' = 'returning';

export const FAKE_DENIED_METRICS: string[] = [];

export const FAKE_RUN_UNAVAILABLE: string[] = ['trade.control_tower.exceptions_by_severity'];

const DAY_MS = 86_400_000;
const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const COMPANY_CURRENCY: Record<string, string> = {
  c1: 'EGP',
  c2: 'SAR',
};

interface StoredWidget extends WidgetListItem {
  accessibleToMe: boolean;
}

interface StoredPlacement {
  id: string;
  widgetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sortOrder: number;
}

interface StoredDashboard {
  id: string;
  ownerUserId: string;
  ownerName: string;
  name: string;
  description: string | null;
  scopeCoverage: ScopeCoverage;
  scopeTargets: ScopeTargetRef[];
  defaultFilters: DashboardFilters;
  sourceTemplateKey: TemplateKey | null;
  definitionSchemaVersion: 1;
  revision: number;
  createdAt: string;
  updatedAt: string;
  placements: StoredPlacement[];
  unavailablePlacements: UnavailablePlacement[];
}

interface StoredPreference {
  id: string;
  dashboardId: string;
  contextKey: string;
  isDefault: boolean;
  isFavorite: boolean;
  revision: number;
  lastOpenedAt: string;
}

interface StoredShare extends Share {
  dashboardId: string;
}

interface IdemEntry {
  fingerprint: string;
  response: unknown;
}

interface FakeDashboardStore {
  initializedMode: 'returning' | 'first-visit' | null;
  dashboards: StoredDashboard[];
  widgets: Map<string, StoredWidget>;
  preferences: StoredPreference[];
  shares: StoredShare[];
  idem: Map<string, IdemEntry>;
  availabilityFailedOnce: Set<string>;
}

const STORE: FakeDashboardStore = {
  initializedMode: null,
  dashboards: [],
  widgets: new Map(),
  preferences: [],
  shares: [],
  idem: new Map(),
  availabilityFailedOnce: new Set(),
};

const SEED_T0 = '2026-03-01T09:00:00.000Z';
const SEED_T1 = '2026-03-04T11:30:00.000Z';
const SEED_T2 = '2026-03-06T14:15:00.000Z';
const SEED_T3 = '2026-03-08T16:45:00.000Z';

function buildSeedWidget(
  id: string,
  owner: { id: string; name: string },
  name: string,
  visualizationType: TradeViz,
  metricKey: string,
  opts?: {
    isShared?: boolean;
    accessLevel?: AccessLevel;
    accessibleToMe?: boolean;
    grain?: QuerySpec['grain'];
    comparison?: QuerySpec['comparison'];
    paletteToken?: string;
    dimensionKey?: string;
  },
): StoredWidget {
  return {
    id,
    ownerUserId: owner.id,
    ownerName: owner.name,
    accessLevel: opts?.accessLevel ?? 'OWNER',
    isShared: opts?.isShared ?? false,
    name,
    visualizationType,
    querySpec: {
      series: [{ metricKey }],
      dimensionKey: opts?.dimensionKey ?? METRIC_BY_KEY.get(metricKey)?.allowedDimensions[0] ?? 'none',
      ...(opts?.grain ? { grain: opts.grain } : {}),
      ...(opts?.comparison ? { comparison: opts.comparison } : {}),
    },
    displaySpec: {
      paletteToken: opts?.paletteToken ?? 'trade.primary',
      options: {},
    },
    revision: 1,
    definitionSchemaVersion: 1,
    createdAt: SEED_T0,
    updatedAt: SEED_T0,
    accessibleToMe: opts?.accessibleToMe ?? true,
  };
}

function seedFromTemplateLayout(
  plcPrefix: string,
  wgtPrefix: string,
  owner: { id: string; name: string },
  specs: readonly TemplateWidgetPlacementSpec[],
  opts?: {
    isShared?: boolean;
    widgetAccessLevel?: AccessLevel;
    skipSlotCode?: string;
  },
): {
  widgets: StoredWidget[];
  placements: StoredPlacement[];
  unavailablePlacements: UnavailablePlacement[];
} {
  const widgets: StoredWidget[] = [];
  const placements: StoredPlacement[] = [];
  const unavailablePlacements: UnavailablePlacement[] = [];

  specs.forEach((spec, idx) => {
    const wgtId = `${wgtPrefix}-${idx + 1}`;
    const plcId = `${plcPrefix}-${idx + 1}`;
    const skipped = opts?.skipSlotCode === spec.code;

    const wgt = buildSeedWidget(wgtId, owner, spec.nameEn, spec.visualizationType, spec.metricKey, {
      isShared: opts?.isShared ?? false,
      accessLevel: opts?.widgetAccessLevel ?? 'OWNER',
      accessibleToMe: !skipped,
      grain: spec.grain,
      comparison: spec.comparison,
      dimensionKey: spec.dimensionKey,
    });
    widgets.push(wgt);

    if (skipped) {
      unavailablePlacements.push({
        placementId: `${plcPrefix}-unavailable`,
        reasonCode: 'WIDGET_ACCESS_REVOKED',
        x: spec.x,
        y: spec.y,
        width: spec.width,
        height: spec.height,
        sortOrder: spec.sortOrder,
      });
    } else {
      placements.push({
        id: plcId,
        widgetId: wgtId,
        x: spec.x,
        y: spec.y,
        width: spec.width,
        height: spec.height,
        sortOrder: spec.sortOrder,
      });
    }
  });

  return { widgets, placements, unavailablePlacements };
}

function seedStore(mode: 'returning' | 'first-visit'): void {
  STORE.initializedMode = mode;
  STORE.dashboards = [];
  STORE.widgets.clear();
  STORE.preferences = [];
  STORE.shares = [];
  STORE.idem.clear();
  STORE.availabilityFailedOnce.clear();

  if (mode === 'first-visit') {
    return;
  }

  // 1. My TRADE_EXECUTIVE (default for c1, favourite)
  const execSeed = seedFromTemplateLayout(
    'plc-exec',
    'wgt-exec',
    FAKE_ME,
    TEMPLATE_LAYOUTS.TRADE_EXECUTIVE.widgets,
  );
  execSeed.widgets.forEach((w) => STORE.widgets.set(w.id, w));
  STORE.dashboards.push({
    id: 'dash-exec-1',
    ownerUserId: FAKE_ME.id,
    ownerName: FAKE_ME.name,
    name: TEMPLATE_LAYOUTS.TRADE_EXECUTIVE.nameEn,
    description: TEMPLATE_LAYOUTS.TRADE_EXECUTIVE.descriptionEn,
    scopeCoverage: 'SINGLE_COMPANY',
    scopeTargets: [{ companyId: 'c1' }],
    defaultFilters: { datePreset: 'CURRENT_MONTH', comparisonMode: 'NONE' },
    sourceTemplateKey: 'TRADE_EXECUTIVE',
    definitionSchemaVersion: 1,
    revision: 1,
    createdAt: SEED_T0,
    updatedAt: SEED_T0,
    placements: execSeed.placements,
    unavailablePlacements: [],
  });
  STORE.preferences.push({
    id: 'pref-exec-c1',
    dashboardId: 'dash-exec-1',
    contextKey: 'COMPANY:c1',
    isDefault: true,
    isFavorite: true,
    revision: 1,
    lastOpenedAt: SEED_T3,
  });

  // 2. My "Weekly purchasing review" (PURCHASING layout, custom name)
  const purchSeed = seedFromTemplateLayout(
    'plc-purch',
    'wgt-purch',
    FAKE_ME,
    TEMPLATE_LAYOUTS.PURCHASING.widgets,
  );
  purchSeed.widgets.forEach((w) => STORE.widgets.set(w.id, w));
  STORE.dashboards.push({
    id: 'dash-purch-1',
    ownerUserId: FAKE_ME.id,
    ownerName: FAKE_ME.name,
    name: 'Weekly purchasing review',
    description: 'Weekly procurement and overdue delivery check.',
    scopeCoverage: 'SINGLE_COMPANY',
    scopeTargets: [{ companyId: 'c1' }],
    defaultFilters: { datePreset: 'CURRENT_WEEK', comparisonMode: 'NONE' },
    sourceTemplateKey: null,
    definitionSchemaVersion: 1,
    revision: 1,
    createdAt: SEED_T1,
    updatedAt: SEED_T1,
    placements: purchSeed.placements,
    unavailablePlacements: [],
  });

  // 3. Rana's "Regional sales review" (MULTI c1 + c2, SALES_AND_QUOTES layout, shared VIEW)
  const ranaSeed = seedFromTemplateLayout(
    'plc-rana',
    'wgt-rana',
    OWNER_RANA,
    TEMPLATE_LAYOUTS.SALES_AND_QUOTES.widgets,
    { isShared: true, widgetAccessLevel: 'VIEW' },
  );
  ranaSeed.widgets.forEach((w) => STORE.widgets.set(w.id, w));
  STORE.dashboards.push({
    id: 'dash-sales-rana',
    ownerUserId: OWNER_RANA.id,
    ownerName: OWNER_RANA.name,
    name: 'Regional sales review',
    description: 'Multi-company quotation and sales order comparison across Egypt and Saudi.',
    scopeCoverage: 'MULTI_COMPANY_AUTHORIZED_UNION',
    scopeTargets: [{ companyId: 'c1' }, { companyId: 'c2' }],
    defaultFilters: { datePreset: 'CURRENT_MONTH', comparisonMode: 'NONE' },
    sourceTemplateKey: null,
    definitionSchemaVersion: 1,
    revision: 2,
    createdAt: SEED_T1,
    updatedAt: SEED_T2,
    placements: ranaSeed.placements,
    unavailablePlacements: [],
  });
  STORE.shares.push({
    id: 'shr-rana-me',
    dashboardId: 'dash-sales-rana',
    subjectType: 'USER',
    subjectId: FAKE_ME.id,
    subjectName: FAKE_ME.name,
    accessLevel: 'VIEW',
    expiresAt: null,
    revision: 1,
    status: 'ACTIVE',
    createdAt: SEED_T2,
    updatedAt: SEED_T2,
  });

  // 4. Tarek's "Branch operations" (SINGLE c1, OPERATIONS layout, shared EDIT, 1 unavailable WIDGET_ACCESS_REVOKED)
  const tarekSeed = seedFromTemplateLayout(
    'plc-tarek',
    'wgt-tarek',
    OWNER_TAREK,
    TEMPLATE_LAYOUTS.OPERATIONS_ACTION_CENTER.widgets,
    { isShared: true, widgetAccessLevel: 'VIEW', skipSlotCode: 'action_open_exceptions' },
  );
  tarekSeed.widgets.forEach((w) => STORE.widgets.set(w.id, w));
  STORE.dashboards.push({
    id: 'dash-ops-tarek',
    ownerUserId: OWNER_TAREK.id,
    ownerName: OWNER_TAREK.name,
    name: 'Branch operations',
    description: 'Daily sales and purchasing exceptions for branch teams.',
    scopeCoverage: 'SINGLE_COMPANY',
    scopeTargets: [{ companyId: 'c1' }],
    defaultFilters: { datePreset: 'CURRENT_MONTH', comparisonMode: 'NONE' },
    sourceTemplateKey: null,
    definitionSchemaVersion: 1,
    revision: 3,
    createdAt: SEED_T2,
    updatedAt: SEED_T3,
    placements: tarekSeed.placements,
    unavailablePlacements: tarekSeed.unavailablePlacements,
  });
  STORE.shares.push({
    id: 'shr-tarek-me',
    dashboardId: 'dash-ops-tarek',
    subjectType: 'USER',
    subjectId: FAKE_ME.id,
    subjectName: FAKE_ME.name,
    accessLevel: 'EDIT',
    expiresAt: null,
    revision: 1,
    status: 'ACTIVE',
    createdAt: SEED_T3,
    updatedAt: SEED_T3,
  });

  // 5. 6 unplaced library widgets owned by FAKE_ME
  const librarySeeds: StoredWidget[] = [
    buildSeedWidget(
      'wgt-lib-1',
      FAKE_ME,
      'Quotations created',
      'METRIC_CARD',
      'trade.quotations.created.count',
    ),
    buildSeedWidget(
      'wgt-lib-2',
      FAKE_ME,
      'Orders by fulfilment status',
      'BAR',
      'trade.sales_orders.fulfillment_status.count',
    ),
    buildSeedWidget('wgt-lib-3', FAKE_ME, 'Stock-outs', 'METRIC_CARD', 'trade.inventory.stockout.count'),
    buildSeedWidget(
      'wgt-lib-4',
      FAKE_ME,
      'Price overrides',
      'METRIC_CARD',
      'trade.pricing.override.count',
    ),
    buildSeedWidget(
      'wgt-lib-5',
      FAKE_ME,
      'Purchase value by status',
      'COLUMN',
      'trade.purchase_orders.value_by_status',
    ),
    buildSeedWidget('wgt-lib-6', FAKE_ME, 'Items by kind', 'PIE', 'trade.catalog.item_kind_mix'),
  ];
  librarySeeds.forEach((w) => STORE.widgets.set(w.id, w));
}

function ensureStore(): void {
  if (STORE.initializedMode !== FAKE_SEED_MODE) {
    seedStore(FAKE_SEED_MODE);
  }
}

export function resetTradeDashboardFakeStore(mode?: 'returning' | 'first-visit'): void {
  if (mode) {
    FAKE_SEED_MODE = mode;
  }
  seedStore(FAKE_SEED_MODE);
}

// ---------------------------------------------------------------------------
// Internal helpers (validation, authz, idempotency, layout, dates)
// ---------------------------------------------------------------------------

// Backend preferenceContext() (dashboard-definition.service.ts:1832): kind defaults from the company
// header; COMPANY needs a company, CONSOLIDATED rejects an explicit companyId (422 FILTER_INVALID).
function resolvePrefContext(
  ctx: TradeContext,
  input?: { kind?: PreferenceContext['kind']; companyId?: string },
): PreferenceContext {
  const kind = input?.kind ?? (ctx.companyId ? 'COMPANY' : 'CONSOLIDATED');
  const companyId = input?.companyId ?? ctx.companyId;
  if ((kind === 'COMPANY' && !companyId) || (kind === 'CONSOLIDATED' && input?.companyId !== undefined)) {
    throw new ApiError(422, 'TRADE.DASHBOARD.FILTER_INVALID');
  }
  return kind === 'COMPANY' && companyId ? { kind, companyId } : { kind: 'CONSOLIDATED' };
}

// detail() (dashboard-definition.service.ts:942) reads isDefault/isFavorite for the header context only.
function headerPrefContext(ctx: TradeContext): PreferenceContext {
  return ctx.companyId ? { kind: 'COMPANY', companyId: ctx.companyId } : { kind: 'CONSOLIDATED' };
}

function prefContextKey(pref: PreferenceContext): string {
  return pref.kind === 'CONSOLIDATED' ? 'CONSOLIDATED' : `COMPANY:${pref.companyId ?? ''}`;
}

function findPreference(dashboardId: string, pref: PreferenceContext): StoredPreference | undefined {
  const key = prefContextKey(pref);
  return STORE.preferences.find((p) => p.dashboardId === dashboardId && p.contextKey === key);
}

function getOrCreatePreference(dashboardId: string, pref: PreferenceContext): StoredPreference {
  const existing = findPreference(dashboardId, pref);
  if (existing) {
    return existing;
  }
  const created: StoredPreference = {
    id: `pref-${fakeId()}`,
    dashboardId,
    contextKey: prefContextKey(pref),
    isDefault: false,
    isFavorite: false,
    revision: 0,
    lastOpenedAt: nowIso(),
  };
  STORE.preferences.push(created);
  return created;
}

function isShareActive(share: StoredShare, nowMs = Date.now()): boolean {
  if (share.expiresAt === null) {
    return true;
  }
  const expMs = Date.parse(share.expiresAt);
  return Number.isFinite(expMs) && expMs > nowMs;
}

function getDashboardAccessLevel(dash: StoredDashboard): AccessLevel | null {
  if (dash.ownerUserId === FAKE_ME.id) {
    return 'OWNER';
  }
  const nowMs = Date.now();
  const direct = STORE.shares.find(
    (s) =>
      s.dashboardId === dash.id &&
      s.subjectType === 'USER' &&
      s.subjectId === FAKE_ME.id &&
      isShareActive(s, nowMs),
  );
  return direct ? direct.accessLevel : null;
}

// TradeDashboardAccessService.definition + assertLevel (dashboard-access.service.ts:300-361).
function requireDashboard(
  id: string,
  required: AccessLevel = 'VIEW',
): { dash: StoredDashboard; accessLevel: AccessLevel } {
  const dash = STORE.dashboards.find((d) => d.id === id);
  const accessLevel = dash ? getDashboardAccessLevel(dash) : null;
  if (!dash || !accessLevel) {
    throw new ApiError(404, 'TRADE.DASHBOARD.NOT_FOUND');
  }
  const rank: Record<AccessLevel, number> = { VIEW: 1, EDIT: 2, OWNER: 3 };
  if (rank[accessLevel] < rank[required]) {
    throw new ApiError(
      403,
      required === 'OWNER'
        ? 'TRADE.DASHBOARD.TRANSITIVE_SHARE_FORBIDDEN'
        : 'TRADE.DASHBOARD.SCOPE_DENIED',
    );
  }
  return { dash, accessLevel };
}

function revisionConflict(): ApiError {
  return new ApiError(409, 'TRADE.DASHBOARD.REVISION_CONFLICT');
}

function checkRevision(actual: number, expected: number): void {
  if (actual !== expected) {
    throw revisionConflict();
  }
}

// requireIdempotencyKey (common/http-preconditions.ts:15).
function requireIdemKey(idemKey: string): string {
  const trimmed = idemKey.trim();
  if (!trimmed) {
    throw new ApiError(400, 'TRADE.IDEMPOTENCY.KEY_MISSING');
  }
  return trimmed;
}

// DomainIdempotencyService: a reused key with another body is 422 TRADE.IDEMPOTENCY.MISMATCH.
function lookupIdem<T>(routeKey: string, idemKey: string, payload: unknown): T | null {
  const key = requireIdemKey(idemKey);
  const existing = STORE.idem.get(`${routeKey}:${key}`);
  if (!existing) {
    return null;
  }
  if (existing.fingerprint !== JSON.stringify(payload)) {
    throw new ApiError(422, 'TRADE.IDEMPOTENCY.MISMATCH');
  }
  return clone(existing.response) as T;
}

function saveIdem(routeKey: string, idemKey: string, payload: unknown, response: unknown): void {
  STORE.idem.set(`${routeKey}:${idemKey.trim()}`, {
    fingerprint: JSON.stringify(payload),
    response: clone(response),
  });
}

// normalizeName (dashboard-definition.service.ts:2032).
function normalizeName(name: string): string {
  return name.normalize('NFKC').trim().toLocaleLowerCase('und');
}

const PLAIN_TEXT_RE = /^[^\p{Cc}\p{Cf}<>]*$/u;

/**
 * class-validator checks of the DTO text fields (dto/dashboard.dto.ts). The global pipe returns
 * 400 TRADE.VALIDATION_FAILED; AllExceptionsFilter flattens the errors into
 * details: { <property path>: [<constraint message>, ...] }.
 */
function textFieldErrors(
  field: string,
  raw: unknown,
  opts: { required: boolean; min: number; max: number },
): string[] {
  if (raw === undefined || raw === null) {
    return opts.required
      ? [
          `${field} must match ${PLAIN_TEXT_RE} regular expression`,
          `${field} must be shorter than or equal to ${opts.max} characters`,
          `${field} must be longer than or equal to ${opts.min} characters`,
          `${field} must be a string`,
        ]
      : [];
  }
  if (typeof raw !== 'string') {
    return [`${field} must be a string`];
  }
  const value = raw.trim();
  const errors: string[] = [];
  if (!PLAIN_TEXT_RE.test(value)) errors.push(`${field} must match ${PLAIN_TEXT_RE} regular expression`);
  if (value.length > opts.max) errors.push(`${field} must be shorter than or equal to ${opts.max} characters`);
  if (value.length < opts.min) errors.push(`${field} must be longer than or equal to ${opts.min} characters`);
  return errors;
}

function assertDto(details: Record<string, string[]>): void {
  const entries = Object.entries(details).filter(([, list]) => list.length > 0);
  if (entries.length > 0) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', Object.fromEntries(entries));
  }
}

function nameErrors(raw: unknown, required: boolean): string[] {
  return textFieldErrors('name', raw, { required, min: 1, max: DASHBOARD_LIMITS.MAX_NAME_CHARACTERS });
}

function descriptionErrors(raw: unknown): string[] {
  return textFieldErrors('description', raw, {
    required: false,
    min: 0,
    max: DASHBOARD_LIMITS.MAX_DESCRIPTION_CHARACTERS,
  });
}

// assertNameAvailable (dashboard-definition.service.ts:1912): 409 per owner, normalized name.
function assertNameAvailable(name: string, ownerUserId: string, excludeDashId?: string): void {
  const normalized = normalizeName(name);
  const conflict = STORE.dashboards.some(
    (d) => d.id !== excludeDashId && d.ownerUserId === ownerUserId && normalizeName(d.name) === normalized,
  );
  if (conflict) {
    throw new ApiError(409, 'TRADE.DASHBOARD.NAME_CONFLICT');
  }
}

function filterInvalid(): ApiError {
  return new ApiError(422, 'TRADE.DASHBOARD.FILTER_INVALID');
}

function isDashboardDate(value: string): boolean {
  return parseStrictUtcYmd(value) !== null;
}

const REGISTERED_FILTER_KEYS = new Set(CATALOG.metrics.flatMap((m) => m.allowedFilterKeys));

// TradeDashboardCatalogService.validateFilters (dashboard-catalog.ts:766).
function validateFilters(filters: DashboardFilters | undefined, allowResolvedPresetDates = false): void {
  if (!filters) return;
  if ([filters.dateFrom, filters.dateTo].some((v) => v !== undefined && !isDashboardDate(v))) {
    throw filterInvalid();
  }
  if ((filters.dateFrom && !filters.dateTo) || (!filters.dateFrom && filters.dateTo)) {
    throw filterInvalid();
  }
  if ((filters.dateFrom || filters.dateTo) && filters.datePreset !== 'CUSTOM' && !allowResolvedPresetDates) {
    throw filterInvalid();
  }
  if (filters.dateFrom && filters.dateTo) {
    const from = parseStrictUtcYmd(filters.dateFrom)!;
    const to = parseStrictUtcYmd(filters.dateTo)!;
    if (from > to) throw filterInvalid();
    if (to - from > DASHBOARD_LIMITS.MAX_SYNC_RANGE_MONTHS * 31 * DAY_MS) {
      throw new ApiError(422, 'TRADE.DASHBOARD.EXECUTION_BUDGET_EXCEEDED');
    }
  }
  if (filters.datePreset === 'CUSTOM' && (!filters.dateFrom || !filters.dateTo)) {
    throw filterInvalid();
  }
  for (const values of [filters.currencyCodes, filters.itemIds]) {
    if (values && new Set(values).size !== values.length) throw filterInvalid();
  }
  const clauseKeys = filters.clauses?.map((c) => c.key) ?? [];
  if (
    new Set(clauseKeys).size !== clauseKeys.length ||
    (filters.clauses ?? []).some((c) => !REGISTERED_FILTER_KEYS.has(c.key) || c.values.length === 0)
  ) {
    throw filterInvalid();
  }
}

function sortedUnique(values: readonly string[] | undefined, upper = false): string[] | undefined {
  if (!values) return undefined;
  return [...new Set(values.map((v) => (upper ? v.trim().toUpperCase() : v.trim())).filter(Boolean))].sort();
}

function normalizeClauseList(clauses: readonly FilterClause[] | undefined): FilterClause[] | undefined {
  if (!clauses) return undefined;
  return clauses
    .map((c) => ({ key: c.key.trim(), values: sortedUnique(c.values) ?? [] }))
    .filter((c) => c.key.length > 0 && c.values.length > 0)
    .sort((a, b) => a.key.localeCompare(b.key));
}

function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

// fromStoredDashboardFilters(toStoredDashboardFilters(dto)) (dashboard-spec.mapper.ts): what detail returns.
function normalizeDashboardFilters(filters: DashboardFilters | undefined): DashboardFilters {
  if (!filters) return {};
  return compact({
    datePreset: filters.datePreset,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    comparisonMode: filters.comparisonMode,
    currencyCodes: sortedUnique(filters.currencyCodes, true),
    itemIds: sortedUnique(filters.itemIds),
    clauses: normalizeClauseList(filters.clauses),
  });
}

// TradeDashboardCatalogService.validateScopeTargets (dashboard-catalog.ts:824): all failures are FILTER_INVALID.
function validateScopeTargetShape(coverage: ScopeCoverage, targets: readonly ScopeTargetRef[]): void {
  const companyIds = new Set<string>();
  for (const target of targets) {
    if (companyIds.has(target.companyId)) throw filterInvalid();
    companyIds.add(target.companyId);
    if (target.branchIds && new Set(target.branchIds).size !== target.branchIds.length) {
      throw filterInvalid();
    }
  }
  if (coverage === 'SINGLE_COMPANY' && companyIds.size !== 1) throw filterInvalid();
  if (coverage === 'MULTI_COMPANY_AUTHORIZED_UNION' && companyIds.size < 2) throw filterInvalid();
}

function companyBranchIds(companyId: string): string[] {
  return [...(FAKE_COMPANIES.find((c) => c.id === companyId)?.branches ?? []).map((b) => b.id)].sort();
}

function scopeInvalid(): ApiError {
  return new ApiError(422, 'TRADE.DASHBOARD.SCOPE_INVALID');
}

/**
 * TradeDashboardScopeService.resolve (dashboard-scope.service.ts:34). The fake viewer holds the
 * dashboard permission on every fake company with full-company coverage.
 */
function resolveScope(input: {
  ctx: TradeContext;
  coverage: ScopeCoverage;
  mode: ScopeMode;
  savedTargets?: readonly ScopeTargetRef[];
  companyScopes?: readonly RuntimeCompanyScope[];
  purpose: 'READ' | 'DEFINITION';
}): { scope: RunResult['scope']; warnings: DashboardWarning[] } {
  const { ctx, mode } = input;
  if (mode === 'SELECTED_SCOPES' && (!input.companyScopes || input.companyScopes.length === 0)) {
    throw filterInvalid();
  }
  if (mode !== 'SELECTED_SCOPES' && input.companyScopes !== undefined) {
    throw filterInvalid();
  }
  const warnings: DashboardWarning[] = [];
  let targets: ResolvedScopeTarget[];
  switch (mode) {
    case 'CURRENT_CONTEXT':
      if (!ctx.companyId) {
        throw new ApiError(422, 'TRADE.DASHBOARD.SCOPE_EMPTY');
      }
      targets = ctx.branchId
        ? [{ companyId: ctx.companyId, coverage: 'AUTHORIZED_SUBSET', branchIds: [ctx.branchId] }]
        : [{ companyId: ctx.companyId, coverage: 'FULL_COMPANY', branchIds: companyBranchIds(ctx.companyId) }];
      break;
    case 'SAVED_TARGETS': {
      const grouped = new Map<string, { companyWide: boolean; branchIds: Set<string> }>();
      for (const saved of input.savedTargets ?? []) {
        const entry = grouped.get(saved.companyId) ?? { companyWide: false, branchIds: new Set<string>() };
        if (saved.branchIds && saved.branchIds.length > 0) saved.branchIds.forEach((b) => entry.branchIds.add(b));
        else entry.companyWide = true;
        grouped.set(saved.companyId, entry);
      }
      targets = [];
      for (const [companyId, entry] of grouped) {
        if (!FAKE_COMPANIES.some((c) => c.id === companyId)) continue;
        targets.push(
          entry.companyWide
            ? { companyId, coverage: 'FULL_COMPANY', branchIds: companyBranchIds(companyId) }
            : { companyId, coverage: 'AUTHORIZED_SUBSET', branchIds: [...entry.branchIds] },
        );
      }
      if (targets.length < grouped.size) {
        warnings.push({ code: 'TRADE.DASHBOARD.SCOPE_TARGET_OMITTED' });
      }
      break;
    }
    case 'SELECTED_SCOPES': {
      const requested = input.companyScopes ?? [];
      if (
        requested.length > DASHBOARD_LIMITS.MAX_EXPLICIT_COMPANY_SCOPES ||
        new Set(requested.map((r) => r.companyId)).size !== requested.length
      ) {
        throw filterInvalid();
      }
      // validateHierarchies: unknown company or a branch of another company.
      for (const target of requested) {
        const company = FAKE_COMPANIES.find((c) => c.id === target.companyId);
        if (!company || (target.branchIds ?? []).some((b) => !company.branches.some((x) => x.id === b))) {
          throw new ApiError(422, 'TRADE.DASHBOARD.COMPANY_BRANCH_MISMATCH');
        }
      }
      targets = requested.map((target) => {
        if (target.branchIds === undefined) {
          return compact({
            companyId: target.companyId,
            coverage: 'FULL_COMPANY' as const,
            branchIds: companyBranchIds(target.companyId),
            channelIds: target.channelIds,
            fulfillmentNodeIds: target.fulfillmentNodeIds,
          });
        }
        if (target.branchIds.length === 0 || new Set(target.branchIds).size !== target.branchIds.length) {
          throw filterInvalid();
        }
        return compact({
          companyId: target.companyId,
          coverage: 'AUTHORIZED_SUBSET' as const,
          branchIds: [...target.branchIds],
          channelIds: target.channelIds,
          fulfillmentNodeIds: target.fulfillmentNodeIds,
        });
      });
      break;
    }
    case 'ALL_ACCESSIBLE':
      targets = FAKE_COMPANIES.map((c) => ({
        companyId: c.id,
        coverage: 'FULL_COMPANY' as const,
        branchIds: companyBranchIds(c.id),
      }));
      if (targets.length > DASHBOARD_LIMITS.MAX_EXPLICIT_COMPANY_SCOPES) {
        targets = targets.slice(0, DASHBOARD_LIMITS.MAX_EXPLICIT_COMPANY_SCOPES);
        warnings.push({
          code: 'TRADE.DASHBOARD.SCOPE_TRUNCATED',
          safeDetails: { limit: DASHBOARD_LIMITS.MAX_EXPLICIT_COMPANY_SCOPES },
        });
      }
      break;
    default:
      throw filterInvalid();
  }

  targets = targets
    .map((t) => ({ ...t, branchIds: [...new Set(t.branchIds)].sort() }))
    .sort((a, b) => a.companyId.localeCompare(b.companyId));
  if (targets.length === 0) {
    throw new ApiError(422, 'TRADE.DASHBOARD.SCOPE_EMPTY');
  }
  if (input.coverage === 'SINGLE_COMPANY' && targets.length !== 1) {
    throw scopeInvalid();
  }
  return {
    scope: {
      coverage: input.coverage,
      mode,
      targets,
      fingerprint: `sha256:${fakeSha256(JSON.stringify({ coverage: input.coverage, mode, targets }))}`,
      resolvedAt: nowIso(),
    },
    warnings,
  };
}

// Deterministic 64-hex stand-in for the backend sha256 fingerprints (never security relevant).
function fakeSha256(input: string): string {
  let out = '';
  for (let round = 0; round < 8; round += 1) {
    out += (hashSeed(`${round}:${input}`) >>> 0).toString(16).padStart(8, '0');
  }
  return out;
}

function toWidgetSummary(w: StoredWidget): WidgetSummary {
  return {
    id: w.id,
    ownerUserId: w.ownerUserId,
    ownerName: w.ownerName,
    accessLevel: w.ownerUserId === FAKE_ME.id ? 'OWNER' : w.accessLevel,
    isShared: w.ownerUserId !== FAKE_ME.id,
    name: w.name,
    visualizationType: w.visualizationType,
    querySpec: clone(w.querySpec),
    displaySpec: clone(w.displaySpec),
    revision: w.revision,
  };
}

function availablePlacements(dash: StoredDashboard): StoredPlacement[] {
  return dash.placements
    .filter((p) => STORE.widgets.get(p.widgetId)?.accessibleToMe === true)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
}

// unavailablePlacements (dashboard-access.service.ts:178), ordered like the backend query.
function unavailablePlacementsOf(dash: StoredDashboard): UnavailablePlacement[] {
  const runtime: UnavailablePlacement[] = [];
  for (const plc of dash.placements) {
    const widget = STORE.widgets.get(plc.widgetId);
    if (widget?.accessibleToMe) continue;
    runtime.push({
      placementId: plc.id,
      reasonCode: widget ? 'WIDGET_ACCESS_REVOKED' : 'WIDGET_DELETED',
      x: plc.x,
      y: plc.y,
      width: plc.width,
      height: plc.height,
      sortOrder: plc.sortOrder,
    });
  }
  return [...dash.unavailablePlacements, ...runtime].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.y - b.y || a.x - b.x || a.placementId.localeCompare(b.placementId),
  );
}

function livePlacementRects(dash: StoredDashboard): CellRect[] {
  return [...dash.placements, ...dash.unavailablePlacements];
}

// detail() (dashboard-definition.service.ts:942).
function buildDashboardDetail(dash: StoredDashboard, ctx: TradeContext): DashboardDetail {
  const accessLevel = getDashboardAccessLevel(dash) ?? 'VIEW';
  const pref = findPreference(dash.id, headerPrefContext(ctx));
  return clone({
    id: dash.id,
    ownerUserId: dash.ownerUserId,
    ownerName: dash.ownerName,
    name: dash.name,
    description: dash.description,
    scopeCoverage: dash.scopeCoverage,
    scopeTargets: dash.scopeTargets.map((t) =>
      t.branchIds && t.branchIds.length > 0
        ? { companyId: t.companyId, branchIds: [...new Set(t.branchIds)].sort() }
        : { companyId: t.companyId },
    ),
    defaultFilters: normalizeDashboardFilters(dash.defaultFilters),
    sourceTemplateKey: dash.sourceTemplateKey,
    definitionSchemaVersion: 1,
    revision: dash.revision,
    accessLevel,
    isShared: dash.ownerUserId !== FAKE_ME.id,
    isDefault: pref?.isDefault ?? false,
    isFavorite: pref?.isFavorite ?? false,
    createdAt: dash.createdAt,
    updatedAt: dash.updatedAt,
    placements: availablePlacements(dash).map(
      (plc): Placement => ({
        id: plc.id,
        widgetId: plc.widgetId,
        x: plc.x,
        y: plc.y,
        width: plc.width,
        height: plc.height,
        sortOrder: plc.sortOrder,
        widget: toWidgetSummary(STORE.widgets.get(plc.widgetId)!),
      }),
    ),
    unavailablePlacements: unavailablePlacementsOf(dash),
    responsive: {
      canonicalLayout: 'DESKTOP_12' as const,
      derivedLayouts: ['TABLET_6', 'MOBILE_1'],
    },
  });
}

// accessibleDashboards row (dashboard-access.service.ts:53).
function buildListRow(dash: StoredDashboard, pref: PreferenceContext): DashboardListRow {
  const stored = findPreference(dash.id, pref);
  return {
    id: dash.id,
    ownerUserId: dash.ownerUserId,
    ownerName: dash.ownerName,
    name: dash.name,
    description: dash.description,
    scopeCoverage: dash.scopeCoverage,
    defaultFilters: normalizeDashboardFilters(dash.defaultFilters),
    sourceTemplateKey: dash.sourceTemplateKey,
    definitionSchemaVersion: 1,
    revision: dash.revision,
    createdAt: dash.createdAt,
    updatedAt: dash.updatedAt,
    accessLevel: getDashboardAccessLevel(dash) ?? 'VIEW',
    isShared: dash.ownerUserId !== FAKE_ME.id,
    isDefault: stored?.isDefault ?? false,
    isFavorite: stored?.isFavorite ?? false,
    lastOpenedAt: stored?.lastOpenedAt ?? null,
  };
}

// navigation() item projection (dashboard-definition.service.ts:127).
function toNavItem(row: DashboardListRow): NavItem {
  return {
    id: row.id,
    name: row.name,
    sourceTemplateKey: row.sourceTemplateKey,
    isDefault: row.isDefault,
    isFavorite: row.isFavorite,
    isShared: row.isShared,
    accessLevel: row.accessLevel,
    ownerUserId: row.ownerUserId,
    ownerName: row.ownerName,
    revision: row.revision,
    updatedAt: row.updatedAt,
  };
}

// ORDER BY is_default DESC, is_favorite DESC, last_opened_at DESC NULLS LAST, updated_at DESC, id.
function accessibleRows(pref: PreferenceContext, limit: number, offset: number): DashboardListRow[] {
  return STORE.dashboards
    .filter((d) => getDashboardAccessLevel(d) !== null)
    .map((d) => buildListRow(d, pref))
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      if (a.lastOpenedAt !== b.lastOpenedAt) {
        if (a.lastOpenedAt === null) return 1;
        if (b.lastOpenedAt === null) return -1;
        return b.lastOpenedAt.localeCompare(a.lastOpenedAt);
      }
      if (a.updatedAt !== b.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
      return a.id.localeCompare(b.id);
    })
    .slice(offset, offset + limit);
}

function setPreference(
  dashboardId: string,
  pref: PreferenceContext,
  changes: { isDefault?: boolean; isFavorite?: boolean },
): StoredPreference {
  if (changes.isDefault) {
    const key = prefContextKey(pref);
    for (const p of STORE.preferences) {
      if (p.contextKey === key && p.isDefault) {
        p.isDefault = false;
        p.revision += 1;
      }
    }
  }
  const row = getOrCreatePreference(dashboardId, pref);
  if (changes.isDefault !== undefined) row.isDefault = changes.isDefault;
  if (changes.isFavorite !== undefined) row.isFavorite = changes.isFavorite;
  row.lastOpenedAt = nowIso();
  row.revision += 1;
  return row;
}

interface CellRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectsOverlap(a: CellRect, b: CellRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

// validatePlacement (dashboard-catalog.ts:1016): 422 LAYOUT_INVALID.
function validatePlacement(vizType: TradeViz, rect: CellRect): void {
  const viz = VIZ_BY_TYPE.get(vizType);
  if (
    !viz ||
    rect.x < 0 ||
    rect.y < 0 ||
    rect.x + rect.width > DASHBOARD_LIMITS.GRID_COLUMNS ||
    rect.width < viz.minimumWidth ||
    rect.width > viz.maximumWidth ||
    rect.height < viz.minimumHeight ||
    rect.height > viz.maximumHeight
  ) {
    throw new ApiError(422, 'TRADE.DASHBOARD.LAYOUT_INVALID');
  }
}

function intField(
  details: Record<string, string[]>,
  path: string,
  value: unknown,
  min: number,
  max: number,
  required: boolean,
): void {
  if (value === undefined && !required) return;
  const errs: string[] = [];
  if (typeof value !== 'number' || !Number.isInteger(value)) errs.push(`${path.split('.').pop()} must be an integer number`);
  if (typeof value === 'number' && value < min) errs.push(`${path.split('.').pop()} must not be less than ${min}`);
  if (typeof value === 'number' && value > max) errs.push(`${path.split('.').pop()} must not be greater than ${max}`);
  if (errs.length) details[path] = errs;
}

// LayoutPlacementDto / CreatePlacementDto integer bounds (dto/dashboard.dto.ts:428-491).
function placementDtoErrors(
  prefix: string,
  p: { x?: number; y?: number; width?: number; height?: number; sortOrder?: number },
  required: boolean,
): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  intField(details, `${prefix}x`, p.x, 0, 11, required);
  intField(details, `${prefix}y`, p.y, 0, DASHBOARD_LIMITS.MAX_LAYOUT_Y, required);
  intField(details, `${prefix}width`, p.width, 1, 12, required);
  intField(details, `${prefix}height`, p.height, 1, DASHBOARD_LIMITS.MAX_WIDGET_HEIGHT, required);
  intField(details, `${prefix}sortOrder`, p.sortOrder, 0, DASHBOARD_LIMITS.MAX_PLACEMENTS - 1, required);
  return details;
}

// firstAvailablePosition (dashboard-widget.service.ts:1028): no room is 422 LIMIT_EXCEEDED.
function firstAvailablePosition(occupied: readonly CellRect[], width: number, height: number): { x: number; y: number } {
  for (let y = 0; y <= DASHBOARD_LIMITS.MAX_LAYOUT_Y; y += 1) {
    for (let x = 0; x <= DASHBOARD_LIMITS.GRID_COLUMNS - width; x += 1) {
      if (!occupied.some((o) => rectsOverlap({ x, y, width, height }, o))) {
        return { x, y };
      }
    }
  }
  throw new ApiError(422, 'TRADE.DASHBOARD.LIMIT_EXCEEDED');
}

// nextDashboardName (dashboard-definition.service.ts:1933).
function nextDashboardName(sourceName: string, ownerUserId: string): string {
  const base = `${sourceName} Copy`.slice(0, 112);
  const occupied = new Set(
    STORE.dashboards.filter((d) => d.ownerUserId === ownerUserId).map((d) => normalizeName(d.name)),
  );
  for (let suffix = 1; suffix <= 999; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base} ${suffix}`.slice(0, 120);
    if (!occupied.has(normalizeName(candidate))) return candidate;
  }
  return `${base.slice(0, 100)} ${Date.now()}`;
}

// nextWidgetNames (dashboard-definition.service.ts:1958).
function nextWidgetNames(ownerUserId: string, sourceNames: readonly string[]): string[] {
  const unavailable = new Set(
    [...STORE.widgets.values()].filter((w) => w.ownerUserId === ownerUserId).map((w) => normalizeName(w.name)),
  );
  return sourceNames.map((sourceName) => {
    const base = sourceName.slice(0, 112);
    for (let suffix = 1; suffix <= 999; suffix += 1) {
      const candidate = suffix === 1 ? base : `${base} ${suffix}`.slice(0, 120);
      if (!unavailable.has(normalizeName(candidate))) {
        unavailable.add(normalizeName(candidate));
        return candidate;
      }
    }
    throw new ApiError(409, 'TRADE.DASHBOARD.NAME_CONFLICT');
  });
}

function assertOwnerDashboardLimit(ownerUserId: string): void {
  const count = STORE.dashboards.filter((d) => d.ownerUserId === ownerUserId).length;
  if (count >= DASHBOARD_LIMITS.MAX_DASHBOARDS_PER_OWNER) {
    throw new ApiError(422, 'TRADE.DASHBOARD.LIMIT_EXCEEDED');
  }
}

function assertWidgetCapacity(ownerUserId: string, additional: number): void {
  const count = [...STORE.widgets.values()].filter((w) => w.ownerUserId === ownerUserId).length;
  if (count + additional > DASHBOARD_LIMITS.MAX_WIDGETS_PER_OWNER) {
    throw new ApiError(422, 'TRADE.DASHBOARD.LIMIT_EXCEEDED');
  }
}

// ---------------------------------------------------------------------------
// UTC Date & Deterministic Run Helpers
// ---------------------------------------------------------------------------

function formatUtcYmd(ms: number): string {
  const d = new Date(ms);
  const y = String(d.getUTCFullYear()).padStart(4, '0');
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseStrictUtcYmd(raw: string): number | null {
  const match = YMD_RE.exec(raw.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  if (formatUtcYmd(ms) !== raw.trim()) {
    return null;
  }
  return ms;
}

function todayUtcMs(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

// presetRange (dashboard-execution.service.ts): Monday-based week, LAST_30_DAYS includes today.
function presetRange(preset: DatePreset, todayMs: number): { dateFrom: string; dateTo: string } {
  const today = new Date(todayMs);
  let fromMs = todayMs;
  switch (preset) {
    case 'CURRENT_WEEK':
      fromMs = todayMs - ((today.getUTCDay() + 6) % 7) * DAY_MS;
      break;
    case 'CURRENT_MONTH':
      fromMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1);
      break;
    case 'CURRENT_QUARTER':
      fromMs = Date.UTC(today.getUTCFullYear(), Math.floor(today.getUTCMonth() / 3) * 3, 1);
      break;
    case 'CURRENT_YEAR':
      fromMs = Date.UTC(today.getUTCFullYear(), 0, 1);
      break;
    case 'LAST_30_DAYS':
      fromMs = todayMs - 29 * DAY_MS;
      break;
    default:
      break;
  }
  return { dateFrom: formatUtcYmd(fromMs), dateTo: formatUtcYmd(todayMs) };
}

function mergeClauseArrays(lower: readonly FilterClause[], upper: readonly FilterClause[]): FilterClause[] {
  const merged = new Map(lower.map((c) => [c.key, sortedUnique(c.values) ?? []]));
  for (const c of upper) merged.set(c.key, sortedUnique(c.values) ?? []);
  return [...merged.entries()]
    .map(([key, values]) => ({ key, values }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * normalizeFilters (dashboard-execution.service.ts) + validateFilters(normalized, true). Runtime
 * values win over the saved defaults; dates of a non-CUSTOM preset are replaced by the preset range.
 * The workspace time zone is fixed to UTC in the fake.
 */
function normalizeRunFilters(
  defaults: DashboardFilters,
  runtime: DashboardFilters | undefined,
): RunResult['normalizedFilters'] {
  for (const f of [defaults, runtime]) {
    if ([f?.dateFrom, f?.dateTo].some((v) => v !== undefined && !isDashboardDate(v))) {
      throw filterInvalid();
    }
  }
  const datePreset: DatePreset = runtime?.datePreset ?? defaults.datePreset ?? 'CURRENT_MONTH';
  const todayMs = todayUtcMs();
  const range =
    datePreset === 'CUSTOM'
      ? {
          dateFrom: runtime?.dateFrom ?? defaults.dateFrom ?? '',
          dateTo: runtime?.dateTo ?? defaults.dateTo ?? '',
        }
      : presetRange(datePreset, todayMs);
  const normalized: RunResult['normalizedFilters'] = {
    datePreset,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    timeZone: 'UTC',
    today: formatUtcYmd(todayMs),
    comparisonMode: runtime?.comparisonMode ?? defaults.comparisonMode ?? 'NONE',
    currencyCodes: sortedUnique(runtime?.currencyCodes ?? defaults.currencyCodes ?? [], true) ?? [],
    itemIds: sortedUnique(runtime?.itemIds ?? defaults.itemIds ?? []) ?? [],
    clauses: mergeClauseArrays(defaults.clauses ?? [], runtime?.clauses ?? []),
    matchNone: false,
  };
  validateFilters(normalized, true);
  return normalized;
}

function hashSeed(input: string): number {

  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seedText: string): () => number {
  let state = hashSeed(seedText) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function formatDecimal(val: number, decimals: number): string {
  return val.toFixed(decimals);
}

interface CategorySpec {
  prefix: string;
  keys: readonly string[];
}

const CATEGORY_SPECS = new Map<string, CategorySpec>([
  [
    'trade.quotations.status.count',
    { prefix: 'trade.document.status', keys: ['draft', 'sent', 'accepted', 'rejected', 'expired'] },
  ],
  [
    'trade.quotations.value_by_status',
    { prefix: 'trade.document.status', keys: ['draft', 'sent', 'accepted', 'rejected', 'expired'] },
  ],
  [
    'trade.sales_orders.status.count',
    { prefix: 'trade.document.status', keys: ['draft', 'confirmed', 'closed', 'cancelled'] },
  ],
  [
    'trade.sales_orders.value_by_status',
    { prefix: 'trade.document.status', keys: ['draft', 'confirmed', 'closed', 'cancelled'] },
  ],
  [
    'trade.purchase_orders.status.count',
    { prefix: 'trade.document.status', keys: ['draft', 'confirmed', 'closed', 'cancelled'] },
  ],
  [
    'trade.purchase_orders.value_by_status',
    { prefix: 'trade.document.status', keys: ['draft', 'confirmed', 'closed', 'cancelled'] },
  ],
  [
    'trade.sales_orders.fulfillment_status.count',
    {
      prefix: 'trade.fulfillment.status',
      keys: ['unfulfilled', 'partially_fulfilled', 'fulfilled'],
    },
  ],
  [
    'trade.purchase_orders.approval_status.count',
    { prefix: 'trade.approval.status', keys: ['pending', 'approved', 'rejected'] },
  ],
  [
    'trade.catalog.item_kind_mix',
    { prefix: 'trade.item.kind', keys: ['product', 'service', 'combo'] },
  ],
  [
    'trade.catalog.capability_mix',
    { prefix: 'trade.catalog.capability', keys: ['sell', 'purchase', 'pos'] },
  ],
  [
    'trade.inventory.availability_status',
    { prefix: 'trade.inventory.availability', keys: ['in_stock', 'low_stock', 'out_of_stock'] },
  ],
  [
    'trade.pricing.price_source_mix',
    { prefix: 'trade.price.purpose', keys: ['sales', 'purchase', 'pos'] },
  ],
  [
    'trade.control_tower.exceptions_by_severity',
    { prefix: 'trade.exception.severity', keys: ['low', 'medium', 'high', 'critical'] },
  ],
]);

// drillPath (dashboard-execution.service.ts): keyed by the metric's drillThroughTargetCode.
function drillPath(code: string): string {
  if (code.includes('QUOTATIONS')) return '/trade/quotations';
  if (code.includes('SALESORDERS')) return '/trade/sales-orders';
  if (code.includes('PURCHASEORDERS')) return '/trade/purchase-orders';
  if (code.includes('CATALOG')) return '/trade/items';
  if (code.includes('INVENTORY')) return '/trade/inventory/availability';
  if (code.includes('PRICING')) return '/trade/price-books';
  if (code.includes('CONTROLTOWER')) return '/trade/control-tower/exceptions';
  return '/trade';
}

function resolveDrillThrough(
  metric: MetricDescriptor | undefined,
  scopeFingerprint: string,
  filters: RunResult['normalizedFilters'],
): WidgetResult['drillThrough'] {
  if (!metric?.drillThroughTargetCode) return undefined;
  return {
    targetCode: metric.drillThroughTargetCode,
    relativePath: drillPath(metric.drillThroughTargetCode),
    filterToken: `sha256:${fakeSha256(JSON.stringify({ scope: scopeFingerprint, filters }))}`,
  };
}

function currenciesForPartition(
  companyId: string,
  metricKey: string,
  unit: string,
  filterCurrencies: readonly string[],
): (string | undefined)[] {
  if (unit !== 'MONEY' && metricKey !== 'trade.quotations.expiring.rows') {
    return [undefined];
  }
  const baseCurrency = COMPANY_CURRENCY[companyId] ?? 'EGP';
  const available =
    companyId === 'c1' &&
    (metricKey === 'trade.sales_orders.confirmed_value' ||
      metricKey === 'trade.sales_orders.value_by_status')
      ? [baseCurrency, 'USD']
      : [baseCurrency];

  if (filterCurrencies.length === 0) {
    return available;
  }
  return available.filter((c) => filterCurrencies.includes(c));
}

function buildRowsForMetric(
  metricKey: string,
  companyId: string,
  currencyCode: string | undefined,
  dateFrom: string,
  dateTo: string,
  rng: () => number,
): Record<string, unknown>[] {
  const fromMs = parseStrictUtcYmd(dateFrom)!;
  const toMs = parseStrictUtcYmd(dateTo)!;
  const cur = currencyCode ?? COMPANY_CURRENCY[companyId] ?? 'EGP';

  if (metricKey === 'trade.quotations.expiring.rows') {
    const statuses = ['SENT', 'DRAFT'];
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < 8; i += 1) {
      const seq = 120 + i + (companyId === 'c2' ? 200 : 0);
      const validMs = toMs + randInt(rng, 1, 7) * DAY_MS;
      const amount = (randInt(rng, 12_000, 185_000) + randInt(rng, 0, 99) / 100).toFixed(2);
      rows.push({
        quotationId: `qt-${companyId}-${seq}`,
        documentNumber: `QT-2026-00${seq}`,
        validUntil: formatUtcYmd(validMs),
        lifecycleStatus: statuses[i % statuses.length],
        currencyCode: cur,
        grandTotal: amount,
      });
    }
    return rows;
  }

  if (metricKey === 'trade.purchase_orders.overdue_expected.rows') {
    const uoms = TRADE_FAKE_DB.uoms.filter((u) => u.status === 'ACTIVE');
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < 8; i += 1) {
      const seq = 410 + i + (companyId === 'c2' ? 100 : 0);
      const expMs = Math.max(fromMs, toMs - randInt(rng, 1, 12) * DAY_MS);
      const ordered = randInt(rng, 40, 300);
      const received = randInt(rng, 0, Math.max(0, ordered - 10));
      const uom = uoms[i % uoms.length];
      rows.push({
        purchaseOrderId: `PO-2026-00${seq}`,
        lineId: `line-${i + 1}`,
        expectedDate: formatUtcYmd(expMs),
        orderedQuantity: String(ordered),
        receivedQuantity: String(received),
        uomId: uom ? uom.code : 'PCS',
      });
    }
    return rows;
  }

  if (metricKey === 'trade.inventory.availability.rows') {
    const itemById = new Map(TRADE_FAKE_DB.items.map((it) => [it.id, it]));
    const uomByIdMap = new Map(TRADE_FAKE_DB.uoms.map((u) => [u.id, u]));
    const companyProfiles = TRADE_FAKE_DB.companyProfiles
      .filter((p) => p.companyId === companyId && p.trackInventory)
      .slice(0, 10);
    const nodes =
      companyId === 'c1' ? ['WH-CAI-01', 'WH-ALX-02', 'WH-GIZ-01'] : ['WH-RYD-01', 'WH-10R-02'];

    return companyProfiles.map((cp, idx) => {
      const item = itemById.get(cp.itemId);
      const uom = item ? uomByIdMap.get(item.baseUomId) : undefined;
      const onHand = randInt(rng, 15, 420);
      const reserved = randInt(rng, 0, Math.floor(onHand * 0.45));
      const available = onHand - reserved;
      return {
        itemId: item ? item.canonicalCode : cp.itemId,
        itemCompanyProfileId: cp.id,
        fulfillmentNodeId: nodes[idx % nodes.length],
        uomId: uom ? uom.code : 'PCS',
        onHand: String(onHand),
        reserved: String(reserved),
        available: String(available),
      };
    });
  }

  // trade.control_tower.action_rows
  const sourceTypes = ['SALES_ORDER', 'PURCHASE_ORDER', 'QUOTATION', 'INVENTORY'];
  const categories = ['CREDIT_HOLD', 'OVERDUE_RECEIPT', 'MARGIN_GUARD', 'STOCKOUT'];
  const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const codes = ['HOLD_ACTIVE', 'PAST_ETA', 'BELOW_FLOOR', 'ZERO_AVAILABLE'];
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < 8; i += 1) {
    const createdMs = Math.max(fromMs, toMs - i * DAY_MS);
    rows.push({
      id: `exc-${companyId}-${i + 1}`,
      sourceType: sourceTypes[i % sourceTypes.length],
      sourceId: `${companyId.toUpperCase()}-DOC-${301 + i}`,
      category: categories[i % categories.length],
      severity: severities[i % severities.length],
      safeErrorCode: codes[i % codes.length],
      createdAt: new Date(createdMs + 10 * 3_600_000).toISOString(),
    });
  }
  return rows;
}

function buildWidgetResult(
  dash: StoredDashboard,
  widget: StoredWidget,
  scope: RunResult['scope'],
  normalizedFilters: RunResult['normalizedFilters'],
  asOfIso: string,
): WidgetResult {
  const targets = scope.targets;
  const metricKey = widget.querySpec.series[0]?.metricKey ?? '';
  const metricDesc = METRIC_BY_KEY.get(metricKey);
  const shape = metricDesc?.shape ?? 'SCALAR';
  const unit = metricDesc?.unit ?? 'COUNT';

  // unavailableResult / FAILED result (dashboard-execution.service.ts): no owners, epochs, asOf or drill.
  const emptyMeta = {
    widgetId: widget.id,
    metricVersions: {},
    sourceOwners: [],
    sourceEpochs: [],
    completeness: 'UNKNOWN' as const,
    partitions: [],
    warnings: [],
  };

  // metricPermitted: a company-scoped provider on a branch-limited target is UNAVAILABLE.
  if (
    FAKE_RUN_UNAVAILABLE.includes(metricKey) ||
    (COMPANY_SCOPED_METRICS.has(metricKey) && targets.some((t) => t.coverage === 'AUTHORIZED_SUBSET'))
  ) {
    return {
      ...emptyMeta,
      status: 'UNAVAILABLE',
      shape,
      errorCode: 'TRADE.DASHBOARD.METRIC_PERMISSION_REQUIRED',
    };
  }

  if (metricKey === 'trade.inventory.availability_status') {
    const runKey = `${dash.id}:${widget.id}`;
    if (!STORE.availabilityFailedOnce.has(runKey)) {
      STORE.availabilityFailedOnce.add(runKey);
      return {
        ...emptyMeta,
        status: 'FAILED',
        shape: 'SCALAR',
        errorCode: 'TRADE.DASHBOARD.EXECUTION_BUDGET_EXCEEDED',
      };
    }
  }

  // combineWidgetResults (dashboard-execution.service.ts).
  const baseMeta = {
    widgetId: widget.id,
    metricVersions: metricKey ? { [metricKey]: metricDesc?.version ?? 1 } : {},
    sourceOwners: metricDesc ? [metricDesc.freshness.sourceOwner] : [],
    sourceEpochs: metricDesc ? [`${metricDesc.freshness.sourceOwner}:canonical:${asOfIso}`] : [],
    asOf: asOfIso,
    warnings: [] as DashboardWarning[],
    ...(metricDesc?.drillThroughTargetCode
      ? { drillThrough: resolveDrillThrough(metricDesc, scope.fingerprint, normalizedFilters) }
      : {}),
  };

  if (metricKey === 'trade.pricing.guard_breaches.count') {
    return {
      ...baseMeta,
      status: 'EMPTY',
      shape,
      completeness: 'COMPLETE',
      partitions: targets.map((t) => ({ companyId: t.companyId, branchIds: [...t.branchIds], scalar: 0 })),
    };
  }

  const partitions: Partition[] = [];
  const hasComparison = normalizedFilters.comparisonMode !== 'NONE';
  const targetComp = widget.querySpec.comparison?.mode === 'TARGET';

  for (const target of targets) {
    const currencyList = currenciesForPartition(
      target.companyId,
      metricKey,
      unit,
      normalizedFilters.currencyCodes,
    );

    for (const currencyCode of currencyList) {
      const branchSalt = target.branchIds.join(',');
      const seedKey = `${widget.id}|${target.companyId}|${currencyCode ?? ''}|${normalizedFilters.dateFrom}|${normalizedFilters.dateTo}|${branchSalt}`;
      const rng = createRng(seedKey);
      const scaleFactor =
        (target.coverage === 'AUTHORIZED_SUBSET' ? 0.55 : 1) *
        (target.companyId === 'c2' ? 0.35 : 1) *
        (currencyCode === 'USD' ? 0.08 : 1);

      if (shape === 'SCALAR') {
        let scalar: string | number;
        let previousValue: string | number;

        if (unit === 'MONEY') {
          const base = randInt(rng, 280_000, 1_950_000) * scaleFactor;
          const prev = base * (0.82 + rng() * 0.34);
          scalar = formatDecimal(Math.max(1200, base), 2);
          previousValue = formatDecimal(Math.max(1000, prev), 2);
        } else if (unit === 'PERCENT') {
          const base = 18 + rng() * 48;
          const prev = Math.max(5, base + (rng() - 0.5) * 10);
          scalar = formatDecimal(base, 1);
          previousValue = formatDecimal(prev, 1);
        } else if (unit === 'QUANTITY') {
          const base = randInt(rng, 50, 900) * scaleFactor;
          const prev = Math.max(10, base * (0.8 + rng() * 0.4));
          scalar = formatDecimal(base, 2);
          previousValue = formatDecimal(prev, 2);
        } else {
          const base = Math.max(1, Math.round(randInt(rng, 12, 240) * scaleFactor));
          const prev = Math.max(1, Math.round(base * (0.8 + rng() * 0.4)));
          scalar = base;
          previousValue = prev;
        }

        const partition: Partition = {
          companyId: target.companyId,
          branchIds: [...target.branchIds],
          ...(currencyCode ? { currencyCode } : {}),
          scalar,
        };

        if (targetComp || hasComparison) {
          const secondaryValue = targetComp
            ? widget.querySpec.comparison?.target ?? '20'
            : previousValue;
          partition.series = [
            {
              key: 'comparison',
              unit,
              ...(currencyCode ? { currencyCode } : {}),
              points: [
                {
                  key: 'value',
                  value: scalar,
                  secondaryValue,
                },
              ],
            },
          ];
        }

        partitions.push(partition);
        continue;
      }

      if (shape === 'TIME_SERIES') {
        const fromMs = parseStrictUtcYmd(normalizedFilters.dateFrom)!;
        const toMs = parseStrictUtcYmd(normalizedFilters.dateTo)!;
        const points: Point[] = [];

        for (let ms = fromMs; ms <= toMs; ms += DAY_MS) {
          const dayIso = `${formatUtcYmd(ms)}T00:00:00.000Z`;
          const val = Math.max(1, Math.round(randInt(rng, 4, 38) * scaleFactor));
          const prev = Math.max(1, Math.round(val * (0.75 + rng() * 0.5)));
          points.push({
            key: dayIso,
            occurredAt: dayIso,
            value: val,
            ...(hasComparison ? { secondaryValue: prev } : {}),
          });
        }

        partitions.push({
          companyId: target.companyId,
          branchIds: [...target.branchIds],
          series: [{ key: metricKey, unit, points }],
        });
        continue;
      }

      if (shape === 'CATEGORY') {
        const spec = CATEGORY_SPECS.get(metricKey) ?? {
          prefix: 'trade.document.status',
          keys: ['draft', 'confirmed', 'closed', 'cancelled'],
        };
        const points: Point[] = spec.keys.map((itemKey) => {
          const labelKey = `${spec.prefix}.${itemKey}`;
          if (unit === 'MONEY') {
            const val = Math.max(2500, randInt(rng, 45_000, 620_000) * scaleFactor);
            const prev = Math.max(2000, val * (0.78 + rng() * 0.42));
            return {
              key: itemKey.toUpperCase(),
              labelKey,
              value: formatDecimal(val, 2),
              ...(hasComparison ? { secondaryValue: formatDecimal(prev, 2) } : {}),
            };
          }
          const val = Math.max(1, Math.round(randInt(rng, 5, 115) * scaleFactor));
          const prev = Math.max(1, Math.round(val * (0.78 + rng() * 0.42)));
          return {
            key: itemKey.toUpperCase(),
            labelKey,
            value: val,
            ...(hasComparison ? { secondaryValue: prev } : {}),
          };
        });

        partitions.push({
          companyId: target.companyId,
          branchIds: [...target.branchIds],
          ...(currencyCode ? { currencyCode } : {}),
          series: [
            {
              key: metricKey,
              unit,
              ...(currencyCode ? { currencyCode } : {}),
              points,
            },
          ],
        });
        continue;
      }

      if (shape === 'XY') {
        const points: Point[] = [];
        for (let i = 1; i <= 30; i += 1) {
          const orderNum = `SO-2026-${String(1000 + i).padStart(5, '0')}`;
          const lineCount = randInt(rng, 1, 18);
          const quantity = randInt(rng, 2, 160);
          const orderValue = formatDecimal(
            Math.max(500, (lineCount * 1450 + quantity * 85 + randInt(rng, 200, 8000)) * scaleFactor),
            2,
          );
          points.push({
            key: orderNum,
            value: orderValue,
            secondaryValue: lineCount,
            size: quantity,
          });
        }
        partitions.push({
          companyId: target.companyId,
          branchIds: [...target.branchIds],
          ...(currencyCode ? { currencyCode } : {}),
          series: [
            {
              key: metricKey,
              unit,
              ...(currencyCode ? { currencyCode } : {}),
              points,
            },
          ],
        });
        continue;
      }

      if (shape === 'INTERVAL') {
        const fromMs = parseStrictUtcYmd(normalizedFilters.dateFrom)!;
        const points: Point[] = [];
        for (let i = 0; i < 12; i += 1) {
          const poId = `PO-2026-${String(201 + Math.floor(i / 2)).padStart(5, '0')}`;
          const lineKey = `${poId}#${(i % 2) + 1}`;
          const startOffsetDays = randInt(rng, 0, 12);
          const durationDays = randInt(rng, 2, 9);
          const startIso = new Date(fromMs + startOffsetDays * DAY_MS).toISOString();
          const endIso = new Date(fromMs + (startOffsetDays + durationDays) * DAY_MS).toISOString();
          points.push({
            key: lineKey,
            value: 1,
            start: startIso,
            end: endIso,
            meta: { purchaseOrderId: poId },
          });
        }
        partitions.push({
          companyId: target.companyId,
          branchIds: [...target.branchIds],
          series: [{ key: metricKey, unit, points }],
        });
        continue;
      }

      if (shape === 'GRAPH') {
        const edges: [string, string][] = [
          ['DRAFT', 'CONFIRMED'],
          ['DRAFT', 'CANCELLED'],
          ['CONFIRMED', 'CLOSED'],
          ['CONFIRMED', 'CANCELLED'],
        ];
        const points: Point[] = edges.map(([source, targetNode]) => ({
          key: `${source}:${targetNode}`,
          source,
          target: targetNode,
          value: Math.max(1, Math.round(randInt(rng, 6, 95) * scaleFactor)),
        }));
        partitions.push({
          companyId: target.companyId,
          branchIds: [...target.branchIds],
          series: [{ key: metricKey, unit, points }],
        });
        continue;
      }

      // ROWS
      const rows = buildRowsForMetric(
        metricKey,
        target.companyId,
        currencyCode,
        normalizedFilters.dateFrom,
        normalizedFilters.dateTo,
        rng,
      );
      partitions.push({
        companyId: target.companyId,
        branchIds: [...target.branchIds],
        ...(currencyCode ? { currencyCode } : {}),
        rows: rows.slice(0, 15),
      });
    }
  }

  return {
    ...baseMeta,
    status: partitions.length === 0 ? 'EMPTY' : 'READY',
    shape,
    completeness: 'COMPLETE',
    partitions,
  };
}

// ---------------------------------------------------------------------------
// Exported fake endpoint implementations (one per backend route, same order as dashboard.controller.ts)
// ---------------------------------------------------------------------------

// GET dashboards/catalog -> TradeDashboardCatalogService.getCatalog(visibleMetricKeys).
export async function fakeGetCatalog(_ctx: TradeContext): Promise<Catalog> {
  await fakeDelay();
  ensureStore();

  const denied = new Set(FAKE_DENIED_METRICS);
  const metrics = CATALOG.metrics.filter((m) => !denied.has(m.key));
  const templates = CATALOG.templates.filter((tpl) =>
    TEMPLATE_LAYOUTS[tpl.key].widgets
      .filter((w) => !w.requiresFeatureKey || metrics.some((m) => m.key === w.metricKey))
      .every((w) => metrics.some((m) => m.key === w.metricKey)),
  );
  return clone({ ...CATALOG, metrics, templates });
}

// GET dashboards/navigation?kind&companyId (dashboard-definition.service.ts:109).
export async function fakeGetNavigation(ctx: TradeContext, query: PreferenceQuery = {}): Promise<Navigation> {
  await fakeDelay();
  ensureStore();

  const preferenceContext = resolvePrefContext(ctx, query);
  const rows = accessibleRows(preferenceContext, 100, 0);
  return clone({
    items: rows.map(toNavItem),
    activeDashboardId: rows.find((r) => r.isDefault)?.id ?? rows[0]?.id ?? null,
    preferenceContext,
    capabilities: {
      canEditLayout: true as const,
      canonicalColumns: 12 as const,
      responsiveLayouts: ['DESKTOP_12', 'TABLET_6', 'MOBILE_1'],
    },
  });
}

// GET dashboards/default?kind&companyId (dashboard-definition.service.ts:183).
export async function fakeGetDefault(ctx: TradeContext, query: PreferenceQuery = {}): Promise<DefaultResult> {
  await fakeDelay();
  ensureStore();

  const preferenceContext = resolvePrefContext(ctx, query);
  const rows = accessibleRows(preferenceContext, 100, 0);
  const selected =
    rows.find((r) => r.isDefault) ??
    rows.find((r) => r.ownerUserId === FAKE_ME.id && r.sourceTemplateKey === 'TRADE_EXECUTIVE') ??
    rows[0];
  if (!selected) {
    return clone({
      dashboard: null,
      ensureTemplate: { templateKey: 'TRADE_EXECUTIVE' as const, preferenceContext },
    });
  }
  const dash = STORE.dashboards.find((d) => d.id === selected.id)!;
  return { dashboard: buildDashboardDetail(dash, ctx), ensureTemplate: null };
}

// GET dashboards?kind&companyId&limit&offset (dashboard-definition.service.ts:156).
export async function fakeListDashboards(
  ctx: TradeContext,
  query: ListDashboardsQuery = {},
): Promise<ListDashboardsResponse> {
  await fakeDelay();
  ensureStore();

  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;
  const details: Record<string, string[]> = {};
  intField(details, 'limit', limit, 1, 100, true);
  intField(details, 'offset', offset, 0, Number.MAX_SAFE_INTEGER, true);
  assertDto(details);

  const preferenceContext = resolvePrefContext(ctx, query);
  const items = accessibleRows(preferenceContext, limit, offset);
  return clone({
    items,
    pagination: {
      limit,
      offset,
      nextOffset: items.length === limit ? offset + limit : null,
    },
  });
}

// GET dashboards/:id (dashboard-definition.service.ts:226); opening does not touch preferences.
export async function fakeGetDashboard(ctx: TradeContext, id: string): Promise<DashboardDetail> {
  await fakeDelay();
  ensureStore();

  const { dash } = requireDashboard(id, 'VIEW');
  return buildDashboardDetail(dash, ctx);
}

// POST dashboards/from-template/:templateKey (dashboard-definition.service.ts:317).
export async function fakeCreateFromTemplate(
  ctx: TradeContext,
  key: TemplateKey | string,
  body: CreateFromTemplateBody = {},
  idem: string,
  lang = 'en',
): Promise<CreateFromTemplateResponse> {
  await fakeDelay();
  ensureStore();

  requireIdemKey(idem);
  assertDto({
    ...(body.name !== undefined ? { name: nameErrors(body.name, true) } : {}),
    description: descriptionErrors(body.description),
  });
  validateFilters(body.defaultFilters);
  if (!(key in TEMPLATE_LAYOUTS)) {
    throw new ApiError(422, 'TRADE.DASHBOARD.DEFINITION_INVALID');
  }
  const spec = TEMPLATE_LAYOUTS[key as TemplateKey];
  const denied = new Set(FAKE_DENIED_METRICS);
  const routeKey = `POST:/dashboards/from-template/${key}`;
  const fingerprint = { body, lang };
  const cached = lookupIdem<CreateFromTemplateResponse>(routeKey, idem, fingerprint);
  if (cached) {
    return { ...cached, replayed: true, dashboard: buildDashboardDetail(requireDashboard(cached.dashboard.id).dash, ctx) };
  }
  if (spec.widgets.some((w) => denied.has(w.metricKey))) {
    throw new ApiError(422, 'TRADE.DASHBOARD.METRIC_PERMISSION_REQUIRED');
  }

  // One live dashboard per owner and template: return it unchanged (created: false, no preference write).
  const existing = STORE.dashboards.find(
    (d) => d.ownerUserId === FAKE_ME.id && d.sourceTemplateKey === spec.key,
  );
  if (existing) {
    const resp: CreateFromTemplateResponse = {
      created: false,
      replayed: false,
      warnings: [],
      dashboard: buildDashboardDetail(existing, ctx),
    };
    saveIdem(routeKey, idem, fingerprint, resp);
    return resp;
  }

  // templateScope (dashboard-definition.service.ts:1675).
  const preference = body.preferenceContext ? resolvePrefContext(ctx, body.preferenceContext) : undefined;
  const companyId = preference?.companyId ?? ctx.companyId;
  let scopeCoverage: ScopeCoverage;
  let scopeTargets: ScopeTargetRef[];
  let warnings: DashboardWarning[] = [];
  if (companyId) {
    const branchId = companyId === ctx.companyId ? ctx.branchId : undefined;
    const target: RuntimeCompanyScope = { companyId, ...(branchId ? { branchIds: [branchId] } : {}) };
    resolveScope({
      ctx,
      coverage: 'SINGLE_COMPANY',
      mode: 'SELECTED_SCOPES',
      companyScopes: [target],
      purpose: 'DEFINITION',
    });
    scopeCoverage = 'SINGLE_COMPANY';
    scopeTargets = [target];
  } else {
    const resolved = resolveScope({
      ctx,
      coverage: 'MULTI_COMPANY_AUTHORIZED_UNION',
      mode: 'ALL_ACCESSIBLE',
      purpose: 'DEFINITION',
    });
    scopeCoverage = resolved.scope.targets.length === 1 ? 'SINGLE_COMPANY' : 'MULTI_COMPANY_AUTHORIZED_UNION';
    scopeTargets = resolved.scope.targets.map((t) =>
      t.coverage === 'FULL_COMPANY' ? { companyId: t.companyId } : { companyId: t.companyId, branchIds: [...t.branchIds] },
    );
    warnings = resolved.warnings;
  }

  assertOwnerDashboardLimit(FAKE_ME.id);
  assertWidgetCapacity(FAKE_ME.id, spec.widgets.length);
  const isAr = lang.toLowerCase().startsWith('ar');
  const name = body.name !== undefined ? body.name.trim() : isAr ? spec.nameAr : spec.nameEn;
  assertNameAvailable(name, FAKE_ME.id);
  const description = body.description !== undefined ? body.description.trim() : isAr ? spec.descriptionAr : spec.descriptionEn;

  const now = nowIso();
  const dashId = `dash-${fakeId()}`;
  const widgetNames = nextWidgetNames(
    FAKE_ME.id,
    spec.widgets.map((w) => (isAr ? w.nameAr : w.nameEn)),
  );
  const placements: StoredPlacement[] = spec.widgets.map((wSpec, index) => {
    const widget: StoredWidget = {
      id: `wgt-${fakeId()}`,
      ownerUserId: FAKE_ME.id,
      ownerName: FAKE_ME.name,
      accessLevel: 'OWNER',
      isShared: false,
      name: widgetNames[index],
      visualizationType: wSpec.visualizationType,
      querySpec: templateQuerySpec(wSpec),
      displaySpec: { paletteToken: 'trade.primary', options: {} },
      revision: 1,
      definitionSchemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      accessibleToMe: true,
    };
    STORE.widgets.set(widget.id, widget);
    return {
      id: `plc-${fakeId()}`,
      widgetId: widget.id,
      x: wSpec.x,
      y: wSpec.y,
      width: wSpec.width,
      height: wSpec.height,
      sortOrder: wSpec.sortOrder,
    };
  });

  const createdDash: StoredDashboard = {
    id: dashId,
    ownerUserId: FAKE_ME.id,
    ownerName: FAKE_ME.name,
    name,
    description,
    scopeCoverage,
    scopeTargets,
    defaultFilters: normalizeDashboardFilters(body.defaultFilters ?? TEMPLATE_DEFAULT_FILTERS),
    sourceTemplateKey: spec.key,
    definitionSchemaVersion: 1,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    placements,
    unavailablePlacements: [],
  };
  STORE.dashboards.push(createdDash);
  if (preference) {
    setPreference(dashId, preference, { isDefault: true });
  }

  const resp: CreateFromTemplateResponse = {
    created: true,
    replayed: false,
    warnings,
    dashboard: buildDashboardDetail(createdDash, ctx),
  };
  saveIdem(routeKey, idem, fingerprint, resp);
  return resp;
}

// POST dashboards (dashboard-definition.service.ts:244).
export async function fakeCreateDashboard(
  ctx: TradeContext,
  body: CreateDashboardBody,
  idem: string,
): Promise<CreateDashboardResponse> {
  await fakeDelay();
  ensureStore();

  assertDto({
    name: nameErrors(body.name, true),
    description: descriptionErrors(body.description),
    ...(Array.isArray(body.scopeTargets) && body.scopeTargets.length > 0
      ? {}
      : { scopeTargets: ['scopeTargets must contain at least 1 elements'] }),
  });
  requireIdemKey(idem);
  validateFilters(body.defaultFilters);
  validateScopeTargetShape(body.scopeCoverage, body.scopeTargets);

  const routeKey = 'POST:/dashboards';
  const cached = lookupIdem<CreateDashboardResponse>(routeKey, idem, body);
  if (cached) {
    return { ...cached, replayed: true, dashboard: buildDashboardDetail(requireDashboard(cached.dashboard.id).dash, ctx) };
  }

  resolveScope({
    ctx,
    coverage: body.scopeCoverage,
    mode: 'SELECTED_SCOPES',
    companyScopes: body.scopeTargets,
    purpose: 'DEFINITION',
  });
  assertOwnerDashboardLimit(FAKE_ME.id);
  const name = body.name.trim();
  assertNameAvailable(name, FAKE_ME.id);

  const now = nowIso();
  const createdDash: StoredDashboard = {
    id: `dash-${fakeId()}`,
    ownerUserId: FAKE_ME.id,
    ownerName: FAKE_ME.name,
    name,
    description: body.description !== undefined ? body.description.trim() : null,
    scopeCoverage: body.scopeCoverage,
    scopeTargets: clone(body.scopeTargets),
    defaultFilters: normalizeDashboardFilters(body.defaultFilters),
    sourceTemplateKey: null,
    definitionSchemaVersion: 1,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    placements: [],
    unavailablePlacements: [],
  };
  STORE.dashboards.push(createdDash);

  const resp: CreateDashboardResponse = {
    created: true,
    replayed: false,
    dashboard: buildDashboardDetail(createdDash, ctx),
  };
  saveIdem(routeKey, idem, body, resp);
  return resp;
}

// PATCH dashboards/:id with If-Match (dashboard-definition.service.ts:458).
export async function fakeUpdateDashboard(
  ctx: TradeContext,
  id: string,
  revision: number,
  patch: UpdateDashboardBody,
): Promise<DashboardDetail> {
  await fakeDelay();
  ensureStore();

  assertDto({
    ...(patch.name !== undefined ? { name: nameErrors(patch.name, true) } : {}),
    description: descriptionErrors(patch.description),
    ...(patch.scopeTargets !== undefined && patch.scopeTargets.length === 0
      ? { scopeTargets: ['scopeTargets must contain at least 1 elements'] }
      : {}),
  });
  validateFilters(patch.defaultFilters);
  const { dash } = requireDashboard(id, 'EDIT');

  const nextCoverage = patch.scopeCoverage ?? dash.scopeCoverage;
  const nextTargets = patch.scopeTargets ?? dash.scopeTargets;
  validateScopeTargetShape(nextCoverage, nextTargets);
  if (patch.scopeCoverage !== undefined || patch.scopeTargets !== undefined) {
    resolveScope({
      ctx,
      coverage: nextCoverage,
      mode: 'SELECTED_SCOPES',
      companyScopes: nextTargets,
      purpose: 'DEFINITION',
    });
  }
  if (patch.name) {
    assertNameAvailable(patch.name.trim(), dash.ownerUserId, dash.id);
  }
  checkRevision(dash.revision, revision);

  if (patch.name !== undefined) dash.name = patch.name.trim();
  if (patch.description !== undefined) {
    dash.description = patch.description === null ? null : patch.description.trim();
  }
  dash.scopeCoverage = nextCoverage;
  dash.scopeTargets = clone(nextTargets);
  if (patch.defaultFilters !== undefined) {
    dash.defaultFilters = normalizeDashboardFilters(patch.defaultFilters);
  }
  dash.revision += 1;
  dash.updatedAt = nowIso();
  return buildDashboardDetail(dash, ctx);
}

// DELETE dashboards/:id with If-Match, 204 (dashboard-definition.service.ts:575): owner only, others get 404.
export async function fakeDeleteDashboard(_ctx: TradeContext, id: string, revision: number): Promise<void> {
  await fakeDelay();
  ensureStore();

  const dash = STORE.dashboards.find((d) => d.id === id);
  if (!dash || dash.ownerUserId !== FAKE_ME.id) {
    throw new ApiError(404, 'TRADE.DASHBOARD.NOT_FOUND');
  }
  checkRevision(dash.revision, revision);
  STORE.dashboards = STORE.dashboards.filter((d) => d.id !== id);
  STORE.preferences = STORE.preferences.filter((p) => p.dashboardId !== id);
  STORE.shares = STORE.shares.filter((s) => s.dashboardId !== id);
}

// POST dashboards/:id/duplicate (dashboard-definition.service.ts:645): widgets are cloned for the caller.
export async function fakeDuplicateDashboard(
  ctx: TradeContext,
  id: string,
  body: DuplicateDashboardBody = {},
  idem: string,
): Promise<DuplicateDashboardResponse> {
  await fakeDelay();
  ensureStore();

  assertDto(body.name !== undefined ? { name: nameErrors(body.name, true) } : {});
  const routeKey = `POST:/dashboards/${id}/duplicate`;
  const cached = lookupIdem<DuplicateDashboardResponse>(routeKey, idem, body);
  if (cached) {
    return { ...cached, replayed: true, dashboard: buildDashboardDetail(requireDashboard(cached.dashboard.id).dash, ctx) };
  }

  const { dash: source } = requireDashboard(id, 'VIEW');
  const resolved = resolveScope({
    ctx,
    coverage: source.scopeCoverage,
    mode: 'SAVED_TARGETS',
    savedTargets: source.scopeTargets,
    purpose: 'READ',
  });
  const sourcePlacements = availablePlacements(source);
  if (sourcePlacements.some((p) => usesDeniedMetric(STORE.widgets.get(p.widgetId)!))) {
    throw new ApiError(422, 'TRADE.DASHBOARD.METRIC_PERMISSION_REQUIRED');
  }
  assertOwnerDashboardLimit(FAKE_ME.id);
  assertWidgetCapacity(FAKE_ME.id, sourcePlacements.length);

  const name = body.name !== undefined ? body.name.trim() : nextDashboardName(source.name, FAKE_ME.id);
  assertNameAvailable(name, FAKE_ME.id);
  const now = nowIso();
  const widgetNames = nextWidgetNames(
    FAKE_ME.id,
    sourcePlacements.map((p) => STORE.widgets.get(p.widgetId)!.name),
  );
  const placements: StoredPlacement[] = sourcePlacements.map((plc, index) => {
    const sourceWidget = STORE.widgets.get(plc.widgetId)!;
    const copy: StoredWidget = {
      ...clone(sourceWidget),
      id: `wgt-${fakeId()}`,
      ownerUserId: FAKE_ME.id,
      ownerName: FAKE_ME.name,
      accessLevel: 'OWNER',
      isShared: false,
      name: widgetNames[index],
      revision: 1,
      createdAt: now,
      updatedAt: now,
      accessibleToMe: true,
    };
    STORE.widgets.set(copy.id, copy);
    return { ...plc, id: `plc-${fakeId()}`, widgetId: copy.id };
  });

  const copyDash: StoredDashboard = {
    id: `dash-${fakeId()}`,
    ownerUserId: FAKE_ME.id,
    ownerName: FAKE_ME.name,
    name,
    description: source.description,
    scopeCoverage: resolved.scope.targets.length === 1 ? 'SINGLE_COMPANY' : 'MULTI_COMPANY_AUTHORIZED_UNION',
    scopeTargets: resolved.scope.targets.map((t) =>
      t.coverage === 'AUTHORIZED_SUBSET' ? { companyId: t.companyId, branchIds: [...t.branchIds] } : { companyId: t.companyId },
    ),
    defaultFilters: normalizeDashboardFilters(source.defaultFilters),
    sourceTemplateKey: null,
    definitionSchemaVersion: 1,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    placements,
    unavailablePlacements: [],
  };
  STORE.dashboards.push(copyDash);

  const resp: DuplicateDashboardResponse = {
    replayed: false,
    duplication: { omittedUnavailableWidgetCount: unavailablePlacementsOf(source).length },
    dashboard: buildDashboardDetail(copyDash, ctx),
  };
  saveIdem(routeKey, idem, body, resp);
  return resp;
}

async function preferenceCommand(
  operation: 'set-default' | 'set-favorite',
  ctx: TradeContext,
  id: string,
  body: { context: PreferenceContext; favorite?: boolean },
  idem: string,
): Promise<PreferenceRow> {
  await fakeDelay();
  ensureStore();

  if (operation === 'set-favorite' && typeof body.favorite !== 'boolean') {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { favorite: ['favorite must be a boolean value'] });
  }
  requireIdemKey(idem);
  const preferenceContext = resolvePrefContext(ctx, body.context);
  const routeKey = `POST:/dashboards/${id}/${operation}`;
  const cached = lookupIdem<PreferenceRow>(routeKey, idem, body);
  if (cached) {
    return { ...cached, replayed: true };
  }
  requireDashboard(id, 'VIEW');
  const row = setPreference(
    id,
    preferenceContext,
    operation === 'set-default' ? { isDefault: true } : { isFavorite: body.favorite },
  );
  const result: PreferenceRow = {
    id: row.id,
    dashboardId: id,
    isDefault: row.isDefault,
    isFavorite: row.isFavorite,
    revision: row.revision,
    replayed: false,
  };
  saveIdem(routeKey, idem, body, result);
  return clone(result);
}

// POST dashboards/:id/set-default { context } (dashboard-definition.service.ts:816).
export function fakeSetDefault(
  ctx: TradeContext,
  id: string,
  context: PreferenceContext,
  idem: string,
): Promise<PreferenceRow> {
  return preferenceCommand('set-default', ctx, id, { context }, idem);
}

// POST dashboards/:id/set-favorite { context, favorite } (dashboard-definition.service.ts:832).
export function fakeSetFavorite(
  ctx: TradeContext,
  id: string,
  context: PreferenceContext,
  favorite: boolean,
  idem: string,
): Promise<PreferenceRow> {
  return preferenceCommand('set-favorite', ctx, id, { context, favorite }, idem);
}

// PATCH dashboards/:id/layout with If-Match (dashboard-definition.service.ts:848).
export async function fakeUpdateLayout(
  ctx: TradeContext,
  id: string,
  revision: number,
  placements: LayoutPlacementInput[],
): Promise<DashboardDetail> {
  await fakeDelay();
  ensureStore();

  const details: Record<string, string[]> = {};
  if (placements.length > DASHBOARD_LIMITS.MAX_PLACEMENTS) {
    details['placements'] = [`placements must contain no more than ${DASHBOARD_LIMITS.MAX_PLACEMENTS} elements`];
  }
  placements.forEach((p, index) => Object.assign(details, placementDtoErrors(`placements.${index}.`, p, true)));
  assertDto(details);

  const { dash } = requireDashboard(id, 'EDIT');
  const current = availablePlacements(dash);
  const currentIds = new Set(current.map((p) => p.id));
  const requestedIds = new Set(placements.map((p) => p.placementId));
  if (
    current.length !== placements.length ||
    requestedIds.size !== placements.length ||
    [...currentIds].some((pid) => !requestedIds.has(pid))
  ) {
    throw new ApiError(422, 'TRADE.DASHBOARD.LAYOUT_INVALID');
  }
  // validateLayoutAgainstFixed (dashboard-catalog.ts:1062).
  const byId = new Map(current.map((p) => [p.id, p]));
  for (const p of placements) {
    validatePlacement(STORE.widgets.get(byId.get(p.placementId)!.widgetId)!.visualizationType, p);
  }
  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      if (rectsOverlap(placements[i], placements[j])) {
        throw new ApiError(409, 'TRADE.DASHBOARD.LAYOUT_OVERLAP');
      }
    }
  }
  const fixed = unavailablePlacementsOf(dash);
  if (placements.some((p) => fixed.some((f) => rectsOverlap(p, f)))) {
    throw new ApiError(409, 'TRADE.DASHBOARD.LAYOUT_OVERLAP');
  }
  checkRevision(dash.revision, revision);

  const hidden = dash.placements.filter((p) => !currentIds.has(p.id));
  dash.placements = [
    ...hidden,
    ...placements.map((p) => ({
      id: p.placementId,
      widgetId: byId.get(p.placementId)!.widgetId,
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      sortOrder: p.sortOrder,
    })),
  ];
  dash.revision += 1;
  dash.updatedAt = nowIso();
  return buildDashboardDetail(dash, ctx);
}

// POST dashboards/:id/run, 200 (dashboard-execution.service.ts:133). requestId travels in the body.
export async function fakeRunDashboard(ctx: TradeContext, id: string, req: RunRequest): Promise<RunResult> {
  await fakeDelay();
  ensureStore();

  const { dash } = requireDashboard(id, 'VIEW');
  const selection = req.scope ?? { scopeMode: 'CURRENT_CONTEXT' as const };
  const { scope, warnings } = resolveScope({
    ctx,
    coverage: dash.scopeCoverage,
    mode: selection.scopeMode,
    savedTargets: dash.scopeTargets,
    companyScopes: selection.companyScopes,
    purpose: 'READ',
  });
  const normalizedFilters = normalizeRunFilters(normalizeDashboardFilters(dash.defaultFilters), req.filters);

  // Only placements the viewer can see run; a requested widget outside them is WIDGET_INVALID.
  let placements = availablePlacements(dash);
  if (req.widgetIds) {
    const requested = new Set(req.widgetIds);
    placements = placements.filter((p) => requested.has(p.widgetId));
    if (placements.length !== requested.size) {
      throw new ApiError(422, 'TRADE.DASHBOARD.WIDGET_INVALID');
    }
  }

  const generatedAt = nowIso();
  const results = placements.map((plc) =>
    buildWidgetResult(dash, STORE.widgets.get(plc.widgetId)!, scope, normalizedFilters, generatedAt),
  );
  if (
    results.length > 0 &&
    results.every((r) => r.status === 'FAILED') &&
    !results.some((r) => r.errorCode === 'TRADE.DASHBOARD.EXECUTION_BUDGET_EXCEEDED')
  ) {
    throw new ApiError(503, 'TRADE.DASHBOARD.SOURCE_UNAVAILABLE');
  }
  const unavailable = unavailablePlacementsOf(dash);
  const partial =
    warnings.length > 0 ||
    unavailable.length > 0 ||
    results.some((r) => r.status !== 'READY' && r.status !== 'EMPTY');

  return clone({
    dashboardId: dash.id,
    dashboardRevision: dash.revision,
    catalogVersion: 1,
    generatedAt,
    timeZone: 'UTC',
    scope,
    normalizedFilters,
    status: partial ? 'PARTIAL' : 'COMPLETE',
    widgets: Object.fromEntries(placements.map((p, index) => [p.widgetId, results[index]])),
    unavailablePlacements: unavailable,
    warnings,
  });
}

// POST dashboards/:id/placements (dashboard-widget.service.ts:517).
export async function fakeAddPlacement(
  _ctx: TradeContext,
  id: string,
  body: AddPlacementBody,
  idem: string,
): Promise<AddPlacementResponse> {
  await fakeDelay();
  ensureStore();

  assertDto(placementDtoErrors('', body, false));
  const routeKey = `POST:/dashboards/${id}/placements`;
  const cached = lookupIdem<AddPlacementResponse>(routeKey, idem, body);
  if (cached) {
    return { ...cached, replayed: true };
  }

  const { dash } = requireDashboard(id, 'EDIT');
  const widget = STORE.widgets.get(body.widgetId);
  // Target contract: a missing or invisible widget is 404 WIDGET_NOT_FOUND (NOT_FOUND stays for dashboards).
  if (!widget || !widget.accessibleToMe) {
    throw new ApiError(404, 'TRADE.DASHBOARD.WIDGET_NOT_FOUND');
  }
  // assertWidgetVisibleForDashboardOwnerAndViewer: the dashboard owner must see the widget too.
  if (widget.ownerUserId !== dash.ownerUserId && dash.ownerUserId !== FAKE_ME.id) {
    throw new ApiError(403, 'TRADE.DASHBOARD.WIDGET_ACCESS_DENIED');
  }
  const existing = livePlacementRects(dash);
  if (existing.length >= DASHBOARD_LIMITS.MAX_PLACEMENTS) {
    throw new ApiError(422, 'TRADE.DASHBOARD.LIMIT_EXCEEDED');
  }
  if (dash.placements.some((p) => p.widgetId === body.widgetId)) {
    throw new ApiError(409, 'TRADE.DASHBOARD.WIDGET_ALREADY_PLACED');
  }
  const viz = VIZ_BY_TYPE.get(widget.visualizationType)!;
  const width = body.width ?? viz.defaultWidth;
  const height = body.height ?? viz.defaultHeight;
  const position =
    body.x === undefined || body.y === undefined
      ? firstAvailablePosition(existing, width, height)
      : { x: body.x, y: body.y };
  const rect = { ...position, width, height };
  validatePlacement(widget.visualizationType, rect);
  if (existing.some((o) => rectsOverlap(rect, o))) {
    throw new ApiError(409, 'TRADE.DASHBOARD.LAYOUT_OVERLAP');
  }

  const placementId = `plc-${fakeId()}`;
  const sortOrder = body.sortOrder ?? existing.length;
  dash.placements.push({ id: placementId, widgetId: widget.id, ...rect, sortOrder });
  dash.revision += 1;
  dash.updatedAt = nowIso();

  const resp: AddPlacementResponse = {
    id: placementId,
    placementId,
    widgetId: widget.id,
    dashboardRevision: dash.revision,
    ...rect,
    sortOrder,
    replayed: false,
  };
  saveIdem(routeKey, idem, body, resp);
  return clone(resp);
}

// DELETE dashboards/:id/placements/:placementId with If-Match, 204 + ETag (dashboard-widget.service.ts:717).
export async function fakeRemovePlacement(
  _ctx: TradeContext,
  id: string,
  placementId: string,
  revision: number,
): Promise<{ revision: number }> {
  await fakeDelay();
  ensureStore();

  const { dash } = requireDashboard(id, 'EDIT');
  const live =
    dash.placements.some((p) => p.id === placementId) ||
    dash.unavailablePlacements.some((p) => p.placementId === placementId);
  if (!live) {
    return { revision: dash.revision };
  }
  checkRevision(dash.revision, revision);
  dash.placements = dash.placements.filter((p) => p.id !== placementId);
  dash.unavailablePlacements = dash.unavailablePlacements.filter((p) => p.placementId !== placementId);
  dash.revision += 1;
  dash.updatedAt = nowIso();
  return { revision: dash.revision };
}

function shareSubjectName(subjectType: 'USER' | 'TEAM', subjectId: string): string {
  if (subjectType === 'USER') {
    return TRADE_FAKE_DB.owners.find((o) => o.id === subjectId)?.name ?? subjectId;
  }
  return FAKE_TEAMS.find((t) => t.id === subjectId)?.name ?? subjectId;
}

// GET dashboards/:id/shares -> { items } (dashboard-share.service.ts list), owner only.
export async function fakeListShares(_ctx: TradeContext, id: string): Promise<ShareListResponse> {
  await fakeDelay();
  ensureStore();

  requireDashboard(id, 'OWNER');
  const nowMs = Date.now();
  const items = STORE.shares
    .filter((s) => s.dashboardId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
    .map(
      ({ dashboardId: _did, ...share }): Share => ({
        ...share,
        status: share.expiresAt !== null && Date.parse(share.expiresAt) <= nowMs ? 'EXPIRED' : 'ACTIVE',
      }),
    );
  return clone({ items });
}

// POST dashboards/:id/shares/bulk-upsert (dashboard-share.service.ts bulkUpsert).
export async function fakeUpsertShares(
  _ctx: TradeContext,
  id: string,
  body: UpsertSharesBody,
  idem: string,
): Promise<UpsertSharesResponse> {
  await fakeDelay();
  ensureStore();

  const details: Record<string, string[]> = {};
  intField(details, 'resourceRevision', body.resourceRevision, 1, Number.MAX_SAFE_INTEGER, true);
  if (body.changes.length < 1 || body.changes.length > DASHBOARD_LIMITS.MAX_SHARE_TARGETS) {
    details['changes'] = ['changes must contain at least 1 elements'];
  }
  body.changes.forEach((change, index) => {
    if (change.subjectType !== 'USER' && change.subjectType !== 'TEAM') {
      details[`changes.${index}.subjectType`] = ['subjectType must be one of the following values: USER, TEAM'];
    }
    if (change.accessLevel !== 'VIEW' && change.accessLevel !== 'EDIT') {
      details[`changes.${index}.accessLevel`] = ['accessLevel must be one of the following values: VIEW, EDIT'];
    }
    if (change.expiresAt && !Number.isFinite(Date.parse(change.expiresAt))) {
      details[`changes.${index}.expiresAt`] = ['expiresAt must be a valid ISO 8601 date string'];
    }
  });
  assertDto(details);
  requireIdemKey(idem);

  // validateChanges: duplicate subjects or sharing with yourself.
  const keys = body.changes.map((c) => `${c.subjectType}:${c.subjectId}`);
  if (
    new Set(keys).size !== keys.length ||
    body.changes.some((c) => c.subjectType === 'USER' && c.subjectId === FAKE_ME.id)
  ) {
    throw new ApiError(422, 'TRADE.DASHBOARD.SHARE_TARGET_INVALID');
  }
  const routeKey = `POST:/dashboards/${id}/shares/bulk-upsert`;
  const cached = lookupIdem<UpsertSharesResponse>(routeKey, idem, body);
  if (cached) {
    return { ...cached, replayed: true };
  }

  const { dash } = requireDashboard(id, 'OWNER');
  const nowMs = Date.now();
  if (body.changes.some((c) => c.expiresAt && Date.parse(c.expiresAt) <= nowMs)) {
    throw new ApiError(422, 'TRADE.DASHBOARD.SHARE_ACCESS_INVALID');
  }
  checkRevision(dash.revision, body.resourceRevision);
  // validateTargets: active users and teams only.
  for (const change of body.changes) {
    const valid =
      change.subjectType === 'USER'
        ? TRADE_FAKE_DB.owners.some((o) => o.id === change.subjectId)
        : FAKE_TEAMS.some((t) => t.id === change.subjectId && t.status === 'ACTIVE');
    if (!valid) {
      throw new ApiError(422, 'TRADE.DASHBOARD.SHARE_TARGET_INVALID');
    }
  }

  const now = nowIso();
  const sorted = [...body.changes].sort((a, b) =>
    `${a.subjectType}:${a.subjectId}`.localeCompare(`${b.subjectType}:${b.subjectId}`),
  );
  const changes: ShareChangeResult[] = sorted.map((change) => {
    const existing = STORE.shares.find(
      (s) => s.dashboardId === id && s.subjectType === change.subjectType && s.subjectId === change.subjectId,
    );
    const expiresAt = change.expiresAt ? new Date(change.expiresAt).toISOString() : null;
    const changed = !existing || existing.accessLevel !== change.accessLevel || existing.expiresAt !== expiresAt;
    let share = existing;
    if (!share) {
      share = {
        id: `shr-${fakeId()}`,
        dashboardId: id,
        subjectType: change.subjectType,
        subjectId: change.subjectId,
        subjectName: shareSubjectName(change.subjectType, change.subjectId),
        accessLevel: change.accessLevel,
        expiresAt,
        revision: 1,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      };
      STORE.shares.push(share);
    } else if (changed) {
      share.accessLevel = change.accessLevel;
      share.expiresAt = expiresAt;
      share.revision += 1;
      share.updatedAt = now;
    }
    return {
      shareId: share.id,
      subjectType: change.subjectType,
      subjectId: change.subjectId,
      accessLevel: change.accessLevel,
      ...(change.expiresAt ? { expiresAt: change.expiresAt } : {}),
      revision: share.revision,
      changed,
    };
  });
  if (changes.some((c) => c.changed)) {
    dash.revision += 1;
    dash.updatedAt = now;
  }

  const resp: UpsertSharesResponse = { resourceRevision: dash.revision, changes, replayed: false };
  saveIdem(routeKey, idem, body, resp);
  return clone(resp);
}

// DELETE dashboards/:id/shares/:shareId with If-Match, 204 + ETag (dashboard-share.service.ts revoke).
export async function fakeRevokeShare(
  _ctx: TradeContext,
  id: string,
  shareId: string,
  revision: number,
): Promise<{ revision: number }> {
  await fakeDelay();
  ensureStore();

  const { dash } = requireDashboard(id, 'OWNER');
  if (!STORE.shares.some((s) => s.dashboardId === id && s.id === shareId)) {
    return { revision: dash.revision };
  }
  checkRevision(dash.revision, revision);
  STORE.shares = STORE.shares.filter((s) => !(s.dashboardId === id && s.id === shareId));
  dash.revision += 1;
  dash.updatedAt = nowIso();
  return { revision: dash.revision };
}

// GET dashboards/share-targets?search&limit&offset -> { items, pagination } (dashboard-share.service.ts targets).
export async function fakeListShareTargets(
  _ctx: TradeContext,
  query: ListShareTargetsQuery = {},
): Promise<ShareTargetListResponse> {
  await fakeDelay();
  ensureStore();

  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;
  const details: Record<string, string[]> = {};
  intField(details, 'limit', limit, 1, 100, true);
  intField(details, 'offset', offset, 0, Number.MAX_SAFE_INTEGER, true);
  if ((query.search?.trim().length ?? 0) > 80) {
    details['search'] = ['search must be shorter than or equal to 80 characters'];
  }
  assertDto(details);

  const needle = query.search?.trim().toLowerCase() ?? '';
  const users: ShareTarget[] = TRADE_FAKE_DB.owners
    .filter((o) => o.id !== FAKE_ME.id && (!needle || o.name.toLowerCase().includes(needle)))
    .map((o) => ({
      subjectType: 'USER' as const,
      subjectId: o.id,
      name: o.name,
      nameI18n: { en: o.name, ar: o.name },
      status: 'ACTIVE' as const,
    }));
  const teams: ShareTarget[] = FAKE_TEAMS.filter(
    (t) =>
      t.status === 'ACTIVE' &&
      (!needle || [t.name, t.nameI18n.en, t.nameI18n.ar].some((n) => n.toLowerCase().includes(needle))),
  ).map((t) => ({
    subjectType: 'TEAM' as const,
    subjectId: t.id,
    name: t.name,
    nameI18n: { ...t.nameI18n },
    status: 'ACTIVE' as const,
  }));
  // ORDER BY subjectType, name, subjectId.
  const items = [...users, ...teams]
    .sort(
      (a, b) =>
        a.subjectType.localeCompare(b.subjectType) ||
        a.name.localeCompare(b.name) ||
        a.subjectId.localeCompare(b.subjectId),
    )
    .slice(offset, offset + limit);
  return clone({
    items,
    pagination: { limit, offset, nextOffset: items.length === limit ? offset + limit : null },
  });
}

// GET widgets -> { items }, at most 500, newest first (dashboard-widget.service.ts list).
export async function fakeListWidgets(_ctx: TradeContext): Promise<WidgetListResponse> {
  await fakeDelay();
  ensureStore();

  const items: WidgetListItem[] = [...STORE.widgets.values()]
    .filter((w) => w.accessibleToMe)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
    .slice(0, DASHBOARD_LIMITS.MAX_WIDGETS_PER_OWNER)
    .map(({ accessibleToMe: _acc, ...pub }) => ({
      ...pub,
      accessLevel: pub.ownerUserId === FAKE_ME.id ? 'OWNER' : pub.accessLevel,
      isShared: pub.ownerUserId !== FAKE_ME.id,
    }));
  return clone({ items });
}

function usesDeniedMetric(widget: StoredWidget): boolean {
  const deniedKeys = new Set(FAKE_DENIED_METRICS);
  return widget.querySpec.series.some((s) => deniedKeys.has(s.metricKey));
}

const TEMPLATE_DEFAULT_FILTERS: DashboardFilters = { datePreset: 'CURRENT_MONTH', comparisonMode: 'NONE' };

function templateQuerySpec(spec: TemplateWidgetPlacementSpec): QuerySpec {
  return {
    series: [{ metricKey: spec.metricKey }],
    dimensionKey: spec.dimensionKey,
    ...(spec.grain ? { grain: spec.grain } : {}),
    ...(spec.comparison ? { comparison: spec.comparison } : {}),
  };
}
