import { isChartKind } from '../analytics.model';
import { ApiError, FAKE_NOW, fakeId } from '../analytics-api';
import type {
  CalculationDetails,
  CrossFilter,
  DashboardOrganizationScope,
  DashboardRun,
  DatasetComparisonDetails,
  ExecutionState,
  Panel,
  PanelCoverage,
  PanelOutcome,
  PanelState,
  RuntimeFilters,
  SeriesUnit,
  SharePreview,
  SharePreviewResource,
  SharePreviewScope,
  Visualization,
  WidgetExecution,
  WidgetPoint,
} from '../analytics.model';
import { executionStateToPanel } from '../panel-state';
import { FAKE_CATALOG } from './fake-catalog';
import { FAKE_BRANCHES, FAKE_COMPANIES, FAKE_PEOPLE, FAKE_TEAMS, fakeLang } from './fake-org';
import { fakeReceipt } from './fake-receipts';

/** Switch to `false` to simulate unready `core.team_membership_history` for E4 TEAM comparison. */
export const TEAM_HISTORY_READY = true;

export const FAKE_ALL_STAFF_TEAM_ID = '01934b10-0000-7000-8000-000000000299';
export const FAKE_EMPTY_TEAM_ID = '01934b10-0000-7000-8000-000000000298';

export interface FakeExecutionOpts {
  id?: string;
  state?: ExecutionState;
  seed?: number;
  currency?: 'EGP' | 'USD';
  comparison?: boolean;
}

const EFFECTIVE_PERIOD = { from: '2026-11-01', to: '2026-11-21', timeZone: 'Africa/Cairo' };

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function L(en: string, ar: string): string {
  return fakeLang() === 'ar' ? ar : en;
}

function moneyScale(currency: 'EGP' | 'USD'): number {
  return currency === 'USD' ? 0.02 : 1;
}

function shapeForKind(kind: Visualization): WidgetExecution['shape'] {
  switch (kind) {
    case 'METRIC_CARD':
    case 'MULTI_KPI':
    case 'PROGRESS_CARD':
    case 'SEMI_CIRCLE_GAUGE':
    case 'THREE_QUARTER_GAUGE':
    case 'CIRCULAR_PROGRESS_GAUGE':
    case 'DETAILED_SPEEDOMETER':
    case 'BULLET':
      return 'SCALAR';
    case 'LINE':
    case 'AREA':
    case 'LINE_AREA':
    case 'COLUMN':
    case 'CALENDAR_HEATMAP':
      return 'TIME_SERIES';
    case 'BAR':
    case 'STACKED_BAR':
    case 'STACKED_BAR_100':
    case 'COMBO':
    case 'PIE':
    case 'DONUT':
    case 'FUNNEL':
    case 'HEATMAP':
    case 'TABLE':
      return 'CATEGORY';
    case 'SCATTER':
    case 'BUBBLE':
      return 'XY';
    case 'GANTT':
    case 'CALENDAR':
      return 'INTERVAL';
    case 'FLOWCHART':
      return 'GRAPH';
    case 'TREEMAP':
      return 'HIERARCHY';
    case 'HISTOGRAM':
      return 'BINNED_DISTRIBUTION';
    case 'BOX_PLOT':
      return 'DURATION_DISTRIBUTION';
    case 'WATERFALL':
      return 'WATERFALL';
    case 'TIMELINE':
    case 'ACTIVITY_FEED':
      return 'EVENT_STREAM';
    case 'LEADERBOARD':
    case 'SCORECARD':
    case 'ALERT_LIST':
      return 'ROWS';
  }
}

function errorForState(state: Exclude<ExecutionState, 'READY' | 'EMPTY'>): { code: string; sourceKey?: string } {
  switch (state) {
    case 'FAILED':
      return { code: 'METRIC_EXECUTION_FAILED' };
    case 'DEADLINE_EXCEEDED':
      return { code: 'BUDGET_EXHAUSTED' };
    case 'UNAVAILABLE':
      return { code: 'SOURCE_NOT_READY', sourceKey: 'marketing.spend' };
    case 'RETIRED':
      return { code: 'METRIC_RETIRED' };
  }
}

function emptyExecution(
  kind: Visualization,
  currency: 'EGP' | 'USD',
  widgetId: string,
): WidgetExecution {
  const shape = shapeForKind(kind);
  const base: WidgetExecution = {
    widgetId,
    versionNumber: 1,
    widgetRevision: 1,
    state: 'EMPTY',
    shape,
    value: null,
    series: [],
    rows: [],
    meta: {
      currency,
      effectivePeriod: EFFECTIVE_PERIOD,
      generatedAt: FAKE_NOW,
      warnings: [],
    },
  };

  if (kind === 'TREEMAP') {
    base.result = { shape: 'HIERARCHY', unit: 'COUNT', nodes: [] };
  } else if (kind === 'HISTOGRAM') {
    base.result = { shape: 'BINNED_DISTRIBUTION', unit: 'COUNT', bins: [], totalCount: 0 };
  } else if (kind === 'BOX_PLOT') {
    base.result = {
      shape: 'DURATION_DISTRIBUTION',
      unit: 'DURATION',
      whiskerMethod: 'MIN_MAX',
      groups: [],
      totalCount: 0,
      excludedCount: 0,
    };
  } else if (kind === 'WATERFALL') {
    base.result = { shape: 'WATERFALL', unit: 'MONEY', currencyCode: currency, steps: [] };
  } else if (kind === 'TIMELINE' || kind === 'ACTIVITY_FEED') {
    base.result = { shape: 'EVENT_STREAM', events: [], partialAccess: false };
  } else if (kind === 'LEADERBOARD') {
    base.result = { shape: 'ROWS', rowKind: 'RANKED', rows: [] };
  } else if (kind === 'SCORECARD') {
    base.result = { shape: 'ROWS', rowKind: 'SCORECARD', rows: [] };
  } else if (kind === 'ALERT_LIST') {
    base.result = { shape: 'ROWS', rowKind: 'ALERT', rows: [], partialAccess: false };
  }

  return base;
}

function monthSlots(): { key: string; label: string; start: string; end: string }[] {
  return [
    { key: '2026-06', label: L('Jun', 'يونيو'), start: '2026-06-01', end: '2026-06-30' },
    { key: '2026-07', label: L('Jul', 'يوليو'), start: '2026-07-01', end: '2026-07-31' },
    { key: '2026-08', label: L('Aug', 'أغسطس'), start: '2026-08-01', end: '2026-08-31' },
    { key: '2026-09', label: L('Sep', 'سبتمبر'), start: '2026-09-01', end: '2026-09-30' },
    { key: '2026-10', label: L('Oct', 'أكتوبر'), start: '2026-10-01', end: '2026-10-31' },
    { key: '2026-11', label: L('Nov', 'نوفمبر'), start: '2026-11-01', end: '2026-11-21' },
  ];
}

function dailyCalendarPoints(rng: () => number): WidgetPoint[] {
  const points: WidgetPoint[] = [];
  const startUtc = Date.UTC(2026, 8, 22);
  for (let i = 0; i < 61; i++) {
    const iso = new Date(startUtc + i * 86_400_000).toISOString().slice(0, 10);
    const value = i === 18 ? null : Math.round(2 + rng() * 11);
    points.push({
      key: iso,
      label: iso,
      value,
      start: iso,
      end: iso,
    });
  }
  return points;
}

export function fakeExecution(kind: Visualization, opts?: FakeExecutionOpts): WidgetExecution {
  const widgetId = opts?.id ?? `fake-${kind.toLowerCase()}`;
  const currency = opts?.currency ?? 'EGP';
  const scale = moneyScale(currency);
  const state: ExecutionState = opts?.state ?? 'READY';
  const seed = opts?.seed ?? hashString(opts?.id ?? kind);
  const rng = mulberry32(seed);
  const comparison = Boolean(opts?.comparison);

  if (state === 'FAILED' || state === 'DEADLINE_EXCEEDED' || state === 'UNAVAILABLE' || state === 'RETIRED') {
    return {
      widgetId,
      versionNumber: 1,
      widgetRevision: 1,
      state,
      shape: shapeForKind(kind),
      value: null,
      series: [],
      error: errorForState(state),
      meta: {
        currency,
        effectivePeriod: EFFECTIVE_PERIOD,
        generatedAt: FAKE_NOW,
        warnings: [],
      },
    };
  }

  if (state === 'EMPTY') {
    return emptyExecution(kind, currency, widgetId);
  }

  const jitter = opts?.seed !== undefined ? 0.9 + rng() * 0.2 : 1;
  const slots = monthSlots();
  const prevWindow = {
    from: '2026-10-01',
    to: '2026-10-21',
    fromInstant: '2026-10-01T00:00:00.000Z',
    toInstant: '2026-10-21T23:59:59.000Z',
  };

  switch (kind) {
    case 'METRIC_CARD': {
      const rateValues = [18.4, 19.6, 21.0, 22.3, 23.8, 25.0];
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'SCALAR',
        value: 25,
        ...(comparison
          ? {
              previousValue: 22.3,
              comparison: {
                type: 'PREVIOUS_PERIOD',
                previousValue: 22.3,
                absoluteChange: 2.7,
                percentChange: 12.1,
                previousWindow: prevWindow,
              },
            }
          : {}),
        details: { numerator: 30, denominator: 120 },
        series: [
          {
            key: 'conversion_rate',
            label: L('Conversion rate', 'معدل التحويل'),
            unit: 'PERCENT',
            axis: 'LEFT',
            points: slots.map((s, i) => ({
              key: s.key,
              label: s.label,
              start: s.start,
              end: s.end,
              value: rateValues[i] ?? 25,
              ...(comparison ? { previousValue: Number(((rateValues[i] ?? 25) - 2.7).toFixed(1)) } : {}),
            })),
          },
        ],
        meta: {
          unit: 'PERCENT',
          timeBasis: 'COHORT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'MULTI_KPI': {
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'SCALAR',
        series: [
          {
            key: 'created',
            label: L('Created', 'الواردون'),
            unit: 'COUNT',
            axis: 'LEFT',
            points: [{ key: 'current', label: L('Created', 'الواردون'), value: 120 }],
          },
          {
            key: 'converted',
            label: L('Converted', 'المحوّلون'),
            unit: 'COUNT',
            axis: 'LEFT',
            points: [{ key: 'current', label: L('Converted', 'المحوّلون'), value: 30 }],
          },
          {
            key: 'rate',
            label: L('Conversion rate', 'معدل التحويل'),
            unit: 'PERCENT',
            axis: 'LEFT',
            points: [{ key: 'current', label: L('Conversion rate', 'معدل التحويل'), value: 25 }],
          },
        ],
        meta: {
          timeBasis: 'EVENT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'PROGRESS_CARD':
    case 'SEMI_CIRCLE_GAUGE':
    case 'THREE_QUARTER_GAUGE':
    case 'CIRCULAR_PROGRESS_GAUGE':
    case 'DETAILED_SPEEDOMETER':
    case 'BULLET': {
      const actual = Math.round(720000 * scale);
      const target = Math.round(1200000 * scale);
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'SCALAR',
        value: actual,
        target,
        result: undefined,
        series: [
          {
            key: 'won_value',
            label: L('Won value', 'قيمة الفرص الرابحة'),
            unit: 'MONEY',
            axis: 'LEFT',
            currency,
            points: [{ key: 'current', label: L('Won value', 'قيمة الفرص الرابحة'), value: actual }],
          },
        ],
        meta: {
          unit: 'MONEY',
          currency,
          timeBasis: 'EVENT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'AREA': {
      const created = [76, 84, 96, 100, 110, 120].map((v) => Math.round(v * jitter));
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'TIME_SERIES',
        series: [
          {
            key: 'leads_created',
            label: L('Leads created', 'العملاء المحتملون الجدد'),
            unit: 'COUNT',
            axis: 'LEFT',
            points: slots.map((s, i) => ({
              key: s.key,
              label: s.label,
              start: s.start,
              end: s.end,
              value: created[i] ?? 0,
              ...(comparison ? { previousValue: Math.round((created[i] ?? 0) * 0.88) } : {}),
            })),
          },
        ],
        meta: {
          unit: 'COUNT',
          timeBasis: 'EVENT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'LINE':
    case 'LINE_AREA':
    case 'COLUMN': {
      const created = [78, 84, 96, 100, 110, 120].map((v) => Math.round(v * jitter));
      const converted: (number | null)[] = [18, 20, null, 24, 27, 30];
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'TIME_SERIES',
        series: [
          {
            key: 'leads_created',
            label: L('Leads created', 'العملاء المحتملون الجدد'),
            unit: 'COUNT',
            axis: 'LEFT',
            points: slots.map((s, i) => ({
              key: s.key,
              label: s.label,
              start: s.start,
              end: s.end,
              value: created[i] ?? 0,
              ...(comparison ? { previousValue: Math.round((created[i] ?? 0) * 0.88) } : {}),
            })),
          },
          {
            key: 'leads_converted',
            label: L('Leads converted', 'العملاء المحوّلون'),
            unit: 'COUNT',
            axis: 'LEFT',
            points: slots.map((s, i) => {
              const val = converted[i] ?? null;
              return {
                key: s.key,
                label: s.label,
                start: s.start,
                end: s.end,
                value: val,
                ...(comparison && val !== null ? { previousValue: Math.max(1, val - 3) } : {}),
              };
            }),
          },
        ],
        meta: {
          unit: 'COUNT',
          timeBasis: 'EVENT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'CALENDAR_HEATMAP': {
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'TIME_SERIES',
        series: [
          {
            key: 'daily_leads',
            label: L('Daily leads', 'العملاء المحتملون يوميًا'),
            unit: 'COUNT',
            axis: 'LEFT',
            points: dailyCalendarPoints(rng),
          },
        ],
        meta: {
          unit: 'COUNT',
          timeBasis: 'EVENT',
          effectivePeriod: { from: '2026-09-22', to: '2026-11-21', timeZone: 'Africa/Cairo' },
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'BAR': {
      const stages = [
        { key: 'qualification', en: 'Qualification', ar: 'التأهيل', val: 1320000 },
        { key: 'proposal', en: 'Proposal', ar: 'عرض السعر', val: 1480000 },
        { key: 'negotiation', en: 'Negotiation', ar: 'التفاوض', val: 1240000 },
        { key: 'contract', en: 'Contract', ar: 'التعاقد', val: 400000 },
        { key: 'UNSPECIFIED', en: 'Unspecified', ar: 'غير محدد', val: 180000 },
      ];
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'CATEGORY',
        series: [
          {
            key: 'pipeline_value',
            label: L('Open pipeline value', 'قيمة الفرص المفتوحة'),
            unit: 'MONEY',
            axis: 'LEFT',
            currency,
            points: stages.map((st) => {
              const v = Math.round(st.val * scale);
              return {
                key: st.key,
                label: L(st.en, st.ar),
                value: v,
                ...(comparison ? { previousValue: Math.round(v * 0.9) } : {}),
              };
            }),
          },
        ],
        meta: {
          unit: 'MONEY',
          currency,
          timeBasis: 'SNAPSHOT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'PIE':
    case 'DONUT': {
      const stages = [
        { key: 'qualification', en: 'Qualification', ar: 'التأهيل', val: 22 },
        { key: 'proposal', en: 'Proposal', ar: 'عرض السعر', val: 18 },
        { key: 'negotiation', en: 'Negotiation', ar: 'التفاوض', val: 12 },
        { key: 'contract', en: 'Contract', ar: 'التعاقد', val: 6 },
      ];
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'CATEGORY',
        series: [
          {
            key: 'opportunities_by_stage',
            label: L('Opportunities', 'الفرص'),
            unit: 'COUNT',
            axis: 'LEFT',
            points: stages.map((st) => ({
              key: st.key,
              label: L(st.en, st.ar),
              value: st.val,
            })),
          },
        ],
        meta: {
          unit: 'COUNT',
          timeBasis: 'SNAPSHOT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'FUNNEL': {
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'CATEGORY',
        series: [
          {
            key: 'lead_journey',
            label: L('Lead journey', 'رحلة العميل المحتمل'),
            unit: 'COUNT',
            axis: 'LEFT',
            points: [
              { key: 'created', label: L('Created', 'وارد'), value: 120 },
              { key: 'qualified', label: L('Qualified', 'مؤهل'), value: 72 },
              { key: 'converted', label: L('Converted', 'محوّل'), value: 30 },
            ],
          },
        ],
        meta: {
          unit: 'COUNT',
          timeBasis: 'COHORT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'TABLE': {
      const stageRows = [
        { key: 'qualification', en: 'Qualification', ar: 'التأهيل', count: 22, value: Math.round(1320000 * scale) },
        { key: 'proposal', en: 'Proposal', ar: 'عرض السعر', count: 18, value: Math.round(1480000 * scale) },
        { key: 'negotiation', en: 'Negotiation', ar: 'التفاوض', count: 12, value: Math.round(1240000 * scale) },
        { key: 'contract', en: 'Contract', ar: 'التعاقد', count: 6, value: Math.round(400000 * scale) },
      ];
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'CATEGORY',
        rows: stageRows.map((r) => ({
          key: r.key,
          stage: L(r.en, r.ar),
          count: r.count,
          value: r.value,
        })),
        series: [
          {
            key: 'count',
            label: L('Opportunities', 'الفرص'),
            unit: 'COUNT',
            axis: 'LEFT',
            points: stageRows.map((r) => ({ key: r.key, label: L(r.en, r.ar), value: r.count })),
          },
          {
            key: 'value',
            label: L('Pipeline value', 'القيمة'),
            unit: 'MONEY',
            axis: 'RIGHT',
            currency,
            points: stageRows.map((r) => ({ key: r.key, label: L(r.en, r.ar), value: r.value })),
          },
        ],
        meta: {
          currency,
          timeBasis: 'SNAPSHOT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'STACKED_BAR':
    case 'STACKED_BAR_100': {
      const branches = FAKE_BRANCHES.map((b) => ({ key: b.id, label: L(b.name.en, b.name.ar) }));
      const stageDefs = [
        { key: 'qualification', en: 'Qualification', ar: 'التأهيل', vals: [120, 90, 40] },
        { key: 'proposal', en: 'Proposal', ar: 'عرض السعر', vals: [90, 70, 30] },
        { key: 'negotiation', en: 'Negotiation', ar: 'التفاوض', vals: [60, 50, 20] },
      ];
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'CATEGORY',
        series: stageDefs.map((s) => ({
          key: s.key,
          label: L(s.en, s.ar),
          unit: 'COUNT',
          axis: 'LEFT',
          points: branches.map((b, i) => ({
            key: b.key,
            label: b.label,
            value: s.vals[i] ?? 0,
          })),
        })),
        meta: {
          unit: 'COUNT',
          timeBasis: 'SNAPSHOT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'HEATMAP': {
      const weekdays = [
        { key: 'sun', en: 'Sun', ar: 'أحد', vals: [4, 9, 12, 8, 3] },
        { key: 'mon', en: 'Mon', ar: 'اثنين', vals: [6, 11, 14, 10, 5] },
        { key: 'tue', en: 'Tue', ar: 'ثلاثاء', vals: [5, 13, null, 11, 4] },
        { key: 'wed', en: 'Wed', ar: 'أربعاء', vals: [7, 10, 15, 9, 6] },
        { key: 'thu', en: 'Thu', ar: 'خميس', vals: [3, 8, 11, 7, 2] },
      ];
      const hours = ['09', '11', '13', '15', '17'];
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'CATEGORY',
        series: weekdays.map((w) => ({
          key: w.key,
          label: L(w.en, w.ar),
          unit: 'COUNT',
          axis: 'LEFT',
          points: hours.map((h, i) => ({
            key: h,
            label: `${h}:00`,
            value: w.vals[i] ?? null,
          })),
        })),
        meta: {
          unit: 'COUNT',
          timeBasis: 'EVENT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'COMBO': {
      const branches = FAKE_BRANCHES.map((b) => ({ key: b.id, label: L(b.name.en, b.name.ar) }));
      const wonCounts = [28, 19, 11];
      const winRates = [31.5, 24.0, 22.8];
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'CATEGORY',
        series: [
          {
            key: 'won_count',
            label: L('Won opportunities', 'الفرص الرابحة'),
            unit: 'COUNT',
            axis: 'LEFT',
            points: branches.map((b, i) => ({
              key: b.key,
              label: b.label,
              value: wonCounts[i] ?? 0,
              ...(comparison ? { previousValue: Math.max(1, (wonCounts[i] ?? 0) - 3) } : {}),
            })),
          },
          {
            key: 'win_rate',
            label: L('Win rate', 'معدل الربح'),
            unit: 'PERCENT',
            axis: 'RIGHT',
            points: branches.map((b, i) => ({
              key: b.key,
              label: b.label,
              value: winRates[i] ?? 0,
              ...(comparison ? { previousValue: Number(((winRates[i] ?? 0) - 1.8).toFixed(1)) } : {}),
            })),
          },
        ],
        meta: {
          timeBasis: 'EVENT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'SCATTER':
    case 'BUBBLE': {
      const deals = [
        { key: 'd1', en: 'Nile Logistics ERP', ar: 'نظام النيل للوجستيات', prob: 20, val: 90000, size: 6 },
        { key: 'd2', en: 'Delta Retail POS', ar: 'نقاط بيع الدلتا', prob: 35, val: 210000, size: 12 },
        { key: 'd3', en: 'Cairo Pharma CRM', ar: 'نظام القاهرة الدوائي', prob: 40, val: 360000, size: 18 },
        { key: 'd4', en: 'Ofoq Cloud Suite', ar: 'حزمة أفق السحابية', prob: 55, val: 150000, size: 9 },
        { key: 'd5', en: 'Alex Port Customs', ar: 'تخليص ميناء الإسكندرية', prob: 60, val: 280000, size: 14 },
        { key: 'd6', en: 'Suez Steel Portal', ar: 'بوابة السويس للصلب', prob: 70, val: 420000, size: 24 },
        { key: 'd7', en: 'Giza Agri Supply', ar: 'إمدادات الجيزة الزراعية', prob: 80, val: 390000, size: 16 },
        { key: 'd8', en: 'Red Sea Resorts', ar: 'منتجعات البحر الأحمر', prob: 90, val: 510000, size: 20 },
      ];
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'XY',
        details: {
          xLabel: L('Win probability (%)', 'احتمال الربح (%)'),
          yLabel: L(`Deal value (${currency})`, `قيمة الصفقة (${currency})`),
        },
        series: [
          {
            key: 'deals',
            label: L('Open opportunities', 'الفرص المفتوحة'),
            unit: 'MONEY',
            axis: 'LEFT',
            currency,
            points: deals.map((d) => ({
              key: d.key,
              label: L(d.en, d.ar),
              value: d.prob,
              secondaryValue: Math.round(d.val * scale),
              size: d.size,
            })),
          },
        ],
        meta: {
          unit: 'MONEY',
          currency,
          timeBasis: 'SNAPSHOT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'GANTT':
    case 'CALENDAR': {
      const items = [
        { key: 'i1', en: 'Delta Group demo', ar: 'عرض مجموعة الدلتا', start: '2026-11-02T09:00:00.000Z', end: '2026-11-05T17:00:00.000Z' },
        { key: 'i2', en: 'Nile Systems proposal', ar: 'عرض سعر شركة النيل للأنظمة', start: '2026-11-05T09:00:00.000Z', end: '2026-11-12T17:00:00.000Z' },
        { key: 'i3', en: 'Horizon security review', ar: 'المراجعة الأمنية لشركة أفق', start: '2026-11-09T09:00:00.000Z', end: '2026-11-15T17:00:00.000Z' },
        { key: 'i4', en: 'Arabia contract negotiation', ar: 'تفاوض عقد العربية للتوزيع', start: '2026-11-12T09:00:00.000Z', end: '2026-11-19T17:00:00.000Z' },
        { key: 'i5', en: 'Alex Port kickoff call', ar: 'اجتماع بدء العمل لميناء الإسكندرية', start: '2026-11-16T09:00:00.000Z', end: '2026-11-21T17:00:00.000Z' },
        { key: 'i6', en: 'Cairo Services renewal', ar: 'تجديد عقد القاهرة للخدمات', start: '2026-11-20T09:00:00.000Z', end: '2026-11-26T17:00:00.000Z' },
      ];
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'INTERVAL',
        series: [
          {
            key: 'intervals',
            label: L('Scheduled milestones', 'المواعيد والأنشطة'),
            unit: 'DURATION',
            axis: 'LEFT',
            points: items.map((it) => ({
              key: it.key,
              label: L(it.en, it.ar),
              start: it.start,
              end: it.end,
              value: Date.parse(it.end) - Date.parse(it.start),
            })),
          },
        ],
        meta: {
          unit: 'DURATION',
          timeBasis: 'CURRENT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'TIMELINE':
    case 'ACTIVITY_FEED': {
      const partialAccess = opts?.seed === 7;
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'EVENT_STREAM',
        result: {
          shape: 'EVENT_STREAM',
          partialAccess,
          events: [
            {
              id: '01934b50-0000-7000-8000-000000000001',
              occurredAt: '2026-11-21T08:45:00.000Z',
              kind: 'CONVERTED',
              title: 'Ali Hassan converted Delta Group',
              titleAr: 'حوّل علي حسن مجموعة الدلتا إلى عميل',
              description: 'Converted to opportunity #OPP-412',
              severity: 'SUCCESS',
              entityRef: { type: 'OPPORTUNITY', id: '01934b60-0000-7000-8000-000000000412', href: '/crm/opportunities/01934b60-0000-7000-8000-000000000412' },
            },
            {
              id: '01934b50-0000-7000-8000-000000000002',
              occurredAt: '2026-11-21T08:10:00.000Z',
              kind: 'CALL',
              title: 'Nada Mahmoud logged a discovery call',
              titleAr: 'سجّلت ندى محمود مكالمة استكشافية',
              description: 'Nile Systems · 14 min',
              severity: 'INFO',
              entityRef: { type: 'LEAD', id: '01934b60-0000-7000-8000-000000000105', href: '/crm/leads/01934b60-0000-7000-8000-000000000105' },
            },
            {
              id: '01934b50-0000-7000-8000-000000000003',
              occurredAt: '2026-11-21T07:30:00.000Z',
              kind: 'STAGE_CHANGE',
              title: 'Sara Kamel moved Horizon Systems to Negotiation',
              titleAr: 'نقلت سارة كامل أنظمة أفق إلى مرحلة التفاوض',
              severity: 'INFO',
              entityRef: { type: 'OPPORTUNITY', id: '01934b60-0000-7000-8000-000000000415', href: '/crm/opportunities/01934b60-0000-7000-8000-000000000415' },
            },
            {
              id: '01934b50-0000-7000-8000-000000000004',
              occurredAt: '2026-11-19T15:20:00.000Z',
              kind: 'SLA_WARNING',
              title: 'First response SLA approaching for Red Sea Trading',
              titleAr: 'اقترب انتهاء مهلة الاستجابة الأولى لشركة البحر الأحمر للتجارة',
              severity: 'WARNING',
              entityRef: { type: 'LEAD', id: '01934b60-0000-7000-8000-000000000118', href: '/crm/leads/01934b60-0000-7000-8000-000000000118' },
            },
            {
              id: '01934b50-0000-7000-8000-000000000005',
              occurredAt: '2026-11-15T11:05:00.000Z',
              kind: 'QUOTE_SENT',
              title: 'Omar Mostafa sent quotation for Cairo Logistics',
              titleAr: 'أرسل عمر مصطفى عرض السعر لشركة القاهرة للوجستيات',
              severity: 'INFO',
              entityRef: { type: 'OPPORTUNITY', id: '01934b60-0000-7000-8000-000000000419', href: '/crm/opportunities/01934b60-0000-7000-8000-000000000419' },
            },
            {
              id: '01934b50-0000-7000-8000-000000000006',
              occurredAt: '2026-11-10T14:40:00.000Z',
              kind: 'LOST',
              title: 'Alexandria Textiles deal marked lost on price',
              titleAr: 'تم إغلاق صفقة منسوجات الإسكندرية بالخسارة بسبب السعر',
              severity: 'CRITICAL',
              entityRef: { type: 'OPPORTUNITY', id: '01934b60-0000-7000-8000-000000000422', href: '/crm/opportunities/01934b60-0000-7000-8000-000000000422' },
            },
          ],
        },
        series: [],
        meta: {
          timeBasis: 'EVENT',
          effectivePeriod: EFFECTIVE_PERIOD,
          partialAccess,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'FLOWCHART': {
      const qual = L('Qualification', 'التأهيل');
      const prop = L('Proposal', 'عرض السعر');
      const neg = L('Negotiation', 'التفاوض');
      const won = L('Won', 'ربح');
      const lost = L('Lost', 'خسارة');
      const edges = [
        { source: qual, target: prop, value: 30 },
        { source: qual, target: lost, value: 10 },
        { source: prop, target: neg, value: 20 },
        { source: prop, target: lost, value: 8 },
        { source: neg, target: won, value: 12 },
        { source: neg, target: lost, value: 6 },
      ];
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'GRAPH',
        series: [
          {
            key: 'stage_flow',
            label: L('Stage transitions', 'انتقالات المراحل'),
            unit: 'COUNT',
            axis: 'LEFT',
            points: edges.map((e) => ({
              key: `${e.source}:${e.target}`,
              label: `${e.source} -> ${e.target}`,
              value: e.value,
              meta: { source: e.source, target: e.target },
            })),
          },
        ],
        meta: {
          unit: 'COUNT',
          timeBasis: 'EVENT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'TREEMAP': {
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'HIERARCHY',
        result: {
          shape: 'HIERARCHY',
          unit: 'COUNT',
          nodes: [
            { id: 'corp', label: L('Corporate', 'الشركات الكبرى'), value: 46, depth: 0 },
            { id: 'corp_bank', parentId: 'corp', label: L('Banking & Finance', 'البنوك والتمويل'), value: 26, depth: 1 },
            { id: 'corp_bank_pub', parentId: 'corp_bank', label: L('Public banks', 'البنوك الحكومية'), value: 14, depth: 2 },
            { id: 'corp_bank_prv', parentId: 'corp_bank', label: L('Private banks', 'البنوك الخاصة'), value: 12, depth: 2 },
            { id: 'corp_tech', parentId: 'corp', label: L('Telecom & Tech', 'الاتصالات والتقنية'), value: 20, depth: 1 },
            { id: 'smb', label: L('SMB', 'المنشآت الصغيرة'), value: 30, depth: 0 },
            { id: 'retail', label: L('Retail', 'التجزئة'), value: 16, depth: 0 },
            { id: 'public', label: L('Public', 'القطاع العام'), value: 8, depth: 0 },
          ],
        },
        series: [],
        meta: {
          unit: 'COUNT',
          timeBasis: 'SNAPSHOT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'HISTOGRAM': {
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'BINNED_DISTRIBUTION',
        result: {
          shape: 'BINNED_DISTRIBUTION',
          unit: 'COUNT',
          bins: [
            { key: '0-2', label: L('0–2 d', '0–2 ي'), order: 0, kind: 'STANDARD', lowerBound: 0, upperBound: 2, count: 34 },
            { key: '3-7', label: L('3–7 d', '3–7 ي'), order: 1, kind: 'STANDARD', lowerBound: 3, upperBound: 7, count: 41 },
            { key: '8-14', label: L('8–14 d', '8–14 ي'), order: 2, kind: 'STANDARD', lowerBound: 8, upperBound: 14, count: 22 },
            { key: '15-30', label: L('15–30 d', '15–30 ي'), order: 3, kind: 'STANDARD', lowerBound: 15, upperBound: 30, count: 12 },
            { key: '31+', label: L('31+ d', '31+ ي'), order: 4, kind: 'OVERFLOW', lowerBound: 31, count: 6 },
          ],
          totalCount: 115,
        },
        series: [],
        meta: {
          unit: 'COUNT',
          timeBasis: 'SNAPSHOT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'BOX_PLOT': {
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'DURATION_DISTRIBUTION',
        result: {
          shape: 'DURATION_DISTRIBUTION',
          unit: 'DURATION',
          whiskerMethod: 'MIN_MAX',
          groups: [
            {
              key: FAKE_BRANCHES[0].id,
              label: L(FAKE_BRANCHES[0].name.en, FAKE_BRANCHES[0].name.ar),
              sampleCount: 48,
              excludedCount: 2,
              min: 15,
              q1: 42,
              median: 85,
              q3: 150,
              p90: 240,
              max: 390,
            },
            {
              key: FAKE_BRANCHES[1].id,
              label: L(FAKE_BRANCHES[1].name.en, FAKE_BRANCHES[1].name.ar),
              sampleCount: 31,
              excludedCount: 1,
              min: 20,
              q1: 55,
              median: 110,
              q3: 195,
              p90: 310,
              max: 480,
            },
            {
              key: FAKE_BRANCHES[2].id,
              label: L(FAKE_BRANCHES[2].name.en, FAKE_BRANCHES[2].name.ar),
              sampleCount: 0,
              excludedCount: 0,
              min: null,
              q1: null,
              median: null,
              q3: null,
              p90: null,
              max: null,
            },
          ],
          totalCount: 79,
          excludedCount: 3,
        },
        series: [],
        meta: {
          unit: 'DURATION',
          timeBasis: 'EVENT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'WATERFALL': {
      const steps = [
        { key: 'start', label: L('Start', 'البداية'), order: 0, kind: 'START' as const, value: 3900000, cumulativeValue: 3900000 },
        { key: 'new', label: L('New', 'جديد'), order: 1, kind: 'DELTA' as const, value: 400000, cumulativeValue: 4300000 },
        { key: 'grown', label: L('Grown', 'زيادة'), order: 2, kind: 'DELTA' as const, value: 150000, cumulativeValue: 4450000 },
        { key: 'lost', label: L('Lost', 'خسارة'), order: 3, kind: 'DELTA' as const, value: -300000, cumulativeValue: 4150000 },
        { key: 'won', label: L('Won', 'ربح'), order: 4, kind: 'DELTA' as const, value: -290000, cumulativeValue: 3860000 },
        { key: 'end', label: L('End', 'النهاية'), order: 5, kind: 'TOTAL' as const, value: 3860000, cumulativeValue: 3860000 },
      ].map((s) => ({
        ...s,
        value: Math.round(s.value * scale),
        cumulativeValue: Math.round(s.cumulativeValue * scale),
      }));

      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'WATERFALL',
        result: {
          shape: 'WATERFALL',
          unit: 'MONEY',
          currencyCode: currency,
          steps,
        },
        series: [],
        meta: {
          unit: 'MONEY',
          currency,
          timeBasis: 'EVENT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'LEADERBOARD': {
      const wonValues = [940000, 780000, 620000, 510000, 430000, 350000, 280000, 190000];
      const wonCounts = [14, 11, 9, 8, 6, 5, 4, 3];
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'ROWS',
        result: {
          shape: 'ROWS',
          rowKind: 'RANKED',
          rows: FAKE_PEOPLE.map((p, idx) => ({
            id: p.id,
            rank: idx + 1,
            label: L(p.name, p.nameAr),
            primaryMeasure: {
              key: 'won_value',
              label: L('Won value', 'قيمة الفرص الرابحة'),
              value: Math.round((wonValues[idx] ?? 150000) * scale),
              unit: 'MONEY',
              currencyCode: currency,
            },
            secondaryMeasures: [
              {
                key: 'won_count',
                label: L('Deals', 'الصفقات'),
                value: wonCounts[idx] ?? 2,
                unit: 'COUNT',
              },
            ],
          })),
        },
        series: [],
        meta: {
          unit: 'MONEY',
          currency,
          timeBasis: 'EVENT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'SCORECARD': {
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'ROWS',
        result: {
          shape: 'ROWS',
          rowKind: 'SCORECARD',
          rows: [
            {
              id: 'sc-1',
              label: L('New leads', 'العملاء المحتملون الجدد'),
              status: 'ON_TRACK',
              measures: [
                {
                  key: 'leads_created',
                  label: L('New leads', 'العملاء المحتملون الجدد'),
                  value: 120,
                  unit: 'COUNT',
                  references: [{ key: 'target', label: L('Target', 'المستهدف'), kind: 'TARGET', value: 110, unit: 'COUNT' }],
                },
              ],
            },
            {
              id: 'sc-2',
              label: L('Lead conversion rate', 'معدل تحويل العملاء المحتملين'),
              status: 'AT_RISK',
              measures: [
                {
                  key: 'conversion_rate',
                  label: L('Lead conversion rate', 'معدل تحويل العملاء المحتملين'),
                  value: 25,
                  unit: 'PERCENT',
                  references: [{ key: 'target', label: L('Target', 'المستهدف'), kind: 'TARGET', value: 28, unit: 'PERCENT' }],
                },
              ],
            },
            {
              id: 'sc-3',
              label: L('Won revenue', 'إيرادات الصفقات الرابحة'),
              status: 'OFF_TRACK',
              measures: [
                {
                  key: 'won_value',
                  label: L('Won revenue', 'إيرادات الصفقات الرابحة'),
                  value: Math.round(720000 * scale),
                  unit: 'MONEY',
                  currencyCode: currency,
                  references: [
                    {
                      key: 'target',
                      label: L('Target', 'المستهدف'),
                      kind: 'TARGET',
                      value: Math.round(1200000 * scale),
                      unit: 'MONEY',
                      currencyCode: currency,
                    },
                  ],
                },
              ],
            },
            {
              id: 'sc-4',
              label: L('Activities completed', 'الأنشطة المكتملة'),
              status: 'ON_TRACK',
              measures: [
                {
                  key: 'activities_completed',
                  label: L('Activities completed', 'الأنشطة المكتملة'),
                  value: 340,
                  unit: 'COUNT',
                  references: [{ key: 'target', label: L('Target', 'المستهدف'), kind: 'TARGET', value: 300, unit: 'COUNT' }],
                },
              ],
            },
            {
              id: 'sc-5',
              label: L('Outbound email reply rate', 'معدل الرد على البريد الصادر'),
              status: 'UNKNOWN',
              measures: [
                {
                  key: 'email_reply_rate',
                  label: L('Outbound email reply rate', 'معدل الرد على البريد الصادر'),
                  value: 0,
                  unit: 'PERCENT',
                },
              ],
            },
          ],
        },
        series: [],
        meta: {
          unit: 'SCORE',
          currency,
          timeBasis: 'EVENT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }

    case 'ALERT_LIST': {
      return {
        widgetId,
        versionNumber: 1,
        widgetRevision: 1,
        state: 'READY',
        shape: 'ROWS',
        result: {
          shape: 'ROWS',
          rowKind: 'ALERT',
          partialAccess: false,
          rows: [
            {
              id: '01934b40-0000-7000-8000-000000000001',
              severity: 'CRITICAL',
              reasonCode: 'SOURCE_NOT_READY',
              title: L('Conversion rate below 20% in Alexandria', 'معدل التحويل أقل من 20% في الإسكندرية'),
              occurredAt: '2026-11-21T08:30:00.000Z',
              dueAt: '2026-11-21T17:00:00.000Z',
              entityRef: { type: 'LEAD', id: '01934b60-0000-7000-8000-000000000101', href: '/crm/leads/01934b60-0000-7000-8000-000000000101' },
            },
            {
              id: '01934b40-0000-7000-8000-000000000002',
              severity: 'WARNING',
              reasonCode: 'CALENDAR_HOURS_MISSING',
              title: L('12 leads without follow-up for 7 days', '12 عميلًا محتملًا دون متابعة منذ 7 أيام'),
              occurredAt: '2026-11-21T07:45:00.000Z',
              entityRef: { type: 'LEAD', id: '01934b60-0000-7000-8000-000000000102', href: '/crm/leads/01934b60-0000-7000-8000-000000000102' },
            },
            {
              id: '01934b40-0000-7000-8000-000000000003',
              severity: 'WARNING',
              reasonCode: 'HISTORY_INCOMPLETE',
              title: L('Stale stage transitions in Giza branch', 'تأخر تحديث تغييرات المراحل في فرع الجيزة'),
              occurredAt: '2026-11-20T16:15:00.000Z',
              entityRef: { type: 'OPPORTUNITY', id: '01934b60-0000-7000-8000-000000000401', href: '/crm/opportunities/01934b60-0000-7000-8000-000000000401' },
            },
            {
              id: '01934b40-0000-7000-8000-000000000004',
              severity: 'INFO',
              reasonCode: 'NO_BASELINE',
              title: L('Monthly quota target pacing reminder', 'تذكير بمتابعة وتيرة المستهدف الشهري'),
              occurredAt: '2026-11-20T09:00:00.000Z',
              entityRef: { type: 'OPPORTUNITY', id: '01934b60-0000-7000-8000-000000000402', href: '/crm/opportunities/01934b60-0000-7000-8000-000000000402' },
            },
          ],
        },
        series: [],
        meta: {
          unit: 'COUNT',
          timeBasis: 'CURRENT',
          effectivePeriod: EFFECTIVE_PERIOD,
          generatedAt: FAKE_NOW,
          warnings: [],
        },
      };
    }
  }
}

function defaultMetricForKind(kind: Visualization): string {
  switch (kind) {
    case 'METRIC_CARD':
      return 'crm.leads.conversion.rate';
    case 'MULTI_KPI':
      return 'crm.leads.created.total';
    case 'PROGRESS_CARD':
    case 'SEMI_CIRCLE_GAUGE':
    case 'THREE_QUARTER_GAUGE':
    case 'CIRCULAR_PROGRESS_GAUGE':
    case 'DETAILED_SPEEDOMETER':
    case 'BULLET':
      return 'crm.opportunities.won_vs_target.value';
    case 'LINE':
    case 'AREA':
    case 'LINE_AREA':
    case 'COLUMN':
      return 'crm.leads.created.count';
    case 'CALENDAR_HEATMAP':
      return 'crm.leads.daily.count';
    case 'BAR':
      return 'crm.opportunities.by_stage.value';
    case 'PIE':
    case 'DONUT':
    case 'TABLE':
      return 'crm.opportunities.by_stage.count';
    case 'FUNNEL':
    case 'STACKED_BAR':
    case 'STACKED_BAR_100':
      return 'crm.leads.by_stage.count';
    case 'HEATMAP':
      return 'crm.leads.arrival_heat.count';
    case 'COMBO':
      return 'crm.opportunities.won.count';
    case 'SCATTER':
    case 'BUBBLE':
      return 'crm.opportunities.deal_vs_probability.xy';
    case 'GANTT':
      return 'crm.opportunities.timeline.interval';
    case 'CALENDAR':
      return 'crm.activities.schedule.interval';
    case 'TIMELINE':
    case 'ACTIVITY_FEED':
      return 'crm.activities.feed.events';
    case 'FLOWCHART':
      return 'crm.opportunities.stage_flow.count';
    case 'TREEMAP':
      return 'crm.customers.by_segment.hierarchy';
    case 'HISTOGRAM':
      return 'crm.leads.aging.bins';
    case 'BOX_PLOT':
      return 'crm.leads.first_response.duration';
    case 'WATERFALL':
      return 'crm.opportunities.pipeline_movement.value';
    case 'LEADERBOARD':
      return 'crm.team.leaderboard.rows';
    case 'SCORECARD':
      return 'crm.team.scorecard.rows';
    case 'ALERT_LIST':
      return 'crm.alerts.open.rows';
  }
}

const ORGANIZATION_SELECTION_LIMIT = 500;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** One id format per filter (single or list), distinct v7 ids, at most 500; otherwise 422 like the backend. */
function selectedOrganizationIds(single: string | undefined, multiple: string[] | undefined): string[] | undefined {
  if (multiple === undefined) return single ? [single.toLowerCase()] : undefined;
  if (
    !single &&
    multiple.length > 0 &&
    multiple.length <= ORGANIZATION_SELECTION_LIMIT &&
    multiple.every((id) => typeof id === 'string' && UUID_V7.test(id))
  ) {
    const ids = multiple.map((id) => id.toLowerCase()).sort();
    if (new Set(ids).size === ids.length) return ids;
  }
  throw new ApiError(422, 'CRM_DASHBOARD_FILTER_INVALID');
}

/**
 * Fake of readDashboardOrganizationScope: options narrowed to the branches the viewer reads, 403 for a
 * company or branch outside them, `partialAccess` when the viewer reads fewer branches than the dashboard covers.
 */
export function fakeOrganizationScope(
  filters: RuntimeFilters,
  readableBranchIds: readonly string[] = FAKE_BRANCHES.map((b) => b.id),
): DashboardOrganizationScope {
  const companyIds = selectedOrganizationIds(filters.companyId, filters.companyIds);
  const branchIds = selectedOrganizationIds(filters.branchId, filters.branchIds);
  const companyName = new Map(FAKE_COMPANIES.map((c) => [c.id, L(c.name.en, c.name.ar)]));
  const branches = FAKE_BRANCHES.filter((b) => readableBranchIds.includes(b.id))
    .map((b) => ({ id: b.id, name: L(b.name.en, b.name.ar), companyId: b.companyId, companyName: companyName.get(b.companyId) ?? '' }))
    .sort((a, b) => a.companyName.localeCompare(b.companyName) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const eligible = companyIds ? branches.filter((b) => companyIds.includes(b.companyId)) : branches;
  const eligibleCompanies = new Set(eligible.map((b) => b.companyId));
  const selectedCount = branchIds ? eligible.filter((b) => branchIds.includes(b.id)).length : eligible.length;
  if (companyIds?.some((id) => !eligibleCompanies.has(id)) || (branchIds && branchIds.length !== selectedCount)) {
    throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  }
  const companies = [...new Map(branches.map((b) => [b.companyId, { id: b.companyId, name: b.companyName }])).values()];
  return {
    companyId: filters.companyId?.toLowerCase() ?? null,
    branchId: filters.branchId?.toLowerCase() ?? null,
    ...(filters.companyIds !== undefined ? { companyIds } : {}),
    ...(filters.branchIds !== undefined ? { branchIds } : {}),
    companies,
    branches,
    partialAccess: branches.length < FAKE_BRANCHES.length,
  };
}

export function fakeDashboardRun(
  dashboardId: string,
  revision: number,
  placements: { widgetId: string; kind: Visualization; state?: ExecutionState }[],
  filters: RuntimeFilters,
  readableBranchIds?: readonly string[],
): DashboardRun {
  const organizationScope = fakeOrganizationScope(filters, readableBranchIds);
  const currency = filters.currencyCode === 'USD' ? 'USD' : 'EGP';
  const comparison = Boolean(filters.compare && filters.compare !== 'NONE');
  const widgets: Record<string, WidgetExecution> = {};
  const panels: PanelOutcome[] = [];
  const appliedWidgetIds: string[] = [];
  const skippedWidgetIds: string[] = [];

  for (const placement of placements) {
    const exec = fakeExecution(placement.kind, {
      id: placement.widgetId,
      state: placement.state ?? 'READY',
      currency,
      comparison,
    });
    widgets[placement.widgetId] = exec;

    const panelState = executionStateToPanel(exec.state);
    const metricKey = defaultMetricForKind(placement.kind);
    const outcome: PanelOutcome = {
      panelKey: placement.widgetId,
      metricKeys: [metricKey],
      state: panelState,
      shape: exec.shape,
      ...(exec.error
        ? (() => {
            const colonIdx = exec.error.code.indexOf(':');
            const src = colonIdx >= 0 ? exec.error.code.slice(colonIdx + 1) : '';
            return {
              unavailable: {
                reasonCode: exec.error.code,
                ...(src ? { sourceKey: src } : {}),
              },
            };
          })()
        : {}),
      cached: false,
      computedAt: FAKE_NOW,
      durationMs: 0,
    };
    panels.push(outcome);

    if (comparison) {
      if (exec.shape === 'SCALAR' || exec.shape === 'TIME_SERIES' || exec.shape === 'CATEGORY') {
        appliedWidgetIds.push(placement.widgetId);
      } else {
        skippedWidgetIds.push(placement.widgetId);
      }
    }
  }

  return {
    dashboardId,
    revision,
    filters,
    generatedAt: FAKE_NOW,
    scope: [{ branchId: FAKE_BRANCHES[0].id, scope: 'ALL' }],
    populationScope: {
      state: 'READY',
      teamIds: FAKE_TEAMS.map((t) => t.id),
      ownerUserIds: FAKE_PEOPLE.map((p) => p.id),
      teams: FAKE_TEAMS.map((t) => ({
        id: t.id,
        name: L(t.name.en, t.name.ar),
        branchIds: [t.branchId],
      })),
      owners: FAKE_PEOPLE.map((p) => ({
        id: p.id,
        name: L(p.name, p.nameAr),
        branchIds: [p.branchId],
      })),
    },
    organizationScope,
    widgets,
    unavailablePlacements: [],
    ...(comparison && filters.compare && filters.compare !== 'NONE'
      ? {
          comparisonCompatibility: {
            requestedTypes: [filters.compare],
            appliedWidgetIds,
            partiallyAppliedWidgetIds: [],
            skippedWidgetIds,
          },
        }
      : {}),
    panels,
    receipts: { runId: fakeId(), receiptIds: [] },
  };
}

function panelStateToExecutionState(state: PanelState): ExecutionState {
  switch (state) {
    case 'READY':
    case 'PARTIAL':
      return 'READY';
    case 'EMPTY':
      return 'EMPTY';
    case 'RETIRED':
      return 'RETIRED';
    case 'TIMEOUT':
      return 'DEADLINE_EXCEEDED';
    case 'ERROR':
      return 'FAILED';
    case 'UNAVAILABLE':
    case 'DENIED':
      return 'UNAVAILABLE';
  }
}

export function fakePanel(
  panelKey: string,
  title: { en: string; ar: string },
  kind: Visualization,
  opts?: { state?: PanelState; reasonCode?: string; coverage?: PanelCoverage },
): Panel {
  const panelState: PanelState = opts?.state ?? 'READY';
  const execState = panelStateToExecutionState(panelState);
  const exec = fakeExecution(kind, { id: panelKey, state: execState });
  const metricKey = defaultMetricForKind(kind);

  const reasonCode =
    opts?.reasonCode ??
    (panelState === 'DENIED' ? 'CRM_SCOPED_PERMISSION_DENIED' : exec.error?.code ?? undefined);
  const colonIdx = reasonCode ? reasonCode.indexOf(':') : -1;
  const sourceKey = reasonCode && colonIdx >= 0 ? reasonCode.slice(colonIdx + 1) || undefined : undefined;

  const receiptId = fakeReceipt(metricKey, {
    panelKey,
    value: exec.value ?? exec.series[0]?.points[0]?.value ?? null,
    numerator: typeof exec.details?.['numerator'] === 'number' ? exec.details['numerator'] : undefined,
    denominator: typeof exec.details?.['denominator'] === 'number' ? exec.details['denominator'] : undefined,
    unit: exec.meta.unit ?? exec.series[0]?.unit ?? 'COUNT',
    currencyCode: exec.meta.currency ?? exec.series[0]?.currency,
  });

  const table =
    kind === 'TABLE' && (panelState === 'READY' || panelState === 'PARTIAL') && exec.rows
      ? {
          columns: [
            { key: 'stage', label: { en: 'Stage', ar: 'المرحلة' }, unit: 'TEXT' as const, reconciles: true },
            { key: 'count', label: { en: 'Opportunities', ar: 'الفرص' }, unit: 'COUNT' as const, reconciles: true },
            { key: 'value', label: { en: 'Pipeline value', ar: 'قيمة الفرص' }, unit: 'MONEY' as const, reconciles: true },
          ],
          rows: exec.rows.map((r) => [r['stage'], r['count'], r['value']]),
          totals: [
            L('Total', 'الإجمالي'),
            exec.rows.reduce((sum, r) => sum + Number(r['count'] ?? 0), 0),
            exec.rows.reduce((sum, r) => sum + Number(r['value'] ?? 0), 0),
          ],
          reconciles: true,
          pageInfo: { limit: 20, hasMore: false, nextCursor: null },
        }
      : undefined;

  return {
    panelKey,
    title,
    visualization: kind,
    metricKeys: [metricKey],
    state: panelState,
    ...(reasonCode
      ? {
          unavailable: {
            reasonCode,
            ...(sourceKey ? { sourceKey } : {}),
          },
        }
      : {}),
    ...(opts?.coverage ? { coverage: opts.coverage } : {}),
    result: exec,
    ...(table ? { table } : {}),
    drill: { kind: 'RECORDS', recordType: 'OPPORTUNITY' },
    pageable: kind === 'TABLE' || isChartKind(kind),
    pinnable: kind === 'TABLE' || isChartKind(kind),
    experimental: false,
    receiptId,
    cached: false,
    computedAt: FAKE_NOW,
    durationMs: 42,
  };
}

function scaleNumber(v: number, factor: number): number {
  const scaled = v * factor;
  return Number.isInteger(v) ? Math.max(0, Math.round(scaled)) : Math.max(0, Number(scaled.toFixed(2)));
}

export function scaleExecutionByFactor(exec: WidgetExecution, factor: number): WidgetExecution {
  const clamped = Math.max(0, factor);
  const series = exec.series.map((s) => ({
    ...s,
    points: s.points.map((pt) => ({
      ...pt,
      value: pt.value === null ? null : scaleNumber(pt.value, clamped),
      ...(pt.previousValue !== undefined ? { previousValue: scaleNumber(pt.previousValue, clamped) } : {}),
    })),
  }));
  const rows = exec.rows?.map((r) => {
    const next: Record<string, unknown> = { ...r };
    for (const [k, val] of Object.entries(next)) {
      if (typeof val === 'number') next[k] = scaleNumber(val, clamped);
    }
    return next;
  });
  return {
    ...exec,
    ...(exec.value !== undefined ? { value: exec.value === null ? null : scaleNumber(exec.value, clamped) } : {}),
    ...(exec.previousValue !== undefined ? { previousValue: scaleNumber(exec.previousValue, clamped) } : {}),
    ...(rows ? { rows } : {}),
    series,
  };
}

export function applyFakeFilterTreeScaling(exec: WidgetExecution, leafCount: number): WidgetExecution {
  if (leafCount <= 0) return exec;
  const factor = Math.max(0, 1 - leafCount * 0.1);
  return scaleExecutionByFactor(exec, factor);
}

export function applyFakeCalculation(
  exec: WidgetExecution,
  operation: 'RATIO' | 'DIFFERENCE',
  numerator: number,
  denominator: number,
  operandMetricKey: string,
  unit: SeriesUnit,
): WidgetExecution {
  const rawValue = operation === 'RATIO' ? (denominator === 0 ? null : numerator / denominator) : numerator - denominator;
  const resultUnit: SeriesUnit = operation === 'RATIO' ? 'RATIO' : unit;
  const { numerator: _dropN, denominator: _dropD, ...restDetails } = exec.details ?? {};
  const calculation: CalculationDetails = {
    operation,
    operandMetricKey,
    numerator,
    denominator,
    value: rawValue,
  };
  const firstSeries = exec.series[0];
  const basePoints = firstSeries?.points ?? [];
  const nextSeries = firstSeries
    ? [
        {
          ...firstSeries,
          unit: resultUnit,
          ...(operation === 'RATIO' ? { currency: undefined } : {}),
          points: basePoints.map((pt, idx) => {
            if (rawValue === null) return { ...pt, value: null };
            const wave = operation === 'RATIO' ? 0.92 + ((idx % 4) * 0.05) : 0.85 + ((idx % 4) * 0.1);
            const ptVal =
              operation === 'RATIO'
                ? Number((rawValue * wave).toFixed(4))
                : Number.isInteger(rawValue)
                  ? Math.round(rawValue * wave)
                  : Number((rawValue * wave).toFixed(2));
            return { ...pt, value: ptVal };
          }),
        },
      ]
    : [];

  return {
    ...exec,
    value: rawValue,
    series: nextSeries,
    details: { ...restDetails, calculation },
    meta: {
      ...exec.meta,
      unit: resultUnit,
      ...(operation === 'RATIO' ? { currency: undefined } : {}),
    },
  };
}

export function applyFakeTeamDatasets(
  baseExec: WidgetExecution,
  teams: { teamId: string; label: string }[],
): WidgetExecution {
  if (!TEAM_HISTORY_READY) {
    return {
      ...baseExec,
      state: 'UNAVAILABLE',
      value: null,
      series: [],
      error: { code: 'SOURCE_NOT_READY', sourceKey: 'core.team_membership_history' },
      meta: {
        ...baseExec.meta,
        warnings: Array.from(new Set([...(baseExec.meta.warnings ?? []), 'SOURCE_NOT_READY'])),
      },
    };
  }

  const slots = monthSlots();
  const templatePoints: WidgetPoint[] = baseExec.series[0]?.points?.length
    ? baseExec.series[0].points
    : slots.map((s, i) => ({
        key: s.key,
        label: s.label,
        start: s.start,
        end: s.end,
        value: 14 + i * 3,
      }));
  const baseUnit: SeriesUnit = baseExec.series[0]?.unit ?? 'COUNT';
  const currency = baseExec.series[0]?.currency ?? baseExec.meta.currency;

  const series = teams.map((team, idx) => {
    const scale = 1 - idx * 0.18;
    const points = templatePoints.map((pt, pIdx) => ({
      ...pt,
      value: pt.value === null ? null : Math.max(0, Math.round(pt.value * scale + ((pIdx + idx) % 3))),
    }));
    return {
      key: `dataset-${idx + 1}`,
      label: team.label,
      unit: baseUnit,
      axis: 'LEFT' as const,
      ...(currency && baseUnit === 'MONEY' ? { currency } : {}),
      points,
    };
  });

  const unionCount = teams.length >= 3 ? 4 : 3;
  const overlapCount = 1;
  const datasetComparison: DatasetComparisonDetails = {
    basis: 'TEAM',
    teamBasis: 'AT_CONVERSION',
    unionCount,
    overlapCount,
    entries: teams.map((team, idx) => ({
      key: `dataset-${idx + 1}`,
      label: team.label,
      state: 'READY',
      total: 2,
    })),
  };

  return {
    ...baseExec,
    state: 'READY',
    ...(baseExec.shape === 'SCALAR' ? { value: 2 } : {}),
    series,
    details: {
      ...(baseExec.details ?? {}),
      datasetComparison,
    },
  };
}

export function applyFakeCrossFilters(
  exec: WidgetExecution,
  dimKey: string | undefined,
  crossFilters: CrossFilter[],
): WidgetExecution {
  if (!crossFilters.length || exec.state !== 'READY') return exec;
  const matching = crossFilters.find((cf) => cf.field === dimKey);
  if (matching && exec.shape === 'CATEGORY' && exec.series.length) {
    const picked = new Set(matching.values);
    const hasExactPoint = exec.series.some((s) => s.points.some((p) => picked.has(p.key)));
    if (hasExactPoint) {
      return {
        ...exec,
        series: exec.series.map((s) => ({
          ...s,
          points: s.points.filter((p) => picked.has(p.key)),
        })),
      };
    }
  }
  return scaleExecutionByFactor(exec, Math.pow(0.4, crossFilters.length));
}

const PREVIEW_RESOURCES: readonly SharePreviewResource[] = [
  'leads',
  'opportunities',
  'activities',
  'customer_profiles',
  'targets',
];

export function fakeSharePreview(
  subjectType: 'USER' | 'TEAM',
  subjectId: string,
  opts?: { existingAccessLevel?: 'VIEW' | 'EDIT'; isOwner?: boolean; metricKeys?: readonly string[] },
): SharePreview {
  const preview = fakeSharePreviewBase(subjectType, subjectId, opts);
  // Retired or unavailable metrics are skipped by the preview and listed, never silently dropped.
  const skippedMetrics = Array.from(new Set(opts?.metricKeys ?? []))
    .map((metricKey) => ({ metricKey, metric: FAKE_CATALOG.metrics.find((m) => m.key === metricKey) }))
    .filter(({ metric }) => metric !== undefined && metric.availability !== 'AVAILABLE')
    .map(({ metricKey, metric }) => ({
      metricKey,
      state: metric!.availability === 'RETIRED' ? ('RETIRED' as const) : ('UNAVAILABLE' as const),
      reasonCode: metric!.unavailableReason ?? (metric!.availability === 'RETIRED' ? 'METRIC_RETIRED' : 'METRIC_UNAVAILABLE'),
    }));
  return skippedMetrics.length > 0 ? { ...preview, skippedMetrics } : preview;
}

function fakeSharePreviewBase(
  subjectType: 'USER' | 'TEAM',
  subjectId: string,
  opts?: { existingAccessLevel?: 'VIEW' | 'EDIT'; isOwner?: boolean },
): SharePreview {
  if (subjectType === 'TEAM') {
    if (subjectId === FAKE_ALL_STAFF_TEAM_ID) {
      throw new ApiError(422, 'CRM_SHARE_PREVIEW_LIMIT_EXCEEDED');
    }
    if (subjectId === FAKE_EMPTY_TEAM_ID) {
      return {
        subjectType: 'TEAM',
        subjectId,
        state: 'EMPTY',
        evaluation: 'COMMON_TEAM_ACCESS',
        definitionAccessLevel: 'NONE',
        sources: [],
      };
    }
    const teamIdx = Math.max(0, FAKE_TEAMS.findIndex((t) => t.id === subjectId));
    const commonScope: SharePreviewScope = teamIdx % 2 === 0 ? 'team' : 'branch';
    return {
      subjectType: 'TEAM',
      subjectId,
      state: 'READY',
      evaluation: 'COMMON_TEAM_ACCESS',
      definitionAccessLevel: opts?.isOwner ? 'OWNER' : opts?.existingAccessLevel ?? 'NONE',
      sources: PREVIEW_RESOURCES.map((resource, i) => ({
        resource,
        granted: resource !== 'targets',
        scope: resource === 'targets' ? null : i === 0 ? commonScope : 'team',
        variesByMember: resource === 'opportunities',
      })),
    };
  }

  const personIdx = FAKE_PEOPLE.findIndex((p) => p.id === subjectId);
  const idx = personIdx >= 0 ? personIdx : hashString(subjectId);
  return {
    subjectType: 'USER',
    subjectId,
    state: 'READY',
    evaluation: 'CURRENT_USER_ACCESS',
    definitionAccessLevel: opts?.isOwner ? 'OWNER' : opts?.existingAccessLevel ?? 'NONE',
    sources: PREVIEW_RESOURCES.map((resource, rIdx) => {
      const granted = idx === 0 || ((idx + rIdx) % 3 !== 0);
      const scope: SharePreviewScope | null = !granted
        ? null
        : idx === 0
          ? 'all'
          : (['own', 'team', 'branch', 'all'] as const)[(idx + rIdx) % 4];
      return {
        resource,
        granted,
        scope,
        variesByMember: false,
      };
    }),
  };
}
