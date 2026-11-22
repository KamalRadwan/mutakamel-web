export type Visualization =
  | 'METRIC_CARD' | 'MULTI_KPI' | 'PROGRESS_CARD' | 'TABLE' | 'LEADERBOARD' | 'SCORECARD' | 'ALERT_LIST'
  | 'ACTIVITY_FEED' | 'TIMELINE' | 'CALENDAR'                                   // the 10 DOM kinds (A2b)
  | 'LINE' | 'AREA' | 'LINE_AREA' | 'COLUMN' | 'BAR' | 'STACKED_BAR' | 'STACKED_BAR_100' | 'COMBO'
  | 'WATERFALL' | 'HISTOGRAM' | 'SCATTER' | 'BUBBLE' | 'BOX_PLOT'               // 13 cartesian echarts kinds (A1a)
  | 'PIE' | 'DONUT' | 'FUNNEL' | 'HEATMAP' | 'CALENDAR_HEATMAP' | 'TREEMAP' | 'FLOWCHART' | 'GANTT'
  | 'SEMI_CIRCLE_GAUGE' | 'THREE_QUARTER_GAUGE' | 'CIRCULAR_PROGRESS_GAUGE' | 'DETAILED_SPEEDOMETER' | 'BULLET'; // 13 (A1b)
export type DomKind = Extract<Visualization, 'METRIC_CARD' | 'MULTI_KPI' | 'PROGRESS_CARD' | 'TABLE' | 'LEADERBOARD' | 'SCORECARD' | 'ALERT_LIST' | 'ACTIVITY_FEED' | 'TIMELINE' | 'CALENDAR'>;
export type ChartKind = Exclude<Visualization, DomKind>;
export const DOM_KINDS: readonly DomKind[] = ['METRIC_CARD','MULTI_KPI','PROGRESS_CARD','TABLE','LEADERBOARD','SCORECARD','ALERT_LIST','ACTIVITY_FEED','TIMELINE','CALENDAR'];
export const isChartKind = (k: Visualization): k is ChartKind => !(DOM_KINDS as readonly string[]).includes(k);

export type ResultShape = 'SCALAR' | 'TIME_SERIES' | 'CATEGORY' | 'XY' | 'INTERVAL' | 'GRAPH' | 'ROWS' | 'HIERARCHY'
  | 'BINNED_DISTRIBUTION' | 'DURATION_DISTRIBUTION' | 'WATERFALL' | 'EVENT_STREAM';
export type SeriesUnit = 'COUNT' | 'MONEY' | 'PERCENT' | 'RATIO' | 'DURATION' | 'SCORE';
export type P2Unit = 'COUNT' | 'MONEY' | 'PERCENT' | 'DURATION' | 'SCORE';
export type ExecutionState = 'READY' | 'EMPTY' | 'UNAVAILABLE' | 'RETIRED' | 'FAILED' | 'DEADLINE_EXCEEDED';

export interface WidgetPoint { key: string; label: string; value: number | null; // null = gap, never 0
  previousValue?: number; previousKey?: string; start?: string; end?: string; previousStart?: string; previousEnd?: string;
  color?: string; meta?: Record<string, unknown>;
  secondaryValue?: number; // XY: y (value = x)
  size?: number }          // BUBBLE size
export interface WidgetSeries { key: string; label: string; state?: 'UNAVAILABLE'; warnings?: string[]; unit: SeriesUnit;
  axis: 'LEFT' | 'RIGHT'; currency?: string; points: WidgetPoint[] }
export interface Reference { key: string; label: string; kind: 'TARGET' | 'BENCHMARK' | 'THRESHOLD_MIN' | 'THRESHOLD_MAX'; value: number; unit: P2Unit; currencyCode?: string }
export interface EntityRef { type: 'LEAD' | 'OPPORTUNITY' | 'ACTIVITY' | 'TASK' | 'CUSTOMER_PROFILE' | 'CALENDAR_EVENT'; id: string; href?: string }
export interface Measure { key: string; label: string; value: number; unit: P2Unit; currencyCode?: string; references?: Reference[] }
export type P2Result =
  | { shape: 'HIERARCHY'; unit: P2Unit; currencyCode?: string; nodes: { id: string; parentId?: string; label: string; value: number; depth: number; entityRef?: EntityRef }[]; references?: Reference[] }
  | { shape: 'BINNED_DISTRIBUTION'; unit: P2Unit; currencyCode?: string; bins: { key: string; label: string; order: number; kind: 'STANDARD' | 'UNDERFLOW' | 'OVERFLOW'; lowerBound?: number; upperBound?: number; count: number }[]; totalCount: number; references?: Reference[] }
  | { shape: 'DURATION_DISTRIBUTION'; unit: 'DURATION'; whiskerMethod: 'MIN_MAX'; groups: { key: string; label: string; sampleCount: number; excludedCount: number; min: number | null; q1: number | null; median: number | null; q3: number | null; p90: number | null; max: number | null }[]; totalCount: number; excludedCount: number } // minutes
  | { shape: 'WATERFALL'; unit: P2Unit; currencyCode?: string; steps: { key: string; label: string; order: number; kind: 'START' | 'DELTA' | 'SUBTOTAL' | 'TOTAL'; value: number; cumulativeValue: number }[]; references?: Reference[] }
  | { shape: 'EVENT_STREAM'; events: { id: string; occurredAt: string; kind: string; title: string; titleAr?: string; description?: string; severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL'; entityRef: EntityRef }[]; partialAccess: boolean }
  | { shape: 'ROWS'; rowKind: 'ALERT'; rows: { id: string; severity: string; reasonCode: string; title: string; occurredAt: string; dueAt?: string; entityRef: EntityRef }[]; partialAccess: boolean }
  | { shape: 'ROWS'; rowKind: 'RANKED'; rows: { id: string; rank: number; label: string; primaryMeasure: Measure; secondaryMeasures: Measure[]; entityRef?: EntityRef }[] }
  | { shape: 'ROWS'; rowKind: 'SCORECARD'; rows: { id: string; label: string; status: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'UNKNOWN'; measures: Measure[]; entityRef?: EntityRef }[] };

export interface WidgetExecution {
  widgetId: string | 'preview'; versionNumber?: number | null; widgetRevision?: number | null;
  state: ExecutionState; shape: ResultShape;
  value?: number | null; previousValue?: number;
  comparison?: { type: 'PREVIOUS_PERIOD' | 'PREVIOUS_YEAR'; previousValue?: number; absoluteChange?: number; percentChange?: number;
    previousWindow: { from: string; to: string; fromInstant: string; toInstant: string } };
  target?: number; governedTarget?: Record<string, unknown>;
  details?: Record<string, unknown>;
  result?: P2Result; rows?: Record<string, unknown>[]; series: WidgetSeries[];
  /** Reference lines of a series-based (legacy, result-less) execution; P2 results carry them in result.references. */
  references?: Reference[];
  /** sourceKey names the source of a SOURCE_NOT_READY (or similar) code; the code itself carries no suffix. */
  error?: { code: string; sourceKey?: string };
  meta: { unit?: string; currency?: string; timeBasis?: string; effectivePeriod?: { from: string; to: string; timeZone: string };
    availability?: 'AVAILABLE' | 'APPLICATION_NOT_SUBSCRIBED' | 'APPLICATION_SUSPENDED' | 'FEATURE_NOT_INCLUDED'; otherCurrencies?: { currencyCode: string; value: number }[]; missingCurrencyCount?: number;
    breakdown?: { currencyCode: string; value: number }[]; ignoredFilters?: string[]; partialAccess?: boolean; generatedAt: string; warnings: string[] };
}
// Point conventions: TIME_SERIES/CATEGORY use value; CATEGORY null id = key 'UNSPECIFIED'; XY value=x, secondaryValue=y, size;
// INTERVAL start, end, value = duration ms; GRAPH edges as points: key 'source:target', label 'source -> target', meta {source, target}.
// Money: unit MONEY + series.currency; never summed across currencies (meta.otherCurrencies / meta.breakdown).

export interface ChartColors { series: string[]; other: string; text: string; textMuted: string; border: string; borderField: string;
  surface: string; surfaceMuted: string; neutralSoft: string; brandSoft: string; accent: string; fontUi: string;
  fillOpacity: number; linkOpacity: number }
export interface ChartContext { lang: 'ar' | 'en'; dir: 'rtl' | 'ltr'; colors: ChartColors;
  t: (key: string, params?: Record<string, unknown>) => string; // key WITHOUT the 'chart.' prefix, e.g. t('other')
  /** Optional resolver for raw reason codes (analytics.reason.*); the exact table falls back to the code. */
  reasonLabel?: (code: string) => string }
export interface ExactTable { columns: { key: string; label: string; unit?: SeriesUnit | 'TEXT' | 'DATE'; currency?: string }[];
  rows: (string | number | null)[][]; totals?: (string | number | null)[] | null }
