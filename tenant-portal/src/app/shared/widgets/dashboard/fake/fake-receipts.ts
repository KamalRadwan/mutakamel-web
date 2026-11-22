import { FAKE_NOW, fakeId } from '../analytics-api';
import type { Explain, Operand, Receipt } from '../analytics.model';
import { FAKE_CATALOG } from './fake-catalog';

const RECEIPTS = new Map<string, Receipt>();
const EXPLAINS = new Map<string, Explain>();

export interface FakeReceiptOpts {
  reportKey?: string;
  panelKey?: string;
  dashboardId?: string;
  widgetId?: string;
  value: number | null;
  numerator?: number;
  denominator?: number;
  unit: string;
  currencyCode?: string;
}

function toDecimalString(v: number | null | undefined): string | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return String(v);
}

export function fakeReceipt(metricKey: string, opts: FakeReceiptOpts): string {
  const id = fakeId();
  const metric = FAKE_CATALOG.metrics.find((m) => m.key === metricKey);
  const period = { from: '2026-11-01', to: '2026-11-21' };
  const coverage: Receipt['coverage'] = {
    coverageStartedAt: '2025-01-01T00:00:00.000Z',
    historyIncomplete: false,
  };

  // Win rate by owner or source lists many closed opportunities: its evidence passes 12 KB and is cut.
  const evidenceTruncated = metricKey === 'crm.opportunities.win.rate';

  const receipt: Receipt = {
    id,
    runId: fakeId(),
    executionKind: opts.reportKey ? 'REPORT_PANEL' : 'WIDGET_RUN',
    metricKey,
    reportKey: opts.reportKey ?? null,
    panelKey: opts.panelKey ?? null,
    dashboardId: opts.dashboardId ?? null,
    widgetId: opts.widgetId ?? null,
    executedAt: FAKE_NOW,
    asOf: FAKE_NOW,
    period,
    filters: opts.currencyCode ? { currencyCode: opts.currencyCode } : {},
    resultStatus: opts.value === null ? 'EMPTY' : 'OK',
    unavailableReasonCode: null,
    coverage,
    result: {
      value: toDecimalString(opts.value),
      numerator: toDecimalString(opts.numerator),
      denominator: toDecimalString(opts.denominator),
      unit: opts.unit,
      currencyCode: opts.currencyCode ?? null,
      rowCount: opts.value === null ? 0 : 1,
    },
    ...(evidenceTruncated ? { evidenceTruncated: true as const } : {}),
    durationMs: 42,
  };

  const numerator: Operand | null =
    opts.numerator !== undefined
      ? { value: toDecimalString(opts.numerator), labelKey: 'analytics.common.ofTotal', drillRef: 'numerator' }
      : null;

  const denominator: Operand | null =
    opts.denominator !== undefined
      ? { value: toDecimalString(opts.denominator), labelKey: 'analytics.common.ofTotal', drillRef: 'denominator' }
      : null;

  const explain: Explain = {
    receiptId: id,
    definition: {
      metricKey,
      formulaKey: metric?.formulaKey ?? 'CUSTOM_METRIC_FORMULA',
      version: 1,
      unit: opts.unit,
      timeModel: metric?.timeModel ?? 'EVENT',
      dateField: metric?.dateField ?? 'CREATED_AT',
      currencyPolicy: metric?.currencyPolicy ?? (opts.currencyCode ? 'SPLIT_BY_CURRENCY' : 'NOT_APPLICABLE'),
      emptyValuePolicy: metric?.emptyValuePolicy ?? 'ZERO',
      basis: metric?.readiness.basis ?? 'EVENT',
      sources: metric?.readiness.sources ?? [{ sourceKey: 'crm.leads.current', mode: 'REQUIRED' }],
    },
    filters: receipt.filters,
    scope: {
      fingerprint: 'scope:cairo-all-v1',
      period,
      asOf: FAKE_NOW,
    },
    coverage,
    ...(evidenceTruncated ? { evidenceTruncated: true as const } : {}),
    numerator,
    denominator,
    value: {
      value: toDecimalString(opts.value),
      labelKey: null,
      drillRef: 'value',
    },
  };

  RECEIPTS.set(id, receipt);
  EXPLAINS.set(id, explain);
  return id;
}

export function findReceipt(id: string): Receipt | undefined {
  return RECEIPTS.get(id);
}

export function findExplain(id: string): Explain | undefined {
  return EXPLAINS.get(id);
}
