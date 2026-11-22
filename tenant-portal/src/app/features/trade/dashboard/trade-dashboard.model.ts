export type AccessLevel = 'OWNER' | 'EDIT' | 'VIEW';
export type ScopeCoverage = 'SINGLE_COMPANY' | 'MULTI_COMPANY_AUTHORIZED_UNION';
export type ScopeMode = 'CURRENT_CONTEXT' | 'SAVED_TARGETS' | 'SELECTED_SCOPES' | 'ALL_ACCESSIBLE';
export type DatePreset =
  | 'TODAY'
  | 'CURRENT_WEEK'
  | 'CURRENT_MONTH'
  | 'CURRENT_QUARTER'
  | 'CURRENT_YEAR'
  | 'LAST_30_DAYS'
  | 'CUSTOM';
export type PeriodComparison = 'NONE' | 'PREVIOUS_PERIOD' | 'PREVIOUS_YEAR';
export type TemplateKey =
  | 'TRADE_EXECUTIVE'
  | 'SALES_AND_QUOTES'
  | 'PURCHASING'
  | 'CATALOG_AND_AVAILABILITY'
  | 'MARGIN_AND_PRICING'
  | 'OPERATIONS_ACTION_CENTER';
export type TradeViz =
  | 'METRIC_CARD'
  | 'LINE'
  | 'AREA'
  | 'LINE_AREA'
  | 'COLUMN'
  | 'BAR'
  | 'STACKED_BAR'
  | 'PIE'
  | 'DONUT'
  | 'SCATTER'
  | 'BUBBLE'
  | 'GANTT'
  | 'FLOWCHART'
  | 'SEMI_CIRCLE_GAUGE'
  | 'THREE_QUARTER_GAUGE'
  | 'CIRCULAR_PROGRESS_GAUGE'
  | 'DETAILED_SPEEDOMETER'
  | 'TABLE'
  | 'FUNNEL'
  | 'HEATMAP';
export type DataShape = 'SCALAR' | 'TIME_SERIES' | 'CATEGORY' | 'XY' | 'INTERVAL' | 'GRAPH' | 'ROWS';
export type MetricUnit = 'COUNT' | 'MONEY' | 'PERCENT' | 'QUANTITY' | 'DURATION' | 'SCORE';
export type UnavailableReason =
  | 'WIDGET_DELETED'
  | 'WIDGET_ACCESS_REVOKED'
  | 'WIDGET_PERMISSION_REQUIRED'
  | 'METRIC_RETIRED_OR_INCOMPATIBLE';

export interface PreferenceContext {
  kind: 'COMPANY' | 'CONSOLIDATED';
  companyId?: string;
}

export interface DashboardFilters {
  datePreset?: DatePreset;
  dateFrom?: string;
  dateTo?: string;
  comparisonMode?: PeriodComparison;
  currencyCodes?: string[];
  itemIds?: string[];
  clauses?: { key: string; values: string[] }[];
} // dates YYYY-MM-DD

export interface ScopeTargetRef {
  companyId: string;
  branchIds?: string[];
} // no branchIds = whole company

export type Aggregation = 'COUNT' | 'SUM' | 'AVERAGE' | 'MIN' | 'MAX' | 'PERCENT';
export type TimeGrain = 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
export type WidgetComparisonMode = PeriodComparison | 'TARGET';

export interface FilterClause {
  key: string;
  values: string[];
}

// Backend DashboardWidgetQuerySpecDto (dto/dashboard.dto.ts:177).
export interface QuerySpec {
  series: {
    metricKey: string;
    label?: string;
    axis?: 'LEFT' | 'RIGHT';
    aggregation?: Aggregation;
  }[];
  dimensionKey?: string;
  grain?: TimeGrain;
  comparison?: {
    mode: WidgetComparisonMode;
    target?: string;
  };
  filters?: FilterClause[];
}

// Backend DashboardDisplaySpecDto (dto/dashboard.dto.ts:209) after normalizeDisplaySpec.
export interface DisplaySpec {
  title?: string;
  subtitle?: string;
  paletteToken?: string;
  color?: string;
  seriesColors?: string[];
  targetColor?: string;
  numberFormatKey?: string;
  precision?: number;
  legendPosition?: 'TOP' | 'BOTTOM' | 'START' | 'END' | 'HIDDEN';
  axisLabels?: Record<string, string>;
  targetDisplay?: boolean;
  options?: Record<string, unknown>;
}

export interface WidgetSummary {
  id: string;
  ownerUserId: string;
  ownerName: string | null;
  accessLevel: AccessLevel;
  isShared: boolean;
  name: string;
  visualizationType: TradeViz;
  querySpec: QuerySpec;
  displaySpec: DisplaySpec;
  revision: number;
}

export interface WidgetListItem extends WidgetSummary {
  definitionSchemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface Placement {
  id: string;
  widgetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sortOrder: number;
  widget: WidgetSummary;
}

export interface UnavailablePlacement {
  placementId: string;
  reasonCode: UnavailableReason;
  x: number;
  y: number;
  width: number;
  height: number;
  sortOrder: number;
}

export interface DashboardDetail {
  id: string;
  ownerUserId: string;
  ownerName: string | null;
  name: string;
  description: string | null;
  scopeCoverage: ScopeCoverage;
  scopeTargets: ScopeTargetRef[];
  defaultFilters: DashboardFilters;
  sourceTemplateKey: TemplateKey | null;
  definitionSchemaVersion: number;
  revision: number;
  accessLevel: AccessLevel;
  isShared: boolean; // ownerUserId !== viewer (dashboard-definition.service.ts detail)
  isDefault: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  placements: Placement[];
  unavailablePlacements: UnavailablePlacement[];
  responsive: {
    canonicalLayout: 'DESKTOP_12';
    derivedLayouts: string[];
  };
}

export interface NavItem {
  id: string;
  name: string;
  sourceTemplateKey: TemplateKey | null;
  isDefault: boolean;
  isFavorite: boolean;
  isShared: boolean;
  accessLevel: AccessLevel;
  ownerUserId: string;
  ownerName: string | null;
  revision: number;
  updatedAt: string;
}

export interface Navigation {
  items: NavItem[];
  activeDashboardId: string | null;
  preferenceContext: PreferenceContext;
  capabilities: {
    canEditLayout: true;
    canonicalColumns: 12;
    responsiveLayouts: string[];
  }; // canEditLayout is a constant: never use it
}

export interface DefaultResult {
  dashboard: DashboardDetail | null;
  ensureTemplate: {
    templateKey: 'TRADE_EXECUTIVE';
    preferenceContext: PreferenceContext;
  } | null;
}

// TradeDashboardWarningV1 (trade-app-common types/trade.types.ts:210).
export interface DashboardWarning {
  code: string;
  sourceOwner?: string;
  safeDetails?: Record<string, string | number | boolean>;
}

export interface PreferenceRow {
  id: string;
  dashboardId: string;
  isDefault: boolean;
  isFavorite: boolean;
  revision: number;
  replayed: boolean;
}

export interface Point {
  key: string;
  labelKey?: string;
  value: number | string | null;
  secondaryValue?: number | string;
  occurredAt?: string;
  start?: string;
  end?: string;
  size?: number | string;
  source?: string;
  target?: string;
  meta?: Record<string, string | number | boolean | null>;
}

export interface Series {
  key: string;
  unit: MetricUnit;
  currencyCode?: string;
  points: Point[];
}

export interface Partition {
  companyId: string;
  branchIds: string[];
  currencyCode?: string;
  scalar?: string | number;
  series?: Series[];
  rows?: Record<string, unknown>[];
}

export interface WidgetResult {
  widgetId: string;
  status: 'READY' | 'EMPTY' | 'LIMITED' | 'STALE' | 'UNAVAILABLE' | 'FAILED';
  shape: DataShape;
  metricVersions: Record<string, number>;
  sourceOwners: string[];
  sourceEpochs: string[];
  asOf?: string;
  completeness: 'COMPLETE' | 'LIMITED' | 'UNKNOWN';
  partitions: Partition[];
  warnings: DashboardWarning[];
  drillThrough?: {
    targetCode: string;
    relativePath: string;
    filterToken: string;
    expiresAt?: string;
  };
  errorCode?: string;
}

// Backend RuntimeCompanyScopeDto (dto/dashboard.dto.ts:501).
export interface RuntimeCompanyScope {
  companyId: string;
  branchIds?: string[];
  channelIds?: string[];
  fulfillmentNodeIds?: string[];
}

// Backend RunDashboardDto (dto/dashboard.dto.ts:536); a missing scope means CURRENT_CONTEXT.
export interface RunRequest {
  requestId: string;
  scope?: {
    scopeMode: ScopeMode;
    companyScopes?: RuntimeCompanyScope[];
  };
  filters?: DashboardFilters;
  widgetIds?: string[];
}

export interface ResolvedScopeTarget {
  companyId: string;
  coverage: 'FULL_COMPANY' | 'AUTHORIZED_SUBSET';
  branchIds: string[];
  channelIds?: string[];
  fulfillmentNodeIds?: string[];
}

export interface RunResult {
  dashboardId: string;
  dashboardRevision: number;
  catalogVersion: 1;
  generatedAt: string;
  timeZone: string;
  scope: {
    coverage: ScopeCoverage;
    mode: ScopeMode;
    targets: ResolvedScopeTarget[];
    fingerprint: string; // sha256:<hex>
    resolvedAt: string;
  };
  normalizedFilters: {
    datePreset: DatePreset;
    dateFrom: string;
    dateTo: string;
    timeZone: string;
    today: string;
    comparisonMode: PeriodComparison;
    currencyCodes: string[];
    itemIds: string[];
    clauses: FilterClause[];
    matchNone: boolean;
  };
  status: 'COMPLETE' | 'PARTIAL';
  widgets: Record<string, WidgetResult>; // available placements only, keyed by widgetId
  unavailablePlacements: UnavailablePlacement[];
  warnings: DashboardWarning[];
}

export interface Size {
  w: number;
  h: number;
}

// TradeDashboardVisualizationDescriptorV1 (trade-app-common types/trade.types.ts:136).
export interface VisualizationDescriptor {
  type: TradeViz;
  supportedShapes: DataShape[];
  minimumSeries: number;
  maximumSeries: number;
  minimumWidth: number;
  defaultWidth: number;
  maximumWidth: number;
  minimumHeight: number;
  defaultHeight: number;
  maximumHeight: number;
  requiresTarget: boolean;
  supportsDualAxis: boolean;
  supportsPeriodComparison: boolean;
  supportedOptionKeys: string[];
}

// TradeDashboardMetricDescriptorV1 (trade-app-common types/trade.types.ts:111).
export interface MetricDescriptor {
  key: string;
  version: number;
  labelKey: string;
  descriptionKey: string;
  shape: DataShape;
  unit: MetricUnit;
  supportedAggregations: Aggregation[];
  allowedDimensions: string[];
  allowedFilterKeys: string[];
  supportedVisualizations: TradeViz[];
  supportedComparisonModes: WidgetComparisonMode[];
  requiredFeatureKeys: string[];
  requiredPermissions: string[];
  requiredFieldPermissions: string[];
  allowedScopeCoverage: ScopeCoverage[];
  allowedScopeModes: ScopeMode[];
  multiCompanyAggregation: 'PARTITION_ONLY' | 'SAFE_ADDITIVE_COUNT';
  currencyBehavior: 'NOT_APPLICABLE' | 'PARTITION_BY_COMPANY_AND_CURRENCY';
  maximumRangeMonths: number;
  maximumPoints: number;
  freshness: {
    sourceOwner: string;
    maximumAgeSeconds: number;
    staleBehavior: 'RETURN_STALE' | 'RETURN_LIMITED' | 'UNAVAILABLE';
    canonicalFallbackAllowed: boolean;
  };
  drillThroughTargetCode?: string;
}

// TradeDashboardTemplateDescriptorV1 (trade-app-common types/trade.types.ts:153).
export interface TemplateDescriptor {
  key: TemplateKey;
  version: number;
  labelKey: string;
  descriptionKey: string;
  requiredFeatureKeys: string[];
  widgetDefinitionCodes: string[];
}

// TRADE_DASHBOARD_LIMITS (trade-app-common constants/limits.ts:12).
export interface DashboardLimits {
  MAX_NAME_CHARACTERS: number;
  MAX_DESCRIPTION_CHARACTERS: number;
  GRID_COLUMNS: number;
  MAX_PLACEMENTS: number;
  MAX_WIDGET_SERIES: number;
  MAX_WIDGET_POINTS: number;
  MAX_DASHBOARDS_PER_OWNER: number;
  MAX_WIDGETS_PER_OWNER: number;
  MAX_EXPLICIT_COMPANY_SCOPES: number;
  MAX_BRANCHES_PER_COMPANY: number;
  MAX_CHANNELS_OR_NODES_PER_COMPANY: number;
  MAX_FILTER_VALUES: number;
  MAX_PROVIDER_CONCURRENCY: number;
  MAX_SHARE_TARGETS: number;
  MAX_SYNC_RANGE_MONTHS: number;
  MAX_LAYOUT_Y: number;
  MAX_WIDGET_HEIGHT: number;
}

// TradeDashboardCatalogService.getCatalog (dashboards/dashboard-catalog.ts:688).
export interface Catalog {
  catalogVersion: number;
  frontendContractVersion: number;
  limits: DashboardLimits;
  filters: {
    datePresets: DatePreset[];
    periodComparisons: PeriodComparison[];
    widgetComparisons: WidgetComparisonMode[];
    timeGrains: TimeGrain[];
    scopeModes: ScopeMode[];
    scopeCoverage: ScopeCoverage[];
  };
  metrics: MetricDescriptor[];
  visualizations: VisualizationDescriptor[];
  templates: TemplateDescriptor[];
  responsive: {
    canonical: 'DESKTOP_12';
    desktopMinimumWidth: number;
    tabletColumns: number;
    mobileMaximumWidth: number;
    layoutEditing: 'DESKTOP_ONLY';
  };
  resultStatuses: WidgetResult['status'][];
  executionCache: 'REQUEST_MEMO_ONLY';
}

export function vizMinSize(v: Pick<VisualizationDescriptor, 'minimumWidth' | 'minimumHeight'>): Size {
  return { w: v.minimumWidth, h: v.minimumHeight };
}

export function vizDefaultSize(v: Pick<VisualizationDescriptor, 'defaultWidth' | 'defaultHeight'>): Size {
  return { w: v.defaultWidth, h: v.defaultHeight };
}

export function vizMaxSize(v: Pick<VisualizationDescriptor, 'maximumWidth' | 'maximumHeight'>): Size {
  return { w: v.maximumWidth, h: v.maximumHeight };
}

export interface Share {
  id: string;
  subjectType: 'USER' | 'TEAM';
  subjectId: string;
  subjectName: string;
  accessLevel: 'VIEW' | 'EDIT';
  expiresAt: string | null;
  revision: number;
  status: 'ACTIVE' | 'EXPIRED';
  createdAt: string;
  updatedAt: string;
}

// Target contract (backend fix queued): name kept, nameI18n added.
export interface ShareTarget {
  subjectType: 'USER' | 'TEAM';
  subjectId: string;
  name: string;
  nameI18n: { en: string; ar: string };
  status: 'ACTIVE';
}

export function shareTargetName(target: Pick<ShareTarget, 'name' | 'nameI18n'>, lang: string): string {
  const localized = lang.toLowerCase().startsWith('ar') ? target.nameI18n?.ar : target.nameI18n?.en;
  return localized?.trim() || target.name;
}

export interface OffsetPagination {
  limit: number;
  offset: number;
  nextOffset: number | null;
}

// GET .../dashboards/:id/shares returns { items } (dashboard-share.service.ts list).
export interface ShareListResponse {
  items: Share[];
}

// GET .../dashboards/share-targets returns { items, pagination } (dashboard-share.service.ts targets).
export interface ShareTargetListResponse {
  items: ShareTarget[];
  pagination: OffsetPagination;
}

// GET .../widgets returns { items } (dashboard-widget.service.ts list).
export interface WidgetListResponse {
  items: WidgetListItem[];
}

export interface CreateDashboardBody {
  name: string;
  description?: string;
  scopeCoverage: ScopeCoverage;
  scopeTargets: ScopeTargetRef[];
  defaultFilters?: DashboardFilters;
}
