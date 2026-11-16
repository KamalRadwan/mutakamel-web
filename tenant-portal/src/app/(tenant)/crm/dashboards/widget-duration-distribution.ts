import { boundedArray, finiteNumber, nonEmptyString, record } from "./dashboard-parse";

export const DURATION_STATISTICS = ["min", "q1", "median", "q3", "p90", "max"] as const;
export type DurationStatistic = (typeof DURATION_STATISTICS)[number];

export interface DurationDistributionGroup extends Record<DurationStatistic, number | null> {
  key: string;
  label: string;
  sampleCount: number;
  excludedCount: number;
}

const count = (value: unknown): value is number => finiteNumber(value) && Number.isSafeInteger(value) && value >= 0;

export function parseDurationGroup(value: unknown): DurationDistributionGroup | null {
  const group = record(value);
  if (!group || typeof group.key !== "string" || !/^[A-Za-z0-9_.:-]{1,100}$/u.test(group.key)
    || !nonEmptyString(group.label) || group.label.length > 500 || !count(group.sampleCount) || !count(group.excludedCount)) return null;
  const statistics: Record<DurationStatistic, number | null> = { min: null, q1: null, median: null, q3: null, p90: null, max: null };
  let previous = 0;
  for (const key of DURATION_STATISTICS) {
    const current = group[key];
    if (!group.sampleCount && current === null) continue;
    if (!group.sampleCount || !finiteNumber(current) || current < previous
      || (group.sampleCount === 1 && key !== "min" && current !== previous)) return null;
    statistics[key] = current;
    previous = current;
  }
  return { key: group.key, label: group.label, sampleCount: group.sampleCount, excludedCount: group.excludedCount, ...statistics };
}

export function durationDistribution(value: unknown) {
  const result = record(value);
  if (!result || result.shape !== "DURATION_DISTRIBUTION" || result.unit !== "DURATION" || result.whiskerMethod !== "MIN_MAX"
    || !count(result.totalCount) || !count(result.excludedCount) || !boundedArray(result.groups, 500)) return null;
  const groups: DurationDistributionGroup[] = [];
  const keys = new Set<string>();
  for (const value of result.groups) {
    const group = parseDurationGroup(value);
    if (!group || keys.has(group.key)) return null;
    groups.push(group);
    keys.add(group.key);
  }
  if (groups.reduce((sum, group) => sum + group.sampleCount, 0) !== result.totalCount
    || groups.reduce((sum, group) => sum + group.excludedCount, 0) !== result.excludedCount) return null;
  return { groups, totalCount: result.totalCount, excludedCount: result.excludedCount };
}
