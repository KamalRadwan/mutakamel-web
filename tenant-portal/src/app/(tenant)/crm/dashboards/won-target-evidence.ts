import { isUUIDv7 } from "@/lib/uuid";
import { boundedArray, invalidResponse, nonEmptyString, record, timestamp } from "./dashboard-parse";

export const TARGET_GRAINS = ["MONTH", "QUARTER", "YEAR"] as const;
export const TARGET_SUBJECTS = ["USER", "TEAM", "BRANCH"] as const;
export const TARGET_PERIOD_STATES = ["OPEN", "CLOSED", "FUTURE"] as const;
export const TARGET_ACTUAL_STATES = ["READY", "SOURCE_PERMISSION_REQUIRED", "HISTORY_INCOMPLETE", "MONEY_DATA_INCOMPLETE",
  "TEAM_HISTORY_UNAVAILABLE", "PERIOD_NOT_STARTED"] as const;
const NO_TARGET_STATES = ["TARGET_UNAVAILABLE", "FILTER_MISMATCH", "PERIOD_MISMATCH"] as const;
const TARGET_MEASURES = ["ATTAINMENT", "DAILY_PACE", "TRAJECTORY"] as const;
const GRAIN_MONTHS = { MONTH: 1, QUARTER: 3, YEAR: 12 } as const;
const ZERO = BigInt(0);

export interface GovernedTargetBinding {
  branchId: string;
  subjectType: typeof TARGET_SUBJECTS[number];
  subjectId: string;
  currencyCode: string;
  periodGrain: typeof TARGET_GRAINS[number];
}

const has = <Value extends string>(values: readonly Value[], value: unknown): value is Value => values.some(item => item === value);
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const money = (value: unknown): value is string => typeof value === "string" && /^\d{1,30}\.\d{2,3}$/u.test(value);
const currency = (value: unknown): value is string => typeof value === "string" && /^[A-Z]{3}$/u.test(value);

export function isGovernedTargetBinding(value: unknown): value is GovernedTargetBinding {
  const item = record(value);
  return !!item && isUUIDv7(item.branchId) && isUUIDv7(item.subjectId) && currency(item.currencyCode)
    && has(TARGET_SUBJECTS, item.subjectType) && has(TARGET_GRAINS, item.periodGrain)
    && (item.subjectType !== "BRANCH" || item.branchId.toLowerCase() === item.subjectId.toLowerCase())
    && Object.keys(item).every(key => ["branchId", "subjectId", "subjectType", "periodGrain", "currencyCode"].includes(key));
}

export function alignedTargetPeriod(value: unknown, grain: GovernedTargetBinding["periodGrain"]): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-01$/u.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && (month - 1) % GRAIN_MONTHS[grain] === 0;
}

export function expectedTargetPeriodEnd(start: string, grain: GovernedTargetBinding["periodGrain"]) {
  return new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1 + GRAIN_MONTHS[grain], 1)).toISOString().slice(0, 10);
}

/** Convert validated decimal evidence to native milliunits without a float round-trip. */
export function targetMilliunits(value: string): bigint {
  const [whole, fraction] = value.split(".");
  return BigInt(whole!) * BigInt(1000) + BigInt(fraction!.padEnd(3, "0"));
}

export function parseWonTargetAmounts(item: Record<string, unknown>) {
  const fail = () => invalidResponse("won target amounts");
  const { targetValue, actualValue, remainingValue, attainmentPercent, excludedCount } = item;
  if (!money(targetValue) || targetMilliunits(targetValue) <= ZERO) return fail();
  if (actualValue === null) {
    if (remainingValue !== null || attainmentPercent !== null || (excludedCount !== null && !count(excludedCount))) return fail();
    return { targetValue, actualValue, remainingValue, attainmentPercent, excludedCount };
  }
  if (!money(actualValue) || !money(remainingValue) || !money(attainmentPercent) || !count(excludedCount)) return fail();
  const target = targetMilliunits(targetValue);
  const actual = targetMilliunits(actualValue);
  const percent = (actual * BigInt(20_000) + target) / (BigInt(2) * target);
  if (targetMilliunits(remainingValue) !== (actual >= target ? ZERO : target - actual)
    || targetMilliunits(attainmentPercent) !== percent * BigInt(10)) return fail();
  return { targetValue, actualValue, remainingValue, attainmentPercent, excludedCount };
}

export function parseWorkingPace(value: unknown, periodState: typeof TARGET_PERIOD_STATES[number], remainingValue: string | null) {
  const fail = () => invalidResponse("target working pace");
  const item = record(value);
  if (!item) return fail();
  const { calendarRevision, remainingWorkdays, requiredPerWorkday } = item;
  const hasCalendar = periodState === "OPEN" && calendarRevision !== null;
  if (hasCalendar ? !count(calendarRevision) || calendarRevision < 1 || !count(remainingWorkdays) || remainingWorkdays > 366
    : calendarRevision !== null || remainingWorkdays !== (periodState === "CLOSED" ? 0 : null)) return fail();
  const state = periodState === "CLOSED" ? "PERIOD_CLOSED" : periodState === "FUTURE" ? "PERIOD_NOT_STARTED"
    : !hasCalendar ? "CALENDAR_UNAVAILABLE" : remainingWorkdays === 0 ? "NO_REMAINING_WORKDAYS"
      : remainingValue === null ? "ACTUAL_UNAVAILABLE" : "READY";
  if (item.state !== state) return fail();
  if (state === "READY") {
    if (typeof requiredPerWorkday !== "string" || !/^\d{1,30}\.\d{3}$/u.test(requiredPerWorkday)) return fail();
    const days = BigInt(remainingWorkdays as number);
    if (targetMilliunits(requiredPerWorkday) !== (targetMilliunits(remainingValue!) + days - BigInt(1)) / days) return fail();
  } else if (requiredPerWorkday !== null) return fail();
  return { state, calendarRevision: calendarRevision as number | null, remainingWorkdays: remainingWorkdays as number | null,
    requiredPerWorkday: requiredPerWorkday as string | null } as const;
}

const trajectoryMoney = (value: unknown): value is string => typeof value === "string" && /^\d{1,30}\.\d{3}$/u.test(value);

function nextCivilDay(date: string): string {
  return new Date(Date.parse(date) + 86_400_000).toISOString().slice(0, 10);
}

export function parseWonTargetTrajectoryPoints(value: unknown, amounts: Pick<ReturnType<typeof parseWonTargetAmounts>, "actualValue" | "targetValue">,
  pace: ReturnType<typeof parseWorkingPace>, asOf: string,
  period: { start: string; endExclusive: string; timeZone: string; state: typeof TARGET_PERIOD_STATES[number] }) {
  const fail = () => invalidResponse("won target trajectory");
  if (!boundedArray(value, 366)) return fail();
  if (amounts.actualValue === null) return value.length ? fail() : [];
  let today: string;
  try {
    const parts = new Intl.DateTimeFormat("en", { timeZone: period.timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date(asOf));
    today = ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("-");
  } catch { return fail(); }
  if (period.state === "FUTURE" || today < period.start || (period.state === "CLOSED") !== (today >= period.endExclusive)) return fail();
  const actual = targetMilliunits(amounts.actualValue);
  const goal = targetMilliunits(amounts.targetValue);
  const planEnd = actual > goal ? actual : goal;
  const rate = pace.requiredPerWorkday;
  const perWorkday = rate === null ? null : targetMilliunits(rate);
  let date = period.start;
  let observed = ZERO;
  let planned = actual;
  let workdays = 0;
  const points = value.map(value => {
    const point = record(value);
    if (!point || point.date !== date || date >= period.endExclusive || typeof point.isPlannedWorkday !== "boolean") return fail();
    const { wonValue, observedCumulative, plannedCumulative, isPlannedWorkday } = point;
    const hasActual = period.state === "CLOSED" || date <= today;
    const hasPlan = perWorkday !== null && date >= today;
    if (hasActual) {
      if (!trajectoryMoney(wonValue) || !trajectoryMoney(observedCumulative)) return fail();
      observed += targetMilliunits(wonValue);
      if (targetMilliunits(observedCumulative) !== observed) return fail();
    } else if (wonValue !== null || observedCumulative !== null) return fail();
    if (isPlannedWorkday) {
      if (hasActual || perWorkday === null) return fail();
      workdays += 1;
      planned += perWorkday;
      if (planned > planEnd) planned = planEnd;
    }
    if (hasPlan ? !trajectoryMoney(plannedCumulative) || targetMilliunits(plannedCumulative) !== planned : plannedCumulative !== null) return fail();
    const result = { date, wonValue: wonValue as string | null, observedCumulative: observedCumulative as string | null,
      plannedCumulative: plannedCumulative as string | null, isPlannedWorkday };
    date = nextCivilDay(date);
    return result;
  });
  const expectedEnd = perWorkday !== null || period.state === "CLOSED" ? period.endExclusive : nextCivilDay(today);
  if (!points.length || date !== expectedEnd || observed !== actual
    || (perWorkday !== null && (workdays !== pace.remainingWorkdays || planned !== planEnd))) return fail();
  return points;
}

export type WonTargetTrajectoryPoints = ReturnType<typeof parseWonTargetTrajectoryPoints>;

export function parseGovernedTargetEvidence(value: unknown, asOf?: unknown) {
  const fail = () => invalidResponse("governed target widget evidence");
  const item = record(value);
  if (!item || item.basis !== "RECORDED_WON_EVENT" || !currency(item.currencyCode)) return fail();
  const { state, currencyCode, basis, measure, periodStart, periodEndExclusive, periodState, coverageStartedAt, revision } = item;
  if (!has(TARGET_MEASURES, measure)) return fail();
  if (measure === "TRAJECTORY" ? !timestamp(asOf) : item.trajectory !== undefined) return fail();
  if (!has(TARGET_ACTUAL_STATES, state) && !has(NO_TARGET_STATES, state)) return fail();
  if (state === "FILTER_MISMATCH" || state === "PERIOD_MISMATCH") {
    if (periodStart !== null || periodEndExclusive !== null) return fail();
  } else if (!TARGET_GRAINS.some(grain => alignedTargetPeriod(periodStart, grain) && expectedTargetPeriodEnd(periodStart, grain) === periodEndExclusive)) {
    return fail();
  }
  const common = { state, basis, measure, currencyCode, periodStart: periodStart as string | null, periodEndExclusive: periodEndExclusive as string | null };
  if (has(NO_TARGET_STATES, state)) {
    if (item.amounts !== null || item.workingPace !== null || periodState !== null || coverageStartedAt !== null || revision !== null
      || (measure === "TRAJECTORY" && item.trajectory !== null)) return fail();
    return { ...common, amounts: null, workingPace: null, trajectory: null, periodState, coverageStartedAt, revision };
  }
  const raw = record(item.amounts);
  if (!raw || !timestamp(coverageStartedAt) || !count(revision) || revision < 1 || !has(TARGET_PERIOD_STATES, periodState)
    || (state === "PERIOD_NOT_STARTED") !== (periodState === "FUTURE") || (measure === "ATTAINMENT" && item.workingPace !== null)) return fail();
  const amounts = parseWonTargetAmounts(raw);
  if (state === "READY" ? amounts.actualValue === null || amounts.excludedCount !== 0
    : amounts.actualValue !== null || (state === "MONEY_DATA_INCOMPLETE" ? !amounts.excludedCount : amounts.excludedCount !== null)) return fail();
  const workingPace = measure !== "ATTAINMENT" ? parseWorkingPace(item.workingPace, periodState, amounts.remainingValue) : null;
  let trajectory: { timeZone: string; points: WonTargetTrajectoryPoints } | null = null;
  if (measure === "TRAJECTORY") {
    if (state === "READY") {
      const evidence = record(item.trajectory);
      if (!evidence || !nonEmptyString(evidence.timeZone) || typeof periodStart !== "string"
        || typeof periodEndExclusive !== "string" || !workingPace || !timestamp(asOf)) return fail();
      const points = parseWonTargetTrajectoryPoints(evidence.points, amounts, workingPace, asOf,
        { start: periodStart, endExclusive: periodEndExclusive, timeZone: evidence.timeZone, state: periodState });
      trajectory = { timeZone: evidence.timeZone, points };
    } else if (item.trajectory !== null) return fail();
  }
  return { ...common, amounts, workingPace, trajectory, periodState, coverageStartedAt, revision };
}

export type GovernedTargetEvidence = ReturnType<typeof parseGovernedTargetEvidence>;
