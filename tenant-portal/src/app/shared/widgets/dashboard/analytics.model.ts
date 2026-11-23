export type {
  ChartColors,
  ChartContext,
  ChartKind,
  DomKind,
  EntityRef,
  ExactTable,
  ExecutionState,
  Measure,
  P2Result,
  P2Unit,
  Reference,
  ResultShape,
  SeriesUnit,
  Visualization,
  WidgetPoint,
  WidgetSeries,
} from '../../ui/chart/chart.model';
export { DOM_KINDS, isChartKind } from '../../ui/chart/chart.model';
import type {
  ResultShape,
  SeriesUnit,
  Visualization,
  WidgetExecution as ChartWidgetExecution,
} from '../../ui/chart/chart.model';

/** Backend 'OTHER' key: the folded Top-N tail. The point carries meta.foldedBucketCount. */
export const OTHER_BUCKET_KEY = 'OTHER';

export type PanelAvailability = NonNullable<ChartWidgetExecution['meta']['availability']>;

/** Run budget from POST dashboards/:id/run. deadlineExceeded means some widgets were clipped. */
export interface RunBudget {
  deadlineMs: number;
  elapsedMs: number;
  statementCount: number;
  deadlineExceeded: boolean;
}

/**
 * Governed target evidence on a widget execution; mirrors the backend GovernedTargetWidgetEvidence
 * (crm-app dashboards/dto/won-target-attainment.dto.ts). Every amount, percent, pace and gap is a decimal string:
 * never compare them as numbers in the client.
 */
export type GovernedTargetState =
  | 'READY'
  | 'SOURCE_PERMISSION_REQUIRED'
  | 'HISTORY_INCOMPLETE'
  | 'MONEY_DATA_INCOMPLETE'
  | 'TEAM_HISTORY_UNAVAILABLE'
  | 'PERIOD_NOT_STARTED'
  | 'TARGET_UNAVAILABLE'
  | 'FILTER_MISMATCH'
  | 'PERIOD_MISMATCH'
  | 'TARGET_NOT_SET'
  | 'SOURCE_NOT_READY';

export interface GovernedTargetAmounts {
  targetValue: string;
  actualValue: string | null;
  attainmentPercent: string | null;
  remainingValue: string | null;
  excludedCount: number | null;
}

export interface GovernedTargetWorkingPace {
  state: 'READY' | 'CALENDAR_UNAVAILABLE' | 'ACTUAL_UNAVAILABLE' | 'NO_REMAINING_WORKDAYS' | 'PERIOD_CLOSED' | 'PERIOD_NOT_STARTED';
  calendarRevision: number | null;
  remainingWorkdays: number | null;
  requiredPerWorkday: string | null;
}

export interface GovernedTargetElapsedPace {
  /** Rates are NOT_PRORATED; no working calendar means UNAVAILABLE with a calendar reason. */
  state: 'READY' | 'UNAVAILABLE' | 'NOT_PRORATED';
  reason: 'CALENDAR_HOURS_MISSING' | 'CALENDAR_UNAVAILABLE' | null;
  workingDays: number | null;
  elapsedWorkingDays: number | null;
}

/** One tenant-local day of the trajectory measure (backend WonTargetTrajectoryPoint). */
export interface GovernedTargetTrajectoryPoint {
  date: string;
  wonValue: string | null;
  observedCumulative: string | null;
  plannedCumulative: string | null;
  isPlannedWorkday: boolean;
}

export interface GovernedTargetResult {
  state: GovernedTargetState;
  basis: 'RECORDED_WON_EVENT' | 'RECORDED_EVENT';
  measure: 'ATTAINMENT' | 'DAILY_PACE' | 'TRAJECTORY';
  currencyCode: string;
  periodStart: string | null;
  periodEndExclusive: string | null;
  periodState: 'OPEN' | 'CLOSED' | 'FUTURE' | null;
  coverageStartedAt: string | null;
  revision: number | null;
  amounts: GovernedTargetAmounts | null;
  workingPace: GovernedTargetWorkingPace | null;
  /** Trajectory measure only; null when the recorded actual is unavailable. */
  trajectory?: { timeZone: string; points: GovernedTargetTrajectoryPoint[] } | null;
  targetMeasure?: 'MONEY' | 'COUNT' | 'RATE';
  grain?: 'MONTH' | 'QUARTER' | 'YEAR';
  subjectResolution?: 'ROW' | 'TEAM_MEMBER_SUM' | null;
  targetCount?: number;
  pace?: string | null;
  paceAttainmentPercent?: string | null;
  elapsedPace?: GovernedTargetElapsedPace | null;
  /** RATE targets: actual minus target in percentage points. */
  gapPercentagePoints?: string | null;
}

export interface ManualReference {
  kind: 'MANUAL';
  seriesIndex: number;
  unit: SeriesUnit;
  value: number;
  label: string;
}

export interface WidgetExecution extends Omit<ChartWidgetExecution, 'meta'> {
  meta: ChartWidgetExecution['meta'] & {
    references?: ManualReference[];
  };
}

export type FilterOperator =
  | 'EQ'
  | 'NEQ'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'IN'
  | 'NOT_IN'
  | 'BETWEEN'
  | 'IS_EMPTY'
  | 'IS_NOT_EMPTY'
  | 'CONTAINS';

export interface FilterLeaf {
  field: string;
  operator: FilterOperator;
  value?: string | number | boolean | (string | number)[] | null;
}

export interface FilterGroup {
  kind: 'AND' | 'OR';
  children: (FilterGroup | FilterLeaf)[];
}

export interface CrossFilter {
  placementId: string;
  field: string;
  values: string[];
}

export interface CalculationDetails {
  operation: 'RATIO' | 'DIFFERENCE';
  operandMetricKey: string;
  numerator: number | null;
  denominator: number | null;
  value: number | null;
}

export interface DatasetComparisonDetails {
  basis: 'TEAM';
  teamBasis: 'AT_CONVERSION';
  unionCount: number;
  overlapCount: number;
  entries: {
    key: string;
    label: string;
    state: 'READY' | 'UNAVAILABLE';
    total: number | null;
  }[];
}

export type SharePreviewResource = 'leads' | 'opportunities' | 'activities' | 'customer_profiles' | 'targets';
export type SharePreviewScope = 'own' | 'team' | 'branch' | 'all';

export interface SharePreview {
  subjectType: 'USER' | 'TEAM';
  subjectId: string;
  state: 'READY' | 'EMPTY';
  skippedMetrics?: { metricKey: string; state: 'RETIRED' | 'UNAVAILABLE'; reasonCode: string }[];
  evaluation: 'CURRENT_USER_ACCESS' | 'COMMON_TEAM_ACCESS';
  definitionAccessLevel: 'NONE' | 'VIEW' | 'EDIT' | 'OWNER';
  sources: {
    resource: SharePreviewResource;
    granted: boolean;
    scope: SharePreviewScope | null;
    variesByMember: boolean;
  }[];
}

export type PanelState = 'READY' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE' | 'DENIED' | 'ERROR' | 'TIMEOUT' | 'RETIRED';

export interface PanelCoverage {
  trackingSince: string | null;
  tiers: Partial<Record<'VERIFIED' | 'DERIVED' | 'UNVERIFIED' | 'BEFORE_TRACKING' | 'HISTORY_INCOMPLETE', number>>;
  note?: { en: string; ar: string };
  noteKey?: string;
}

export interface PanelOutcome {
  panelKey: string;
  metricKeys: string[];
  state: PanelState;
  shape: ResultShape | null;
  result?: unknown;
  scalars?: unknown;
  unavailable?: { reasonCode: string; sourceKey?: string; message?: { en: string; ar: string } };
  coverage?: PanelCoverage;
  warnings?: string[];
  experimental?: boolean;
  receiptId?: string;
  cached: boolean;
  computedAt: string;
  durationMs: number;
}

export type DatePreset =
  | 'TODAY'
  | 'CURRENT_WEEK'
  | 'CURRENT_MONTH'
  | 'CURRENT_QUARTER'
  | 'CURRENT_YEAR'
  | 'LAST_MONTH'
  | 'LAST_3_COMPLETE_MONTHS'
  | 'LAST_QUARTER'
  | 'LAST_YEAR'
  | 'YESTERDAY'
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'LAST_90_DAYS'
  | 'CUSTOM';

export interface DashboardFilters {
  datePreset?: DatePreset;
  compare?: 'NONE' | 'PREVIOUS_PERIOD' | 'PREVIOUS_YEAR';
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  ownerUserId?: string;
  pipelineId?: string;
  currencyCode?: string;
  staleDays?: number;
  closingWindowDays?: number;
  limit?: number;
}

export interface RuntimeFilters extends DashboardFilters {
  companyId?: string;
  companyIds?: string[];
  branchIds?: string[];
  teamIds?: string[];
  ownerUserIds?: string[];
}

export interface UnavailablePlacement {
  id: string;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
  reason:
    | 'WIDGET_ACCESS_REVOKED'
    | 'WIDGET_PERMISSION_REQUIRED'
    | 'WIDGET_DELETED'
    | 'WIDGET_ARCHIVED'
    | 'WIDGET_NOT_PUBLISHED'
    | 'WIDGET_VERSION_UNAVAILABLE';
}

/**
 * Run organization scope (crm-app engine/dashboard-organization-scope.ts). `companies`/`branches` are the
 * filter options the viewer can read (ACTIVE branches, company then branch order, at most 500).
 * `companyIds`/`branchIds` echo the request only when it sent them (sorted, distinct).
 */
export interface DashboardOrganizationScope {
  companyId: string | null;
  branchId: string | null;
  companyIds?: string[];
  branchIds?: string[];
  companies: { id: string; name: string }[];
  branches: { id: string; name: string; companyId: string; companyName: string }[];
  /** The viewer reads fewer branches than the dashboard covers. */
  partialAccess: boolean;
}

export interface DashboardRun {
  dashboardId: string;
  revision: number;
  filters: RuntimeFilters;
  generatedAt: string;
  scope: { branchId: string; scope: string }[];
  populationScope?: {
    state: 'READY' | 'SOURCE_NOT_READY' | 'TOO_BROAD';
    teamIds: string[];
    ownerUserIds: string[];
    teams: { id: string; name: string; branchIds: string[] }[];
    owners: { id: string; name: string; branchIds: string[] }[];
  };
  organizationScope: DashboardOrganizationScope;
  widgets: Record<string, WidgetExecution>;
  unavailablePlacements: UnavailablePlacement[];
  comparisonCompatibility?: {
    requestedTypes: ('PREVIOUS_PERIOD' | 'PREVIOUS_YEAR')[];
    appliedWidgetIds: string[];
    partiallyAppliedWidgetIds: string[];
    skippedWidgetIds: string[];
  };
  panels: PanelOutcome[];
  receipts: { runId: string; receiptIds: string[] };
  budget?: RunBudget;
}

export interface FilterDescriptor {
  key: string;
  kind: 'PERIOD' | 'COMPARISON' | 'COMPANY' | 'BRANCH' | 'TEAM' | 'OWNER' | 'PIPELINE' | 'SOURCE' | 'CURRENCY' | 'ENUM' | 'NUMBER';
  label: { en: string; ar: string };
  required?: boolean;
  multiple?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  defaultValue?: unknown;
}

export interface PanelTable {
  columns: { key: string; label: { en: string; ar: string }; unit?: SeriesUnit | 'TEXT' | 'DATE'; reconciles?: boolean }[];
  rows: unknown[][];
  totals?: unknown[];
  reconciles: boolean;
  reconcileDelta?: Record<string, number>;
  pageInfo?: { limit: number; hasMore: boolean; nextCursor: string | null };
}

export interface Panel {
  panelKey: string;
  title: { en: string; ar: string };
  visualization: Visualization;
  metricKeys: string[];
  state: PanelState;
  unavailable?: { reasonCode: string; sourceKey?: string; message?: { en: string; ar: string } };
  coverage?: PanelCoverage;
  result?: WidgetExecution;
  table?: PanelTable;
  drill?: { kind: 'RECORDS' | 'NONE'; recordType?: 'LEAD' | 'OPPORTUNITY' | 'ACTIVITY' | 'CUSTOMER' | 'DOCUMENT' };
  pageable?: boolean;
  pinnable?: boolean;
  experimental?: boolean;
  receiptId?: string;
  cached: boolean;
  computedAt: string;
  durationMs: number;
  layout?: Record<string, { x: number; y: number; w: number; h: number }>;
}

export type ReportDomain =
  | 'acquisition'
  | 'lead-conversion'
  | 'lead-lifecycle'
  | 'response-sla'
  | 'pipeline'
  | 'forecast-targets'
  | 'activities'
  | 'team-performance'
  | 'customers'
  | 'commercial'
  | 'email'
  | 'data-governance';

export interface PanelManifest {
  manifestVersion: 2;
  report?: {
    reportKey: string;
    domain: ReportDomain;
    code: string | null;
    title: { en: string; ar: string };
    summary?: { en: string; ar: string };
    methodCard: { en: string; ar: string };
    blueprintRevision: number;
  };
  dashboard?: { dashboardId: string; revision: number; kind: 'DASHBOARD' | 'REPORT' };
  scope: {
    basis: 'CURRENT' | 'AS_OF';
    asOf: string;
    timeZone: string;
    branchIds: string[] | 'ALL';
    ownerMode: 'ALL' | 'TEAM' | 'OWN';
    fingerprint: string;
  };
  period: { kind: string; from: string; to: string; comparison?: { kind: string; from: string; to: string } };
  filters: { applied: { key: string; value: unknown }[]; schema: FilterDescriptor[] };
  panels: Panel[];
  receipts: { runId: string; receiptIds: string[] };
  freshness: { dataAsOf: string | null; oldestSourceAsOf: string | null; stale: boolean };
}

export interface CatalogVisualization {
  key: Visualization;
  shapes: ResultShape[];
  minSeries: number;
  maxSeries: number;
  supportsDualAxis: boolean;
  supportsMixedUnits: boolean;
  supportsReferences: boolean;
  supportedTransforms: string[];
  requiresTarget: boolean;
  supportsPeriodComparison: boolean;
  minSize: { w: number; h: number };
  defaultSize: { w: number; h: number };
  maxSize?: { w: number; h: number };
}

export interface CatalogMetric {
  key: string;
  availability: 'AVAILABLE' | 'RETIRED' | 'UNAVAILABLE';
  /** Derived from the result shape; a reportOnly metric is never offered in the builder. */
  reportOnly?: boolean;
  labelAr: string;
  labelEn: string;
  unit: SeriesUnit;
  shape: ResultShape;
  dimensions: string[];
  visualizations?: Visualization[];
  requiredComparison?: 'GOVERNED_TARGET';
  requiredGrain?: 'DAY';
  requiredResource?: 'leads' | 'opportunities' | 'activities' | 'customer_profiles';
  rowKind?: 'ALERT' | 'RANKED' | 'SCORECARD';
  supportsPeriodComparison: boolean;
  timeModel: 'EVENT' | 'COHORT' | 'SNAPSHOT' | 'INTERVAL' | 'CUSTOM' | 'UNKNOWN';
  dateField: string;
  formulaKey: string;
  supportedFilters: string[];
  comparisonTypes: ('NONE' | 'PREVIOUS_PERIOD' | 'PREVIOUS_YEAR' | 'TARGET' | 'DATASETS' | 'GOVERNED_TARGET')[];
  currencyPolicy: 'NOT_APPLICABLE' | 'SPLIT_BY_CURRENCY' | 'CUSTOM' | 'UNKNOWN';
  accessResources: ('leads' | 'opportunities' | 'activities' | 'customer_profiles' | 'targets')[];
  emptyValuePolicy: string;
  readiness: {
    basis: 'CURRENT' | 'EVENT' | 'SNAPSHOT' | 'FACT';
    sources: { sourceKey: string; mode: 'REQUIRED' | 'OPTIONAL' }[];
  };
  drilldown?: { dimensionKey: string; requiresCurrency: boolean };
  datasetComparison?: { bases: ('PERIOD' | 'BRANCH' | 'COMPANY' | 'TEAM')[] };
  unavailableReason?: string;
}

export interface Grouping {
  key: string;
  grain?: 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
  topN?: number;
  groupRest?: boolean;
  exclusive?: boolean;
}

export interface QuerySpec {
  engine?: 'LEGACY_V1';
  series: {
    metricKey: string;
    axis?: 'LEFT' | 'RIGHT';
    label?: string;
    color?: string;
    calculation?: { operation: 'RATIO' | 'DIFFERENCE'; operandMetricKey: string };
  }[];
  dimension?: Grouping;
  breakdown?: Grouping & { limit?: number };
  filters?: DashboardFilters;
  filterTree?: FilterGroup;
  comparison?: {
    type: 'NONE' | 'PREVIOUS_PERIOD' | 'PREVIOUS_YEAR' | 'TARGET' | 'DATASETS' | 'GOVERNED_TARGET';
    target?: number;
    basis?: 'PERIOD' | 'BRANCH' | 'COMPANY' | 'TEAM';
    datasets?: {
      datePreset?: DatePreset;
      dateFrom?: string;
      dateTo?: string;
      branchId?: string;
      companyId?: string;
      teamId?: string;
      label?: string;
    }[];
    governedTarget?: {
      branchId: string;
      subjectType: 'USER' | 'TEAM' | 'BRANCH';
      subjectId: string;
      currencyCode: string;
      periodGrain: 'MONTH' | 'QUARTER' | 'YEAR';
    };
  };
  scopeBinding?:
    | { kind: 'VIEWER_RELATIVE' }
    | {
        kind: 'FIXED_REQUESTED';
        ceiling: { companyIds?: string[]; branchIds?: string[]; teamIds?: string[]; ownerUserIds?: string[] };
      };
}

export interface DisplaySpec {
  title?: string;
  subtitle?: string;
  color?: string;
  targetColor?: string;
  numberFormat?: 'auto' | 'full' | 'duration-auto' | 'duration-minutes' | 'duration-hours' | 'duration-days';
  legendPosition?: 'top' | 'bottom' | 'start' | 'end' | 'none';
  references?: { seriesIndex: number; unit: SeriesUnit; value: number; label: string }[];
  options?: Record<string, unknown>;
}

export interface Catalog {
  grid: { columns: 48; rowHeightPx: 8; maxWidgets: 20; maxPointsPerWidget: 1000; timeZone: string };
  visualizations: CatalogVisualization[];
  metrics: CatalogMetric[];
  dimensions: {
    key: string;
    grains: ('DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR')[];
    /** NATURAL = enum or bounded dimension: Top-N / group-rest is refused (422 CRM_WIDGET_DIMENSION_INVALID). */
    cardinality?: 'NATURAL' | 'OPEN';
    labelAr?: string;
    labelEn?: string;
  }[];
  widgetRecipes: {
    key: string;
    family: string;
    nameAr: string;
    nameEn: string;
    descriptionAr: string;
    descriptionEn: string;
    visualizationType: Visualization;
    querySpec: QuerySpec;
    displaySpec: DisplaySpec;
    sourceResources: string[];
  }[];
  templates: { key: string; nameAr: string; nameEn: string; descriptionAr: string; descriptionEn: string; widgetCount: number }[];
}

export interface SourceReadiness {
  sourceKey: string;
  sourceFamily: string;
  ownerModule: string;
  status: 'READY' | 'EXPERIMENTAL' | 'NOT_READY' | 'SETUP_INCOMPLETE' | 'DISCONNECTED' | 'DEFERRED';
  reasonCode: string | null;
  uiState: 'AVAILABLE' | 'EXPERIMENTAL' | 'SETUP_INCOMPLETE' | 'NOT_CONNECTED';
  lagSeconds: number | null;
  freshnessSloSeconds: number | null;
  stale: boolean;
  watermarkAt: string | null;
  coverageStartedAt: string | null;
  backfillFloorAt: string | null;
  lastCheckedAt: string | null;
  statusChangedAt: string;
  revision: number;
  affectedReportCount: number;
}

export interface Receipt {
  id: string;
  runId: string | null;
  executionKind: string;
  metricKey: string;
  reportKey: string | null;
  panelKey: string | null;
  dashboardId: string | null;
  widgetId: string | null;
  executedAt: string;
  asOf: string;
  period: { from: string; to: string } | null;
  filters: Record<string, unknown>;
  resultStatus: 'OK' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE' | 'DENIED' | 'DEADLINE_EXCEEDED' | 'ERROR';
  unavailableReasonCode: string | null;
  coverage: { coverageStartedAt: string | null; historyIncomplete: boolean };
  result: {
    value: string | null;
    numerator: string | null;
    denominator: string | null;
    unit: string | null;
    currencyCode: string | null;
    rowCount: number | null;
  };
  /** True when the evidence passed 12 KB and was cut. */
  evidenceTruncated?: true;
  durationMs: number;
  // Optional during the transition: still-fake producers do not carry server evidence metadata.
  widgetVersionNumber?: number | null;
  scopeFingerprint?: string;
  permissionRevision?: string;
  queryHash?: string;
  sourceWatermarks?: Record<string, {
    epoch: number | null;
    settledTxid: string | null;
    visibleTxid: string | null;
    aboveCount: number | null;
    asOf: string | null;
  }>;
  config?: {
    targetReleases?: { targetId: string; releaseId: string; releaseNumber: number }[];
    slaPolicyIds?: string[];
    calendarRevisions?: { branchId: string; year: number; revision: number }[];
  };
  isolationLevel?: 'REPEATABLE_READ' | 'READ_COMMITTED';
  engineRelease?: string;
  cached?: false;
}

export interface Operand {
  value: string | null;
  labelKey: string | null;
  drillRef: string | null;
}

export interface Explain {
  receiptId: string;
  definition: {
    metricKey: string;
    formulaKey: string;
    version: number;
    unit: string;
    timeModel: string;
    dateField: string;
    currencyPolicy: string;
    emptyValuePolicy: string;
    basis: 'CURRENT' | 'EVENT' | 'SNAPSHOT' | 'FACT';
    sources: { sourceKey: string; mode: 'REQUIRED' | 'OPTIONAL' }[];
  };
  filters: Record<string, unknown>;
  scope: { fingerprint: string; period: { from: string; to: string } | null; asOf: string };
  coverage: Receipt['coverage'];
  evidenceTruncated?: true;
  numerator: Operand | null;
  denominator: Operand | null;
  value: Operand;
  sensitivity?: { label: string; value: string }[];
  decomposition?: { driver: string; delta: string; contribution: string }[];
  compareTo?: { receiptId: string; value: string | null };
}

export interface Share {
  id: string;
  subjectType: 'USER' | 'TEAM';
  subjectId: string;
  accessLevel: 'VIEW' | 'EDIT';
  sharedByUserId: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShareListItem extends Share {
  effectiveAccessLevel: 'VIEW' | 'EDIT';
  subjectName: string | null;
  subjectEmail: string | null;
  context: string;
  effectiveAccessSource: 'Direct grant';
}

/** GET dashboards|widgets/share-targets row: a USER carries `email`, a TEAM carries `code` (the other key is absent). */
export interface ShareTarget {
  id: string;
  type: 'USER' | 'TEAM';
  name: string;
  email?: string;
  code?: string;
  branchId: string;
}

export interface MetricStatsQuery {
  from: string;
  to: string;
  metricKey?: string;
  cursor?: string | null;
  limit?: number;
}

export interface MetricStat {
  statDate: string;
  metricKey: string;
  executionKind: 'DASHBOARD_RUN' | 'WIDGET_PREVIEW' | 'REPORT_RUN' | 'ALERT_EVALUATION' | 'SUBSCRIPTION' | 'EXPORT' | 'EXPLAIN';
  executions: number;
  cacheHits: number;
  p50Ms: number | null;
  p95Ms: number | null;
  maxMs: number;
  timeouts: number;
  errors: number;
  denied: number;
}

/** Approved target list row; amounts remain decimal strings. */
export interface GovernedTargetOption {
  id: string;
  branchId: string | null;
  subjectType: 'USER' | 'TEAM' | 'BRANCH' | 'TEAM_SET';
  subjectId: string | null;
  metricKey: string;
  currencyCode: string | null;
  periodGrain: 'MONTH' | 'QUARTER' | 'YEAR';
  periodStart: string;
  targetValue: string;
  revision: number;
  approvalState: 'APPROVED';
}

export interface OrgBranch {
  id: string;
  name: { en: string; ar: string };
  companyId: string;
}

export interface OrgTeam {
  id: string;
  name: { en: string; ar: string };
  branchId: string;
}

export interface OrgUser {
  id: string;
  name: string;
  nameAr: string;
  email: string;
  teamId: string;
  branchId: string;
}

export interface OwnerOption {
  id: string;
  name: string | null;
}

export interface PipelineOption {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
}
