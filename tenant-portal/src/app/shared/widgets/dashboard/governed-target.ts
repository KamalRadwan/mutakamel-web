import { formatMoneyNumber } from '../../ui/money/money-format';
import type { GovernedTargetResult, WidgetExecution } from './analytics.model';

type Translate = (key: string, params?: Record<string, unknown>) => string;

/** States that carry no amounts: the hint shows their reason only. */
const REASON_ONLY_STATES = new Set<GovernedTargetResult['state']>([
  'TARGET_NOT_SET',
  'TARGET_UNAVAILABLE',
  'SOURCE_PERMISSION_REQUIRED',
  'SOURCE_NOT_READY',
  'FILTER_MISMATCH',
  'PERIOD_MISMATCH',
  'PERIOD_NOT_STARTED',
  'HISTORY_INCOMPLETE',
  'MONEY_DATA_INCOMPLETE',
  'TEAM_HISTORY_UNAVAILABLE',
]);

/** Sign of a decimal string read from its text, never by converting it to a number. */
function signedDecimal(value: string): string {
  const text = value.trim();
  if (text.startsWith('-') || text.startsWith('+')) return text;
  return /^0*(\.0*)?$/.test(text) ? text : `+${text}`;
}

/**
 * Hint parts for a governed target. Amounts are decimal strings and go through the shared money helper; a RATE
 * target shows the gap in percentage points and never a pace (elapsed pace NOT_PRORATED).
 */
export function governedTargetParts(exec: WidgetExecution | null | undefined, t: Translate): string[] {
  const gt = exec?.governedTarget as GovernedTargetResult | undefined;
  if (!gt) return [];
  const parts: string[] = [];

  if (REASON_ONLY_STATES.has(gt.state)) {
    const key = `analytics.reason.${gt.state}`;
    const text = t(key);
    parts.push(text === key ? t('analytics.reason.UNKNOWN') : text);
    return parts;
  }
  const amounts = gt.amounts;
  if (!amounts) return parts;

  if (gt.targetMeasure === 'RATE') {
    const target = formatMoneyNumber(amounts.targetValue);
    if (target !== null) parts.push(t('analytics.common.targetOf', { v: `${target}%` }));
    if (gt.gapPercentagePoints != null && gt.gapPercentagePoints.trim() !== '') {
      parts.push(t('analytics.common.gapPp', { v: signedDecimal(gt.gapPercentagePoints) }));
    }
    return parts;
  }

  const isMoney = gt.targetMeasure !== 'COUNT';
  const amount = (value: string | null | undefined): string | null => {
    const text = formatMoneyNumber(value);
    if (text === null) return null;
    return isMoney && gt.currencyCode ? `${gt.currencyCode} ${text}` : text;
  };

  const target = amount(amounts.targetValue);
  if (target !== null) parts.push(t('analytics.common.targetOf', { v: target }));
  const remaining = amount(amounts.remainingValue);
  if (remaining !== null) parts.push(t('analytics.common.remainingOf', { v: remaining }));
  if (gt.elapsedPace?.state === 'UNAVAILABLE') {
    parts.push(t(`analytics.reason.${gt.elapsedPace.reason ?? 'CALENDAR_HOURS_MISSING'}`));
  } else {
    const perDay = amount(gt.workingPace?.requiredPerWorkday);
    if (perDay !== null) parts.push(t('analytics.common.perWorkday', { v: perDay }));
  }
  return parts;
}
