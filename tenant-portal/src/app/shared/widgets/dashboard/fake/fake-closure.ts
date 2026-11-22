import { toMoneyString } from '../../../ui/money/money-format';
import { can } from '../analytics-permissions';
import { OTHER_BUCKET_KEY, type GovernedTargetResult, type WidgetExecution, type WidgetPoint } from '../analytics.model';
import { FAKE_PEOPLE, fakeLang } from './fake-org';

/**
 * Fakes of the backend closure rules: the folded OTHER bucket, win rate shapes,
 * governed targets (money as 2-decimal strings) and the seeded panel meta.
 */

function L(en: string, ar: string): string {
  return fakeLang() === 'ar' ? ar : en;
}

interface Bucket {
  key: string;
  label: string;
  value: number;
  numerator?: number;
  denominator?: number;
}

function toPoint(b: Bucket, extra?: Record<string, unknown>): WidgetPoint {
  const hasRate = b.numerator !== undefined && b.denominator !== undefined;
  return {
    key: b.key,
    label: b.label,
    value: b.value,
    ...(hasRate || extra ? { meta: { ...(hasRate ? { numerator: b.numerator, denominator: b.denominator } : {}), ...extra } } : {}),
  };
}

/**
 * Keeps the top N buckets and folds the tail into OTHER.
 * Ratios fold by pooling (sum of numerators over sum of denominators); UNSPECIFIED always comes last.
 */
function foldBuckets(buckets: Bucket[], topN: number | undefined, groupRest: boolean): WidgetPoint[] {
  const unspecified = buckets.find((b) => b.key === 'UNSPECIFIED');
  const ranked = buckets.filter((b) => b.key !== 'UNSPECIFIED').sort((a, b) => b.value - a.value);
  const limit = topN !== undefined && topN > 0 ? topN : ranked.length;
  const head = ranked.slice(0, limit);
  const tail = ranked.slice(limit);

  const points = head.map((b) => toPoint(b));
  if (groupRest && tail.length > 0) {
    const pooled = tail.every((b) => b.numerator !== undefined && b.denominator !== undefined);
    const numerator = tail.reduce((sum, b) => sum + (b.numerator ?? 0), 0);
    const denominator = tail.reduce((sum, b) => sum + (b.denominator ?? 0), 0);
    const value = pooled
      ? denominator === 0
        ? 0
        : Number(((numerator / denominator) * 100).toFixed(1))
      : tail.reduce((sum, b) => sum + b.value, 0);
    points.push(
      toPoint(
        {
          key: OTHER_BUCKET_KEY,
          label: L('Other', 'أخرى'),
          value,
          ...(pooled ? { numerator, denominator } : {}),
        },
        { foldedBucketCount: tail.length },
      ),
    );
  } else {
    points.push(...tail.map((b) => toPoint(b)));
  }
  if (unspecified) points.push(toPoint(unspecified));
  return points;
}

/** Top-N with the folded OTHER bucket on a category result. */
export function applyFakeTopN(exec: WidgetExecution, topN: number | undefined, groupRest: boolean): WidgetExecution {
  if (exec.shape !== 'CATEGORY' || exec.series.length === 0 || (topN === undefined && !groupRest)) return exec;
  return {
    ...exec,
    series: exec.series.map((s) => ({
      ...s,
      points: foldBuckets(
        s.points.map((p) => ({ key: p.key, label: p.label, value: p.value ?? 0 })),
        topN,
        groupRest,
      ),
    })),
  };
}

const SOURCE_LABELS: { key: string; en: string; ar: string }[] = [
  { key: 'WEBSITE', en: 'Website', ar: 'الموقع الإلكتروني' },
  { key: 'REFERRAL', en: 'Referral', ar: 'إحالة' },
  { key: 'OUTBOUND', en: 'Outbound call', ar: 'مكالمة صادرة' },
  { key: 'LINKEDIN', en: 'LinkedIn', ar: 'لينكدإن' },
  { key: 'TRADE_SHOW', en: 'Trade show', ar: 'معرض تجاري' },
  { key: 'PARTNER', en: 'Partner', ar: 'شريك' },
  { key: 'EMAIL', en: 'Email campaign', ar: 'حملة بريدية' },
  { key: 'UNSPECIFIED', en: 'Unspecified', ar: 'غير محدد' },
];

const MONTHS: { key: string; en: string; ar: string }[] = [
  { key: '2026-06', en: 'Jun', ar: 'يونيو' },
  { key: '2026-07', en: 'Jul', ar: 'يوليو' },
  { key: '2026-08', en: 'Aug', ar: 'أغسطس' },
  { key: '2026-09', en: 'Sep', ar: 'سبتمبر' },
  { key: '2026-10', en: 'Oct', ar: 'أكتوبر' },
  { key: '2026-11', en: 'Nov', ar: 'نوفمبر' },
];

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(1));
}

/**
 * Win rate (crm.opportunities.win.rate): a scalar, BAR by owner or source, LINE by time.
 * A dimensioned result also carries the scalar `value` (pooled overall rate) beside the points,
 * and every point carries meta.numerator / meta.denominator.
 */
export function applyFakeWinRate(
  exec: WidgetExecution,
  dimensionKey: string | undefined,
  topN?: number,
  groupRest = false,
): WidgetExecution {
  if (exec.state !== 'READY') return exec;
  const label = L('Win rate', 'معدل ربح الفرص');

  let buckets: Bucket[] = [];
  let shape: WidgetExecution['shape'] = 'SCALAR';
  if (dimensionKey === 'owner') {
    shape = 'CATEGORY';
    buckets = FAKE_PEOPLE.map((p, i) => {
      const denominator = 14 + ((i * 7) % 19);
      const numerator = Math.max(1, Math.round(denominator * (0.18 + ((i * 5) % 11) / 40)));
      return { key: p.id, label: L(p.name, p.nameAr), value: rate(numerator, denominator), numerator, denominator };
    });
  } else if (dimensionKey === 'source') {
    shape = 'CATEGORY';
    buckets = SOURCE_LABELS.map((s, i) => {
      const denominator = 9 + ((i * 5) % 17);
      const numerator = Math.max(1, Math.round(denominator * (0.15 + ((i * 3) % 9) / 36)));
      return { key: s.key, label: L(s.en, s.ar), value: rate(numerator, denominator), numerator, denominator };
    });
  } else if (dimensionKey === 'time') {
    shape = 'TIME_SERIES';
    buckets = MONTHS.map((m, i) => {
      const denominator = 30 + i * 3;
      const numerator = 8 + ((i * 3) % 7) + i;
      return { key: m.key, label: L(m.en, m.ar), value: rate(numerator, denominator), numerator, denominator };
    });
  }

  const totalNumerator = buckets.length > 0 ? buckets.reduce((s, b) => s + (b.numerator ?? 0), 0) : 33;
  const totalDenominator = buckets.length > 0 ? buckets.reduce((s, b) => s + (b.denominator ?? 0), 0) : 120;
  const overall = rate(totalNumerator, totalDenominator);

  const points =
    shape === 'TIME_SERIES'
      ? buckets.map((b) => toPoint(b))
      : shape === 'CATEGORY'
        ? foldBuckets(buckets, topN, groupRest)
        : [];

  const first = exec.series[0];
  return {
    ...exec,
    shape,
    value: overall,
    details: { ...(exec.details ?? {}), numerator: totalNumerator, denominator: totalDenominator },
    series: [
      {
        key: 'win_rate',
        label,
        unit: 'PERCENT',
        axis: first?.axis ?? 'LEFT',
        points,
      },
    ],
    meta: { ...exec.meta, unit: 'PERCENT', timeBasis: 'EVENT' },
  };
}

export type FakeTargetScenario = 'PACE_UNAVAILABLE' | 'TARGET_NOT_SET';

export interface FakeGovernedTargetInput {
  unit: 'MONEY' | 'PERCENT';
  /** The target's currency (money only). */
  currencyCode?: string;
  /** The currency the run displays. A target in another currency is TARGET_NOT_SET. */
  displayCurrency: string;
  /** Decimal string of the approved target, or null when none exists. */
  targetValue: string | null;
  scenario?: FakeTargetScenario;
}

/**
 * Governed target output. Money fields are 2-decimal strings. Pace follows the branch working calendar:
 * with no calendar it is UNAVAILABLE with CALENDAR_HOURS_MISSING while target and attainment stay shown.
 * A rate target returns attainment plus gapPercentagePoints and no pace.
 */
export function applyFakeGovernedTarget(exec: WidgetExecution, input: FakeGovernedTargetInput): WidgetExecution {
  if (exec.state !== 'READY') return exec;
  const money = input.unit === 'MONEY';
  const rawActual = exec.value ?? exec.series[0]?.points[0]?.value ?? 0;
  const actual = money ? Math.round(rawActual * 100) / 100 : rawActual;
  const actualValue = money ? toMoneyString(actual) : toMoneyString(rawActual);

  const warnings: string[] = [];
  let state: GovernedTargetResult['state'] = 'READY';
  let targetValue = input.targetValue;
  const currencyMismatch = money && Boolean(input.currencyCode) && input.currencyCode !== input.displayCurrency;

  if (!can('crm.targets.read')) {
    state = 'SOURCE_PERMISSION_REQUIRED';
    targetValue = null;
    warnings.push('SOURCE_PERMISSION_REQUIRED');
  } else if (targetValue === null || input.scenario === 'TARGET_NOT_SET' || currencyMismatch) {
    state = 'TARGET_NOT_SET';
    targetValue = null;
    warnings.push('TARGET_NOT_SET');
    if (currencyMismatch) warnings.push('OTHER_CURRENCIES');
  }

  const remaining = targetValue !== null ? Math.max(0, Number(targetValue) - actual) : null;
  const paceUnavailable = money && input.scenario === 'PACE_UNAVAILABLE';
  if (paceUnavailable && targetValue !== null) warnings.push('CALENDAR_HOURS_MISSING');

  // Shape of the backend GovernedTargetWidgetEvidence; every amount is a decimal string.
  const result: GovernedTargetResult = {
    state,
    basis: 'RECORDED_WON_EVENT',
    measure: 'ATTAINMENT',
    currencyCode: input.currencyCode ?? input.displayCurrency,
    periodStart: '2026-11-01',
    periodEndExclusive: '2026-12-01',
    periodState: 'OPEN',
    coverageStartedAt: null,
    revision: targetValue !== null ? 1 : null,
    targetMeasure: money ? 'MONEY' : 'RATE',
    grain: 'MONTH',
    amounts:
      targetValue === null
        ? null
        : {
            targetValue,
            actualValue,
            attainmentPercent:
              Number(targetValue) === 0 ? null : ((actual / Number(targetValue)) * 100).toFixed(1),
            remainingValue: money && remaining !== null ? toMoneyString(remaining) : null,
            excludedCount: 0,
          },
    workingPace:
      money && targetValue !== null
        ? {
            state: paceUnavailable ? 'CALENDAR_UNAVAILABLE' : 'READY',
            calendarRevision: paceUnavailable ? null : 1,
            remainingWorkdays: paceUnavailable ? null : 6,
            requiredPerWorkday: paceUnavailable || remaining === null ? null : toMoneyString(remaining / 6),
          }
        : null,
    elapsedPace:
      targetValue === null
        ? null
        : !money
          ? { state: 'NOT_PRORATED', reason: null, workingDays: null, elapsedWorkingDays: null }
          : paceUnavailable
            ? { state: 'UNAVAILABLE', reason: 'CALENDAR_HOURS_MISSING', workingDays: null, elapsedWorkingDays: null }
            : { state: 'READY', reason: null, workingDays: 21, elapsedWorkingDays: 15 },
    ...(!money && targetValue !== null ? { gapPercentagePoints: (actual - Number(targetValue)).toFixed(1) } : {}),
  };

  return {
    ...exec,
    ...(targetValue !== null ? { target: Number(targetValue) } : {}),
    governedTarget: { ...result },
    meta: { ...exec.meta, warnings: Array.from(new Set([...exec.meta.warnings, ...warnings])) },
  };
}

export interface FakePanelMetaSeed {
  availability?: NonNullable<WidgetExecution['meta']['availability']>;
  partialAccess?: boolean;
  warnings?: string[];
  /** Removes the numbers (a panel without a source permission, or an unavailable application). */
  clearData?: boolean;
}

/** Seeds meta.availability, meta.partialAccess and warnings on an execution (Trade warnings, partial access). */
export function applyFakePanelMeta(exec: WidgetExecution, seed: FakePanelMetaSeed): WidgetExecution {
  const cleared: Partial<WidgetExecution> = seed.clearData
    ? { value: null, series: [], rows: [], result: undefined }
    : {};
  return {
    ...exec,
    ...cleared,
    meta: {
      ...exec.meta,
      ...(seed.availability ? { availability: seed.availability } : {}),
      ...(seed.partialAccess ? { partialAccess: true } : {}),
      warnings: Array.from(new Set([...exec.meta.warnings, ...(seed.warnings ?? [])])),
    },
  };
}
