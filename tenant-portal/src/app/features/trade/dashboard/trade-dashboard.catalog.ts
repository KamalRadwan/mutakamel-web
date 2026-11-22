import type {
  Aggregation,
  Catalog,
  DashboardLimits,
  DataShape,
  MetricDescriptor,
  MetricUnit,
  QuerySpec,
  ScopeCoverage,
  ScopeMode,
  TemplateDescriptor,
  TemplateKey,
  TradeViz,
  VisualizationDescriptor,
  WidgetComparisonMode,
} from './trade-dashboard.model';

// Mirrors backend trade-app/src/modules/dashboards/dashboard-catalog.ts (catalog version 1).

export interface TemplateWidgetPlacementSpec {
  code: string;
  metricKey: string;
  visualizationType: TradeViz;
  nameEn: string;
  nameAr: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sortOrder: number;
  dimensionKey: string;
  grain?: QuerySpec['grain'];
  comparison?: QuerySpec['comparison'];
  requiresFeatureKey?: string;
}

export interface TemplateLayoutSpec {
  key: TemplateKey;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  requiredFeatureKeys: string[];
  widgets: TemplateWidgetPlacementSpec[];
}

// TRADE_DASHBOARD_LIMITS (trade-app-common constants/limits.ts:12).
export const DASHBOARD_LIMITS: DashboardLimits = {
  MAX_NAME_CHARACTERS: 120,
  MAX_DESCRIPTION_CHARACTERS: 500,
  GRID_COLUMNS: 12,
  MAX_PLACEMENTS: 20,
  MAX_WIDGET_SERIES: 4,
  MAX_WIDGET_POINTS: 1_000,
  MAX_DASHBOARDS_PER_OWNER: 100,
  MAX_WIDGETS_PER_OWNER: 500,
  MAX_EXPLICIT_COMPANY_SCOPES: 25,
  MAX_BRANCHES_PER_COMPANY: 250,
  MAX_CHANNELS_OR_NODES_PER_COMPANY: 100,
  MAX_FILTER_VALUES: 200,
  MAX_PROVIDER_CONCURRENCY: 6,
  MAX_SHARE_TARGETS: 100,
  MAX_SYNC_RANGE_MONTHS: 24,
  MAX_LAYOUT_Y: 10_000,
  MAX_WIDGET_HEIGHT: 24,
};

export const SHAPE_VISUALIZATIONS: Record<DataShape, readonly TradeViz[]> = {
  SCALAR: [
    'METRIC_CARD',
    'SEMI_CIRCLE_GAUGE',
    'THREE_QUARTER_GAUGE',
    'CIRCULAR_PROGRESS_GAUGE',
    'DETAILED_SPEEDOMETER',
    'TABLE',
  ],
  TIME_SERIES: ['LINE', 'AREA', 'LINE_AREA', 'COLUMN', 'STACKED_BAR', 'TABLE', 'HEATMAP'],
  CATEGORY: ['LINE', 'COLUMN', 'BAR', 'STACKED_BAR', 'PIE', 'DONUT', 'TABLE', 'FUNNEL', 'HEATMAP'],
  XY: ['SCATTER', 'BUBBLE', 'TABLE'],
  INTERVAL: ['GANTT', 'TABLE'],
  GRAPH: ['FLOWCHART', 'TABLE'],
  ROWS: ['TABLE'],
};

type VizOptions = Partial<
  Pick<
    VisualizationDescriptor,
    | 'minimumSeries'
    | 'maximumSeries'
    | 'requiresTarget'
    | 'supportsDualAxis'
    | 'supportsPeriodComparison'
    | 'supportedOptionKeys'
  >
>;

// Same argument order as the backend visualization() helper (dashboard-catalog.ts:182).
function visualization(
  type: TradeViz,
  supportedShapes: DataShape[],
  minimumWidth: number,
  minimumHeight: number,
  defaultWidth: number,
  defaultHeight: number,
  maximumWidth: number,
  maximumHeight: number,
  options: VizOptions = {},
): VisualizationDescriptor {
  return {
    type,
    supportedShapes,
    minimumSeries: options.minimumSeries ?? 1,
    maximumSeries: options.maximumSeries ?? 4,
    minimumWidth,
    minimumHeight,
    defaultWidth,
    defaultHeight,
    maximumWidth,
    maximumHeight,
    requiresTarget: options.requiresTarget ?? false,
    supportsDualAxis: options.supportsDualAxis ?? false,
    supportsPeriodComparison: options.supportsPeriodComparison ?? false,
    supportedOptionKeys: ['prefix', 'suffix', ...(options.supportedOptionKeys ?? [])],
  };
}

const VISUALIZATIONS: VisualizationDescriptor[] = [
  visualization('METRIC_CARD', ['SCALAR'], 3, 2, 3, 2, 6, 4, {
    maximumSeries: 1,
    supportsPeriodComparison: true,
    supportedOptionKeys: ['showComparison', 'sparkline', 'trendDirection'],
  }),
  visualization('LINE', ['TIME_SERIES', 'CATEGORY'], 4, 4, 6, 6, 12, 10, {
    supportsDualAxis: true,
    supportsPeriodComparison: true,
    supportedOptionKeys: ['smooth', 'showPoints', 'showGrid', 'showValues'],
  }),
  visualization('AREA', ['TIME_SERIES'], 4, 4, 6, 6, 12, 10, {
    supportsPeriodComparison: true,
    supportedOptionKeys: ['smooth', 'gradient', 'stacked', 'showGrid'],
  }),
  visualization('LINE_AREA', ['TIME_SERIES'], 4, 4, 8, 6, 12, 10, {
    supportsDualAxis: true,
    supportsPeriodComparison: true,
    supportedOptionKeys: ['smooth', 'gradient', 'showPoints', 'showGrid'],
  }),
  visualization('COLUMN', ['TIME_SERIES', 'CATEGORY'], 4, 4, 6, 6, 12, 10, {
    supportsDualAxis: true,
    supportsPeriodComparison: true,
    supportedOptionKeys: ['rounded', 'showGrid', 'showValues'],
  }),
  visualization('BAR', ['CATEGORY'], 4, 4, 6, 6, 12, 10, {
    supportsPeriodComparison: true,
    supportedOptionKeys: ['rounded', 'showGrid', 'showValues'],
  }),
  visualization('STACKED_BAR', ['CATEGORY', 'TIME_SERIES'], 4, 4, 6, 6, 12, 10, {
    supportedOptionKeys: ['percentStack', 'rounded', 'showValues'],
  }),
  visualization('PIE', ['CATEGORY'], 3, 4, 4, 5, 6, 8, {
    maximumSeries: 1,
    supportedOptionKeys: ['showLabels', 'showPercentages'],
  }),
  visualization('DONUT', ['CATEGORY'], 3, 4, 4, 5, 6, 8, {
    maximumSeries: 1,
    supportedOptionKeys: ['showLabels', 'showPercentages', 'centerLabel'],
  }),
  visualization('SCATTER', ['XY'], 5, 5, 6, 6, 12, 10, {
    maximumSeries: 1,
    supportedOptionKeys: ['showGrid', 'showTrendLine'],
  }),
  visualization('BUBBLE', ['XY'], 5, 5, 6, 6, 12, 10, {
    maximumSeries: 1,
    supportedOptionKeys: ['showGrid', 'scaleBubbles'],
  }),
  visualization('GANTT', ['INTERVAL'], 6, 6, 12, 8, 12, 16, {
    maximumSeries: 1,
    supportedOptionKeys: ['showToday', 'compactRows'],
  }),
  visualization('FLOWCHART', ['GRAPH'], 6, 6, 12, 8, 12, 16, {
    maximumSeries: 1,
    supportedOptionKeys: ['direction', 'showCounts'],
  }),
  visualization('SEMI_CIRCLE_GAUGE', ['SCALAR'], 3, 3, 4, 5, 6, 8, {
    maximumSeries: 1,
    requiresTarget: true,
    supportedOptionKeys: ['showTarget', 'showTicks'],
  }),
  visualization('THREE_QUARTER_GAUGE', ['SCALAR'], 3, 3, 4, 5, 6, 8, {
    maximumSeries: 1,
    requiresTarget: true,
    supportedOptionKeys: ['showTarget', 'showTicks'],
  }),
  visualization('CIRCULAR_PROGRESS_GAUGE', ['SCALAR'], 3, 3, 4, 5, 6, 8, {
    maximumSeries: 1,
    requiresTarget: true,
    supportedOptionKeys: ['showTarget', 'thickness'],
  }),
  visualization('DETAILED_SPEEDOMETER', ['SCALAR'], 3, 4, 4, 5, 8, 8, {
    maximumSeries: 1,
    requiresTarget: true,
    supportedOptionKeys: ['showTarget', 'showTicks', 'bands'],
  }),
  visualization(
    'TABLE',
    ['SCALAR', 'TIME_SERIES', 'CATEGORY', 'XY', 'INTERVAL', 'GRAPH', 'ROWS'],
    4,
    4,
    6,
    6,
    12,
    16,
    {
      supportsPeriodComparison: true,
      supportedOptionKeys: ['compact', 'stickyHeader', 'showTotals'],
    },
  ),
  visualization('FUNNEL', ['CATEGORY'], 4, 4, 6, 6, 8, 10, {
    maximumSeries: 1,
    supportedOptionKeys: ['showPercentages', 'showValues'],
  }),
  visualization('HEATMAP', ['CATEGORY', 'TIME_SERIES'], 4, 5, 6, 6, 12, 12, {
    supportsPeriodComparison: true,
    supportedOptionKeys: ['showLegend', 'showValues', 'colorScale'],
  }),
];

type MetricOwner =
  | 'quotations'
  | 'salesOrders'
  | 'purchaseOrders'
  | 'catalog'
  | 'inventory'
  | 'pricing'
  | 'controlTower';

// permissionForOwner (dashboard-catalog.ts:321).
const PERMISSION_FOR_OWNER: Record<MetricOwner, string> = {
  quotations: 'trade.quotations.read',
  salesOrders: 'trade.sales_orders.read',
  purchaseOrders: 'trade.purchase_orders.read',
  catalog: 'trade.items.read',
  inventory: 'trade.inventory.read',
  pricing: 'trade.pricing.read',
  controlTower: 'trade.control_tower.read',
};

const FEATURE_FOR_OWNER: Record<MetricOwner, string> = {
  quotations: 'trade.sales',
  salesOrders: 'trade.sales',
  purchaseOrders: 'trade.purchasing',
  catalog: 'trade.catalog',
  inventory: 'trade.inventory',
  pricing: 'trade.pricing',
  controlTower: 'trade.analytics',
};

/**
 * Provider scope COMPANY (dashboard-execution.service.ts providerScope): these metrics run only on
 * FULL_COMPANY targets; a branch-limited target makes the widget UNAVAILABLE.
 */
export const COMPANY_SCOPED_METRICS: ReadonlySet<string> = new Set([
  'trade.catalog.items.count',
  'trade.catalog.item_kind_mix',
  'trade.catalog.capability_mix',
  'trade.catalog.active_profiles.count',
  'trade.inventory.active_reservations.count',
  'trade.pricing.price_entries.count',
  'trade.pricing.price_source_mix',
]);

const ALL_COVERAGE: ScopeCoverage[] = ['SINGLE_COMPANY', 'MULTI_COMPANY_AUTHORIZED_UNION'];
const ALL_MODES: ScopeMode[] = ['CURRENT_CONTEXT', 'SAVED_TARGETS', 'SELECTED_SCOPES', 'ALL_ACCESSIBLE'];

interface MetricInput {
  key: string;
  shape: DataShape;
  unit: MetricUnit;
  owner: MetricOwner;
  filterKeys: string[];
  dimensions?: string[];
  fieldPermissions?: string[];
  multiCompanyAggregation?: MetricDescriptor['multiCompanyAggregation'];
  maximumPoints?: number;
}

// metric() helper (dashboard-catalog.ts:378); filterKeys is the result of allowedFilterKeys().
function metric(input: MetricInput): MetricDescriptor {
  const token = input.key.replaceAll('.', '_');
  const aggregation: Aggregation[] =
    input.unit === 'COUNT' ? ['COUNT'] : input.unit === 'PERCENT' ? ['PERCENT'] : ['SUM'];
  const comparisonModes: WidgetComparisonMode[] =
    input.shape === 'SCALAR' || input.shape === 'TIME_SERIES' || input.shape === 'CATEGORY'
      ? ['NONE', 'PREVIOUS_PERIOD', 'PREVIOUS_YEAR', 'TARGET']
      : ['NONE'];
  return {
    key: input.key,
    version: 1,
    labelKey: `trade.dashboard.metric.${token}.label`,
    descriptionKey: `trade.dashboard.metric.${token}.description`,
    shape: input.shape,
    unit: input.unit,
    supportedAggregations: aggregation,
    allowedDimensions: input.dimensions ?? ['none'],
    allowedFilterKeys: input.filterKeys,
    supportedVisualizations: [...SHAPE_VISUALIZATIONS[input.shape]],
    supportedComparisonModes: comparisonModes,
    requiredFeatureKeys: [...new Set(['trade.analytics', FEATURE_FOR_OWNER[input.owner]])],
    requiredPermissions: [PERMISSION_FOR_OWNER[input.owner]],
    requiredFieldPermissions: input.fieldPermissions ?? [],
    allowedScopeCoverage: [...ALL_COVERAGE],
    allowedScopeModes: [...ALL_MODES],
    multiCompanyAggregation: input.multiCompanyAggregation ?? 'PARTITION_ONLY',
    currencyBehavior: input.unit === 'MONEY' ? 'PARTITION_BY_COMPANY_AND_CURRENCY' : 'NOT_APPLICABLE',
    maximumRangeMonths: DASHBOARD_LIMITS.MAX_SYNC_RANGE_MONTHS,
    maximumPoints: input.maximumPoints ?? DASHBOARD_LIMITS.MAX_WIDGET_POINTS,
    freshness: {
      sourceOwner: input.owner,
      maximumAgeSeconds: input.owner === 'inventory' ? 300 : 900,
      staleBehavior: input.owner === 'inventory' ? 'RETURN_STALE' : 'UNAVAILABLE',
      canonicalFallbackAllowed: true,
    },
    drillThroughTargetCode: `TRADE_${input.owner.toUpperCase()}_LIST`,
  };
}

const DOC_FILTERS = ['status', 'channel', 'item', 'document_type'];
const PO_FILTERS = [...DOC_FILTERS, 'approval_status'];
const SAFE = 'SAFE_ADDITIVE_COUNT' as const;

// TRADE_DASHBOARD_METRICS (dashboard-catalog.ts:489), same order.
const METRICS: MetricDescriptor[] = [
  metric({ key: 'trade.quotations.created.count', shape: 'SCALAR', unit: 'COUNT', owner: 'quotations', filterKeys: DOC_FILTERS, multiCompanyAggregation: SAFE }),
  metric({ key: 'trade.quotations.created.trend', shape: 'TIME_SERIES', unit: 'COUNT', owner: 'quotations', filterKeys: DOC_FILTERS, dimensions: ['time'] }),
  metric({ key: 'trade.quotations.status.count', shape: 'CATEGORY', unit: 'COUNT', owner: 'quotations', filterKeys: DOC_FILTERS, dimensions: ['status'] }),
  metric({ key: 'trade.quotations.total_value', shape: 'SCALAR', unit: 'MONEY', owner: 'quotations', filterKeys: DOC_FILTERS }),
  metric({ key: 'trade.quotations.value_by_status', shape: 'CATEGORY', unit: 'MONEY', owner: 'quotations', filterKeys: DOC_FILTERS, dimensions: ['status'] }),
  metric({ key: 'trade.quotations.acceptance_rate', shape: 'SCALAR', unit: 'PERCENT', owner: 'quotations', filterKeys: DOC_FILTERS }),
  metric({ key: 'trade.quotations.expiring.count', shape: 'SCALAR', unit: 'COUNT', owner: 'quotations', filterKeys: DOC_FILTERS, multiCompanyAggregation: SAFE }),
  metric({ key: 'trade.quotations.expiring.rows', shape: 'ROWS', unit: 'COUNT', owner: 'quotations', filterKeys: DOC_FILTERS, dimensions: ['record'], maximumPoints: 100 }),

  metric({ key: 'trade.sales_orders.confirmed.count', shape: 'SCALAR', unit: 'COUNT', owner: 'salesOrders', filterKeys: DOC_FILTERS, multiCompanyAggregation: SAFE }),
  metric({ key: 'trade.sales_orders.confirmed_value', shape: 'SCALAR', unit: 'MONEY', owner: 'salesOrders', filterKeys: DOC_FILTERS }),
  metric({ key: 'trade.sales_orders.confirmed.trend', shape: 'TIME_SERIES', unit: 'COUNT', owner: 'salesOrders', filterKeys: DOC_FILTERS, dimensions: ['time'] }),
  metric({ key: 'trade.sales_orders.status.count', shape: 'CATEGORY', unit: 'COUNT', owner: 'salesOrders', filterKeys: DOC_FILTERS, dimensions: ['status'] }),
  metric({ key: 'trade.sales_orders.value_by_status', shape: 'CATEGORY', unit: 'MONEY', owner: 'salesOrders', filterKeys: DOC_FILTERS, dimensions: ['status'] }),
  metric({ key: 'trade.sales_orders.held.count', shape: 'SCALAR', unit: 'COUNT', owner: 'salesOrders', filterKeys: DOC_FILTERS, multiCompanyAggregation: SAFE }),
  metric({ key: 'trade.sales_orders.pending_confirmation.count', shape: 'SCALAR', unit: 'COUNT', owner: 'salesOrders', filterKeys: DOC_FILTERS, multiCompanyAggregation: SAFE }),
  metric({ key: 'trade.sales_orders.fulfillment_status.count', shape: 'CATEGORY', unit: 'COUNT', owner: 'salesOrders', filterKeys: DOC_FILTERS, dimensions: ['fulfillment_status'] }),

  metric({ key: 'trade.purchase_orders.confirmed.count', shape: 'SCALAR', unit: 'COUNT', owner: 'purchaseOrders', filterKeys: PO_FILTERS, multiCompanyAggregation: SAFE }),
  metric({ key: 'trade.purchase_orders.confirmed_value', shape: 'SCALAR', unit: 'MONEY', owner: 'purchaseOrders', filterKeys: PO_FILTERS }),
  metric({ key: 'trade.purchase_orders.status.count', shape: 'CATEGORY', unit: 'COUNT', owner: 'purchaseOrders', filterKeys: PO_FILTERS, dimensions: ['status'] }),
  metric({ key: 'trade.purchase_orders.value_by_status', shape: 'CATEGORY', unit: 'MONEY', owner: 'purchaseOrders', filterKeys: PO_FILTERS, dimensions: ['status'] }),
  metric({ key: 'trade.purchase_orders.pending_approval_rows', shape: 'SCALAR', unit: 'COUNT', owner: 'purchaseOrders', filterKeys: PO_FILTERS, multiCompanyAggregation: SAFE }),
  metric({ key: 'trade.purchase_orders.approval_status.count', shape: 'CATEGORY', unit: 'COUNT', owner: 'purchaseOrders', filterKeys: PO_FILTERS, dimensions: ['approval_status'] }),
  metric({ key: 'trade.purchase_orders.overdue_expected.count', shape: 'SCALAR', unit: 'COUNT', owner: 'purchaseOrders', filterKeys: PO_FILTERS, multiCompanyAggregation: SAFE }),
  metric({ key: 'trade.purchase_orders.overdue_expected.rows', shape: 'ROWS', unit: 'COUNT', owner: 'purchaseOrders', filterKeys: PO_FILTERS, dimensions: ['record'], maximumPoints: 100 }),

  metric({ key: 'trade.catalog.items.count', shape: 'SCALAR', unit: 'COUNT', owner: 'catalog', filterKeys: ['status', 'item'], multiCompanyAggregation: SAFE }),
  metric({ key: 'trade.catalog.item_kind_mix', shape: 'CATEGORY', unit: 'COUNT', owner: 'catalog', filterKeys: ['status', 'item'], dimensions: ['item_kind'] }),
  metric({ key: 'trade.catalog.capability_mix', shape: 'CATEGORY', unit: 'COUNT', owner: 'catalog', filterKeys: ['item', 'capability'], dimensions: ['capability'] }),
  metric({ key: 'trade.catalog.active_profiles.count', shape: 'SCALAR', unit: 'COUNT', owner: 'catalog', filterKeys: ['status', 'item'], multiCompanyAggregation: SAFE }),
  metric({ key: 'trade.catalog.branch_assortment.count', shape: 'SCALAR', unit: 'COUNT', owner: 'catalog', filterKeys: ['item'], multiCompanyAggregation: SAFE }),

  metric({ key: 'trade.inventory.availability_status', shape: 'CATEGORY', unit: 'COUNT', owner: 'inventory', filterKeys: ['fulfillment_node', 'item'], dimensions: ['availability_status'] }),
  metric({ key: 'trade.inventory.stockout.count', shape: 'SCALAR', unit: 'COUNT', owner: 'inventory', filterKeys: ['fulfillment_node', 'item'], multiCompanyAggregation: SAFE }),
  metric({ key: 'trade.inventory.availability.rows', shape: 'ROWS', unit: 'QUANTITY', owner: 'inventory', filterKeys: ['fulfillment_node', 'item'], dimensions: ['record'], maximumPoints: 100 }),
  metric({ key: 'trade.inventory.active_reservations.count', shape: 'SCALAR', unit: 'COUNT', owner: 'inventory', filterKeys: [], multiCompanyAggregation: SAFE }),

  metric({ key: 'trade.pricing.price_entries.count', shape: 'SCALAR', unit: 'COUNT', owner: 'pricing', filterKeys: ['item'], multiCompanyAggregation: SAFE }),
  metric({ key: 'trade.pricing.price_source_mix', shape: 'CATEGORY', unit: 'COUNT', owner: 'pricing', filterKeys: ['item'], dimensions: ['price_source'] }),
  metric({ key: 'trade.pricing.override.count', shape: 'SCALAR', unit: 'COUNT', owner: 'pricing', filterKeys: [], multiCompanyAggregation: SAFE }),
  metric({ key: 'trade.pricing.guard_breaches.count', shape: 'SCALAR', unit: 'COUNT', owner: 'pricing', filterKeys: [], multiCompanyAggregation: SAFE }),
  metric({ key: 'trade.pricing.estimated_margin_rate', shape: 'SCALAR', unit: 'PERCENT', owner: 'pricing', filterKeys: [], fieldPermissions: ['trade.pricing.view_cost'] }),

  metric({ key: 'trade.control_tower.open_exceptions', shape: 'SCALAR', unit: 'COUNT', owner: 'controlTower', filterKeys: ['status', 'severity'], multiCompanyAggregation: SAFE }),
  metric({ key: 'trade.control_tower.exceptions_by_severity', shape: 'CATEGORY', unit: 'COUNT', owner: 'controlTower', filterKeys: ['status', 'severity'], dimensions: ['severity'] }),
  metric({ key: 'trade.control_tower.action_rows', shape: 'ROWS', unit: 'COUNT', owner: 'controlTower', filterKeys: ['severity'], dimensions: ['record'], maximumPoints: 100 }),

  metric({ key: 'trade.orders.value_vs_lines', shape: 'XY', unit: 'MONEY', owner: 'salesOrders', filterKeys: DOC_FILTERS, dimensions: ['order'], maximumPoints: 200 }),
  metric({ key: 'trade.purchase_orders.expected_schedule', shape: 'INTERVAL', unit: 'DURATION', owner: 'purchaseOrders', filterKeys: PO_FILTERS, dimensions: ['schedule'], maximumPoints: 200 }),
  metric({ key: 'trade.orders.lifecycle_flow', shape: 'GRAPH', unit: 'COUNT', owner: 'salesOrders', filterKeys: DOC_FILTERS, dimensions: ['lifecycle'] }),
];

const METRIC_INDEX = new Map(METRICS.map((m) => [m.key, m]));

// Template widgets use the metric's first allowed dimension, as the backend template definitions do.
function dimensionOf(metricKey: string): string {
  return METRIC_INDEX.get(metricKey)?.allowedDimensions[0] ?? 'none';
}

function cardSlot(
  index: number,
  code: string,
  metricKey: string,
  nameEn: string,
  nameAr: string,
): TemplateWidgetPlacementSpec {
  return {
    code,
    metricKey,
    visualizationType: 'METRIC_CARD',
    nameEn,
    nameAr,
    x: index * 3,
    y: 0,
    width: 3,
    height: 2,
    sortOrder: index,
    dimensionKey: dimensionOf(metricKey),
  };
}

function chartSlot(
  index: number,
  code: string,
  metricKey: string,
  visualizationType: TradeViz,
  nameEn: string,
  nameAr: string,
  extra?: Pick<TemplateWidgetPlacementSpec, 'grain' | 'comparison' | 'requiresFeatureKey'>,
): TemplateWidgetPlacementSpec {
  const row = Math.floor(index / 2);
  const col = index % 2;
  return {
    code,
    metricKey,
    visualizationType,
    nameEn,
    nameAr,
    x: col * 6,
    y: 2 + row * 6,
    width: 6,
    height: 6,
    sortOrder: 4 + index,
    dimensionKey: dimensionOf(metricKey),
    ...(extra?.grain ? { grain: extra.grain } : {}),
    ...(extra?.comparison ? { comparison: extra.comparison } : {}),
    ...(extra?.requiresFeatureKey ? { requiresFeatureKey: extra.requiresFeatureKey } : {}),
  };
}

export const TEMPLATE_LAYOUTS: Record<TemplateKey, TemplateLayoutSpec> = {
  TRADE_EXECUTIVE: {
    key: 'TRADE_EXECUTIVE',
    nameEn: 'Executive overview',
    nameAr: 'نظرة تنفيذية',
    descriptionEn: 'Sales, purchasing, stock and exceptions at a glance.',
    descriptionAr: 'المبيعات والمشتريات والمخزون والاستثناءات في لمحة واحدة.',
    requiredFeatureKeys: ['trade.analytics', 'trade.sales', 'trade.purchasing'],
    widgets: [
      cardSlot(
        0,
        'executive_sales_value',
        'trade.sales_orders.confirmed_value',
        'Confirmed sales value',
        'قيمة المبيعات المؤكدة',
      ),
      cardSlot(
        1,
        'executive_purchase_value',
        'trade.purchase_orders.confirmed_value',
        'Confirmed purchase value',
        'قيمة المشتريات المؤكدة',
      ),
      cardSlot(
        2,
        'executive_acceptance',
        'trade.quotations.acceptance_rate',
        'Quotation acceptance',
        'قبول عروض الأسعار',
      ),
      cardSlot(
        3,
        'executive_exceptions',
        'trade.control_tower.open_exceptions',
        'Open exceptions',
        'الاستثناءات المفتوحة',
      ),
      chartSlot(
        0,
        'executive_sales_trend',
        'trade.sales_orders.confirmed.trend',
        'LINE_AREA',
        'Confirmed orders trend',
        'اتجاه الطلبات المؤكدة',
        { grain: 'DAY' },
      ),
      chartSlot(
        1,
        'executive_order_status',
        'trade.sales_orders.status.count',
        'DONUT',
        'Orders by status',
        'الطلبات حسب الحالة',
      ),
      chartSlot(
        2,
        'executive_availability',
        'trade.inventory.availability_status',
        'STACKED_BAR',
        'Stock availability',
        'توفر المخزون',
        { requiresFeatureKey: 'trade.inventory' },
      ),
      chartSlot(
        3,
        'executive_severity',
        'trade.control_tower.exceptions_by_severity',
        'BAR',
        'Exceptions by severity',
        'الاستثناءات حسب الخطورة',
      ),
    ],
  },
  SALES_AND_QUOTES: {
    key: 'SALES_AND_QUOTES',
    nameEn: 'Sales and quotations',
    nameAr: 'المبيعات وعروض الأسعار',
    descriptionEn: 'Quotation flow, acceptance and order value.',
    descriptionAr: 'تدفق عروض الأسعار ونسبة القبول وقيمة الطلبات.',
    requiredFeatureKeys: ['trade.analytics', 'trade.sales'],
    widgets: [
      cardSlot(
        0,
        'sales_quote_count',
        'trade.quotations.created.count',
        'Quotations created',
        'عروض الأسعار المُنشأة',
      ),
      cardSlot(
        1,
        'sales_quote_value',
        'trade.quotations.total_value',
        'Quotations value',
        'قيمة عروض الأسعار',
      ),
      cardSlot(
        2,
        'sales_acceptance',
        'trade.quotations.acceptance_rate',
        'Acceptance rate',
        'نسبة القبول',
      ),
      cardSlot(
        3,
        'sales_pending_confirmation',
        'trade.sales_orders.pending_confirmation.count',
        'Awaiting confirmation',
        'بانتظار التأكيد',
      ),
      chartSlot(
        0,
        'sales_quote_trend',
        'trade.quotations.created.trend',
        'LINE',
        'Quotations trend',
        'اتجاه عروض الأسعار',
        { grain: 'DAY' },
      ),
      chartSlot(
        1,
        'sales_quote_status',
        'trade.quotations.value_by_status',
        'DONUT',
        'Quotation value by status',
        'قيمة العروض حسب الحالة',
      ),
      chartSlot(
        2,
        'sales_order_status',
        'trade.sales_orders.value_by_status',
        'COLUMN',
        'Order value by status',
        'قيمة الطلبات حسب الحالة',
      ),
      chartSlot(
        3,
        'sales_value_xy',
        'trade.orders.value_vs_lines',
        'BUBBLE',
        'Order value and lines',
        'قيمة الطلبات وعدد البنود',
      ),
    ],
  },
  PURCHASING: {
    key: 'PURCHASING',
    nameEn: 'Purchasing',
    nameAr: 'المشتريات',
    descriptionEn: 'Purchase orders, approvals and expected deliveries.',
    descriptionAr: 'أوامر الشراء والاعتمادات والتوريدات المتوقعة.',
    requiredFeatureKeys: ['trade.analytics', 'trade.purchasing'],
    widgets: [
      cardSlot(
        0,
        'purchasing_confirmed_count',
        'trade.purchase_orders.confirmed.count',
        'Confirmed purchase orders',
        'أوامر الشراء المؤكدة',
      ),
      cardSlot(
        1,
        'purchasing_confirmed_value',
        'trade.purchase_orders.confirmed_value',
        'Purchase order value',
        'قيمة أوامر الشراء',
      ),
      cardSlot(
        2,
        'purchasing_pending_approval',
        'trade.purchase_orders.pending_approval_rows',
        'Awaiting approval',
        'بانتظار الاعتماد',
      ),
      cardSlot(
        3,
        'purchasing_overdue',
        'trade.purchase_orders.overdue_expected.count',
        'Overdue deliveries',
        'التوريدات المتأخرة',
      ),
      chartSlot(
        0,
        'purchasing_status',
        'trade.purchase_orders.value_by_status',
        'BAR',
        'Value by status',
        'القيمة حسب الحالة',
      ),
      chartSlot(
        1,
        'purchasing_approval',
        'trade.purchase_orders.approval_status.count',
        'FUNNEL',
        'Approval status',
        'حالة الاعتماد',
      ),
      chartSlot(
        2,
        'purchasing_schedule',
        'trade.purchase_orders.expected_schedule',
        'GANTT',
        'Expected deliveries',
        'التوريدات المتوقعة',
      ),
      chartSlot(
        3,
        'purchasing_overdue_rows',
        'trade.purchase_orders.overdue_expected.rows',
        'TABLE',
        'Overdue lines',
        'البنود المتأخرة',
      ),
    ],
  },
  CATALOG_AND_AVAILABILITY: {
    key: 'CATALOG_AND_AVAILABILITY',
    nameEn: 'Catalogue and availability',
    nameAr: 'الكتالوج والتوفر',
    descriptionEn: 'Items, assortment and stock availability.',
    descriptionAr: 'الأصناف والتشكيلة وتوفر المخزون.',
    requiredFeatureKeys: ['trade.analytics', 'trade.catalog', 'trade.inventory'],
    widgets: [
      cardSlot(0, 'catalog_items', 'trade.catalog.items.count', 'Items', 'الأصناف'),
      cardSlot(
        1,
        'catalog_profiles',
        'trade.catalog.active_profiles.count',
        'Active company items',
        'أصناف الشركة النشطة',
      ),
      cardSlot(
        2,
        'catalog_assortment',
        'trade.catalog.branch_assortment.count',
        'Branch assortment',
        'تشكيلة الفرع',
      ),
      cardSlot(
        3,
        'catalog_stockout',
        'trade.inventory.stockout.count',
        'Stock-outs',
        'نفاد المخزون',
      ),
      chartSlot(
        0,
        'catalog_kind_mix',
        'trade.catalog.item_kind_mix',
        'DONUT',
        'Items by kind',
        'الأصناف حسب النوع',
      ),
      chartSlot(
        1,
        'catalog_capability_mix',
        'trade.catalog.capability_mix',
        'BAR',
        'Items by capability',
        'الأصناف حسب القدرة',
      ),
      chartSlot(
        2,
        'catalog_availability',
        'trade.inventory.availability_status',
        'PIE',
        'Availability',
        'التوفر',
      ),
      chartSlot(
        3,
        'catalog_availability_rows',
        'trade.inventory.availability.rows',
        'TABLE',
        'Stock by location',
        'المخزون حسب الموقع',
      ),
    ],
  },
  MARGIN_AND_PRICING: {
    key: 'MARGIN_AND_PRICING',
    nameEn: 'Margin and pricing',
    nameAr: 'الهامش والتسعير',
    descriptionEn: 'Price entries, overrides and estimated margin.',
    descriptionAr: 'بنود الأسعار والتجاوزات والهامش التقديري.',
    requiredFeatureKeys: ['trade.analytics', 'trade.pricing'],
    widgets: [
      cardSlot(
        0,
        'pricing_entries',
        'trade.pricing.price_entries.count',
        'Price entries',
        'بنود الأسعار',
      ),
      cardSlot(
        1,
        'pricing_overrides',
        'trade.pricing.override.count',
        'Price overrides',
        'تجاوزات الأسعار',
      ),
      cardSlot(
        2,
        'pricing_guard_breaches',
        'trade.pricing.guard_breaches.count',
        'Price guard breaches',
        'مخالفات حدود الأسعار',
      ),
      cardSlot(
        3,
        'pricing_margin',
        'trade.pricing.estimated_margin_rate',
        'Estimated margin',
        'الهامش التقديري',
      ),
      chartSlot(
        0,
        'pricing_source_mix',
        'trade.pricing.price_source_mix',
        'DONUT',
        'Prices by purpose',
        'الأسعار حسب الغرض',
      ),
      chartSlot(
        1,
        'pricing_margin_gauge',
        'trade.pricing.estimated_margin_rate',
        'SEMI_CIRCLE_GAUGE',
        'Margin against target',
        'الهامش مقابل المستهدف',
        { comparison: { mode: 'TARGET', target: '20' } },
      ),
    ],
  },
  OPERATIONS_ACTION_CENTER: {
    key: 'OPERATIONS_ACTION_CENTER',
    nameEn: 'Operations action centre',
    nameAr: 'مركز الإجراءات التشغيلية',
    descriptionEn: 'What needs attention today in sales and purchasing.',
    descriptionAr: 'ما يحتاج إلى متابعة اليوم في المبيعات والمشتريات.',
    requiredFeatureKeys: ['trade.analytics', 'trade.sales', 'trade.purchasing'],
    widgets: [
      cardSlot(
        0,
        'action_expiring_quotes',
        'trade.quotations.expiring.count',
        'Expiring quotations',
        'عروض أسعار توشك على الانتهاء',
      ),
      cardSlot(
        1,
        'action_held_orders',
        'trade.sales_orders.held.count',
        'Orders on hold',
        'الطلبات الموقوفة',
      ),
      cardSlot(
        2,
        'action_pending_approval',
        'trade.purchase_orders.pending_approval_rows',
        'Purchase orders awaiting approval',
        'أوامر شراء بانتظار الاعتماد',
      ),
      cardSlot(
        3,
        'action_open_exceptions',
        'trade.control_tower.open_exceptions',
        'Open exceptions',
        'الاستثناءات المفتوحة',
      ),
      chartSlot(
        0,
        'action_quote_rows',
        'trade.quotations.expiring.rows',
        'TABLE',
        'Quotations to follow up',
        'عروض أسعار للمتابعة',
      ),
      chartSlot(
        1,
        'action_exception_rows',
        'trade.control_tower.action_rows',
        'TABLE',
        'Action list',
        'قائمة الإجراءات',
      ),
      chartSlot(
        2,
        'action_lifecycle',
        'trade.orders.lifecycle_flow',
        'FLOWCHART',
        'Order lifecycle',
        'دورة حياة الطلب',
      ),
      chartSlot(
        3,
        'action_exception_severity',
        'trade.control_tower.exceptions_by_severity',
        'HEATMAP',
        'Exceptions by severity',
        'الاستثناءات حسب الخطورة',
      ),
    ],
  },
};

const TEMPLATE_KEYS_ORDER: readonly TemplateKey[] = [
  'TRADE_EXECUTIVE',
  'SALES_AND_QUOTES',
  'PURCHASING',
  'CATALOG_AND_AVAILABILITY',
  'MARGIN_AND_PRICING',
  'OPERATIONS_ACTION_CENTER',
];

// template() helper (dashboard-catalog.ts:591): label keys keep the upper-case template key.
const TEMPLATES: TemplateDescriptor[] = TEMPLATE_KEYS_ORDER.map((key) => {
  const layout = TEMPLATE_LAYOUTS[key];
  return {
    key,
    version: 1,
    labelKey: `trade.dashboard.template.${key}.label`,
    descriptionKey: `trade.dashboard.template.${key}.description`,
    requiredFeatureKeys: [...layout.requiredFeatureKeys],
    widgetDefinitionCodes: layout.widgets.map((w) => w.code),
  };
});

export const CATALOG: Catalog = {
  catalogVersion: 1,
  frontendContractVersion: 1,
  limits: DASHBOARD_LIMITS,
  filters: {
    datePresets: [
      'TODAY',
      'CURRENT_WEEK',
      'CURRENT_MONTH',
      'CURRENT_QUARTER',
      'CURRENT_YEAR',
      'LAST_30_DAYS',
      'CUSTOM',
    ],
    periodComparisons: ['NONE', 'PREVIOUS_PERIOD', 'PREVIOUS_YEAR'],
    widgetComparisons: ['NONE', 'PREVIOUS_PERIOD', 'PREVIOUS_YEAR', 'TARGET'],
    timeGrains: ['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'],
    scopeModes: [...ALL_MODES],
    scopeCoverage: [...ALL_COVERAGE],
  },
  metrics: METRICS,
  visualizations: VISUALIZATIONS,
  templates: TEMPLATES,
  responsive: {
    canonical: 'DESKTOP_12',
    desktopMinimumWidth: 1181,
    tabletColumns: 6,
    mobileMaximumWidth: 620,
    layoutEditing: 'DESKTOP_ONLY',
  },
  resultStatuses: ['READY', 'EMPTY', 'LIMITED', 'STALE', 'UNAVAILABLE', 'FAILED'],
  executionCache: 'REQUEST_MEMO_ONLY',
};

export const METRIC_BY_KEY: ReadonlyMap<string, MetricDescriptor> = METRIC_INDEX;

export const VIZ_BY_TYPE: ReadonlyMap<TradeViz, VisualizationDescriptor> = new Map(
  VISUALIZATIONS.map((v) => [v.type, v]),
);
