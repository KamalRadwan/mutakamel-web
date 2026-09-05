type DashboardMetricKind = "integer" | "money" | "percent" | "ratio";
type DashboardRangeGranularity = "day" | "month";
export type DashboardMetricTone =
  | "amber"
  | "blue"
  | "cyan"
  | "green"
  | "purple"
  | "red";

export const DASHBOARD_GROUP_KEYS = [
  "tenants",
  "domains",
  "subscriptions",
  "billing",
  "payments",
  "wallets",
  "database",
  "storage",
  "provisioning",
  "catalogue",
  "notifications",
  "usage",
  "security",
  "audit",
] as const;

export type DashboardGroupKey = (typeof DASHBOARD_GROUP_KEYS)[number];

type DashboardGroupPermission =
  | "admin.reports.tenants"
  | "admin.reports.domains"
  | "admin.reports.subscriptions"
  | "admin.reports.billing"
  | "admin.reports.payments"
  | "admin.reports.wallets"
  | "admin.reports.database-server"
  | "admin.reports.storage"
  | "admin.reports.provisioning"
  | "admin.reports.catalogue"
  | "admin.reports.notifications"
  | "admin.reports.usage"
  | "admin.reports.security"
  | "admin.reports.audit";

export interface DashboardMetric {
  key: string;
  label: string;
  value: number | string;
  kind: DashboardMetricKind;
  description: string;
  tone: DashboardMetricTone;
  /**
   * A small chart drawn under the number, carrying its own label because it
   * is rarely the card's own value over time — the control plane keeps no
   * status history, so "active tenants last Tuesday" is unanswerable. It is a
   * related series that *is* recorded, and the label is what stops a reader
   * taking it for the card's history. Absent when there is nothing to draw.
   */
  trend?: DashboardMetricTrend;
}

export interface DashboardMetricTrend {
  label: string;
  kind: "line" | "bar";
  points: number[];
}

export interface DashboardGroupAlert {
  key: string;
  severity: "info" | "warning" | "critical";
  count: number;
  message: string;
}

interface DashboardAvailableGroup {
  key: DashboardGroupKey;
  permission: DashboardGroupPermission;
  available: true;
  asOf: string;
  snapshot: Record<string, unknown>;
  period: Record<string, unknown>;
  breakdowns: Record<string, unknown>;
  alerts: DashboardGroupAlert[];
  cards: DashboardMetric[];
  /** Authored by Core; absent until a provider emits it (see below). */
  visuals?: DashboardVisual[];
}

interface DashboardUnavailableGroup {
  key: DashboardGroupKey;
  permission: DashboardGroupPermission;
  available: false;
  asOf: string;
  reasonCode:
    | "SOURCE_NOT_CONFIGURED"
    | "HISTORICAL_DATA_NOT_STORED"
    | "PROJECTION_NOT_ACTIVE";
  message: string;
  alerts: DashboardGroupAlert[];
  cards: DashboardMetric[];
}

export type DashboardGroup =
  | DashboardAvailableGroup
  | DashboardUnavailableGroup;

type DashboardGroups = Partial<
  Record<DashboardGroupKey, DashboardGroup>
>;

export type DashboardUnavailableReason =
  | "HISTORICAL_DATA_NOT_STORED"
  | "SOURCE_NOT_CONFIGURED"
  | "TARGET_NOT_CONFIGURED";

interface DashboardAvailableDataset<T> {
  available: true;
  data: T;
}

interface DashboardUnavailableDataset {
  available: false;
  reasonCode: DashboardUnavailableReason;
  message: string;
}

type DashboardDataset<T> =
  | DashboardAvailableDataset<T>
  | DashboardUnavailableDataset;

interface DashboardNamedValue {
  key: string;
  label: string;
  value: number;
}

interface DashboardTimeSeriesPoint {
  bucket: string;
  label: string;
  value: number;
}

interface DashboardDualTimeSeriesPoint {
  bucket: string;
  label: string;
  primary: number;
  secondary: number;
}

interface DashboardDatabaseCapacityItem {
  id: string;
  name: string;
  metadata: string;
  status: string;
  countryName: string;
  countryIsoCode: string;
  currentTenants: number;
  maxTenants: number;
  utilization: number;
  tone: DashboardMetricTone;
}

export interface DashboardRegionItem {
  key: string;
  countryName: string;
  countryIsoCode: string;
  count: number;
  ratio: number;
  tone: DashboardMetricTone;
}

export interface DashboardResponse extends DashboardGroups {
  asOf: string;
  /** Every group this actor may see, whether or not it was loaded. */
  authorizedGroups: DashboardGroupKey[];
  /**
   * The subset actually present in this response (see `?groups=`). Absent
   * from a Core deployment that predates the parameter, which always
   * returns every authorized group.
   */
  loadedGroups?: DashboardGroupKey[];
  range: {
    from: string;
    to: string;
    label: string;
    granularity: DashboardRangeGranularity;
  };

  /**
   * Only what no single group can report. Tenant lifecycle, database health,
   * subscription status, billing summary, and domain health used to live here
   * too, restating each group's own snapshot — the overview now derives them
   * from the groups (see utils/overview-sources.ts).
   */
  overview: {
    kpis: DashboardMetric[];
    /**
     * Both of the fields below are dropped by Core when the actor lacks the
     * permission behind them — growth needs tenants *and* billing, recent
     * tenants needs tenants. Optional here because they are optional there;
     * declaring them required only moved the failure to a runtime crash.
     */
    tenantBillingGrowth?: {
      year: number;
      currencyCode: string; // current backend value: "USD"
      granularity: DashboardRangeGranularity;
      points: Array<{
        month: string; // formatted bucket label; may represent a day
        tenants: number;
        collected: number;
      }>;
    };
    recentTenants?: {
      items: Array<{
        id: string;
        name: string;
        status: string; // humanized label, not a raw TenantStatusEnum value
        plan: string; // humanized subscription status + " Plan", or "No Plan"
        createdAt: string;
      }>;
    };
  };

  analytics?: {
    subscriptions: {
      recurringRevenue: DashboardDataset<{
        currencyCode: "USD";
        monthlyRecurringRevenue: number;
        annualRecurringRevenue: number;
        byBillingCycle: DashboardNamedValue[];
      }>;
      arrTarget: DashboardDataset<{
        currencyCode: "USD";
        actual: number;
        target: number;
      }>;
      averageCollectedRevenue: DashboardDataset<{
        currencyCode: "USD";
        points: DashboardTimeSeriesPoint[];
      }>;
      paymentHealth: DashboardDataset<DashboardNamedValue[]>;
      churnAndAcquisition: DashboardDataset<{
        points: DashboardDualTimeSeriesPoint[];
      }>;
      upcomingRenewals: DashboardDataset<{
        windowDays: 90;
        points: DashboardTimeSeriesPoint[];
      }>;
      revenueFlow: DashboardUnavailableDataset;
      lifetimeValue: DashboardUnavailableDataset;
      promotionImpact: DashboardUnavailableDataset;
      cohortRetention: DashboardUnavailableDataset;
    };
    billing: {
      aging: DashboardDataset<{
        currencyCode: "USD";
        items: DashboardNamedValue[];
      }>;
      daysSalesOutstanding: DashboardDataset<{
        unit: "days";
        points: DashboardTimeSeriesPoint[];
      }>;
      cashFlow: DashboardDataset<{
        currencyCode: "USD";
        points: DashboardDualTimeSeriesPoint[];
      }>;
      revenueByPurpose: DashboardDataset<{
        currencyCode: "USD";
        items: DashboardNamedValue[];
      }>;
      paymentProviders: DashboardDataset<DashboardNamedValue[]>;
      paymentFailureReasons: DashboardDataset<DashboardNamedValue[]>;
      refunds: DashboardDataset<{
        currencyCode: "USD";
        points: DashboardTimeSeriesPoint[];
      }>;
      taxByCountry: DashboardDataset<{
        currencyCode: "USD";
        items: DashboardNamedValue[];
      }>;
      renewalForecast: DashboardDataset<{
        currencyCode: "USD";
        windowDays: 90;
        points: DashboardTimeSeriesPoint[];
      }>;
      usageOverage: DashboardUnavailableDataset;
      costBreakdown: DashboardUnavailableDataset;
      discountImpact: DashboardUnavailableDataset;
      chargebacks: DashboardUnavailableDataset;
    };
    servers: {
      nodes: DashboardAvailableDataset<DashboardDatabaseCapacityItem[]>;
      regions: DashboardAvailableDataset<DashboardRegionItem[]>;
      latency: DashboardUnavailableDataset;
      capacityHistory: DashboardUnavailableDataset;
    };
    platformHealth: DashboardUnavailableDataset;
  };
}

export interface AdminDashboardQuery {
  date?: string;
  from?: string;
  to?: string;
}

/* ------------------------------------------------------------------ *
 * Visuals contract
 *
 * `snapshot`/`period`/`breakdowns` are untyped bags, so the portal can
 * never tell what a number means or what it should be compared against.
 * `visuals[]` carries that meaning instead: each entry names the shape it
 * wants, its unit, and its reference values. Core authors these in the
 * providers (dashboard-visual.utils.ts); until every group emits them the
 * portal infers a subset client-side (visuals/infer-visuals.ts).
 * ------------------------------------------------------------------ */

export type DashboardVisualKind =
  | "donut"
  | "bar"
  | "comparison"
  | "diverging"
  | "stacked"
  | "pareto"
  | "line"
  | "area"
  | "dual-axis"
  | "gauge"
  | "bullet"
  | "funnel"
  | "waterfall"
  | "heatmap"
  | "multi-series"
  | "list"
  | "scatter";

export type DashboardVisualUnit =
  | "count"
  | "usd"
  | "ratio"
  | "seconds"
  | "bytes";

export interface DashboardVisualPoint {
  key: string;
  label: string;
  value: number;
  /** Semantic role for status data; omit so the qualitative ramp is used. */
  tone?: DashboardMetricTone;
}

export interface DashboardVisualPair {
  key: string;
  label: string;
  primary: number;
  secondary: number;
}

export interface DashboardVisualBulletRow {
  key: string;
  label: string;
  value: number;
  target?: number;
  maximum?: number;
  tone?: DashboardMetricTone;
}

/** `delta` values may be negative; `start` and `total` are absolute. */
export interface DashboardVisualWaterfallStep {
  key: string;
  label: string;
  value: number;
  role: "start" | "delta" | "total";
}

export interface DashboardVisualHeatRow {
  key: string;
  label: string;
  values: number[];
}

/** One named line or stack in a chart carrying more than two measures. */
export interface DashboardVisualSeries {
  key: string;
  label: string;
  tone?: DashboardMetricTone;
  points: DashboardVisualPoint[];
}

/**
 * A row in a list panel. `href` makes the row a link, which is how a report
 * hands an operator the record that needs their attention rather than only
 * telling them how many there are.
 */
export interface DashboardVisualListRow {
  key: string;
  label: string;
  detail?: string;
  value?: string;
  href?: string;
  tone?: DashboardMetricTone;
}

export interface DashboardVisualBand {
  upTo: number;
  tone: "green" | "amber" | "red";
}

/**
 * One mark on a two-axis plot. `size` is an optional third measure carried as
 * radius, for when the same coordinates mean different things at ten requests
 * and at ten thousand.
 */
export interface DashboardVisualScatterPoint {
  key: string;
  label: string;
  x: number;
  y: number;
  size?: number;
  tone?: DashboardMetricTone;
}

interface DashboardVisualBase {
  key: string;
  title: string;
  subtitle?: string;
  unit: DashboardVisualUnit;
  secondaryUnit?: DashboardVisualUnit;
  /** `primary` spans two grid columns. */
  emphasis?: "primary" | "secondary";
  /**
   * Keep the categories in the order Core sent instead of ranking them.
   *
   * A histogram's buckets are a scale — "today, this week, never" sorted by
   * size tells the reader nothing and costs them the axis.
   */
  ordered?: boolean;
  reference?: {
    target?: number;
    maximum?: number;
    bands?: DashboardVisualBand[];
    /**
     * What the unreached part of a gauge means. `neutral` is simply "not yet";
     * `danger` says the shortfall is itself the problem, which is what an
     * unverified domain is.
     */
    remainderTone?: "neutral" | "danger";
  };
}

interface DashboardTwoSeriesData {
  pairs: DashboardVisualPair[];
  primaryLabel: string;
  secondaryLabel: string;
}

/**
 * One entry per kind, so `Extract<DashboardVisual, { kind: K }>` narrows to a
 * single member. Extending `Record<DashboardVisualKind, unknown>` makes a
 * kind added above a compile error until its payload is defined here.
 */
interface DashboardVisualDataByKind extends Record<DashboardVisualKind, unknown> {
  donut: { categories: DashboardVisualPoint[] };
  bar: { categories: DashboardVisualPoint[] };
  pareto: { categories: DashboardVisualPoint[] };
  funnel: { categories: DashboardVisualPoint[] };
  comparison: DashboardTwoSeriesData;
  diverging: DashboardTwoSeriesData;
  stacked: DashboardTwoSeriesData;
  "dual-axis": DashboardTwoSeriesData;
  line: { series: DashboardVisualPoint[] };
  area: { series: DashboardVisualPoint[] };
  gauge: { value: number; maximum: number };
  bullet: { rows: DashboardVisualBulletRow[] };
  waterfall: { steps: DashboardVisualWaterfallStep[] };
  heatmap: { columns: string[]; rows: DashboardVisualHeatRow[] };
  "multi-series": { series: DashboardVisualSeries[] };
  list: { rows: DashboardVisualListRow[] };
  scatter: {
    points: DashboardVisualScatterPoint[];
    xLabel: string;
    yLabel: string;
  };
}

export type DashboardVisualOf<K extends DashboardVisualKind> =
  DashboardVisualBase & { kind: K; data: DashboardVisualDataByKind[K] };

export type DashboardVisual = {
  [K in DashboardVisualKind]: DashboardVisualOf<K>;
}[DashboardVisualKind];
