import { boundedArray, finiteNumber, invalidResponse, nonEmptyString, record, stringArray } from "../dashboard-parse";
import { parseCohortReportContext, type BranchCohortFilters } from "./branch-cohort-report-contract";

export const CONVERSION_JOURNEY_REPORT_PATH = "/api/tenant/crm/v1/dashboards/lead-conversion-journey";
const durationDays = [0, 1, 3, 7, 14, 30, 60, 90];
const minutesPerDay = 24 * 60;
const fail = () => invalidResponse("lead conversion journey report");
const count = (value: unknown): value is number => finiteNumber(value) && Number.isSafeInteger(value) && value >= 0;

function parsePanel(value: unknown) {
  const panel = record(value);
  if (!panel || (panel.state !== "READY" && panel.state !== "EMPTY" && panel.state !== "UNAVAILABLE")
    || !stringArray(panel.warnings, 10) || (panel.state === "UNAVAILABLE" ? panel.data !== null : !record(panel.data))) return fail();
  return { state: panel.state, data: record(panel.data), warnings: panel.warnings, partialAccess: panel.partialAccess };
}

function parseDuration(value: unknown) {
  const { state, warnings, data } = parsePanel(value);
  const panel = { state, warnings, data };
  if (!panel.data) return { ...panel, data: null };
  const { median, p90, bins, conversionSample } = panel.data;
  const sample = record(conversionSample);
  if (!sample || !count(sample.validCount) || !count(sample.excludedCount) || (panel.state === "READY") !== (sample.validCount > 0)
    || !boundedArray(bins, durationDays.length) || bins.length !== durationDays.length) return fail();
  if (sample.validCount === 0 ? median !== null || p90 !== null
    : !finiteNumber(median) || !finiteNumber(p90) || median < 0 || p90 < median) return fail();

  const parsedBins = bins.map((value, order) => {
    const bin = record(value);
    const days = durationDays[order]!;
    const next = durationDays[order + 1];
    const lowerBound = days * minutesPerDay;
    const upperBound = next === undefined ? undefined : next * minutesPerDay;
    const kind = next === undefined ? "OVERFLOW" : "STANDARD";
    if (!bin || !nonEmptyString(bin.label) || bin.key !== `duration-${days}d` || bin.order !== order || bin.kind !== kind
      || bin.lowerBound !== lowerBound || bin.upperBound !== upperBound || !count(bin.count)) return fail();
    return { key: bin.key, label: bin.label, order, kind, lowerBound, upperBound, count: bin.count };
  });
  if (parsedBins.reduce((sum, bin) => sum + bin.count, 0) !== sample.validCount) return fail();
  return { ...panel, data: { median: median as number | null, p90: p90 as number | null, bins: parsedBins,
    validCount: sample.validCount, excludedCount: sample.excludedCount } };
}

function parseCohort(value: unknown, asOf: string) {
  const panel = parsePanel(value);
  if (typeof panel.partialAccess !== "boolean") return fail();
  const partialAccess = panel.partialAccess;
  if (!panel.data) return { ...panel, partialAccess, data: null };
  const { created, converted, won, withoutReadableWin, rate, invalidIntervals, outcomeBasis } = panel.data;
  if (!count(created) || !count(converted) || !count(won) || !count(withoutReadableWin) || !count(invalidIntervals)
    || converted + invalidIntervals > created || won + withoutReadableWin !== converted || panel.data.asOf !== asOf
    || outcomeBasis !== "CURRENT_WON" || (panel.state === "READY") !== (created > 0)) return fail();
  const expectedRate = converted ? Math.round(10_000 * won / converted) / 100 : null;
  if (rate !== expectedRate) return fail();
  return { ...panel, partialAccess, data: { created, converted, won, withoutReadableWin, rate: expectedRate, invalidIntervals } };
}

export function parseConversionJourneyReport(value: unknown, filters: BranchCohortFilters) {
  const { root, context } = parseCohortReportContext(value, filters, fail);
  const duration = parseDuration(root.duration);
  const cohort = parseCohort(root.cohort, context.asOf);
  if ((duration.state === "UNAVAILABLE") !== (context.branches.length === 0)
    || (duration.state === "UNAVAILABLE" && cohort.state !== "UNAVAILABLE")) return fail();
  return { ...context, duration, cohort };
}

export type ConversionJourneyReport = ReturnType<typeof parseConversionJourneyReport>;
