import { finiteNumber, record, timestamp } from "./dashboard-parse";

const REASONS = ["CLIPPED_MONTH", "FUTURE_MONTH", "OPEN_MONTH", "AGE_NOT_REACHED", "NO_ELIGIBLE_LEADS"] as const;
export type CohortMaturityReason = (typeof REASONS)[number];

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function cohortMaturityCell(meta: Record<string, unknown>) {
  const cell = record(meta.cohortMaturity);
  if (!cell) return null;
  const { numerator, denominator, reason, matureAt } = cell;
  if ((numerator !== null && !count(numerator)) || (denominator !== null && !count(denominator))
    || (numerator !== null && (denominator === null || numerator > denominator)) || !timestamp(matureAt)) return null;
  if (reason !== null && !REASONS.includes(reason as CohortMaturityReason)) return null;
  return { numerator, denominator, reason: reason as CohortMaturityReason | null, matureAt };
}

export function cohortMaturitySummary(details?: Record<string, unknown>) {
  const evidence = record(details?.cohortMaturity);
  const d30 = record(evidence?.d30);
  if (evidence?.populationBasis !== "LIVE_CURRENT_SCOPE" || !timestamp(evidence.asOf) || typeof evidence.timeZone !== "string" || !d30) return null;
  const { cohorts, numerator, denominator, rate } = d30;
  if (!count(cohorts) || !count(numerator) || !count(denominator) || numerator > denominator
    || (rate !== null && (!finiteNumber(rate) || rate < 0 || rate > 100))) return null;
  return { asOf: evidence.asOf, timeZone: evidence.timeZone, cohorts, numerator, denominator, rate };
}
