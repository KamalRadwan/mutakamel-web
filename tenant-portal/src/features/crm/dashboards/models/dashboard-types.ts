export const dashboardVisualizationTypes = [
  "METRIC_CARD",
  "LINE",
  "AREA",
  "LINE_AREA",
  "COLUMN",
  "BAR",
  "STACKED_BAR",
  "PIE",
  "DONUT",
  "SCATTER",
  "BUBBLE",
  "GANTT",
  "FLOWCHART",
  "SEMI_CIRCLE_GAUGE",
  "THREE_QUARTER_GAUGE",
  "CIRCULAR_PROGRESS_GAUGE",
  "DETAILED_SPEEDOMETER",
  "TABLE",
  "FUNNEL",
  "HEATMAP",
  "MULTI_KPI",
  "PROGRESS_CARD",
  "BULLET",
  "STACKED_BAR_100",
  "COMBO",
  "WATERFALL",
  "TREEMAP",
  "LEADERBOARD",
  "SCORECARD",
  "HISTOGRAM",
  "CALENDAR",
  "TIMELINE",
  "CALENDAR_HEATMAP",
  "ALERT_LIST",
  "ACTIVITY_FEED",
] as const;

export type DashboardVisualizationType = (typeof dashboardVisualizationTypes)[number];

export type DashboardAccessLevel = "OWNER" | "EDIT" | "VIEW";
export type DashboardShareSubjectType = "USER" | "TEAM";
export type DashboardDatePreset =
  | "CURRENT_MONTH"
  | "CURRENT_QUARTER"
  | "CURRENT_YEAR"
  | "LAST_30_DAYS";
export type DashboardDataShape =
  | "SCALAR"
  | "TIME_SERIES"
  | "CATEGORY"
  | "XY"
  | "INTERVAL"
  | "GRAPH"
  | "ROWS"
  | "HIERARCHY"
  | "BINNED_DISTRIBUTION"
  | "WATERFALL"
  | "EVENT_STREAM";

export type DashboardMetricUnit = "COUNT" | "MONEY" | "PERCENT" | "DURATION" | "SCORE";
export type DashboardP2RowKind = "ALERT" | "RANKED" | "SCORECARD";

export type DashboardLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DashboardLayoutConstraints = {
  minW: number;
  minH: number;
  defaultW: number;
  defaultH: number;
  maxW: number;
  maxH: number;
};

export type DashboardMetricSeries = {
  metricKey: string;
  label?: string;
  axis?: "LEFT" | "RIGHT";
  aggregation?: "COUNT" | "SUM" | "AVERAGE" | "MIN" | "MAX" | "PERCENT";
  color?: string;
};

export type DashboardQuerySpec = {
  engine?: "LEGACY_V1" | "SEMANTIC_V1";
  semanticVersion?: 1;
  source?: "leads" | "opportunities";
  semanticFilters?: Array<{
    field: "status" | "stageId" | "sourceId";
    operator: "EQ" | "IN";
    values: string[];
  }>;
  dimension?: {
    key: string;
    grain?: "DAY" | "WEEK" | "MONTH" | "QUARTER" | "YEAR";
  };
  series: DashboardMetricSeries[];
  filters?: Record<string, string | number | boolean | string[] | undefined>;
  comparison?: {
    type: "NONE" | "PREVIOUS_PERIOD" | "PREVIOUS_YEAR" | "TARGET";
    target?: number;
  };
  topN?: number;
  maxPoints?: number;
};

export type DashboardDisplaySpec = {
  title?: string;
  subtitle?: string;
  color?: string;
  targetColor?: string;
  numberFormat?: string;
  legendPosition?: string;
  options?: Record<string, unknown>;
};

export type CrmDashboardWidget = {
  id: string;
  ownerUserId?: string;
  ownerName?: string;
  name: string;
  visualizationType: DashboardVisualizationType;
  querySpec: DashboardQuerySpec;
  displaySpec: DashboardDisplaySpec;
  schemaVersion?: number;
  revision?: number;
  createdAt?: string;
  updatedAt?: string;
  accessLevel?: DashboardAccessLevel;
  isShared?: boolean;
  usage?: {
    placementCount: number;
    dashboardCount: number;
    activeShareCount?: number;
    hiddenPlacementCount?: number;
    placements?: Array<DashboardLayout & {
      placementId: string;
      dashboardId: string;
      dashboardName: string;
      dashboardRevision: number;
    }>;
  };
};

export type CrmDashboardPlacement = DashboardLayout & {
  id: string;
  dashboardId: string;
  widgetId: string;
  widget: CrmDashboardWidget;
};

export type DashboardUnavailablePlacement = DashboardLayout & {
  id: string;
  sortOrder?: number;
  reason: "WIDGET_ACCESS_REVOKED" | "WIDGET_PERMISSION_REQUIRED" | "WIDGET_DELETED";
};

export type CrmDashboardFilters = {
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  ownerUserId?: string;
  pipelineId?: string;
  currencyCode?: string;
  staleDays?: number;
  closingWindowDays?: number;
  limit?: number;
  datePreset?: DashboardDatePreset;
  compare?: "NONE" | "PREVIOUS_PERIOD" | "PREVIOUS_YEAR";
};

export type CrmDashboard = {
  id: string;
  name: string;
  description?: string;
  ownerUserId?: string;
  ownerName?: string;
  accessLevel: DashboardAccessLevel;
  isDefault?: boolean;
  isFavorite?: boolean;
  isSystemDefault?: boolean;
  isShared?: boolean;
  sourceTemplateKey?: string;
  schemaVersion?: number;
  createdAt?: string;
  updatedAt?: string;
  defaultFilters?: CrmDashboardFilters;
  revision: number;
  placements: CrmDashboardPlacement[];
  unavailablePlacements?: DashboardUnavailablePlacement[];
};

export type CrmDashboardNavigationItem = Pick<
  CrmDashboard,
  "id" | "name" | "accessLevel" | "isDefault" | "isSystemDefault" | "isShared" | "revision"
> & {
  ownerName?: string;
  isFavorite?: boolean;
  description?: string;
  ownerUserId?: string;
  updatedAt?: string;
};

export type DashboardCatalogMetric = {
  key: string;
  labelAr: string;
  labelEn: string;
  unit: DashboardMetricUnit;
  shape: DashboardDataShape;
  dimensions: string[];
  requiredResource?: "leads" | "opportunities" | "activities" | "customer_profiles";
  rowKind?: DashboardP2RowKind;
  semanticVersion?: number;
  timeModel?: "EVENT" | "COHORT" | "SNAPSHOT" | "INTERVAL" | "CUSTOM" | "UNKNOWN";
  dateField?: string;
  formulaKey?: string;
  supportedFilters?: string[];
  comparisonTypes?: Array<"NONE" | "PREVIOUS_PERIOD" | "PREVIOUS_YEAR" | "TARGET">;
  currencyPolicy?: "NOT_APPLICABLE" | "SPLIT_BY_CURRENCY" | "CUSTOM" | "UNKNOWN";
  accessResources?: Array<"leads" | "opportunities" | "activities" | "customer_profiles">;
  emptyValuePolicy?: "ZERO" | "FULL_SCORE" | "EMPTY_SERIES" | "EMPTY_GRAPH" | "EMPTY_ROWS" | "CUSTOM" | "UNKNOWN";
  supportsPeriodComparison: boolean;
};

export type DashboardCatalogVisualization = {
  key: DashboardVisualizationType;
  shapes: DashboardDataShape[];
  minW: number;
  minH: number;
  defaultW: number;
  defaultH: number;
  maxW: number;
  maxH: number;
  minSeries: number;
  maxSeries: number;
  requiresTarget?: boolean;
  supportsDualAxis?: boolean;
  supportsMixedUnits?: boolean;
  supportsReferences?: boolean;
  supportedTransforms?: Array<"PERCENT_OF_CATEGORY">;
  rowKinds?: DashboardP2RowKind[];
  supportsPeriodComparison: boolean;
};

export type DashboardSemanticQueryCatalog = {
  engine: "SEMANTIC_V1";
  semanticVersion: 1;
  sources: Array<"leads" | "opportunities">;
  metricKeys: string[];
  limits: {
    maxSeries: number;
    maxDimensions: number;
    maxFilters: number;
    maxInValues: number;
    maxDateRangeYears: number;
    maxTopN: number;
    maxPoints: number;
    maxAccessBranches: number;
    maxAccessOwnersPerBranch: number;
    maxAccessPipelines: number;
  };
};

export type DashboardCatalog = {
  metrics: DashboardCatalogMetric[];
  visualizations: DashboardCatalogVisualization[];
  semanticQuery?: DashboardSemanticQueryCatalog;
  dimensions?: Array<{ key: string; grains: string[] }>;
  templates?: Array<{
    key:
      | "CRM_DEFAULT"
      | "SALES_PIPELINE"
      | "LEAD_PERFORMANCE"
      | "KPIS_TARGETS"
      | "TRENDS_COMPARISONS"
      | "DISTRIBUTION_RELATIONSHIPS"
      | "PROCESS_OPERATIONS"
      | "ACTIVITIES_PRODUCTIVITY"
      | "CUSTOMER_INTELLIGENCE"
      | "DATA_QUALITY"
      | "ACTION_CENTER";
    nameAr: string;
    nameEn: string;
    descriptionAr?: string;
    descriptionEn?: string;
    widgetCount?: number;
    defaultFilters?: CrmDashboardFilters;
  }>;
  grid?: { columns: number; maxWidgets: number; maxPointsPerWidget: number; timeZone?: string };
};

export type DashboardDataPoint = {
  key: string;
  label: string;
  labelAr?: string;
  labelEn?: string;
  value: number;
  secondaryValue?: number;
  size?: number;
  start?: string;
  end?: string;
  color?: string;
  href?: string;
  meta?: Record<string, unknown>;
};

export type DashboardWidgetSeriesData = {
  key: string;
  label: string;
  labelAr?: string;
  labelEn?: string;
  unit?: string;
  currency?: string;
  axis?: "LEFT" | "RIGHT";
  points: DashboardDataPoint[];
};

export type DashboardP2Reference = {
  key: string;
  label: string;
  kind: "TARGET" | "BENCHMARK" | "THRESHOLD_MIN" | "THRESHOLD_MAX";
  value: number;
  unit: DashboardMetricUnit;
  currencyCode?: string;
};

export type DashboardP2EntityReference = {
  type: "LEAD" | "OPPORTUNITY" | "ACTIVITY" | "TASK" | "CUSTOMER_PROFILE" | "CALENDAR_EVENT";
  id: string;
  href?: string;
};

export type DashboardP2Measure = {
  key: string;
  label: string;
  value: number;
  unit: DashboardMetricUnit;
  currencyCode?: string;
  references?: DashboardP2Reference[];
};

export type DashboardHierarchyResult = {
  shape: "HIERARCHY";
  unit: DashboardMetricUnit;
  currencyCode?: string;
  nodes: Array<{
    id: string;
    parentId?: string;
    label: string;
    value: number;
    depth: number;
    entityRef?: DashboardP2EntityReference;
  }>;
  references?: DashboardP2Reference[];
};

export type DashboardBinnedDistributionResult = {
  shape: "BINNED_DISTRIBUTION";
  unit: DashboardMetricUnit;
  currencyCode?: string;
  bins: Array<{
    key: string;
    label: string;
    order: number;
    kind: "STANDARD" | "UNDERFLOW" | "OVERFLOW";
    lowerBound?: number;
    upperBound?: number;
    count: number;
  }>;
  totalCount: number;
  references?: DashboardP2Reference[];
};

export type DashboardWaterfallResult = {
  shape: "WATERFALL";
  unit: DashboardMetricUnit;
  currencyCode?: string;
  steps: Array<{
    key: string;
    label: string;
    order: number;
    kind: "START" | "DELTA" | "SUBTOTAL" | "TOTAL";
    value: number;
    cumulativeValue: number;
  }>;
  references?: DashboardP2Reference[];
};

export type DashboardEventStreamResult = {
  shape: "EVENT_STREAM";
  events: Array<{
    id: string;
    occurredAt: string;
    kind: string;
    title: string;
    description?: string;
    severity: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";
    entityRef: DashboardP2EntityReference;
  }>;
  partialAccess: boolean;
};

export type DashboardP2RowsResult =
  | {
      shape: "ROWS";
      rowKind: "ALERT";
      rows: Array<{
        id: string;
        severity: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";
        reasonCode: string;
        title: string;
        occurredAt: string;
        dueAt?: string;
        entityRef: DashboardP2EntityReference;
      }>;
      partialAccess: boolean;
    }
  | {
      shape: "ROWS";
      rowKind: "RANKED";
      rows: Array<{
        id: string;
        rank: number;
        label: string;
        primaryMeasure: DashboardP2Measure;
        secondaryMeasures: DashboardP2Measure[];
        entityRef?: DashboardP2EntityReference;
      }>;
    }
  | {
      shape: "ROWS";
      rowKind: "SCORECARD";
      rows: Array<{
        id: string;
        label: string;
        status: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "UNKNOWN";
        measures: DashboardP2Measure[];
        entityRef?: DashboardP2EntityReference;
      }>;
    };

export type DashboardP2Result =
  | DashboardHierarchyResult
  | DashboardBinnedDistributionResult
  | DashboardWaterfallResult
  | DashboardEventStreamResult
  | DashboardP2RowsResult;

export type DashboardWidgetResult = {
  widgetId: string;
  shape: DashboardDataShape;
  value?: number;
  previousValue?: number;
  target?: number;
  details?: Record<string, unknown>;
  rows?: Array<Record<string, unknown>>;
  result?: DashboardP2Result;
  series: DashboardWidgetSeriesData[];
  meta?: {
    unit?: string;
    currency?: string;
    generatedAt?: string;
    warnings?: string[];
  };
  error?: {
    code?: string;
    message: string;
  };
};

export type DashboardRunResult = {
  dashboardId: string;
  revision?: number;
  generatedAt: string;
  filters?: CrmDashboardFilters;
  scope?: Array<{ branchId: string; scope: string }>;
  comparisonCompatibility?: {
    requestedTypes: Array<"PREVIOUS_PERIOD" | "PREVIOUS_YEAR">;
    appliedWidgetIds: string[];
    partiallyAppliedWidgetIds: string[];
    skippedWidgetIds: string[];
  };
  widgets: Record<string, DashboardWidgetResult>;
  unavailablePlacements?: DashboardUnavailablePlacement[];
};

export type DashboardPointSelection = {
  pointKey: string;
  seriesKey?: string;
};

export type DashboardDrilldownRequest = DashboardPointSelection & {
  cursor?: string;
  limit?: number;
  expectedWidgetRevision?: number;
  filters?: CrmDashboardFilters;
};

export type DashboardDrilldownRecord = Partial<{
  id: string;
  entityType: string;
  title: string;
  status: string;
  stageName: string;
  ownerName: string;
  branchName: string;
  pipelineName: string;
  sourceName: string;
  activityType: string;
  reason: string;
  amount: number;
  currencyCode: string;
  rank: number;
  value: number;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  dueAt: string;
  closedAt: string;
  convertedAt: string;
}>;

export type DashboardDrilldownResult = {
  dashboardId: string;
  widgetId: string;
  placementId: string;
  widgetRevision: number;
  selection: DashboardPointSelection;
  records: DashboardDrilldownRecord[];
  pageInfo: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
};

export type CreateDashboardInput = {
  name: string;
  description?: string;
  defaultFilters?: CrmDashboardFilters;
  templateKey?:
    | "CRM_DEFAULT"
    | "SALES_PIPELINE"
    | "LEAD_PERFORMANCE"
    | "KPIS_TARGETS"
    | "TRENDS_COMPARISONS"
    | "DISTRIBUTION_RELATIONSHIPS"
    | "PROCESS_OPERATIONS"
    | "ACTIVITIES_PRODUCTIVITY"
    | "CUSTOMER_INTELLIGENCE"
    | "DATA_QUALITY"
    | "ACTION_CENTER";
};

export type CreateWidgetInput = {
  name: string;
  visualizationType: DashboardVisualizationType;
  querySpec: DashboardQuerySpec;
  displaySpec: DashboardDisplaySpec;
};

export type UpdateWidgetResult = CrmDashboardWidget & {
  dashboardRevisions?: Record<string, number>;
  layoutAdjustments?: Array<DashboardLayout & { placementId: string; dashboardId: string }>;
};

export type PreviewWidgetInput = CreateWidgetInput & {
  /** Runtime filters used only for this viewer-scoped preview. */
  filters?: CrmDashboardFilters;
};

export type ShareDashboardInput = {
  subjectType: DashboardShareSubjectType;
  subjectIds: string[];
  accessLevel: Exclude<DashboardAccessLevel, "OWNER">;
  expiresAt?: string;
};

export type DashboardShareTarget = {
  id: string;
  type: DashboardShareSubjectType;
  name: string;
  email?: string;
  branchNames?: string[];
};

export type DashboardResourceShare = {
  id: string;
  subjectType: DashboardShareSubjectType;
  subjectId: string;
  accessLevel: Exclude<DashboardAccessLevel, "OWNER">;
  effectiveAccessLevel?: Exclude<DashboardAccessLevel, "OWNER">;
  effectiveAccessSource?: string;
  subjectName?: string;
  subjectEmail?: string;
  context?: string;
  sharedByUserId?: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
};
