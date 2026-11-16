import { isUUIDv7 } from "@/lib/uuid";
import { boundedArray, invalidResponse, nonEmptyString, record, timestamp } from "../dashboard-parse";
import { parseReportOrganizationScope } from "./branch-cohort-report-contract";
import { alignedTargetPeriod, expectedTargetPeriodEnd, parseWonTargetAmounts, parseWonTargetTrajectoryPoints, parseWorkingPace, TARGET_ACTUAL_STATES, TARGET_GRAINS,
  TARGET_PERIOD_STATES, TARGET_SUBJECTS, targetMilliunits } from "../won-target-evidence";

export { TARGET_GRAINS, TARGET_SUBJECTS, alignedTargetPeriod, targetMilliunits } from "../won-target-evidence";
const OPEN_PACE = ["CALENDAR_UNAVAILABLE", "BRANCH_CALENDAR"] as const;
const CLOSED_PACE = { CLOSED: "PERIOD_CLOSED", FUTURE: "PERIOD_NOT_STARTED" } as const;
const REPORT_PATH = "/api/tenant/crm/v1/dashboards/won-target-attainment";
const ZERO = BigInt(0);

export interface WonTargetFilters {
  periodGrain: typeof TARGET_GRAINS[number];
  periodStart: string;
  companyId: string | null;
  branchId: string | null;
  subjectType: typeof TARGET_SUBJECTS[number] | null;
  subjectId: string | null;
  trajectoryTargetId?: string;
}

export const WON_TARGET_DEFAULT_FILTERS: WonTargetFilters = {
  periodGrain: "MONTH", periodStart: "", companyId: null, branchId: null, subjectType: null, subjectId: null,
};

export function wonTargetQuery(filters: WonTargetFilters) {
  const params = new URLSearchParams({ periodGrain: filters.periodGrain });
  for (const key of ["periodStart", "companyId", "branchId", "subjectType", "subjectId", "trajectoryTargetId"] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  return `${REPORT_PATH}?${params}`;
}

const fail = () => invalidResponse("won target attainment report");
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const has = <Value extends string>(values: readonly Value[], value: unknown): value is Value => values.some(item => item === value);
const currency = (value: unknown): value is string => typeof value === "string" && /^[A-Z]{3}$/u.test(value);
function parseTrajectory(value: unknown, targetId: string | undefined, rows: TrajectoryTarget[], asOf: string,
  period: { start: string; endExclusive: string; timeZone: string; state: typeof TARGET_PERIOD_STATES[number] }) {
  const target = rows.find(row => row.id === targetId);
  if (!target) return value === null ? null : fail();
  const item = record(value);
  if (!item || item.targetId !== target.id) return fail();
  const points = parseWonTargetTrajectoryPoints(item.points, target, target.workingPace, asOf, period);
  return { targetId: target.id, points };
}

type TrajectoryTarget = Pick<ReturnType<typeof parseWonTargetAmounts>, "actualValue" | "targetValue">
  & { id: string; workingPace: ReturnType<typeof parseWorkingPace> };

export function parseWonTargetReport(value: unknown, filters: WonTargetFilters) {
  const root = record(value);
  const period = record(root?.period);
  if (!root || !timestamp(root.asOf) || root.basis !== "RECORDED_WON_EVENT" || !period || period.grain !== filters.periodGrain
    || !alignedTargetPeriod(period.start, filters.periodGrain) || (filters.periodStart && period.start !== filters.periodStart)
    || period.endExclusive !== expectedTargetPeriodEnd(period.start, filters.periodGrain) || !nonEmptyString(period.timeZone)
    || !has(TARGET_PERIOD_STATES, period.state) || !has(TARGET_SUBJECTS, root.subjectType)
    || (filters.subjectType && root.subjectType !== filters.subjectType) || root.subjectId !== (filters.subjectId?.toLowerCase() ?? null)
    || !boundedArray(root.rows, 200) || !boundedArray(root.currencies, 200)
    || (root.coverageStartedAt !== null && !timestamp(root.coverageStartedAt))) return fail();
  try { new Intl.DateTimeFormat("en", { timeZone: period.timeZone }); } catch { return fail(); }
  const { companies, branches, partialAccess, branchById, companyId, branchId } = parseReportOrganizationScope(root.scope, filters, fail);
  const { subjectType, asOf, coverageStartedAt } = root;
  const periodState = period.state;
  const pace = root.pace;
  if (period.state === "OPEN" ? !has(OPEN_PACE, pace) : pace !== CLOSED_PACE[period.state]) return fail();
  if ((root.rows.length === 0) !== (coverageStartedAt === null) || (coverageStartedAt && Date.parse(coverageStartedAt) > Date.parse(asOf))) return fail();
  const rows = root.rows.map(value => {
    const item = record(value);
    if (!item || !isUUIDv7(item.id) || !isUUIDv7(item.branchId) || !isUUIDv7(item.subjectId) || !currency(item.currencyCode)
      || (item.subjectName !== null && !nonEmptyString(item.subjectName)) || !count(item.revision) || item.revision < 1
      || !has(TARGET_ACTUAL_STATES, item.state) || (root.subjectId && item.subjectId !== root.subjectId)
      || (subjectType === "BRANCH" && item.subjectId !== item.branchId)) return fail();
    const branch = branchById.get(item.branchId);
    if (!branch || (branchId && branch.id !== branchId) || (companyId && branch.companyId !== companyId)) return fail();
    const amounts = parseWonTargetAmounts(item);
    if ((item.state === "READY") !== (amounts.actualValue !== null)
      || (item.state === "READY" && (amounts.excludedCount !== 0 || subjectType === "TEAM"))
      || (item.state === "MONEY_DATA_INCOMPLETE" && !amounts.excludedCount)
      || (item.state !== "READY" && item.state !== "MONEY_DATA_INCOMPLETE" && amounts.excludedCount !== null)
      || (item.state === "TEAM_HISTORY_UNAVAILABLE" && subjectType !== "TEAM")
      || (item.state === "PERIOD_NOT_STARTED") !== (period.state === "FUTURE")) return fail();
    const workingPace = parseWorkingPace(item.workingPace, periodState, amounts.remainingValue);
    return { id: item.id, branch, subjectId: item.subjectId, subjectName: item.subjectName, currencyCode: item.currencyCode,
      revision: item.revision, state: item.state, workingPace, ...amounts };
  });
  if (new Set(rows.map(row => row.id)).size !== rows.length
    || new Set(rows.map(row => `${row.branch.id}:${row.subjectId}`)).size !== rows.length) return fail();
  const calendarByBranch = new Map<string, string>();
  for (const row of rows) {
    const evidence = `${row.workingPace.calendarRevision}:${row.workingPace.remainingWorkdays}`;
    if (calendarByBranch.has(row.branch.id) && calendarByBranch.get(row.branch.id) !== evidence) return fail();
    calendarByBranch.set(row.branch.id, evidence);
  }
  if ((pace === "BRANCH_CALENDAR") !== rows.some(row => row.workingPace.calendarRevision !== null)) return fail();
  const ready = rows.filter(row => row.state === "READY").length;
  const state = !rows.length ? "EMPTY" : ready === rows.length ? "READY" : ready ? "PARTIAL" : "UNAVAILABLE";
  if (root.state !== state) return fail();
  const byCurrency = new Map<string, typeof rows>();
  for (const row of rows) {
    const group = byCurrency.get(row.currencyCode) ?? [];
    group.push(row);
    byCurrency.set(row.currencyCode, group);
  }
  if (root.currencies.length !== (subjectType === "TEAM" ? 0 : byCurrency.size)) return fail();
  const currencies = root.currencies.map(value => {
    const item = record(value);
    if (!item || !currency(item.currencyCode)) return fail();
    const group = byCurrency.get(item.currencyCode);
    if (!group || item.targetCount !== group.length) return fail();
    const amounts = parseWonTargetAmounts(item);
    const complete = group.every(row => row.actualValue !== null);
    if (targetMilliunits(amounts.targetValue) !== group.reduce((total, row) => total + targetMilliunits(row.targetValue), ZERO)
      || (complete !== (amounts.actualValue !== null))
      || (amounts.actualValue !== null && targetMilliunits(amounts.actualValue) !== group.reduce((sum, row) => sum + targetMilliunits(row.actualValue!), ZERO))
      || amounts.excludedCount !== (complete ? 0 : null)) return fail();
    byCurrency.delete(item.currencyCode);
    return { currencyCode: item.currencyCode, targetCount: group.length, ...amounts };
  });
  const parsedPeriod = { grain: filters.periodGrain, start: period.start, endExclusive: period.endExclusive as string, timeZone: period.timeZone, state: period.state };
  const trajectory = parseTrajectory(root.trajectory, filters.trajectoryTargetId?.toLowerCase(), rows, asOf, parsedPeriod);
  return { asOf, coverageStartedAt, companies, branches, partialAccess, subjectType, subjectId: filters.subjectId, trajectory,
    pace: pace as typeof OPEN_PACE[number] | typeof CLOSED_PACE[keyof typeof CLOSED_PACE], state, rows, currencies,
    period: parsedPeriod };
}

export type WonTargetReport = ReturnType<typeof parseWonTargetReport>;
